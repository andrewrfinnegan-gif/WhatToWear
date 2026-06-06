/** Express middleware that requires a valid Bearer token and attaches the user. */
import type { NextFunction, Request, Response } from 'express';

import { verifyToken } from './security';

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }
  try {
    const payload = verifyToken(header.slice('Bearer '.length));
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
