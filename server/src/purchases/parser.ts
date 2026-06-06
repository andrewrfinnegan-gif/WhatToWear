/**
 * Receipt parsing — public entry point.
 *
 * Delegates to a registry of extractors (see ./extractors): per-retailer /
 * platform extractors are tried first, then a generic JSON-LD + text fallback.
 * The first extractor that yields apparel line items wins. `finalizeReceipt`
 * applies uniform filtering/de-dupe/brand-currency backfill.
 *
 * Types and a few helpers are re-exported from ./extractors/shared so existing
 * importers (`./parser`) keep working unchanged.
 */
import { EXTRACTORS } from './extractors';
import {
  buildContext,
  finalizeReceipt,
  looksLikeOrderEmail,
  type ParsedReceipt,
  type RawEmail,
} from './extractors/shared';

export {
  htmlToText,
  extractJsonLd,
  type RawEmail,
  type ParsedLineItem,
  type ParsedReceipt,
} from './extractors/shared';

export function parseReceipt(raw: RawEmail): ParsedReceipt | null {
  const ctx = buildContext(raw);
  if (!looksLikeOrderEmail(ctx)) return null;

  for (const extractor of EXTRACTORS) {
    if (!extractor.matches(ctx)) continue;
    const result = extractor.extract(ctx);
    if (!result || result.items.length === 0) continue;
    const receipt = finalizeReceipt(ctx, extractor.id, result);
    if (receipt) return receipt;
  }
  return null;
}
