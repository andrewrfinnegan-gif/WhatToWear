/**
 * Outfit recommendation.
 *
 * `recommendOutfits` is the single entry point the UI calls. It pre-filters the
 * closet to weather/occasion-appropriate candidates, then asks the Claude
 * stylist to assemble looks. If Claude is unconfigured or errors, it falls back
 * to a deterministic on-device engine so the app always returns something.
 */
import { suggestOutfits } from '@/services/claude';
import { needsOuterwear, targetWarmthForTemp } from '@/services/weather';
import type { ClothingItem, Category, Occasion, Outfit, Weather } from '@/types';
import { OCCASIONS } from '@/types';
import { isClaudeConfigured } from '@/config';

/** Neutrals pair with anything; this drives the simple color-harmony score. */
const NEUTRALS = new Set([
  'black', 'white', 'grey', 'gray', 'navy', 'beige', 'tan', 'cream',
  'khaki', 'charcoal', 'denim', 'brown',
]);

function targetFormality(occasion: Occasion): number {
  return OCCASIONS.find((o) => o.id === occasion)?.targetFormality ?? 3;
}

/** True if the item is plausibly right for the occasion + temperature. */
function isCandidate(item: ClothingItem, occasion: Occasion, targetWarmth: number): boolean {
  const occasionOk = item.occasions.includes(occasion);
  // Don't put a heavy coat on in summer or a tank top in winter (allow ±1).
  const warmthOk = Math.abs(item.warmth - targetWarmth) <= 2 || item.category === 'accessory';
  return occasionOk && warmthOk;
}

/** Filter the closet down to items worth considering. */
export function candidatesFor(
  closet: ClothingItem[],
  occasion: Occasion,
  weather: Weather,
): ClothingItem[] {
  const targetWarmth = targetWarmthForTemp(weather.feelsLikeC);
  const filtered = closet.filter((i) => isCandidate(i, occasion, targetWarmth));
  // Fall back to occasion-only filtering if weather filtering is too aggressive.
  if (filtered.length < 3) return closet.filter((i) => i.occasions.includes(occasion));
  return filtered;
}

function colorHarmony(items: ClothingItem[]): number {
  const colors = items.flatMap((i) => i.colors.map((c) => c.toLowerCase()));
  if (colors.length === 0) return 0.5;
  const neutralCount = colors.filter((c) => NEUTRALS.has(c)).length;
  const nonNeutral = colors.filter((c) => !NEUTRALS.has(c));
  const distinctNonNeutral = new Set(nonNeutral).size;
  // Reward neutrals and at most ~2 accent colors; penalize a clash of many bold colors.
  const neutralRatio = neutralCount / colors.length;
  const accentPenalty = Math.max(0, distinctNonNeutral - 2) * 0.2;
  return Math.max(0, Math.min(1, 0.4 + neutralRatio * 0.6 - accentPenalty));
}

function pickBest(items: ClothingItem[], target: number): ClothingItem | undefined {
  if (items.length === 0) return undefined;
  // Prefer formality close to target, then least-recently-worn, then favorites.
  return [...items].sort((a, b) => {
    const fa = Math.abs(a.formality - target);
    const fb = Math.abs(b.formality - target);
    if (fa !== fb) return fa - fb;
    const ra = a.lastWornAt ?? 0;
    const rb = b.lastWornAt ?? 0;
    if (ra !== rb) return ra - rb;
    return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
  })[0];
}

function byCategory(items: ClothingItem[], category: Category): ClothingItem[] {
  return items.filter((i) => i.category === category);
}

function scoreOutfit(items: ClothingItem[], occasion: Occasion, weather: Weather): number {
  const target = targetFormality(occasion);
  const avgFormality = items.reduce((s, i) => s + i.formality, 0) / items.length;
  const formalityScore = 1 - Math.min(1, Math.abs(avgFormality - target) / 2);
  const harmony = colorHarmony(items);
  const targetWarmth = targetWarmthForTemp(weather.feelsLikeC);
  const avgWarmth =
    byCategory(items, 'accessory').length === items.length
      ? targetWarmth
      : items
          .filter((i) => i.category !== 'accessory')
          .reduce((s, i) => s + i.warmth, 0) /
        Math.max(1, items.filter((i) => i.category !== 'accessory').length);
  const warmthScore = 1 - Math.min(1, Math.abs(avgWarmth - targetWarmth) / 2);
  return Math.round((formalityScore * 0.4 + harmony * 0.35 + warmthScore * 0.25) * 100);
}

function buildRationale(items: ClothingItem[], occasion: Occasion, weather: Weather): string {
  const names = items.map((i) => i.name.toLowerCase());
  const lead = names.slice(0, -1).join(', ');
  const last = names[names.length - 1];
  const pieces = names.length > 1 ? `${lead} with ${last}` : last;
  return `${pieces} — balanced for a ${occasion} setting at ${weather.tempC}°C.`;
}

/** Deterministic assembly used as the offline fallback. */
export function rulesEngineOutfits(
  closet: ClothingItem[],
  occasion: Occasion,
  weather: Weather,
  count = 3,
): Outfit[] {
  const pool = candidatesFor(closet, occasion, weather);
  const target = targetFormality(occasion);
  const wantOuter = needsOuterwear(weather);
  const outfits: Outfit[] = [];
  const usedSignatures = new Set<string>();

  // Generate a few variants by rotating through the available tops/bottoms/dresses.
  const tops = byCategory(pool, 'top');
  const bottoms = byCategory(pool, 'bottom');
  const dresses = byCategory(pool, 'dress');
  const footwearAll = byCategory(pool, 'footwear');
  const outerAll = byCategory(pool, 'outerwear');
  const accessoriesAll = byCategory(pool, 'accessory');

  const variants = Math.max(tops.length * bottoms.length, dresses.length, 1);

  for (let v = 0; v < variants && outfits.length < count; v++) {
    const items: ClothingItem[] = [];
    if (dresses.length && (v % 2 === 1 || tops.length === 0 || bottoms.length === 0)) {
      const dress = dresses[v % dresses.length];
      if (dress) items.push(dress);
    } else {
      const top = tops[v % Math.max(1, tops.length)];
      const bottom = bottoms[Math.floor(v / Math.max(1, tops.length)) % Math.max(1, bottoms.length)];
      if (top) items.push(top);
      if (bottom) items.push(bottom);
    }
    const footwear = pickBest(footwearAll, target);
    if (footwear) items.push(footwear);
    if (wantOuter) {
      const outer = pickBest(outerAll, target);
      if (outer) items.push(outer);
    }
    const accessory = pickBest(accessoriesAll, target);
    if (accessory && items.length >= 3) items.push(accessory);

    // A valid look needs at least a core garment + footwear.
    const hasCore = items.some((i) => i.category === 'dress') ||
      (items.some((i) => i.category === 'top') && items.some((i) => i.category === 'bottom'));
    if (!hasCore || items.length < 2) continue;

    const signature = items.map((i) => i.id).sort().join('|');
    if (usedSignatures.has(signature)) continue;
    usedSignatures.add(signature);

    outfits.push({
      id: `rules-${occasion}-${v}-${Date.now()}`,
      itemIds: items.map((i) => i.id),
      items,
      occasion,
      rationale: buildRationale(items, occasion, weather),
      score: scoreOutfit(items, occasion, weather),
      aiGenerated: false,
    });
  }

  return outfits.sort((a, b) => b.score - a.score).slice(0, count);
}

export interface RecommendResult {
  outfits: Outfit[];
  usedAi: boolean;
  /** Set when AI was attempted but failed; UI can surface a gentle note. */
  aiError?: string;
}

/**
 * Top-level recommender. Tries the Claude stylist first (on pre-filtered
 * candidates), falls back to the rules engine on any error or missing config.
 */
export async function recommendOutfits(
  closet: ClothingItem[],
  occasion: Occasion,
  weather: Weather,
  count = 3,
): Promise<RecommendResult> {
  const fallback = (aiError?: string): RecommendResult => ({
    outfits: rulesEngineOutfits(closet, occasion, weather, count),
    usedAi: false,
    aiError,
  });

  if (!isClaudeConfigured()) return fallback();

  const candidates = candidatesFor(closet, occasion, weather);
  if (candidates.length < 2) return fallback();

  try {
    const outfits = await suggestOutfits(candidates, occasion, weather, count);
    if (outfits.length === 0) return fallback();
    // Score AI outfits with the same yardstick so ranking is consistent.
    const scored = outfits.map((o) => ({ ...o, score: scoreOutfit(o.items, occasion, weather) }));
    return { outfits: scored.sort((a, b) => b.score - a.score), usedAi: true };
  } catch (err) {
    return fallback(err instanceof Error ? err.message : 'AI unavailable');
  }
}
