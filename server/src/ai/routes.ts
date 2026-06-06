/**
 * AI proxy endpoints. All require auth (so usage is tied to an account) and
 * forward to Claude server-side. When the server has no key configured they
 * return 503 so the client cleanly falls back to its on-device rules engine.
 */
import { Router } from 'express';
import { z } from 'zod';

import { isClaudeConfigured } from '../config';
import { requireAuth } from '../auth/middleware';
import { inferFromPurchaseText, suggestOutfits, tagImage } from './anthropic';

export const aiRouter = Router();
aiRouter.use(requireAuth);

// Guard every AI route behind a configured key.
aiRouter.use((_req, res, next) => {
  if (!isClaudeConfigured()) {
    res.status(503).json({ error: 'AI is not configured on the server' });
    return;
  }
  next();
});

const tagSchema = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(['image/jpeg', 'image/png']).optional().default('image/jpeg'),
});

aiRouter.post('/tag', async (req, res) => {
  const parsed = tagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid image payload' });
    return;
  }
  try {
    const attributes = await tagImage(parsed.data.imageBase64, parsed.data.mediaType);
    res.json({ attributes });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Tagging failed' });
  }
});

const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  subtype: z.string().optional(),
  colors: z.array(z.string()),
  formality: z.number(),
  warmth: z.number(),
});

const outfitsSchema = z.object({
  candidates: z.array(candidateSchema).min(1).max(200),
  occasion: z.string(),
  weather: z.object({
    condition: z.string(),
    tempC: z.number(),
    feelsLikeC: z.number(),
    precipitationProb: z.number(),
    windKph: z.number(),
  }),
  count: z.number().int().min(1).max(6).optional().default(3),
});

aiRouter.post('/outfits', async (req, res) => {
  const parsed = outfitsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid outfits payload' });
    return;
  }
  const { candidates, occasion, weather, count } = parsed.data;
  try {
    const outfits = await suggestOutfits(candidates, occasion, weather, count);
    res.json({ outfits });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Styling failed' });
  }
});

const purchaseSchema = z.object({ text: z.string().min(1).max(300) });

aiRouter.post('/purchase', async (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid purchase payload' });
    return;
  }
  try {
    const attributes = await inferFromPurchaseText(parsed.data.text);
    res.json({ attributes });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Inference failed' });
  }
});
