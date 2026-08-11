# Current repository context

## Product

Your Horoscope is a Next.js/React Telegram Mini App with PostgreSQL-backed chart data, personal forecasts, Premium access through Telegram Stars, and a Capacitor Android target.

## Personal AI forecast

The active personal forecast experience lives in `views/Dashboard.tsx`. It is one short, personal AI-written story for Today, Week, or Month. The period is selected in the diary drawer; the main screen has no period tabs, thematic sections, cards, or separate reader pages.

- UI: `components/PersonalForecastFeed/` and `styles/personalForecastFeed.css`
- Contract and cache identity: `lib/personalForecastContract.ts`
- Generation: `lib/personalForecastGeneration.ts` sends OpenAI Luna the selected date/range and a compact private context from the saved natal profile. Luna is the author of the forecast prose.

Swiss Ephemeris calculates and stores the natal chart. It does not calculate a separate transit/evidence package for every forecast period. The model must never present its interpretation as a deterministic calculation or invent astrological facts not supplied by the server.

OpenAI Luna through the Responses API is the route for personal forecast prose. Zodiac remains a separate sign-based product with its DeepSeek route.

## Current visual direction

Forecast copy is a clean, readable text story: a short heading and one or two paragraphs, at most 150 words in total. Text is never placed over imagery or inside a card. Images and stickers are optional, rare editorial pauses after the story; they have no explanatory caption and never choose the forecast topic. Do not add promo banners, feedback prompts, questions, or unrelated blocks to the active story without an explicit product decision.

## Useful commands

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npm run build
```

Use targeted tests first for a scoped UI change. Deployment and Railway checks require an explicit request.
