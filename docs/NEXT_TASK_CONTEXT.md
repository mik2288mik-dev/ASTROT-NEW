# Next Task Context

This repository is the MVP app «Твой Гороскоп» / “Your Horoscope”.

## Current personal forecast architecture

The complete personal screen contract in `docs/PERSONAL_FORECAST_SCREEN_V2_TASK.md` is implemented on `feat/personal-forecast-screen-v2`:

- one chart-based product for `Сегодня / Неделя / Месяц / Год`;
- exactly seven fixed topics plus two or three evidence-selected dynamic topics;
- server-calculated Swiss Ephemeris evidence with stable IDs;
- GPT explains only evidence assigned to one topic;
- one versioned package/cache/lock path for all four periods;
- local-first Dashboard and background refresh/prewarm;
- backend Free/Premium slicing;
- deterministic whole-screen visual resolver with CSS fallback;
- separate `Зодиак` sign-horoscope product preserved.

The incompatible personal daily canvas, period extras, fallback copy, and sign-based Dashboard period consumers have been removed. Old database rows are retained but do not match V2 keys.

## Architecture boundaries

- Root UI: `App.tsx`; screens: `views/`; reusable UI: `components/`.
- Personal contract: `lib/personalForecastContract.ts`.
- Evidence calculation: `lib/personalForecastEvidence.ts`.
- Generation and validation: `lib/personalForecastGeneration.ts`.
- Server cache/locks: `lib/personalForecastCache.ts`.
- Client stale-while-revalidate: `services/personalForecastService.ts`.
- Endpoint: `/api/content/forecast/personal`.
- Prewarm: `lib/personalForecastPrewarm.ts`, `lib/contentPrewarm.ts`, and `services/contentPrewarmService.ts`.
- Visual resolver: `lib/personalForecastVisuals.ts`.
- App auth: `lib/auth/appAuth.ts`.
- Canonical charts: `/api/charts/*`.
- Unified user-facing model resolver: `getUnifiedContentModel()`; default model: GPT-4.1.
- AI voice source: `lib/appVoice.ts`.
- Sign horoscopes remain a separate `Зодиак` product and must never power personal Dashboard periods.

## Safety boundaries for follow-up work

- Do not restore daily-canvas, personal period-extra, or sign-based personal Dashboard code.
- Do not delete old database content as part of an unrelated change.
- Do not copy or rename images to fill missing visual slots; use the documented fallback until distinct artwork exists.
- Keep visual-manifest versioning independent from prompt/text cache versioning.
- Preserve local-first startup: a cache miss or background error must not hide or close Dashboard.
- Update the existing architecture documents when changing the personal forecast contract; do not add another task document.

## Required completion checks

For changes touching this product run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Also search for working imports of removed personal systems and confirm that `views/Dashboard.tsx` contains no sign-horoscope endpoint or service calls.

## Release manual QA

Before release, verify Telegram Mini App safe areas, native and Telegram back/swipe behavior, notification and share deep links, and startup/retry behavior on a slow network.
