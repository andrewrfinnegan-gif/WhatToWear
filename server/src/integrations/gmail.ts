/**
 * Gmail connector (env-gated). Lets a user connect their inbox so order-
 * confirmation emails from clothing retailers are scanned and parsed into
 * purchases automatically.
 *
 *   GET  /integrations/gmail/status     is it configured / connected?
 *   GET  /integrations/gmail/auth-url   begin OAuth (returns Google consent URL)
 *   GET  /integrations/gmail/callback   OAuth redirect target (exchanges code)
 *   POST /integrations/gmail/sync       scan recent retailer emails -> purchases
 *
 * Requires GOOGLE_CLIENT_ID/SECRET + PUBLIC_BASE_URL. Without them every route
 * returns 503. The OAuth + message-fetch paths need live Google credentials and
 * are not exercised by the test suite; the parsing they feed into is.
 */
import { Router } from 'express';

import { config, isGmailConfigured } from '../config';
import { db, type IntegrationRow } from '../db';
import { requireAuth, type AuthedRequest } from '../auth/middleware';
import { signToken, verifyToken } from '../auth/security';
import { parseReceipt, type RawEmail } from '../purchases/parser';
import { ingestReceipt } from '../purchases/store';

export const gmailRouter = Router();

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Retailers we search for; mirrors the parser's registry.
const RETAILER_DOMAINS = [
  'bonobos.com', 'uniqlo.com', 'jcrew.com', 'nike.com', 'adidas.com', 'zara.com',
  'hm.com', 'everlane.com', 'lululemon.com', 'gap.com', 'oldnavy.com',
  'nordstrom.com', 'ssense.com', 'thursdayboots.com', 'amazon.com',
];

function redirectUri(): string {
  return `${config.publicBaseUrl}/integrations/gmail/callback`;
}

gmailRouter.get('/status', requireAuth, (req: AuthedRequest, res) => {
  if (!isGmailConfigured()) {
    res.json({ configured: false, connected: false });
    return;
  }
  const row = db
    .prepare('SELECT user_id, last_sync_at FROM integrations WHERE user_id = ? AND provider = ?')
    .get(req.userId, 'gmail') as Pick<IntegrationRow, 'user_id' | 'last_sync_at'> | undefined;
  res.json({ configured: true, connected: !!row, lastSyncAt: row?.last_sync_at ?? null });
});

gmailRouter.get('/auth-url', requireAuth, (req: AuthedRequest, res) => {
  if (!isGmailConfigured()) {
    res.status(503).json({ error: 'Gmail integration is not configured' });
    return;
  }
  // Encode the user id in a short-lived signed state to tie the callback back.
  const state = signToken({ sub: req.userId!, email: req.userEmail ?? '' });
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: SCOPE,
    state,
  });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

gmailRouter.get('/callback', async (req, res) => {
  if (!isGmailConfigured()) {
    res.status(503).send('Gmail integration is not configured');
    return;
  }
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state) {
    res.status(400).send('Missing code/state');
    return;
  }
  let userId: string;
  try {
    userId = verifyToken(state).sub;
  } catch {
    res.status(400).send('Invalid state');
    return;
  }

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(await tokenRes.text());
    const tok = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    db.prepare(
      `INSERT INTO integrations (user_id, provider, access_token, refresh_token, expires_at, last_sync_at)
       VALUES (@user_id, 'gmail', @access_token, @refresh_token, @expires_at, NULL)
       ON CONFLICT(user_id, provider) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, integrations.refresh_token),
         expires_at = excluded.expires_at`,
    ).run({
      user_id: userId,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? null,
      expires_at: Date.now() + tok.expires_in * 1000,
    });

    // Bounce back into the app.
    res.redirect(`${config.appRedirect}?gmail=connected`);
  } catch (err) {
    console.error('Gmail OAuth failed', err);
    res.status(502).send('Failed to connect Gmail');
  }
});

/** Return a valid access token, refreshing if expired. */
async function getAccessToken(userId: string): Promise<string | null> {
  const row = db
    .prepare('SELECT * FROM integrations WHERE user_id = ? AND provider = ?')
    .get(userId, 'gmail') as IntegrationRow | undefined;
  if (!row) return null;

  if (row.expires_at && row.expires_at > Date.now() + 60_000 && row.access_token) {
    return row.access_token;
  }
  if (!row.refresh_token) return row.access_token;

  const refreshRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!refreshRes.ok) return null;
  const tok = (await refreshRes.json()) as { access_token: string; expires_in: number };
  db.prepare('UPDATE integrations SET access_token = ?, expires_at = ? WHERE user_id = ? AND provider = ?').run(
    tok.access_token,
    Date.now() + tok.expires_in * 1000,
    userId,
    'gmail',
  );
  return tok.access_token;
}

// --- MIME helpers -----------------------------------------------------------

function b64urlDecode(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

/** Walk the MIME tree collecting the first text/plain and text/html bodies. */
function extractBodies(part: GmailPart, acc: { text?: string; html?: string }): void {
  if (part.mimeType === 'text/plain' && part.body?.data && !acc.text) {
    acc.text = b64urlDecode(part.body.data);
  } else if (part.mimeType === 'text/html' && part.body?.data && !acc.html) {
    acc.html = b64urlDecode(part.body.data);
  }
  for (const p of part.parts ?? []) extractBodies(p, acc);
}

function header(part: GmailPart, name: string): string {
  return part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

/** Convert a full Gmail message into the parser's RawEmail shape. */
function toRawEmail(message: { payload: GmailPart; internalDate?: string }): RawEmail {
  const bodies: { text?: string; html?: string } = {};
  extractBodies(message.payload, bodies);
  return {
    from: header(message.payload, 'From'),
    subject: header(message.payload, 'Subject'),
    text: bodies.text,
    html: bodies.html,
    receivedAt: message.internalDate ? Number(message.internalDate) : Date.now(),
  };
}

gmailRouter.post('/sync', requireAuth, async (req: AuthedRequest, res) => {
  if (!isGmailConfigured()) {
    res.status(503).json({ error: 'Gmail integration is not configured' });
    return;
  }
  const token = await getAccessToken(req.userId!);
  if (!token) {
    res.status(409).json({ error: 'Gmail not connected' });
    return;
  }

  try {
    const fromQuery = RETAILER_DOMAINS.map((d) => `from:${d}`).join(' OR ');
    const q = `newer_than:90d (${fromQuery}) (subject:order OR subject:receipt OR subject:confirmation OR subject:shipped)`;
    const listRes = await fetch(
      `${GMAIL_API}/messages?maxResults=25&q=${encodeURIComponent(q)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!listRes.ok) throw new Error(await listRes.text());
    const list = (await listRes.json()) as { messages?: { id: string }[] };

    let inserted = 0;
    let scanned = 0;
    for (const msg of list.messages ?? []) {
      const msgRes = await fetch(`${GMAIL_API}/messages/${msg.id}?format=full`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!msgRes.ok) continue;
      const full = (await msgRes.json()) as { payload: GmailPart; internalDate?: string };
      scanned++;
      const receipt = parseReceipt(toRawEmail(full));
      if (receipt) inserted += ingestReceipt(req.userId!, receipt, 'gmail');
    }

    db.prepare('UPDATE integrations SET last_sync_at = ? WHERE user_id = ? AND provider = ?').run(
      Date.now(),
      req.userId,
      'gmail',
    );
    res.json({ ok: true, scanned, inserted });
  } catch (err) {
    console.error('Gmail sync failed', err);
    res.status(502).json({ error: 'Gmail sync failed' });
  }
});
