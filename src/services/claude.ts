/**
 * Claude integration: two capabilities.
 *
 *  1. tagClothingImage  — vision: turn a garment photo into structured
 *     attributes so the user barely has to type (the "biggest bottleneck").
 *  2. suggestOutfits    — reasoning: act as a stylist, combining closet items
 *     into outfits appropriate for the occasion + weather, with a rationale.
 *
 * Both fail soft: callers should catch and fall back to the rules engine.
 */
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_PROXY_URL,
  STYLING_MODEL,
  TAGGING_MODEL,
  isClaudeConfigured,
} from '@/config';
import type { ClothingItem, InferredItem, Occasion, Outfit, Weather } from '@/types';
import { CATEGORIES, OCCASIONS } from '@/types';

const API_URL = ANTHROPIC_PROXY_URL || 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

async function callClaude(
  model: string,
  system: string,
  content: unknown,
  maxTokens: number,
): Promise<string> {
  if (!isClaudeConfigured()) throw new Error('Claude is not configured');

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': ANTHROPIC_VERSION,
    // Allow direct calls from the RN/web runtime in dev. In production this goes
    // through ANTHROPIC_PROXY_URL and the key never reaches the client.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (!ANTHROPIC_PROXY_URL && ANTHROPIC_API_KEY) headers['x-api-key'] = ANTHROPIC_API_KEY;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Claude request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const blocks: AnthropicContentBlock[] = data.content ?? [];
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
}

/** Pull the first JSON object/array out of a model response, tolerating prose/fences. */
function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('No JSON found in Claude response');
  // Walk to the matching closing bracket.
  const open = candidate[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === open) depth++;
    else if (candidate[i] === close) {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1)) as T;
    }
  }
  throw new Error('Unbalanced JSON in Claude response');
}

const ATTRIBUTE_SCHEMA = `Return ONLY a JSON object with this exact shape:
{
  "name": string,            // short friendly name, e.g. "Navy oxford shirt"
  "category": one of ${JSON.stringify(CATEGORIES)},
  "subtype": string,         // e.g. "oxford shirt", "slim chinos", "chelsea boots"
  "colors": string[],        // primary color first, e.g. ["navy","white"]
  "formality": 1|2|3|4|5,    // 1 very casual ... 5 black tie
  "warmth": 1|2|3|4|5,       // 1 tank/sandals ... 5 heavy winter coat
  "occasions": array of any of ${JSON.stringify(OCCASIONS.map((o) => o.id))},
  "brand": string            // empty string if unknown
}`;

/** Vision call: infer structured attributes from a base64 garment photo. */
export async function tagClothingImage(
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<InferredItem> {
  const system =
    'You are a fashion cataloguing assistant. Identify the single main garment ' +
    'in the photo and describe it as structured data. Be decisive. ' +
    ATTRIBUTE_SCHEMA;

  const raw = await callClaude(
    TAGGING_MODEL,
    system,
    [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: 'Catalogue this garment. Respond with JSON only.' },
    ],
    600,
  );

  return normalizeInferred(extractJson<Record<string, unknown>>(raw));
}

/** Coerce a loose model object into a valid InferredItem. */
function normalizeInferred(obj: Record<string, unknown>): InferredItem {
  const validOccasions = new Set(OCCASIONS.map((o) => o.id));
  const occasions = (Array.isArray(obj.occasions) ? obj.occasions : [])
    .filter((o): o is Occasion => typeof o === 'string' && validOccasions.has(o as Occasion));
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
    subtype: typeof obj.subtype === 'string' ? obj.subtype : undefined,
    colors: Array.isArray(obj.colors) ? obj.colors.map(String).slice(0, 4) : [],
    formality: clamp(obj.formality),
    warmth: clamp(obj.warmth),
    occasions: occasions.length ? occasions : ['casual'],
    brand: typeof obj.brand === 'string' && obj.brand ? obj.brand : undefined,
  };
}

/** Compact representation of a closet item for the stylist prompt. */
function describeItem(i: ClothingItem): string {
  return `${i.id} | ${i.name} | ${i.category}${i.subtype ? `/${i.subtype}` : ''} | colors:${i.colors.join(',')} | formality:${i.formality} | warmth:${i.warmth}`;
}

/**
 * Stylist call: from a candidate set of items, propose `count` complete outfits
 * for the occasion + weather. Returns outfits referencing item ids.
 */
export async function suggestOutfits(
  candidates: ClothingItem[],
  occasion: Occasion,
  weather: Weather,
  count = 3,
): Promise<Outfit[]> {
  const system =
    'You are an expert personal stylist helping someone who struggles to put ' +
    'outfits together. Build complete, well-coordinated outfits ONLY from the ' +
    'provided closet items (reference them by id). Respect color harmony, ' +
    'formality, and the weather. Every outfit needs footwear and either ' +
    '(a top + bottom) or a dress. Add outerwear when it is cold, wet, or windy. ' +
    `Return ONLY a JSON array of ${count} outfits:\n` +
    '[{ "itemIds": string[], "rationale": string }]  // rationale: one friendly sentence';

  const userText = [
    `Occasion: ${occasion}`,
    `Weather: ${weather.condition}, ${weather.tempC}°C (feels ${weather.feelsLikeC}°C), ` +
      `precip ${weather.precipitationProb}%, wind ${weather.windKph} km/h`,
    '',
    'Closet items (id | name | category | colors | formality | warmth):',
    ...candidates.map(describeItem),
  ].join('\n');

  const raw = await callClaude(STYLING_MODEL, system, [{ type: 'text', text: userText }], 1200);
  const parsed = extractJson<{ itemIds: string[]; rationale: string }[]>(raw);
  const byId = new Map(candidates.map((c) => [c.id, c]));

  return parsed
    .map((o, idx): Outfit | null => {
      const items = (o.itemIds ?? []).map((id) => byId.get(id)).filter((x): x is ClothingItem => !!x);
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

/**
 * Parse a free-text purchase/receipt line into garment attributes so phone
 * purchases can auto-populate the closet.
 */
export async function inferItemFromPurchaseText(text: string): Promise<InferredItem> {
  const system =
    'You convert a purchase/receipt line into a structured clothing item. ' +
    'Infer reasonable attributes from the product name and brand. ' +
    ATTRIBUTE_SCHEMA;
  const raw = await callClaude(
    TAGGING_MODEL,
    system,
    [{ type: 'text', text: `Purchase: "${text}"\nRespond with JSON only.` }],
    500,
  );
  return normalizeInferred(extractJson<Record<string, unknown>>(raw));
}
