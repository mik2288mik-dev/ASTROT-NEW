# MVP product and content system

## Products

- Personal diary: Today, Week, and Month are periods of one personal AI-story screen, selected from its drawer.
- Zodiac: a separate sign-based horoscope product.
- Natal chart and permanent natal reading.
- Compatibility by sign and a Premium chart-based relationship reading.
- Settings, onboarding, Premium access, support, notifications, administration, and mobile-shell functionality.

## Personal forecast

- The reader lives in `views/Dashboard.tsx`; there is no separate forecast page, period switcher on the main screen, question block, feedback prompt, or themed feed beneath a forecast.
- A forecast is one short personal story: a 3–8-word heading and one or two paragraphs, no more than 150 words. There is no separate advice, list, conclusion, technical explanation, or visual cue in the generated copy.
- Today, Week, and Month each receive an original narrative for their exact date/range. They do not use a fixed set of life themes, behavioural patterns, or a calendar breakdown.
- Swiss Ephemeris calculates the saved natal chart. That chart supplies private context for the model; it does not produce a separate transit/evidence payload for the forecast period.
- OpenAI Luna receives the selected period plus available birth details and compact natal context via the Responses API, and writes the forecast itself. Strict JSON Schema and server validation control the output shape, 150-word limit, voice, and safety boundaries.
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
- Text is the default. A forecast has no more than one strong image; a curated sticker is rare and has no caption. Text never sits on an image or in an additional visual frame.
- Forecast assets live in `public/assets/forecast-feed/`; do not restore section scenes, captions, or promotional banners from legacy systems during code cleanup.
