/**
 * Inbound-email webhook — the production automation path.
 *
 * An email provider's inbound-parse feature (SendGrid Inbound Parse, Postmark,
 * Mailgun Routes, Cloudflare Email Workers, …) forwards messages sent to a
 * user's unique ingest address to this endpoint. We verify a shared secret,
 * resolve the address to a user via their ingest alias, parse the receipt, and
 * store any clothing line items.
 *
 * The payload is normalized to { to, from, subject, text, html }; a few-line
 * adapter maps each provider's native shape to this (see server/README.md).
 */
import { Router } from 'express';
import { z } from 'zod';

import { config } from '../config';
import { db, type UserRow } from '../db';
import { parseReceipt } from '../purchases/parser';
import { ingestReceipt } from '../purchases/store';

export const webhooksRouter = Router();

const payloadSchema = z.object({
  to: z.string(),
  from: z.string(),
  subject: z.string().optional().default(''),
  text: z.string().optional(),
  html: z.string().optional(),
});

/** Extract the ingest alias from a recipient string like "u_ab12@inbound.host". */
function aliasFromRecipient(to: string): string | null {
  // Match the local part of any address; aliases are alnum tokens.
  const matches = to.match(/([a-z0-9]+)@/gi);
  if (!matches) return null;
  for (const m of matches) {
    const local = m.replace('@', '');
    const user = db.prepare('SELECT id FROM users WHERE ingest_alias = ?').get(local) as
      | Pick<UserRow, 'id'>
      | undefined;
    if (user) return local;
  }
  return null;
}

webhooksRouter.post('/email', (req, res) => {
  // Verify shared secret (header or ?secret=). Reject if unconfigured.
  const provided = req.header('x-webhook-secret') ?? (req.query.secret as string | undefined);
  if (!config.webhookSecret || provided !== config.webhookSecret) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }

  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const alias = aliasFromRecipient(parsed.data.to);
  if (!alias) {
    // Unknown recipient: ack so the provider doesn't retry forever.
    res.json({ ok: true, ignored: 'unknown recipient' });
    return;
  }
  const user = db.prepare('SELECT id FROM users WHERE ingest_alias = ?').get(alias) as
    | Pick<UserRow, 'id'>
    | undefined;
  if (!user) {
    res.json({ ok: true, ignored: 'unknown recipient' });
    return;
  }

  const receipt = parseReceipt(parsed.data);
  if (!receipt) {
    res.json({ ok: true, inserted: 0, note: 'no clothing items found' });
    return;
  }
  const inserted = ingestReceipt(user.id, receipt, 'email');
  res.json({ ok: true, inserted });
});
