# MVP product and content system

## Products

- Personal diary: Today, Week, and Month are periods of one personal-reading screen.
- Zodiac: a separate sign-based horoscope product.
- Natal chart and permanent natal reading.
- Compatibility by sign and a Premium chart-based relationship reading.
- Settings, onboarding, Premium access, support, notifications, administration, and mobile-shell functionality.

## Personal forecast

- The period reader lives in `views/Dashboard.tsx`; there is no separate personal forecast page or a question block beneath a forecast.
- A forecast is a short personal story: headline, one or two paragraphs, one distinct piece of advice, and at most one editorial visual.
- Today focuses on an immediate scene or choice; Week follows one behavioural pattern; Month follows direction, appetite, or capacity.
- Swiss Ephemeris calculates the saved natal chart. It does not calculate transit/evidence payloads for every forecast period.
- OpenAI Luna receives the saved natal profile and user context via the Responses API. Strict JSON Schema controls the output shape; server validation controls the word limits, voice, evidence reference, and forbidden period wording.
- `lib/appVoice.ts` is the runtime voice source.

## Access and cache

- `/api/content/forecast/personal` owns cache lookup and generation under locks.
- The client renders a usable local package first and refreshes it in the background.
- The server slices the package for access tier; client locks are presentation only.
- Cache identity includes user, chart, period, language, model, prompt version, and voice version.

## Product boundaries

- Zodiac remains on its separate DeepSeek route.
- Swiss Ephemeris remains required for natal calculation and permanent natal interpretation.
- “Question for the astrologer” belongs to the natal-reading flow. Old forecast-question server routes are legacy surfaces and must not be restored in the diary UI without a dedicated migration.
- Applied database migrations and data are not removed as a code-cleanup step.

## Visual rules

- Primary navigation lives in the left drawer. Forecast periods are internal to the diary.
- A forecast has no more than one strong image. Text never sits on an image or in an additional visual frame.
- Forecast assets live in `public/assets/forecast-feed/`; do not delete them during code cleanup.
