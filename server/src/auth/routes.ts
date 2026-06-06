/** Auth endpoints: signup, login, and current-user lookup. */
import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { db, type UserRow } from '../db';
import { requireAuth, type AuthedRequest } from './middleware';
import { hashPassword, signToken, verifyPassword } from './security';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().trim().min(1).max(80).optional(),
});

function publicUser(row: Pick<UserRow, 'id' | 'email' | 'display_name'>) {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

authRouter.post('/signup', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const { email, password, displayName } = parsed.data;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' });
    return;
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  db.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, email, passwordHash, displayName ?? null, Date.now());

  const token = signToken({ sub: id, email });
  res.status(201).json({ token, user: publicUser({ id, email, display_name: displayName ?? null }) });
});

authRouter.post('/login', async (req, res) => {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password' });
    return;
  }
  const { email, password } = parsed.data;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user: publicUser(user) });
});

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const user = db.prepare('SELECT id, email, display_name FROM users WHERE id = ?').get(req.userId) as
    | Pick<UserRow, 'id' | 'email' | 'display_name'>
    | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: publicUser(user) });
});
