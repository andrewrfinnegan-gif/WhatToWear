/**
 * Turns a detected purchase (title + brand from the backend's receipt parser)
 * into closet garment attributes. Uses the Claude AI proxy when available,
 * falling back to a keyword heuristic so import always works.
 */
import { inferItemFromPurchaseText, isAiAvailable } from '@/services/claude';
import type { Category, InferredItem, Occasion } from '@/types';

/** Minimal shape needed to infer attributes from a purchase. */
export interface PurchaseLike {
  title: string;
  brand?: string | null;
}

const KEYWORDS: { match: RegExp; category: Category; warmth: number; formality: number; occasions: Occasion[] }[] = [
  { match: /coat|parka|overcoat/i, category: 'outerwear', warmth: 5, formality: 4, occasions: ['work', 'casual', 'formal'] },
  { match: /jacket|blazer|bomber/i, category: 'outerwear', warmth: 3, formality: 3, occasions: ['casual', 'work'] },
  { match: /sweater|jumper|knit|hoodie|cardigan|crew/i, category: 'top', warmth: 4, formality: 3, occasions: ['casual', 'work'] },
  { match: /shirt|tee|t-shirt|polo|blouse|top/i, category: 'top', warmth: 2, formality: 3, occasions: ['casual', 'work'] },
  { match: /dress(?!\s*shirt)|gown/i, category: 'dress', warmth: 2, formality: 4, occasions: ['date', 'formal'] },
  { match: /chino|trouser|pant|jean|short|skirt/i, category: 'bottom', warmth: 3, formality: 3, occasions: ['casual', 'work'] },
  { match: /boot|sneaker|shoe|loafer|heel|sandal|trainer/i, category: 'footwear', warmth: 2, formality: 3, occasions: ['casual', 'work'] },
  { match: /belt|watch|scarf|hat|tie|bag|sunglass/i, category: 'accessory', warmth: 1, formality: 3, occasions: ['casual', 'work'] },
];

const COLOR_WORDS = [
  'black', 'white', 'grey', 'gray', 'charcoal', 'navy', 'blue', 'red', 'green',
  'forest', 'olive', 'khaki', 'tan', 'stone', 'camel', 'beige', 'cream', 'brown',
  'pink', 'purple', 'yellow', 'orange', 'indigo',
];

/** Heuristic parser used when the AI proxy is unavailable. */
export function parsePurchaseHeuristically(purchase: PurchaseLike): InferredItem {
  const text = purchase.title.toLowerCase();
  const rule = KEYWORDS.find((k) => k.match.test(text));
  const colors = COLOR_WORDS.filter((c) => text.includes(c));
  const name = purchase.title.split(/[-—|]/)[0].trim() || purchase.title;
  return {
    name,
    category: rule?.category ?? 'top',
    subtype: undefined,
    colors: colors.slice(0, 3),
    formality: (rule?.formality ?? 3) as InferredItem['formality'],
    warmth: (rule?.warmth ?? 2) as InferredItem['warmth'],
    occasions: rule?.occasions ?? ['casual'],
    brand: purchase.brand ?? undefined,
  };
}

/** Convert a purchase into garment attributes (Claude first, heuristic fallback). */
export async function inferFromPurchase(purchase: PurchaseLike): Promise<InferredItem> {
  if (isAiAvailable()) {
    try {
      const text = [purchase.brand, purchase.title].filter(Boolean).join(' ');
      const inferred = await inferItemFromPurchaseText(text);
      return { ...inferred, brand: inferred.brand ?? purchase.brand ?? undefined };
    } catch {
      // fall through to heuristic
    }
  }
  return parsePurchaseHeuristically(purchase);
}
