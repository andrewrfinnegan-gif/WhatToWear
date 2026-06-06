/**
 * Thin HTTP client for the WhatToWear backend. Holds the auth token in a
 * module-level variable (set by the auth store) so any service can make
 * authenticated calls without prop-drilling the token.
 */
import { API_URL, isApiConfigured } from '@/config';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function hasAuthToken(): boolean {
  return authToken !== null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Set false for endpoints that must not send the token (signup/login). */
  auth?: boolean;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured()) throw new ApiError('Backend URL is not configured', 0);

  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth && authToken) headers.authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Network request failed', 0);
  }

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
