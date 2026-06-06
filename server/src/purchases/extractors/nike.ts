/**
 * Nike order-confirmation extractor.
 *
 * Demonstrates a brand-specific extractor: brand is always Nike, and the
 * color/size attribute lines are captured into the variant for better downstream
 * attribute inference. Targets Nike's itemized table template; if the structure
 * isn't found it returns null and the generic extractor takes over (Nike is an
 * apparel-only retailer, so generic text parsing still works).
 */
import {
  findPrice,
  stripTags,
  type EmailContext,
  type ExtractResult,
  type Extractor,
  type ParsedLineItem,
} from './shared';

const ITEM_BLOCK = /<table[^>]*class="[^"]*order-item[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
const TITLE_RE = /(?:item-title|pii-name)[^>]*>([\s\S]*?)<\/(?:p|span|td|a)>/i;
const ATTR_RE = /(?:item-attr|pii-(?:color|size))[^>]*>([\s\S]*?)<\/(?:p|span|td)>/gi;
const PRICE_RE = /(?:item-price|pii-price)[^>]*>([\s\S]*?)<\/td>/i;
const IMG_RE = /<img[^>]+src="([^"]+)"/i;

export const nikeExtractor: Extractor = {
  id: 'nike',
  matches: (ctx) => /nike\./i.test(ctx.domain) || /nike\./i.test(ctx.from),
  extract(ctx: EmailContext): ExtractResult | null {
    if (!ctx.html) return null;
    const items: ParsedLineItem[] = [];
    let m: RegExpExecArray | null;
    ITEM_BLOCK.lastIndex = 0;

    while ((m = ITEM_BLOCK.exec(ctx.html)) !== null) {
      const block = m[1];
      const titleRaw = block.match(TITLE_RE)?.[1];
      if (!titleRaw) continue;
      const title = stripTags(titleRaw);
      if (!title) continue;

      // Collect "Color: …" / "Size: …" attribute lines into a single variant.
      const attrs: string[] = [];
      let a: RegExpExecArray | null;
      ATTR_RE.lastIndex = 0;
      while ((a = ATTR_RE.exec(block)) !== null) {
        const v = stripTags(a[1]).replace(/^(color|size)\s*:?\s*/i, '').trim();
        if (v) attrs.push(v);
      }
      const variant = attrs.length ? attrs.join(' · ') : undefined;

      const priceCell = block.match(PRICE_RE)?.[1];
      const price = priceCell ? findPrice(stripTags(priceCell)) : findPrice(stripTags(block));
      const imageUri = block.match(IMG_RE)?.[1];

      items.push({ title, brand: 'Nike', variant, price, imageUri, apparelHint: true });
    }

    if (items.length === 0) return null;
    return { items, retailer: 'Nike' };
  },
};
