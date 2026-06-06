/** Auth API calls. */
import { apiFetch } from '@/api/client';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  /** Per-user alias for the receipt-forwarding address. */
  ingestAlias?: string | null;
  /** Address users forward receipts to (null until the server sets INGEST_DOMAIN). */
  ingestAddress?: string | null;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function signup(email: string, password: string, displayName?: string) {
  return apiFetch<AuthResponse>('/auth/signup', {
    method: 'POST',
    auth: false,
    body: { email, password, displayName },
  });
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
}

export function fetchMe() {
  return apiFetch<{ user: AuthUser }>('/auth/me');
}
