/**
 * Client runtime configuration.
 *
 * The app talks to the WhatToWear backend for accounts, cloud closet sync, and
 * AI (the Anthropic key lives only on the server — never in this bundle). Set
 * the backend URL via EXPO_PUBLIC_API_URL in .env:
 *
 *   EXPO_PUBLIC_API_URL=http://localhost:4000     # web / simulator
 *   EXPO_PUBLIC_API_URL=http://192.168.x.x:4000   # phone on same LAN
 *
 * With no API URL set, the app runs fully offline: local-only closet and the
 * on-device rules engine for outfits.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export function isApiConfigured(): boolean {
  return API_URL.length > 0;
}
