# Current repository context

## Product

Your Horoscope is a Next.js/React Telegram Mini App with PostgreSQL-backed chart data, personal forecasts, Premium access through Telegram Stars, and a Capacitor Android target.

## Personal Forecast Feed

The active personal forecast experience lives in `views/Dashboard.tsx`. Today, Week, and Month are periods of one feed; the screen is not a set of reader pages or forecast cards.

- UI components: `components/PersonalForecastFeed/`
- Contract, cache identity, access slicing: `lib/personalForecastContract.ts`
- Evidence and generation: `lib/personalForecastEvidence.ts`, `lib/personalForecastGeneration.ts`
- Visual selection: `lib/personalForecastVisuals.ts`
- Feed styles: `styles/personalForecastFeed.css`
- Native promo placement: `lib/personalForecastPromo.ts`

OpenAI Luna through the Responses API is the fixed route for every generated surface except the separate Zodiac product, which keeps DeepSeek. Calculations, server cache, question flow, and Free/Premium rules remain production boundaries.

## Current visual direction

Forecast copy remains a centered, concise text feed. Each section can have a light, semantic background scene that fades into white; these are not containers or cards. Generated source assets belong in `public/assets/forecast-feed/`. Cross-product navigation may use separate album-cover-style banner promos.

## Useful commands

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npm run build
```

Use targeted tests first for a scoped UI change. Deployment and Railway checks require an explicit request.
