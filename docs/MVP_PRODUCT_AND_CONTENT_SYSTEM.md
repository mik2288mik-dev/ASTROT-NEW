# MVP Product And Content System

This is the active product and content source of truth for "Tvoi Goroskop" / "Your Horoscope".

## 1. MVP Functions

- Home screen with a personal daily reading.
- Daily, weekly, and monthly sign horoscopes.
- Natal chart calculation and natal reading screens.
- Free sign compatibility.
- Premium relationship reading by two saved charts.
- Matrix of Destiny with free short and Premium full views.
- Premium calendar/archive for saved personal daily readings.
- Settings, profile, onboarding, subscription, support, admin, and notification system screens needed to operate the MVP.

## 2. Free And Premium

- Personal daily: Free users receive the card, overview, and one additional topic chosen by the backend. Premium users receive all nine topics and summary.
- Sign horoscope: daily/weekly/monthly sign content is Free.
- Natal chart: chart calculation and teaser/basic entry are Free; full report, planet insight, living/current-period sections, and topic sections require Premium.
- Sign compatibility: Free and chart-free.
- Detailed relationship reading: Premium and chart-based.
- Matrix of Destiny: short result is Free, full report is Premium.
- Calendar/archive: Premium only.

Backend access is enforced by `lib/accessMatrix.ts`, `lib/contentAccessMatrix.ts`, `lib/contentArchitecture.ts`, and Premium entitlement helpers. The frontend can show locks and CTAs, but it is not the source of truth.

## 3. Data Path

- App auth is resolved through `requireAppUser` / `lib/auth/appAuth.ts` for Telegram users, signed web guests, and native-ready sessions.
- The canonical chart write/read surface is `/api/charts`. Primary chart creation and repair use `ensureCanonicalPrimaryChart`; additional saved charts use `createOrReuseCanonicalChart`.
- Swiss Ephemeris calculations live in `lib/swisseph-calculator.ts`; AI receives structured chart/transit evidence and does not calculate astronomy.
- Product content APIs live under `/api/content/*`.
- AI prompts use the unified voice from `lib/appVoice.ts` and route through the OpenAI client/generation helpers already used by active content modules.
- Active persistence uses PostgreSQL through `lib/db.ts` and immutable migrations in `lib/migrations.ts`.

## 4. Personal Daily Canvas

The personal daily reading is generated and stored as one canvas through `pages/api/content/natal/human-daily.ts`.

The canonical canvas shape is:

- `card.title`
- `card.teaser`
- `card.positive_points`
- `card.caution_points`
- `sections`
- `summary`
- `meta.free_section_key`

The required section order is:

1. `overview`
2. `love`
3. `money`
4. `work`
5. `goals`
6. `family`
7. `friendship`
8. `energy`
9. `communication`

The canvas is generated once under a shared daily cache key, then individual UI tabs are sliced from that same saved canvas. Free access is decided by `meta.free_section_key`: `overview` is always Free, and exactly one of the other eight topics is Free. The key is selected by backend logic in `lib/natalHumanInterpretation.ts` and is stable for the saved reading.

## 5. Persistence And Archive

- Natal charts are stored in `natal_charts` with canonical input hashes, calculation version, chart data, coordinates, and primary-chart status.
- Personal daily canvas content is stored in `content_interpretations` under `content_surface='natal'`, `content_variant='living'`, cache key `personal_daily.canvas.YYYY-MM-DD`, and prompt version `HUMAN_DAILY_PROMPT_VERSION`.
- Sign horoscopes use shared `content_cache`.
- Forecast, natal, and synastry layers use `content_interpretations` and `synastry_cache` according to `lib/contentAccessMatrix.ts`.
- Past daily readings are read from saved rows. Archive views must not generate missing past days on read.
- When birth data changes, chart persistence creates or repairs a canonical chart version by input hash. New readings use the new chart/input hash; old saved rows stay tied to the old chart/cache context.

## 6. Voice Rules

The app speaks like a direct, kind, smart friend: concrete, warm, concise, and useful. It uses "you", avoids fatalism, avoids fear, avoids fake certainty, and does not bury practical advice under mystical filler.

Do:

- Name real situations plainly.
- Give one useful next move.
- Keep sensitive topics respectful.
- Let humor stay light and occasional.

Do not use:

- Generic wellness filler.
- Fate/prophesy language.
- Empty cosmic abstractions.
- Product names from removed systems.
- Copy that says a day or horoscope is "ready" as a ritual catchphrase.

The runtime voice source is `lib/appVoice.ts`. Prompt builders and fallback text should use it or match it.

## 7. Cleanup Boundary

Only the MVP functions listed above belong to the active product surface. Deprecated chat, utility, currency, one-off purchase, standalone daily-assistant, and compatibility systems are not part of runtime, UI, active prompts, or product documentation.

Detailed removed-name tracking lives in `docs/MVP_LEGACY_REMOVAL_LOG.md`. Schema cleanup is implemented by migration `mvp_036_schema_cleanup` in `lib/migrations.ts`.

## 8. Active Tables

Core active tables include:

- `users`
- `user_sessions`
- `natal_charts`
- `content_interpretations`
- `content_cache`
- `synastry_cache`
- `content_unlocks`
- `premium_entitlements`
- `star_payments`
- `daily_checkins`
- notification/admin/support tables required by the operational backoffice

The cleanup migration removes legacy product tables that are no longer part of the MVP.

## 9. Active AI Generations

- Personal daily canvas.
- Free personal/sign daily forecast where the route needs generation.
- Sign weekly/monthly horoscope.
- Natal anchor/full/living/planet insight.
- Premium synastry.
- Matrix interpretation where the active matrix flow needs generated text.
- Notification/admin text only for real MVP notification scenarios.

All generated user-facing text must use structured inputs and the app voice.
