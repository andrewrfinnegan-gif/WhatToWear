/**
 * Shared foundation for the receipt-extractor registry.
 *
 * Defines the Extractor contract, the parsed types, retailer registry, and the
 * common helpers (HTML→text, JSON-LD, apparel/noise classification, currency)
 * that both the generic and per-retailer extractors reuse. `finalizeReceipt`
 * applies the uniform post-processing (apparel filtering, de-dupe, brand/
 * currency fallback) so each extractor only has to produce raw line items.
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
  /** Optional color/size, e.g. "Navy / M". Folded into the title for display. */
  variant?: string;
  /** Extractor-asserted apparel signal (e.g. a size variant) — bypasses the
   *  keyword apparel filter for retailers whose product names lack keywords. */
  apparelHint?: boolean;
}

export interface ParsedReceipt {
  retailer?: string;
  orderId?: string;
  currency: string;
  purchasedAt: number;
  items: ParsedLineItem[];
  /** id of the extractor that produced this receipt (for debugging/metrics). */
  extractor?: string;
}

/** Precomputed view of an email, passed to every extractor. */
export interface EmailContext {
  raw: RawEmail;
  from: string;
  domain: string;
  subject: string;
  html: string;
  text: string;
}

/** What an extractor returns before uniform finalization. */
export interface ExtractResult {
  items: ParsedLineItem[];
  retailer?: string;
  currency?: string;
  orderId?: string;
}

export interface Extractor {
  id: string;
  /** Cheap check: should this extractor attempt the email? */
  matches(ctx: EmailContext): boolean;
  /** Produce raw line items, or null if it can't handle this email. */
  extract(ctx: EmailContext): ExtractResult | null;
}

// --- Retailer registry: sender domain -> friendly name / apparel-only flag.
export const RETAILERS: { domain: RegExp; name: string; apparelOnly: boolean }[] = [
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
  { domain: /asos\./i, name: 'ASOS', apparelOnly: true },
  { domain: /nordstrom\./i, name: 'Nordstrom', apparelOnly: false },
  { domain: /ssense\./i, name: 'SSENSE', apparelOnly: true },
  { domain: /thursdayboot/i, name: 'Thursday Boot Co.', apparelOnly: true },
  { domain: /amazon\./i, name: 'Amazon', apparelOnly: false },
];

export function lookupRetailer(ctx: EmailContext): { name: string; apparelOnly: boolean } | undefined {
  return RETAILERS.find((r) => r.domain.test(ctx.domain) || r.domain.test(ctx.from));
}

export const APPAREL_RE =
  /\b(shirt|tee|t-?shirt|polo|blouse|top|tank|sweater|jumper|knit|hoodie|hoody|cardigan|sweatshirt|pullover|fleece|jacket|blazer|bomber|coat|parka|overcoat|vest|dress|gown|skirt|pant|pants|trouser|trousers|chino|chinos|jean|jeans|short|shorts|legging|leggings|jogger|joggers|sweatpants|suit|boot|boots|sneaker|sneakers|shoe|shoes|loafer|heel|heels|sandal|sandals|trainer|trainers|sock|socks|belt|scarf|hat|cap|beanie|tie|glove|gloves|jumpsuit|romper|underwear|boxer|bra|swimsuit|bikini|trunks)\b/i;

export const NOISE_RE =
  /\b(subtotal|total|shipping|tax|vat|duties|discount|promo|gift\s?card|order\s?summary|estimated|delivery|free|balance|refund|store\s?credit|reward|points|tip|handling)\b/i;

const SIZE_RE = /\b(xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,2}(?:\.\d)?(?:w|l)?)\b|size/i;

export function decodeEntities(s: string): string {
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

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
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

export function currencyFromSymbol(text: string): string {
  if (/£/.test(text)) return 'GBP';
  if (/€/.test(text)) return 'EUR';
  if (/¥/.test(text)) return 'JPY';
  return 'USD';
}

export function priceToNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** First currency-prefixed price found in a string. */
export function findPrice(s: string): number | undefined {
  const m = s.match(/(?:\$|£|€|USD|GBP|EUR)\s?(\d{1,4}(?:[.,]\d{2}))/i);
  return m ? Number(m[1].replace(',', '.')) : undefined;
}

export function looksLikeSize(variant: string | undefined): boolean {
  if (!variant) return false;
  return SIZE_RE.test(variant) || variant.includes('/');
}

export function senderDomain(from: string): string {
  const m = from.match(/@([^>\s]+)/);
  return (m ? m[1] : from).toLowerCase();
}

export function buildContext(raw: RawEmail): EmailContext {
  const html = raw.html ?? '';
  const text = raw.text ?? (html ? htmlToText(html) : '');
  return {
    raw,
    from: raw.from,
    domain: senderDomain(raw.from),
    subject: raw.subject,
    html,
    text,
  };
}

export function looksLikeOrderEmail(ctx: EmailContext): boolean {
  return /\b(order|receipt|purchase|confirmation|invoice|shipped|your\s+order)\b/i.test(
    `${ctx.subject} ${ctx.text.slice(0, 400)}`,
  );
}

/**
 * Uniform post-processing: drop noise/non-apparel, de-dupe, fold variant into
 * the title, and backfill brand/currency. Returns null if nothing survives.
 */
export function finalizeReceipt(ctx: EmailContext, extractorId: string, result: ExtractResult): ParsedReceipt | null {
  const retailerInfo = lookupRetailer(ctx);
  const retailer = result.retailer ?? retailerInfo?.name;
  const apparelOnly = retailerInfo?.apparelOnly ?? false;

  const seen = new Set<string>();
  const items: ParsedLineItem[] = [];
  for (const raw of result.items) {
    const baseTitle = raw.title.trim();
    if (!baseTitle || baseTitle.length < 3) continue;
    if (NOISE_RE.test(baseTitle)) continue;
    const isApparel = apparelOnly || raw.apparelHint || APPAREL_RE.test(baseTitle);
    if (!isApparel) continue;

    const title = raw.variant ? `${baseTitle} — ${raw.variant}` : baseTitle;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({ ...raw, title, brand: raw.brand ?? retailer });
  }

  if (items.length === 0) return null;

  return {
    retailer,
    orderId: result.orderId,
    currency: result.currency ?? currencyFromSymbol(ctx.text),
    purchasedAt: ctx.raw.receivedAt ?? Date.now(),
    items,
    extractor: extractorId,
  };
}
