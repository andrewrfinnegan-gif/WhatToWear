/**
 * Purchase endpoints (all require auth):
 *   GET  /purchases            list (optionally ?status=pending)
 *   POST /purchases/parse      manually paste/forward a receipt -> parse + store
 *   POST /purchases/:id/import mark a purchase as imported into the closet
 *   POST /purchases/:id/dismiss
 */
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, type AuthedRequest } from '../auth/middleware';
import { parseReceipt } from './parser';
import { ingestReceipt, listPurchases, setPurchaseStatus } from './store';

export const purchasesRouter = Router();
purchasesRouter.use(requireAuth);

purchasesRouter.get('/', (req: AuthedRequest, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({ purchases: listPurchases(req.userId!, status) });
});

const parseSchema = z.object({
  from: z.string().optional().default('receipts@unknown'),
  subject: z.string().optional().default('Order confirmation'),
  text: z.string().optional(),
  html: z.string().optional(),
});

purchasesRouter.post('/parse', (req: AuthedRequest, res) => {
  const parsed = parseSchema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.text && !parsed.data.html)) {
    res.status(400).json({ error: 'Provide receipt text or html' });
    return;
  }
  const receipt = parseReceipt(parsed.data);
  if (!receipt) {
    res.status(422).json({ error: "Couldn't find any clothing items in that receipt" });
    return;
  }
  const inserted = ingestReceipt(req.userId!, receipt, 'manual');
  res.json({
    inserted,
    receipt: { retailer: receipt.retailer, currency: receipt.currency, items: receipt.items.length },
    purchases: listPurchases(req.userId!, 'pending'),
  });
});

purchasesRouter.post('/:id/import', (req: AuthedRequest, res) => {
  const ok = setPurchaseStatus(req.userId!, String(req.params.id), 'imported');
  if (!ok) {
    res.status(404).json({ error: 'Purchase not found' });
    return;
  }
  res.json({ ok: true });
});

purchasesRouter.post('/:id/dismiss', (req: AuthedRequest, res) => {
  const ok = setPurchaseStatus(req.userId!, String(req.params.id), 'dismissed');
  if (!ok) {
    res.status(404).json({ error: 'Purchase not found' });
    return;
  }
  res.json({ ok: true });
});
