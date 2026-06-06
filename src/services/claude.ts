/**
 * AI service — now a thin client over the backend's /ai/* proxy. The Anthropic
 * key lives only on the server; this module sends image/text/candidate data and
 * normalizes the structured JSON the server returns into our domain types.
 *
 * Every function throws when AI is unavailable (no backend, not signed in, or a
 * server error) so callers fall back to the on-device rules engine.
 */
import { apiFetch, hasAuthToken } from '@/api/client';
import { isApiConfigured } from '@/config';
import type { ClothingItem, InferredItem, Occasion, Outfit, Weather } from '@/types';
import { CATEGORIES, OCCASIONS } from '@/types';

/** AI requires both a configured backend and an authenticated user. */
export function isAiAvailable(): boolean {
  return isApiConfigured() && hasAuthToken();
}

/** Coerce a loose server/model object into a valid InferredItem. */
function normalizeInferred(obj: Record<string, unknown>): InferredItem {
  const validOccasions = new Set(OCCASIONS.map((o) => o.id));
  const occasions = (Array.isArray(obj.occasions) ? obj.occasions : []).filter(
    (o): o is Occasion => typeof o === 'string' && validOccasions.has(o as Occasion),
  );
  const category = CATEGORIES.includes(obj.category as never)
    ? (obj.category as InferredItem['category'])
    : 'top';
  const clamp = (n: unknown): 1 | 2 | 3 | 4 | 5 => {
    const v = Math.min(5, Math.max(1, Math.round(Number(n) || 3)));
    return v as 1 | 2 | 3 | 4 | 5;
  };
  return {
    name: typeof obj.name === 'string' && obj.name ? obj.name : 'Untitled item',
    category,
    subtype: typeof obj.subtype === 'string' && obj.subtype ? obj.subtype : undefined,
    colors: Array.isArray(obj.colors) ? obj.colors.map(String).slice(0, 4) : [],
    formality: clamp(obj.formality),
    warmth: clamp(obj.warmth),
    occasions: occasions.length ? occasions : ['casual'],
    brand: typeof obj.brand === 'string' && obj.brand ? obj.brand : undefined,
  };
}

/** Vision: infer structured attributes from a base64 garment photo. */
export async function tagClothingImage(
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<InferredItem> {
  const { attributes } = await apiFetch<{ attributes: Record<string, unknown> }>('/ai/tag', {
    method: 'POST',
    body: { imageBase64: base64, mediaType },
  });
  return normalizeInferred(attributes);
}

/** Stylist: ask the backend to assemble outfits from candidate items. */
export async function suggestOutfits(
  candidates: ClothingItem[],
  occasion: Occasion,
  weather: Weather,
  count = 3,
): Promise<Outfit[]> {
  const { outfits } = await apiFetch<{ outfits: { itemIds: string[]; rationale: string }[] }>(
    '/ai/outfits',
    {
      method: 'POST',
      body: {
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          subtype: c.subtype,
          colors: c.colors,
          formality: c.formality,
          warmth: c.warmth,
        })),
        occasion,
        weather: {
          condition: weather.condition,
          tempC: weather.tempC,
          feelsLikeC: weather.feelsLikeC,
          precipitationProb: weather.precipitationProb,
          windKph: weather.windKph,
        },
        count,
      },
    },
  );

  const byId = new Map(candidates.map((c) => [c.id, c]));
  return outfits
    .map((o, idx): Outfit | null => {
      const items = (o.itemIds ?? [])
        .map((id) => byId.get(id))
        .filter((x): x is ClothingItem => !!x);
      if (items.length < 2) return null;
      return {
        id: `ai-${Date.now()}-${idx}`,
        itemIds: items.map((i) => i.id),
        items,
        occasion,
        rationale: o.rationale ?? 'A coordinated look for the day.',
        score: 100 - idx,
        aiGenerated: true,
      };
    })
    .filter((o): o is Outfit => o !== null);
}

/** Parse a free-text purchase line into garment attributes. */
export async function inferItemFromPurchaseText(text: string): Promise<InferredItem> {
  const { attributes } = await apiFetch<{ attributes: Record<string, unknown> }>('/ai/purchase', {
    method: 'POST',
    body: { text },
  });
  return normalizeInferred(attributes);
}
