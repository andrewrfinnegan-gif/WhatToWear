/**
 * Receipt parsing engine — the heart of purchase integration.
 *
 * Turns a raw order-confirmation email into structured clothing line items.
 * Strategy, most-reliable first:
 *   1. JSON-LD (schema.org Order/Invoice/Product) embedded in the HTML — many
 *      retailers (Shopify and others) include this; it's the cleanest signal.
 *   2. Text/regex fallback — pair product-ish lines with nearby prices.
 * Results are filtered to apparel and de-noised (drop shipping/tax/totals).
 *
 * The same engine powers every ingestion path: manual paste, inbound-email
 * webhook, and the Gmail connector.
 */

export interface RawEmail {
  from: string;
  subject: string;
  text?: string;
  html?: string;
  receivedAt?: number;
}

export interface ParsedLineItem {
  title: string;
  brand?: string;
  price?: number;
  quantity?: number;
  imageUri?: string;
}

export interface ParsedReceipt {
  retailer?: string;
  orderId?: string;
  currency: string;
  purchasedAt: number;
  items: ParsedLineItem[];
}

// --- Retailer registry: map sender domains to a friendly name / default brand.
const RETAILERS: { domain: RegExp; name: string; apparelOnly: boolean }[] = [
  { domain: /uniqlo\./i, name: 'Uniqlo', apparelOnly: true },
  { domain: /bonobos\./i, name: 'Bonobos', apparelOnly: true },
  { domain: /jcrew\./i, name: 'J.Crew', apparelOnly: true },
  { domain: /nike\./i, name: 'Nike', apparelOnly: true },
  { domain: /adidas\./i, name: 'Adidas', apparelOnly: true },
  { domain: /zara\./i, name: 'Zara', apparelOnly: true },
  { domain: /hm\.com|h&m/i, name: 'H&M', apparelOnly: true },
  { domain: /everlane\./i, name: 'Everlane', apparelOnly: true },
  { domain: /lululemon\./i, name: 'Lululemon', apparelOnly: true },
  { domain: /gap\.com|oldnavy\./i, name: 'Gap', apparelOnly: true },
  { domain: /nordstrom\./i, name: 'Nordstrom', apparelOnly: false },
  { domain: /ssense\./i, name: 'SSENSE', apparelOnly: true },
  { domain: /thursdayboot/i, name: 'Thursday Boot Co.', apparelOnly: true },
  { domain: /amazon\./i, name: 'Amazon', apparelOnly: false },
];

// Words that indicate apparel/footwear/accessories.
const APPAREL_RE =
  /\b(shirt|tee|t-?shirt|polo|blouse|top|tank|sweater|jumper|knit|hoodie|cardigan|sweatshirt|jacket|blazer|bomber|coat|parka|overcoat|vest|dress|gown|skirt|pant|pants|trouser|trousers|chino|chinos|jean|jeans|short|shorts|legging|leggings|suit|boot|boots|sneaker|sneakers|shoe|shoes|loafer|heel|heels|sandal|sandals|trainer|trainers|sock|socks|belt|scarf|hat|cap|beanie|tie|glove|gloves|jumpsuit|romper|hoody|pullover|joggers|sweatpants|underwear|boxer|bra|swimsuit|bikini|trunks)\b/i;

// Non-item lines to ignore.
const NOISE_RE =
  /\b(subtotal|total|shipping|tax|vat|discount|promo|gift\s?card|order\s?summary|estimated|delivery|free|balance|refund|store\s?credit|reward|points|tip)\b/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|tr|table|li|h[1-6]|br)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Pull and parse all <script type="application/ld+json"> blocks. */
export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(decodeEntities(m[1].trim())));
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return blocks;
}

function currencyFromSymbol(text: string): string {
  if (/£/.test(text)) return 'GBP';
  if (/€/.test(text)) return 'EUR';
  if (/¥/.test(text)) return 'JPY';
  return 'USD';
}

function priceToNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** Recursively collect schema.org objects whose @type matches a predicate. */
function collectTyped(node: unknown, match: (t: string) => boolean, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    for (const n of node) collectTyped(n, match, out);
    return;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const types = asArray(obj['@type']).map((t) => String(t).toLowerCase());
    if (types.some((t) => match(t))) out.push(obj);
    for (const key of Object.keys(obj)) collectTyped(obj[key], match, out);
  }
}

function lineItemFromOffer(offer: Record<string, unknown>, fallbackBrand?: string): ParsedLineItem | null {
  // An Offer may wrap the product in itemOffered, or be a product-ish node itself.
  const product = (offer.itemOffered ?? offer.orderedItem ?? offer) as Record<string, unknown>;
  const name = (product.name ?? offer.name) as string | undefined;
  if (!name || typeof name !== 'string') return null;
  const brandNode = product.brand as Record<string, unknown> | string | undefined;
  const brand =
    typeof brandNode === 'string'
      ? brandNode
      : brandNode && typeof brandNode === 'object'
        ? (brandNode.name as string | undefined)
        : fallbackBrand;
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  const price = priceToNumber(offer.price ?? (offer.priceSpecification as Record<string, unknown>)?.price);
  const qty = priceToNumber(offer.eligibleQuantity ?? offer.orderQuantity ?? offer.quantity);
  return {
    title: name.trim(),
    brand: brand?.trim(),
    price,
    quantity: qty && qty > 0 ? Math.round(qty) : undefined,
    imageUri: typeof image === 'string' ? image : undefined,
  };
}

function parseFromJsonLd(html: string, fallbackBrand?: string): { items: ParsedLineItem[]; currency?: string; orderId?: string } | null {
  const blocks = extractJsonLd(html);
  if (blocks.length === 0) return null;

  const orders: Record<string, unknown>[] = [];
  collectTyped(blocks, (t) => t === 'order' || t === 'invoice', orders);

  const items: ParsedLineItem[] = [];
  let currency: string | undefined;
  let orderId: string | undefined;

  if (orders.length > 0) {
    for (const order of orders) {
      orderId = orderId ?? (order.orderNumber as string | undefined) ?? (order.confirmationNumber as string | undefined);
      currency = currency ?? (order.priceCurrency as string | undefined);
      const offers = [
        ...asArray(order.acceptedOffer as unknown),
        ...asArray(order.orderedItem as unknown),
      ] as Record<string, unknown>[];
      for (const offer of offers) {
        const li = lineItemFromOffer(offer, fallbackBrand);
        if (li) items.push(li);
      }
    }
  }

  // Fall back to standalone Product nodes if no Order structure was found.
  if (items.length === 0) {
    const products: Record<string, unknown>[] = [];
    collectTyped(blocks, (t) => t === 'product', products);
    for (const p of products) {
      const li = lineItemFromOffer(p, fallbackBrand);
      if (li) items.push(li);
    }
  }

  if (items.length === 0) return null;
  return { items, currency, orderId };
}

/**
 * Best-effort text fallback: pair product-ish lines with nearby prices.
 * When `lenient` (a known apparel-only retailer), accept any priced, non-noise
 * line instead of requiring an apparel keyword — so "Cashmere Crew" still counts.
 */
function parseFromText(text: string, fallbackBrand: string | undefined, lenient: boolean): ParsedLineItem[] {
  const priceRe = /(?:\$|£|€|USD|GBP|EUR)\s?(\d{1,4}(?:[.,]\d{2}))/i;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ParsedLineItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (NOISE_RE.test(line)) continue;

    // Lenient (apparel retailer): the price must be on the same line — a clean
    // product-line signal that avoids grabbing headers. Otherwise the apparel
    // keyword is the signal and a price may sit on the following line.
    const priceMatch = lenient ? line.match(priceRe) : line.match(priceRe) ?? lines[i + 1]?.match(priceRe);
    if (lenient) {
      if (!priceMatch) continue;
    } else if (!APPAREL_RE.test(line)) {
      continue;
    }

    const title = line.replace(priceRe, '').replace(/\s{2,}/g, ' ').replace(/[.•\-–·|]+$/, '').trim();
    if (title.length < 3) continue;

    items.push({
      title,
      brand: fallbackBrand,
      price: priceMatch ? Number(priceMatch[1].replace(',', '.')) : undefined,
    });
  }
  // De-dupe identical titles.
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = it.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function senderDomain(from: string): string {
  const m = from.match(/@([^>\s]+)/);
  return (m ? m[1] : from).toLowerCase();
}

function looksLikeOrderEmail(subject: string, body: string): boolean {
  return /\b(order|receipt|purchase|confirmation|invoice|shipped|your\s+order)\b/i.test(
    `${subject} ${body.slice(0, 400)}`,
  );
}

/**
 * Parse a raw email into a clothing receipt, or return null if it isn't a
 * recognizable clothing order.
 */
export function parseReceipt(raw: RawEmail): ParsedReceipt | null {
  const domain = senderDomain(raw.from);
  const retailer = RETAILERS.find((r) => r.domain.test(domain) || r.domain.test(raw.from));
  const html = raw.html ?? '';
  const text = raw.text ?? (html ? htmlToText(html) : '');

  if (!looksLikeOrderEmail(raw.subject, text)) return null;

  const fallbackBrand = retailer?.name;
  let items: ParsedLineItem[] = [];
  let currency: string | undefined;
  let orderId: string | undefined;

  const fromJsonLd = html ? parseFromJsonLd(html, fallbackBrand) : null;
  if (fromJsonLd) {
    items = fromJsonLd.items;
    currency = fromJsonLd.currency;
    orderId = fromJsonLd.orderId;
  }
  // Keep apparel only; from non-apparel retailers (Amazon) this is essential.
  const apparelOnly = retailer?.apparelOnly ?? false;

  if (items.length === 0) {
    items = parseFromText(text, fallbackBrand, apparelOnly);
  }

  items = items
    .filter((it) => !NOISE_RE.test(it.title))
    .filter((it) => apparelOnly || APPAREL_RE.test(it.title));

  if (items.length === 0) return null;

  return {
    retailer: retailer?.name,
    orderId,
    currency: currency ?? currencyFromSymbol(text),
    purchasedAt: raw.receivedAt ?? Date.now(),
    items,
  };
}
