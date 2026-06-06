/**
 * Server-side Anthropic Claude client. Mirrors the prompts the app used to run
 * directly, but the API key now lives only here. Returns lightly-parsed JSON;
 * the client normalizes/validates into its domain types.
 */
import { config, isClaudeConfigured } from '../config';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const CATEGORIES = ['top', 'bottom', 'outerwear', 'dress', 'footwear', 'accessory'];
const OCCASIONS = ['casual', 'work', 'formal', 'leisure', 'date', 'workout'];

interface ContentBlock {
  type: string;
  text?: string;
}

async function callClaude(
  model: string,
  system: string,
  content: unknown,
  maxTokens: number,
): Promise<string> {
  if (!isClaudeConfigured()) throw new Error('Claude is not configured on the server');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      'x-api-key': config.anthropicApiKey,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Claude request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: ContentBlock[] };
  return (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
}

/** Pull the first balanced JSON object/array out of a model response. */
function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('No JSON found in Claude response');
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
  "name": string,
  "category": one of ${JSON.stringify(CATEGORIES)},
  "subtype": string,
  "colors": string[],
  "formality": 1|2|3|4|5,
  "warmth": 1|2|3|4|5,
  "occasions": array of any of ${JSON.stringify(OCCASIONS)},
  "brand": string
}`;

export async function tagImage(
  base64: string,
  mediaType: 'image/jpeg' | 'image/png',
): Promise<Record<string, unknown>> {
  const system =
    'You are a fashion cataloguing assistant. Identify the single main garment ' +
    'in the photo and describe it as structured data. Be decisive. ' +
    ATTRIBUTE_SCHEMA;
  const raw = await callClaude(
    config.taggingModel,
    system,
    [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: 'Catalogue this garment. Respond with JSON only.' },
    ],
    600,
  );
  return extractJson<Record<string, unknown>>(raw);
}

export interface OutfitCandidate {
  id: string;
  name: string;
  category: string;
  subtype?: string;
  colors: string[];
  formality: number;
  warmth: number;
}

export async function suggestOutfits(
  candidates: OutfitCandidate[],
  occasion: string,
  weather: { condition: string; tempC: number; feelsLikeC: number; precipitationProb: number; windKph: number },
  count: number,
): Promise<{ itemIds: string[]; rationale: string }[]> {
  const system =
    'You are an expert personal stylist helping someone who struggles to put ' +
    'outfits together. Build complete, well-coordinated outfits ONLY from the ' +
    'provided closet items (reference them by id). Respect color harmony, ' +
    'formality, and the weather. Every outfit needs footwear and either ' +
    '(a top + bottom) or a dress. Add outerwear when it is cold, wet, or windy. ' +
    `Return ONLY a JSON array of ${count} outfits:\n` +
    '[{ "itemIds": string[], "rationale": string }]';

  const userText = [
    `Occasion: ${occasion}`,
    `Weather: ${weather.condition}, ${weather.tempC}°C (feels ${weather.feelsLikeC}°C), ` +
      `precip ${weather.precipitationProb}%, wind ${weather.windKph} km/h`,
    '',
    'Closet items (id | name | category | colors | formality | warmth):',
    ...candidates.map(
      (c) =>
        `${c.id} | ${c.name} | ${c.category}${c.subtype ? `/${c.subtype}` : ''} | colors:${c.colors.join(',')} | formality:${c.formality} | warmth:${c.warmth}`,
    ),
  ].join('\n');

  const raw = await callClaude(config.stylingModel, system, [{ type: 'text', text: userText }], 1200);
  return extractJson<{ itemIds: string[]; rationale: string }[]>(raw);
}

export async function inferFromPurchaseText(text: string): Promise<Record<string, unknown>> {
  const system =
    'You convert a purchase/receipt line into a structured clothing item. ' +
    'Infer reasonable attributes from the product name and brand. ' +
    ATTRIBUTE_SCHEMA;
  const raw = await callClaude(
    config.taggingModel,
    system,
    [{ type: 'text', text: `Purchase: "${text}"\nRespond with JSON only.` }],
    500,
  );
  return extractJson<Record<string, unknown>>(raw);
}
