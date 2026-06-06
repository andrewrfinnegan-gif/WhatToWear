/**
 * Generic extractor — the always-on fallback. Tries schema.org JSON-LD first
 * (reliable, used by many retailers incl. Shopify), then a text/regex pass that
 * pairs product-ish lines with nearby prices. `matches` is always true, so this
 * runs last in the registry for any email a specific extractor didn't handle.
 */
import {
  APPAREL_RE,
  NOISE_RE,
  extractJsonLd,
  findPrice,
  lookupRetailer,
  priceToNumber,
  type EmailContext,
  type ExtractResult,
  type Extractor,
  type ParsedLineItem,
} from './shared';

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

function parseFromJsonLd(html: string, fallbackBrand?: string): ExtractResult | null {
  const blocks = extractJsonLd(html);
  if (blocks.length === 0) return null;

  const orders: Record<string, unknown>[] = [];
  collectTyped(blocks, (t) => t === 'order' || t === 'invoice', orders);

  const items: ParsedLineItem[] = [];
  let currency: string | undefined;
  let orderId: string | undefined;

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

/** Text fallback: pair product-ish lines with nearby prices. */
function parseFromText(text: string, fallbackBrand: string | undefined, lenient: boolean): ParsedLineItem[] {
  const priceRe = /(?:\$|£|€|USD|GBP|EUR)\s?(\d{1,4}(?:[.,]\d{2}))/i;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ParsedLineItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (NOISE_RE.test(line)) continue;

    const priceMatch = lenient ? line.match(priceRe) : line.match(priceRe) ?? lines[i + 1]?.match(priceRe);
    if (lenient) {
      if (!priceMatch) continue;
    } else if (!APPAREL_RE.test(line)) {
      continue;
    }

    const title = line.replace(priceRe, '').replace(/\s{2,}/g, ' ').replace(/[.•\-–·|]+$/, '').trim();
    if (title.length < 3) continue;
    items.push({ title, brand: fallbackBrand, price: priceMatch ? Number(priceMatch[1].replace(',', '.')) : undefined });
  }
  return items;
}

export const genericExtractor: Extractor = {
  id: 'generic',
  matches: () => true,
  extract(ctx: EmailContext): ExtractResult | null {
    const retailer = lookupRetailer(ctx);
    const fallbackBrand = retailer?.name;

    const fromJsonLd = ctx.html ? parseFromJsonLd(ctx.html, fallbackBrand) : null;
    if (fromJsonLd) return fromJsonLd;

    const items = parseFromText(ctx.text, fallbackBrand, retailer?.apparelOnly ?? false);
    if (items.length === 0) return null;
    return { items };
  },
};

// Re-exported so callers/tests can reach these via the registry barrel too.
export { findPrice };
