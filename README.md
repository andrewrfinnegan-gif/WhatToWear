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
- **Purchases** — a feed of recent purchases; one tap infers attributes and
  files the garment into your closet.
- **Weather-aware, occasion-aware recommendation engine** — Claude stylist with
  a deterministic on-device rules engine as a fallback, so the app always works.
- A starter wardrobe is seeded on first launch so suggestions work immediately.

## Tech stack

- **Expo (SDK 56) + React Native** — one codebase for iOS & Android (and web).
- **expo-router** — file-based navigation (`app/`).
- **Open-Meteo** — free, keyless weather; `expo-location` for coordinates.
- **Anthropic Claude** — vision tagging (Haiku) + outfit styling (Sonnet).
- **AsyncStorage** — local closet persistence.

## Project layout

```
app/                       # screens (expo-router)
  _layout.tsx              # providers + navigation stack
  (tabs)/                  # Today, Closet, Purchases
  add-item.tsx             # photo → auto-tag → save
  item/[id].tsx            # item detail
src/
  types.ts                 # domain model (ClothingItem, Outfit, Weather…)
  theme.ts                 # design tokens
  config.ts                # API key / model config
  store/                   # closet context + persistence + seed data
  services/
    weather.ts             # Open-Meteo + warmth heuristics
    claude.ts              # vision tagging + stylist + purchase parsing
    recommend.ts           # candidate filtering, scoring, AI+rules orchestration
    purchases.ts           # purchase feed + inference
  components/              # reusable UI
  utils/                   # color mapping, etc.
```

## Running it

```bash
npm install
npm start            # then press i / a, or scan the QR with Expo Go
npm run web          # run in a browser
```

Type-check / bundle check:

```bash
npm run typecheck
npx expo export --platform web   # validates the full module graph
```

### Enabling the AI stylist (optional)

The app runs fully without any API key using the on-device rules engine. To turn
on Claude-powered auto-tagging and styling:

```bash
cp .env.example .env
# add EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
npm start
```

> **Security note:** `EXPO_PUBLIC_*` values are embedded in the client bundle.
> That's fine for local development, but a shipped app must route Claude requests
> through a backend proxy (`EXPO_PUBLIC_ANTHROPIC_PROXY_URL`) so the key never
> reaches devices. The client code already supports this proxy mode.

## Roadmap

- Backend proxy for Claude + user accounts and cloud closet sync.
- Real purchase ingestion (Apple/Google Pay transactions, retailer order emails).
- Background removal on garment photos for cleaner thumbnails.
- "Packing mode" (multi-day trips), laundry/wear tracking, and capsule analysis.
- Learned style preferences from which outfits you actually wear.
```
