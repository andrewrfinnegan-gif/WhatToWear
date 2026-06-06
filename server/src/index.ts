/** WhatToWear API: auth, closet sync, and the Claude AI proxy. */
import cors from 'cors';
import express from 'express';

import { config, isClaudeConfigured, isGmailConfigured } from './config';
import { aiRouter } from './ai/routes';
import { authRouter } from './auth/routes';
import { closetRouter } from './closet/routes';
import { gmailRouter } from './integrations/gmail';
import { purchasesRouter } from './purchases/routes';
import { webhooksRouter } from './webhooks/email';
import './db'; // initialize schema on startup

const app = express();

app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
// Base64 images make tagging payloads large; allow generous JSON bodies.
app.use(express.json({ limit: '12mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, aiConfigured: isClaudeConfigured(), gmailConfigured: isGmailConfigured() });
});

app.use('/auth', authRouter);
app.use('/closet', closetRouter);
app.use('/ai', aiRouter);
app.use('/purchases', purchasesRouter);
app.use('/integrations/gmail', gmailRouter);
app.use('/webhooks', webhooksRouter);

// Fallback error handler.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`WhatToWear API listening on :${config.port} (AI ${isClaudeConfigured() ? 'on' : 'off'})`);
});
