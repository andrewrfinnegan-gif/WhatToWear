/**
 * Amazon order/ship-confirmation extractor.
 *
 * Amazon emails link each product to a /dp/ or /gp/product URL with the title as
 * the link text; the price sits shortly after. Amazon's catalog is mixed, so we
 * deliberately set no apparel hint — the shared apparel filter keeps clothing
 * and drops cables/gadgets. Falls through to generic when no product links are
 * present (e.g. plain-text emails).
 */
import { findPrice, stripTags, type EmailContext, type ExtractResult, type Extractor, type ParsedLineItem } from './shared';

const PRODUCT_LINK = /<a[^>]+href="[^"]*\/(?:dp|gp\/product|gp\/r\.html)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
const JUNK_TITLE = /^(view|track|buy again|return|leave|see|order|details|your)\b/i;

export const amazonExtractor: Extractor = {
  id: 'amazon',
  matches: (ctx) => /amazon\.[a-z.]+/i.test(ctx.domain) || /amazon\.[a-z.]+/i.test(ctx.from),
  extract(ctx: EmailContext): ExtractResult | null {
    if (!ctx.html) return null;
    const items: ParsedLineItem[] = [];
    let m: RegExpExecArray | null;
    PRODUCT_LINK.lastIndex = 0;

    while ((m = PRODUCT_LINK.exec(ctx.html)) !== null) {
      const title = stripTags(m[1]);
      if (title.length < 5 || JUNK_TITLE.test(title)) continue;

      // Look for a price in the window following the product link.
      const window = ctx.html.slice(m.index, m.index + 600);
      const price = findPrice(stripTags(window));

      const before = ctx.html.slice(Math.max(0, m.index - 400), m.index);
      const imageUri = before.match(/<img[^>]+src="([^"]+)"[^>]*>(?![\s\S]*<img)/i)?.[1];

      items.push({ title, price, imageUri });
    }

    if (items.length === 0) return null;
    return { items, retailer: 'Amazon' };
  },
};
