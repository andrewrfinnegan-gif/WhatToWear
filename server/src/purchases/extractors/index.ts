/**
 * Extractor registry. Order matters: specific platform/retailer extractors are
 * tried first, with the generic JSON-LD/text extractor as the catch-all. To add
 * a retailer, implement an Extractor and insert it before `genericExtractor`.
 */
import { amazonExtractor } from './amazon';
import { genericExtractor } from './generic';
import { nikeExtractor } from './nike';
import { shopifyExtractor } from './shopify';
import type { Extractor } from './shared';

export const EXTRACTORS: Extractor[] = [
  shopifyExtractor,
  amazonExtractor,
  nikeExtractor,
  genericExtractor,
];
