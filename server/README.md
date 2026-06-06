# WhatToWear API

Backend for the WhatToWear app: **accounts**, **cloud closet sync**, and a
**Claude AI proxy** so the Anthropic API key lives only on the server and never
ships in the mobile bundle.

## Stack

- **Node + Express + TypeScript**
- **SQLite** (`better-sqlite3`) — zero-config persistence; swap for Postgres by
  reimplementing `src/db.ts`.
- **JWT** auth (bcrypt-hashed passwords).
- **zod** request validation.

## Endpoints

| Method | Path            | Auth | Purpose |
|--------|-----------------|------|---------|
| GET    | `/health`       | —    | Liveness + whether AI is configured |
| POST   | `/auth/signup`  | —    | Create account → `{ token, user }` |
| POST   | `/auth/login`   | —    | Log in → `{ token, user }` |
| GET    | `/auth/me`      | ✅   | Current user |
| GET    | `/closet`       | ✅   | Full snapshot of non-deleted items |
| POST   | `/closet/sync`  | ✅   | Delta sync (see below) |
| POST   | `/ai/tag`       | ✅   | Vision: photo → garment attributes |
| POST   | `/ai/outfits`   | ✅   | Stylist: candidates → outfits |
| POST   | `/ai/purchase`  | ✅   | Purchase text → garment attributes |

### Closet sync model

`POST /closet/sync` with `{ since, items: [{ id, updatedAt, deleted, data }] }`:

1. Applies incoming items with **last-write-wins** — an incoming change only
   overwrites a stored item if its `updatedAt >= ` the stored one.
2. Returns every server item changed since `since` (tombstones included) so the
   client can merge. Response: `{ items, serverTime }`.

Deletes are soft (tombstones) so they propagate across devices.

## Running

```bash
cd server
cp .env.example .env       # set JWT_SECRET, and ANTHROPIC_API_KEY to enable AI
npm install
npm run dev                # tsx watch on http://localhost:4000
```

Production build:

```bash
npm run build && npm start
```

When `ANTHROPIC_API_KEY` is unset the `/ai/*` routes return `503` and the app
falls back to its on-device rules engine, so the backend is useful even without
an AI key.

## Connecting the app

Point the Expo app at this server by setting `EXPO_PUBLIC_API_URL` in the app's
`.env` (e.g. `http://localhost:4000` for web, or your machine's LAN IP for a
phone on the same network).

## Notes / roadmap

- For production: put this behind HTTPS, add rate limiting, rotate `JWT_SECRET`,
  and consider refresh tokens. Move from SQLite to Postgres for multi-instance
  deployments.
