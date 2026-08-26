# Current architecture

## Runtime

- `App.tsx` restores the authenticated profile and a saved natal chart without making generation a startup gate.
- `Dashboard` is the only personal-reading surface. Today, Week, and Month are internal periods selected by one controlled three-tab switcher directly below the Today header; they are not primary navigation destinations.
- The client is local-first: it keeps a usable cached reading visible while a server refresh runs in the background.

## Personal forecasts

- `lib/swisseph-calculator.ts` remains the deterministic source for the saved natal chart. It is not called to calculate forecast-period transits or evidence.
- `lib/personalForecastGeneration.ts` builds one private prompt input from the selected date/range, available birth details, saved natal positions/aspects, and bounded anti-repeat history, then asks OpenAI Luna to author the reading. It does not inject a preselected generic psychological topic.
- Luna uses the Responses API with `store: false` and strict JSON Schema through `lib/openaiResponses.ts`. The schema permits exactly four required strings: `title`, `punchline`, `forecast`, and `closing`. Rejected draft text stays server-side and is never serialized into the repair prompt.
- The server renders the four fields in order: generated title, separate sharp punchline, forecast body, and separate conclusion/advice. Today materializes as 4–6 ordered text fragments: the first/main fragment lives in `overview`, and the remainder live in ordered `sections`. Week and Month keep one cohesive body followed by the advice section; Week is longer than Today, and Month is longer than Week.
- Anti-repeat validation derives compact signatures from the generated title, punchline, forecast, and closing, then compares them with bounded history and the reference corpus. The references control voice and form only; they do not supply a personal plot.
- The model is the author of the personal forecast, not a renderer of precomputed themes or a calculator of period events. The server validates format, length, language, forecast voice, safety, unsupported claims, repetition, and visible astrology before persisting the result. Writer attempts remain capped at two.
- `lib/personalForecastCache.ts` caches one materialized package by authenticated user, owned chart ID, full saved-natal fingerprint, hash of sanitized profile fields, period, timezone-aware period key, language, model, calculation, contract, prompt, and voice identity. Before generation, it reads up to 15 recent fragments for the same user and chart across `day`, `week`, and `month`; this is negative prompt context only and is never served as the requested forecast. Compatible stale output must have the current prompt identity.
- `lib/appVoice.ts` owns the shared runtime voice and the separate personal-forecast voice identity. `lib/personalForecastExamples.ts` contains the complete reference corpus — 21 Today, 15 Week, and 20 Month examples — and supplies every reference for the selected period. Forecast-specific bite does not change the global app voice.
- `/api/content/forecast/personal`, its cache, and the client service exchange `PersonalForecastPackage` end to end. Legacy `aiPersonalHoroscope*` fields remain inactive compatibility state rather than an alternate forecast source.
- The client reads local state, checks the server cache with `GET`, then starts generation with `POST`. A `202` is polled with the same `POST` and `regenerate: false`. Startup prewarm remains non-blocking: Free requests only `day`, while Premium sequentially requests `day`, `week`, and `month`.

## Product separation

- `Зодиак` remains a separate sign-based product and keeps its DeepSeek compatibility route.
- Swiss Ephemeris remains required for natal-chart calculation and its permanent interpretations.
- “Вопрос астрологу” belongs to the natal reading and opens from that product; it is not a block inside the personal forecast.

## Visual and navigation boundaries

- One `LumiaBottomTabBar` is the production primary-navigation shell on the main screens; the old drawer is not mounted. Its left zone opens the personal and sign horoscopes, its centre opens compatibility, natal chart, astrologer question, and the encyclopedia, and its right zone opens Settings, Store, and Premium. The top profile action opens profile data and saved charts. Forecast periods remain internal to the Diary through its controlled tabs.
- The active Today surface is the deterministic `calendar-editorial` composition in `TodayEditorialFeed`: `TodayLineField` selects one of 12 line presets and `TodayCalendarClock` selects one of 15 clock presets from `userId + periodKey`. The generated title, clock-adjacent punchline, forecast fragments, and conclusion/advice render as distinct parts of one reading.
- `lib/personalForecastVisuals/diaryVisualEngine.ts`, its five layouts, the 309-image personal catalog, and 19 paper templates remain library-only. The active Today renderer does not mount that planner, `EditorialForecastVisual`, or `EditorialPaperNote`.
- `lib/personalForecastVisuals/personal.manifest.json`, `paper-templates.manifest.json`, and `editorialSelectors.ts` are the personal source of truth. They do not import the legacy Zodiac pool. Zodiac uses its own typed allowlist, `zodiac-legacy-special.manifest.json`, and `lib/zodiacLegacyVisuals/index.ts`; that pool contains only 24 psychedelic and 24 approved funny-animal assets under `/assets/zodiac-legacy-special/`.
- Body prose remains outside imagery and additional cards. Luna never chooses the clock, line preset, asset, coordinates, colour, or layout.

## Android accounts

- Android is the primary product platform. Email registration/password login, email-code confirmation and reset, Google Credential Manager, Yandex LoginSDK 3.1.3, and VK ID SDK 2.7.2 are implemented in the native shell with server-side credential verification.
- Auth capabilities are runtime-aware: Android uses native provider readiness, browser OAuth also requires its server secrets and HTTPS origin, and password login remains independently available when email-code delivery is not configured.
- `account_identities` maps verified email, Google, Yandex, VK, and Telegram identities to one canonical `users.id`. An email match alone never merges users, and an identity already owned by another user cannot be captured. Natal chart, forecast history, Premium, and saved data remain attached to the canonical user.
- Native sessions are restored from Android Keystore-backed storage and are revocable server-side. Login/link flows guard cancel, Back, repeated taps, cold start, and concurrent callbacks.
- Migration `mvp_043_password_authentication` adds password credentials and email-code state. Provider console credentials, email delivery, Railway secrets, production migration execution, release signing fingerprints, and live device verification remain manual deployment work.

## Persistence boundary

- Existing migrations and stored data are append-only history; do not delete database tables as a code-cleanup step.
- Legacy forecast-question server routes remain isolated until their shared natal-question utilities are explicitly migrated. They are not part of the rendered forecast UI.
