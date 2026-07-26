# MVP Product And Content System

This is the product-level source of truth for «Твой Гороскоп» / “Your Horoscope”.

## 1. MVP products

- Personal forecast screen: `Сегодня / Неделя / Месяц / Год`.
- Separate general `Зодиак` product with sign-based forecasts.
- Natal chart calculation and natal readings.
- Free sign compatibility.
- Premium chart-based relationship reading.
- Matrix of Destiny with Free/Premium layers.
- Premium calendar/archive for saved personal readings.
- Settings, onboarding, subscription, support, admin, notifications, and mobile-shell functionality required to operate the MVP.

## 2. Personal forecast screen — active product

The implemented contract is documented in:

`docs/PERSONAL_FORECAST_SCREEN_V2_TASK.md`

All four periods are personal and use the user’s natal chart plus calculated influences for the selected interval. Sign horoscopes must not power these tabs.

Every period has the same seven fixed topics:

1. Твой день / Твоя неделя / Твой месяц / Твой год
2. Любовь
3. Работа и дела
4. Деньги
5. Настроение и силы
6. Общение
7. Удача

The server additionally selects 2–3 dynamic topics from calculated evidence. The model does not invent topic titles or life events.

Each topic contains:

- `card` — concise useful answer for the main screen;
- `reading` — complete explanation of the selected topic;
- `astrology.explanation` — human-readable reason for the result;
- verified evidence references generated from server calculations.

The personal screen uses one unified user-facing model resolver, default GPT-4.1. Astronomy and topic evidence are calculated in code; GPT only explains supplied evidence.

## 3. Runtime boundary

- Today/Week/Month/Year all use the same chart-based `PersonalForecastPackage`.
- The personal Dashboard has no daily-canvas, period-extra, or sign-horoscope consumer.
- Missing personal content reports `generating`/`unavailable` locally and never substitutes a general sign forecast or static forecast copy.
- General sign-horoscope generation remains active only for the separate `Зодиак` product.
- Legacy personal rows are retained in storage but are incompatible with V2 keys.

## 4. Free and Premium

The forecast-screen implementation must preserve the ability to enforce this product logic on the backend:

- overview of the selected period is fully Free;
- short `card` text is visible to all users;
- one additional fixed topic may be fully Free according to backend selection;
- remaining full readings, dynamic topics, detailed evidence, and advanced period access may require Premium.

Other products:

- `Зодиак`: general sign forecasts are Free unless product pricing is changed separately;
- natal chart: calculation/basic entry Free, full interpretation Premium;
- sign compatibility: Free and chart-free;
- detailed relationship reading: Premium and chart-based;
- Matrix of Destiny: short result Free, full report Premium;
- archive/calendar: Premium.

Frontend locks and CTAs are presentation only. Access truth is enforced by `lib/accessMatrix.ts`, `lib/contentAccessMatrix.ts`, `lib/contentArchitecture.ts`, and entitlement helpers.

## 5. Data and calculation path

- App identity: `requireAppUser` / `lib/auth/appAuth.ts`.
- Canonical chart APIs: `/api/charts/*`.
- Chart calculation: `lib/swisseph-calculator.ts` and related deterministic calculation modules.
- Personal forecast evidence: server-calculated natal/transit relationships for the requested period.
- Product content APIs: `/api/content/*`.
- Unified model selection: `getUnifiedContentModel()`.
- Runtime voice source: `lib/appVoice.ts`.
- Persistence: PostgreSQL through `lib/db.ts`; applied migrations remain immutable history.

The model never calculates astronomy and never creates an aspect, orb, date, house activation, or period window that is absent from supplied evidence.

## 6. Personal forecast cache and archive

The V2 key format, lock identity, retention policy, and prewarm cadence are specified in `docs/CONTENT_CACHE_AND_PREWARM.md`.

Legacy personal-screen packages are invalidated by versioned identity without deleting unrelated natal, `Зодиак`, synastry, compatibility, payment, or archive data. Past saved readings are not generated on archive read.

## 7. Voice and content rules

The app explains calculations calmly, confidently, directly, and in normal modern language.

Required order:

1. answer the topic;
2. explain the combined result;
3. show the astrological basis separately when useful.

Generated text must not:

- invent conversations, purchases, work, partners, conflicts, documents, tasks, or events;
- replace a forecast with a psychological portrait;
- add advice automatically;
- use generic wellness, mystical, coaching, or pseudo-profound filler;
- pad fields to a target length;
- create artificial hooks, hero headlines, or generated CTAs for the personal forecast cards.

The only runtime source for shared voice rules is `lib/appVoice.ts`. `docs/APP_VOICE.md` documents that contract.

## 8. Visual system

The personal screen has one design language but different visual families for Day/Week/Month/Year.

- no duplicate `asset.path` on one screen;
- period heroes differ when the asset pool allows it;
- topic images are selected deterministically for the period;
- GPT does not select images;
- when a unique suitable asset is unavailable, use the approved design-system fallback rather than repeating an unrelated image;
- the implementation report must include an asset inventory and missing slots.

## 9. Active storage boundaries

Core active storage includes users/sessions, natal charts, content interpretations/cache, synastry cache, unlocks, entitlements, payments, archive/check-in data, and operational notification/admin/support tables.

Deprecated product tables are removed only through additive cleanup migrations. Do not delete applied migration history.

## 10. Architecture sources

The shipped architecture is maintained in:

- `docs/CURRENT_ARCHITECTURE.md`;
- `docs/MVP_PRODUCT_AND_CONTENT_SYSTEM.md`;
- `docs/CONTENT_CACHE_AND_PREWARM.md`;
- `docs/NEXT_TASK_CONTEXT.md`.

Dead legacy runtime and incompatible tests are removed only after all consumers use the personal forecast V2 contract. The historical task contract remains `docs/PERSONAL_FORECAST_SCREEN_V2_TASK.md`; do not add duplicate forecast task documents.
