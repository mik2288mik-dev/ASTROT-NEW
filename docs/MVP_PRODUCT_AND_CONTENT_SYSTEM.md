# MVP product and content system

## Products

- Personal diary: Today, Week, and Month are periods of one personal AI-reading screen, selected from its drawer.
- Zodiac: a separate sign-based horoscope product.
- Natal chart and permanent natal reading.
- Compatibility by sign and a Premium chart-based relationship reading.
- Settings, onboarding, Premium access, support, notifications, administration, and mobile-shell functionality.

## Personal forecast

- The reader lives in `views/Dashboard.tsx`; there is no separate forecast page, period switcher on the main screen, question block, feedback prompt, “hit/miss” control, chat, game, or time-of-day forecast.
- Today is a continuous personal feed: one 3–8-word shared headline and 4–6 sequential untitled text fragments, no more than 150 visible words in total. The first fragment is `overview`; the following fragments are ordered `sections`. Love/Work/Mood and other categories are never visible.
- Week and Month each receive one cohesive personal story for their exact range. They are not multi-card feeds and have no Monday-to-Sunday, week-part, or month-part breakdown.
- None of the three periods uses a fixed set of life themes, preselected behavioural patterns, separate advice blocks, or generic newspaper-horoscope categories. Internal post-hoc service keys are allowed only for diversity validation and are never rendered.
- Swiss Ephemeris calculates the saved natal chart. That chart supplies private context for the model; it does not produce a separate transit/evidence payload for the forecast period.
- OpenAI Luna receives the selected period plus available birth details, saved natal context, and bounded recent forecast excerpts via the Responses API, and writes the forecast itself. Recent excerpts are negative anti-repeat context, not factual biography and not fallback copy.
- Strict JSON Schema and server validation control the fragment count, 150-word limit, language, forecast-specific voice, safety, unsupported claims, and repetition. The writer has at most two attempts.
- `lib/appVoice.ts` is the runtime voice source. Its personal-forecast layer may be sharper and occasionally ironic without changing the global app voice.

## Access and cache

- `/api/content/forecast/personal` owns cache lookup and generation under locks.
- The client renders a usable local package first and refreshes it in the background.
- The server slices the package for access tier; client locks are presentation only.
- Cache identity includes user, chart, period, language, model, prompt version, and voice version.
- Existing Premium slicing and local-first behavior remain unchanged; history lookup does not bypass access control or replace the current-period cache entry.

## Product boundaries

- Zodiac remains on its separate DeepSeek route.
- Swiss Ephemeris remains required for natal calculation and permanent natal interpretation.
- “Question for the astrologer” belongs to the natal-reading flow. Old forecast-question server routes are legacy surfaces and must not be restored in the diary UI without a dedicated migration.
- Applied database migrations and data are not removed as a code-cleanup step.

## Visual rules

- Primary navigation lives in the left drawer. Forecast periods are internal to the diary.
- Text is the default. A forecast has no more than one strong image; a curated sticker is rare and has no caption. Text never sits on an image or in an additional visual frame.
- Forecast assets live in `public/assets/forecast-feed/`; do not restore section scenes, captions, or promotional banners from legacy systems during code cleanup.
