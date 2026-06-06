# WhatToWear

Stop staring at your closet. WhatToWear suggests complete, weather-aware outfits
for whatever you're doing today — built entirely from clothes you actually own.

It's for people who don't have a strong sense of what matches: you tell it the
setting (casual, work, formal, date…), it reads your local weather, and an AI
stylist assembles coordinated outfits from your digital closet with a one-line
explanation of why each works.

## Why this exists

Two problems make "what do I wear" hard:

1. **Coordination** — knowing which pieces go together, and dressing for the
   weather. WhatToWear handles both automatically.
2. **The upload bottleneck** — a closet app is only useful if your clothes are
   in it, and manually entering each garment is tedious. WhatToWear attacks this
   from two sides:
   - **Photo auto-tagging** — snap a photo and Claude vision fills in the type,
     colors, formality, and warmth. Confirming an item is a few taps.
   - **Purchase import** — clothing you buy on your phone is detected and filed
     into your closet automatically, no photo or typing required.

## Features (current vertical slice)

- **Today** — weather banner + occasion picker → ranked outfit suggestions with
  a "Wear this" action that feeds garment rotation back into future picks.
- **Closet** — filterable grid of your wardrobe; add items via camera/library.
- **Add item** — photo → Claude vision auto-tags every attribute (manual entry
  works too, and is the fallback when no API key is set).
- **Purchases** — real purchase integration: order-confirmation emails are
  parsed into clothing line items (forward/paste, an inbound-email webhook, or a
  connected Gmail inbox); one tap infers attributes and files the garment.
- **Weather-aware, occasion-aware recommendation engine** — Claude stylist with
  a deterministic on-device rules engine as a fallback, so the app always works.
- A starter wardrobe is seeded on first launch so suggestions work immediately.

## Accounts, cloud sync & the AI proxy

The app works fully **offline as a guest** (local closet + on-device rules
engine). Signing in unlocks two things, both served by the backend in
[`server/`](./server):

- **Cloud closet sync** — your wardrobe syncs across devices via a delta sync
  with last-write-wins on `updatedAt`; deletes propagate as tombstones.
- **AI stylist + auto-tagging** — the app calls the backend's `/ai/*` proxy; the
  **Anthropic API key lives only on the server and never ships in the app
  bundle.** If the server has no key, AI routes return 503 and the app falls
  back to the rules engine.

The client keeps the JWT in the device keychain (`expo-secure-store`) and routes
all authenticated requests through `src/api/`.

## Tech stack

**App**
- **Expo (SDK 56) + React Native** — one codebase for iOS & Android (and web).
- **expo-router** — file-based navigation (`app/`).
- **Open-Meteo** — free, keyless weather; `expo-location` for coordinates.
- **AsyncStorage** — local closet cache; **expo-secure-store** — token storage.

**Backend** (`server/`)
- **Node + Express + TypeScript**, **SQLite** (`better-sqlite3`), **JWT** auth
  (bcrypt), **zod** validation, and a server-side **Claude** proxy
  (Haiku for tagging, Sonnet for styling).

## Project layout

```
app/                       # screens (expo-router)
  _layout.tsx              # Auth + Closet providers + navigation stack
  (tabs)/                  # Today, Closet, Purchases, Account
  add-item.tsx             # photo → auto-tag → save
  item/[id].tsx            # item detail
src/
  types.ts                 # domain model (ClothingItem, Outfit, Weather…)
  theme.ts                 # design tokens
  config.ts                # backend URL config
  api/                     # client, auth, closet-sync API calls
  store/                   # auth + closet contexts (sync, persistence, seed)
  services/
    weather.ts             # Open-Meteo + warmth heuristics
    claude.ts              # AI client over the backend /ai/* proxy
    recommend.ts           # candidate filtering, scoring, AI+rules orchestration
    purchases.ts           # purchase feed + inference
  components/              # reusable UI
  utils/                   # color mapping, secure storage
server/                    # backend API (see server/README.md)
```

## Running it

**1. Backend** (optional but needed for accounts/sync/AI):

```bash
cd server
cp .env.example .env       # set JWT_SECRET; add ANTHROPIC_API_KEY to enable AI
npm install
npm run dev                # http://localhost:4000
```

**2. App:**

```bash
npm install
cp .env.example .env       # set EXPO_PUBLIC_API_URL to your backend (or leave unset for offline)
npm start                  # press i / a, or scan the QR with Expo Go
npm run web                # run in a browser
```

Type-check / bundle check:

```bash
npm run typecheck
npx expo export --platform web   # validates the full module graph
```

## Roadmap

- ~~Backend proxy for Claude + user accounts and cloud closet sync.~~ ✅
- Refresh tokens, rate limiting, and a managed Postgres for multi-instance deploys.
- ~~Real purchase ingestion (retailer order emails).~~ ✅ (forward/paste, inbound webhook, Gmail)
- ~~Per-retailer receipt extractors.~~ ✅ (pluggable registry: Shopify, Amazon, Nike + generic; more to add)
- Product-image enrichment for imported purchases.
- Background removal on garment photos for cleaner thumbnails.
- "Packing mode" (multi-day trips), laundry/wear tracking, and capsule analysis.
- Learned style preferences from which outfits you actually wear.
```
