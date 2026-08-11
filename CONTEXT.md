# Current repository context

## Product

Your Horoscope is a Next.js/React Telegram Mini App with PostgreSQL-backed chart data, personal forecasts, Premium access through Telegram Stars, and a Capacitor Android target.

## Personal AI forecast

The active personal forecast experience lives in `views/Dashboard.tsx`. The period is selected in the diary drawer; the main screen has no period tabs, cards, or separate reader pages. Today is a continuous reading feed of 4–6 AI-written fragments. Week and Month are each one cohesive AI-written personal story.

- UI: `components/PersonalForecastFeed/` and `styles/personalForecastFeed.css`
- Contract and cache identity: `lib/personalForecastContract.ts`
- Generation: `lib/personalForecastGeneration.ts` sends OpenAI Luna the selected date/range, saved personal/natal context, and bounded recent-copy anti-repeat context. Luna authors all visible forecast prose. The old generic `profileNarrativeDirection`/editorial-topic rotation is not part of the product.

Swiss Ephemeris calculates and stores the natal chart. It does not calculate a separate transit/evidence package for every forecast period. The model must never present its interpretation as a deterministic calculation or invent astrological facts not supplied by the server.

OpenAI Luna through the Responses API is the route for personal forecast prose. Strict structured output returns one shared headline and hidden service metadata plus the visible fragments. Hidden metadata exists only to validate diversity and is never a visible category. Zodiac remains a separate sign-based product with its DeepSeek route.

## Current visual direction

Forecast copy is clean and readable: a short shared heading and at most 150 words in total. Today reads top-to-bottom as 4–6 untitled fragments with no visible Love/Work/Mood categories; Week and Month remain single stories. Text is never placed over imagery or inside a card. Images and stickers are optional, rare editorial pauses; they have no explanatory caption and never choose the forecast topic. Do not add promo banners, feedback prompts, questions, “hit/miss” controls, chat, games, or morning/day/evening segmentation without an explicit product decision.

## Useful commands

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npm run build
```

Use targeted tests first for a scoped UI change. Deployment and Railway checks require an explicit request.
