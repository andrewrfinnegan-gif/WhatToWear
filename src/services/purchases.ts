/**
 * Purchase ingestion — the "auto-populate the closet from phone purchases"
 * feature. In production this would subscribe to a payments/receipts source
 * (Apple/Google Pay transactions, retailer order emails, Stripe webhooks). Here
 * we expose a typed PurchaseRecord plus a mock feed so the flow is demonstrable.
 *
 * Each record is converted into closet attributes via Claude (with a keyword
 * fallback) so a tap turns a receipt line into a tagged garment.
 */
import { inferItemFromPurchaseText } from '@/services/claude';
import { isClaudeConfigured } from '@/config';
import type { Category, InferredItem, Occasion } from '@/types';

export interface PurchaseRecord {
  id: string;
  /** Product title as it appears on the receipt. */
  title: string;
  brand?: string;
  retailer: string;
  price: number;
  currency: string;
  purchasedAt: number;
  /** Optional product image from the retailer. */
  imageUri?: string;
}

/** Mock feed standing in for a real payments/receipts integration. */
export const MOCK_PURCHASE_FEED: PurchaseRecord[] = [
  {
    id: 'p-1',
    title: 'Merino V-Neck Sweater — Forest Green',
    brand: 'Uniqlo',
    retailer: 'Uniqlo',
    price: 49.9,
    currency: 'USD',
    purchasedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: 'p-2',
    title: 'Slim Fit Stretch Chino Pant — Stone',
    brand: 'Bonobos',
    retailer: 'Bonobos',
    price: 89,
    currency: 'USD',
    purchasedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: 'p-3',
    title: 'Suede Chelsea Boots — Tan',
    brand: 'Thursday Boot Co.',
    retailer: 'Amazon',
    price: 199,
    currency: 'USD',
    purchasedAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
  },
];

const KEYWORDS: { match: RegExp; category: Category; warmth: number; formality: number; occasions: Occasion[] }[] = [
  { match: /coat|parka|overcoat/i, category: 'outerwear', warmth: 5, formality: 4, occasions: ['work', 'casual', 'formal'] },
  { match: /jacket|blazer|bomber/i, category: 'outerwear', warmth: 3, formality: 3, occasions: ['casual', 'work'] },
  { match: /sweater|jumper|knit|hoodie|cardigan/i, category: 'top', warmth: 4, formality: 3, occasions: ['casual', 'work'] },
  { match: /shirt|tee|t-shirt|polo|blouse|top/i, category: 'top', warmth: 2, formality: 3, occasions: ['casual', 'work'] },
  { match: /dress(?!\s*shirt)|gown/i, category: 'dress', warmth: 2, formality: 4, occasions: ['date', 'formal'] },
  { match: /chino|trouser|pant|jean|short|skirt/i, category: 'bottom', warmth: 3, formality: 3, occasions: ['casual', 'work'] },
  { match: /boot|sneaker|shoe|loafer|heel|sandal|trainer/i, category: 'footwear', warmth: 2, formality: 3, occasions: ['casual', 'work'] },
  { match: /belt|watch|scarf|hat|tie|bag|sunglass/i, category: 'accessory', warmth: 1, formality: 3, occasions: ['casual', 'work'] },
];

const COLOR_WORDS = [
  'black', 'white', 'grey', 'gray', 'charcoal', 'navy', 'blue', 'red', 'green',
  'forest', 'olive', 'khaki', 'tan', 'stone', 'camel', 'beige', 'cream', 'brown',
  'pink', 'purple', 'yellow', 'orange',
];

/** Heuristic parser used when Claude is unavailable. */
export function parsePurchaseHeuristically(record: PurchaseRecord): InferredItem {
  const text = record.title.toLowerCase();
  const rule = KEYWORDS.find((k) => k.match.test(text));
  const colors = COLOR_WORDS.filter((c) => text.includes(c)).map((c) => (c === 'stone' || c === 'forest' ? c : c));
  // Strip color/separators for a cleaner display name.
  const name = record.title.split('—')[0].trim() || record.title;
  return {
    name,
    category: rule?.category ?? 'top',
    subtype: undefined,
    colors: colors.length ? colors.slice(0, 3) : [],
    formality: (rule?.formality ?? 3) as InferredItem['formality'],
    warmth: (rule?.warmth ?? 2) as InferredItem['warmth'],
    occasions: rule?.occasions ?? ['casual'],
    brand: record.brand,
  };
}

/** Convert a purchase into garment attributes (Claude first, heuristic fallback). */
export async function inferFromPurchase(record: PurchaseRecord): Promise<InferredItem> {
  if (isClaudeConfigured()) {
    try {
      const text = [record.brand, record.title].filter(Boolean).join(' ');
      const inferred = await inferItemFromPurchaseText(text);
      return { ...inferred, brand: inferred.brand ?? record.brand };
    } catch {
      // fall through to heuristic
    }
  }
  return parsePurchaseHeuristically(record);
}
