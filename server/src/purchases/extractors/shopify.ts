/**
 * Shopify order-confirmation extractor.
 *
 * Shopify's notification email template is shared by a huge number of DTC
 * clothing brands, so one extractor covers many retailers. It isolates each
 * product row (`<table class="row product">`) and reads the title, variant
 * (color/size), price, and image from the well-known class names. A size-like
 * variant sets the apparel hint so clothing whose name lacks a keyword
 * (e.g. "The Cashmere Crew") still survives filtering.
 *
 * NOTE: targets Shopify's standard template; heavily-customized themes may need
 * tuning. The generic JSON-LD path remains a fallback (many Shopify emails also
 * embed JSON-LD).
 */
import {
  findPrice,
  looksLikeSize,
  stripTags,
  type EmailContext,
  type ExtractResult,
  type Extractor,
  type ParsedLineItem,
} from './shared';

const SIGNATURE = /order-list__|product__description__|powered by shopify/i;
const PRODUCT_BLOCK = /<table[^>]*class="[^"]*\bproduct\b[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;

const NAME_RE = /(?:product__description__name|order-list__item-title)[^>]*>([\s\S]*?)<\/(?:span|td|a|p)>/i;
const VARIANT_RE = /(?:product__description__variant|order-list__item-variant)[^>]*>([\s\S]*?)<\/(?:span|td|p)>/i;
const PRICE_RE = /order-list__(?:item-)?price[^>]*>([\s\S]*?)<\/td>/i;
const IMG_RE = /<img[^>]+src="([^"]+)"/i;
const QTY_RE = /\s*[×x]\s*(\d+)\s*$/;

export const shopifyExtractor: Extractor = {
  id: 'shopify',
  matches: (ctx) => SIGNATURE.test(ctx.html),
  extract(ctx: EmailContext): ExtractResult | null {
    const items: ParsedLineItem[] = [];
    let m: RegExpExecArray | null;
    PRODUCT_BLOCK.lastIndex = 0;

    while ((m = PRODUCT_BLOCK.exec(ctx.html)) !== null) {
      const block = m[1];
      const nameRaw = block.match(NAME_RE)?.[1];
      if (!nameRaw) continue;
      let title = stripTags(nameRaw);

      // Pull an inline "× 2" quantity out of the title.
      let quantity: number | undefined;
      const qtyMatch = title.match(QTY_RE);
      if (qtyMatch) {
        quantity = Number(qtyMatch[1]);
        title = title.replace(QTY_RE, '').trim();
      }
      if (!title) continue;

      const variant = block.match(VARIANT_RE)?.[1] ? stripTags(block.match(VARIANT_RE)![1]) : undefined;
      const priceCell = block.match(PRICE_RE)?.[1];
      const price = priceCell ? findPrice(stripTags(priceCell)) : findPrice(stripTags(block));
      const imageUri = block.match(IMG_RE)?.[1];

      items.push({
        title,
        variant: variant && variant.length <= 40 ? variant : undefined,
        price,
        quantity,
        imageUri,
        apparelHint: looksLikeSize(variant),
      });
    }

    if (items.length === 0) return null;
    return { items };
  },
};
