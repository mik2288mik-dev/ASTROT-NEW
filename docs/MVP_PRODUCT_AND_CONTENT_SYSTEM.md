# MVP Product And Content System

This is the product-level source of truth for «Твой Гороскоп» / “Your Horoscope”.

## 1. MVP products

- Personal forecast feed: `Сегодня / Неделя / Месяц / Год`.
- Separate general `Зодиак` product with sign-based forecasts.
- Natal chart calculation and natal readings.
- Free sign compatibility.
- Premium chart-based relationship reading.
- Matrix of Destiny with Free/Premium layers.
- Premium calendar/archive for saved personal readings.
- Settings, onboarding, subscription, support, admin, notifications, and mobile-shell functionality required to operate the MVP.

## 2. Personal forecast feed — active product

The active contract is `docs/PERSONAL_FORECAST_FEED_V3_SPEC.md`.

All four periods use the user’s natal chart plus calculated influences for the selected interval. Sign horoscopes never power these tabs.

The feed contains, in order:

1. a human overview;
2. fixed sections for Love, Mood, Home and Family, Friends, Tasks/Work/Money, and period-specific Wishes;
3. two to four evidence-selected life dynamics interspersed among the fixed sections;
4. separate strong astro-accent sections when justified;
5. native product promos, period questions, and the global calculation explanation.

Every section contains normal-language text, importance, a visual tag, a real locked preview, optional inline astro accent, and local explanation anchors referencing verified evidence. Strong conclusions can be explained locally without opening a separate reader.

Astronomy, section selection, fixed order, Premium slicing, visual selection, promos, and cross-period continuation are decided in code. One structured model request explains the supplied period evidence.

## 3. Runtime boundary

- `views/Dashboard.tsx` is the complete personal screen.
- There is no personal topic-reader route, DailyCanvas consumer, period-extra consumer, or sign-horoscope fallback.
- Missing content reports generating/unavailable state only in the affected feed surface.
- General sign-horoscope generation remains active only in the separate `Зодиак` product.
- Old personal rows remain stored but cannot match V3 identities.

## 4. Free and Premium

Backend access policy:

- Today Free includes overview, wishes, the strongest calculated section, and one deterministic rotating section.
- Other Today sections keep a real 5–10-word lead, real blurred continuation, a real teaser, and a Premium CTA.
- Week, Month, and Year are fully Premium.
- Free non-day responses remain fully locked and expose only a personalized preview and concrete Premium benefit; full section text and evidence are server-redacted.
- Period questions are fully Premium.
- The server returns only the access-sliced payload; frontend locks are presentation, not authority.
- A successful purchase reveals the current feed in place and preserves scroll.

Other products retain their separate policies:

- `Зодиак`: general sign forecasts are separate and Free unless pricing changes independently;
- natal chart: calculation/basic entry Free, full interpretation Premium;
- sign compatibility: Free and chart-free;
- detailed relationship reading: Premium and chart-based;
- Matrix of Destiny: short result Free, full report Premium;
- archive/calendar: Premium.

## 5. Questions

- The approved bilingual catalog has 84 stable-ID questions, live search, themes, and period filters.
- Users can receive at most 20 answers and submit at most 3 custom questions per day.
- Only high-confidence period-framed relevant questions are approved automatically; a theme keyword alone is insufficient, and doubtful questions wait for manual moderation.
- Unsafe, nonsensical, off-topic, and duplicate questions are rejected with similar approved alternatives.
- A manual approval generates from the saved feed and natal evidence, stores the answer, and exposes an unread bell deep-link to the period question.
- Saved questions are exact-feed/chart/version scoped; untrusted question/feed text cannot override task instructions, and generated answers must cite known evidence without unsupported dates or guaranteed events.
- Status and answer remain inside the current period block; the product has no chat or separate question-history screen.

## 6. Data, calculation, and caching

- App identity: `requireAppUser` / `lib/auth/appAuth.ts`.
- Canonical charts: `/api/charts/*`.
- Deterministic astronomy: `lib/swisseph-calculator.ts` and `lib/personalForecastEvidence.ts`.
- Feed endpoint: `/api/content/forecast/personal`.
- Question endpoint: `/api/content/forecast/questions`.
- Unified production model resolver: `getUnifiedContentModel()`; Feed V3 does not select or change a model.
- Runtime voice: `lib/appVoice.ts` via `getAppSystemVoice(language)`.
- Persistence: PostgreSQL through `lib/db.ts`; applied migration history remains immutable.

The model never calculates astronomy and never creates an aspect, orb, date, house activation, period window, or biography absent from supplied data.

V3 cache/lock identity and prewarm cadence are specified in `docs/CONTENT_CACHE_AND_PREWARM.md`.

## 7. Voice and content rules

The only runtime source for shared voice rules is `lib/appVoice.ts`; `docs/APP_VOICE.md` documents the same contract.

The product voice is direct, bold, calculation-led, and easy to understand. Natal text is descriptive. Forecasts and question answers may be directive when the calculation supports a clear action, risk, or condition.

Required order:

1. a concrete conclusion in ordinary language;
2. an observable situation, action, conversation, decision, or reaction;
3. a short calculation-based explanation when useful.

Every sentence must add information. Delete introductions about what «we found», what «the chart shows», what is «active», or which vague «themes repeat». State the actual conclusion instead.

Generated and static copy must not:

- invent events, biography, trauma, childhood, parents, diagnoses, profession, or income;
- replace the answer with psychology or coaching;
- use mystical, cosmic, motivational, wellness, or pseudo-profound filler;
- use generic formulas such as «замедлись», «прислушайся к себе», «позволь себе», «отпусти контроль», «побереги ресурс», «энергия дня», «внутренний рисунок», «повторяющиеся сценарии», «карта сложилась», or «это про тебя»;
- promise guaranteed future events;
- define another character, astrologer, therapist, coach, friend, mentor, or mystical guide inside a task prompt.

Task prompts define only the output, supplied calculation, required subject, JSON shape, volume, and technical limits. Static UI copy, fallbacks, notifications, onboarding, paywalls, and generated text follow the same voice rules.

## 8. Visual and promo system

- The feed uses full-width existing manifest assets with deterministic responsive crop, scale, mirror, overlay, and CSS fallback.
- Adjacent backgrounds do not repeat.
- GPT never selects or generates images.
- Each complete feed has mandatory natal and compatibility promos.
- At most one relevant Zodiac promo is added for a strong astro factor.
- Product and promo format never repeat within the same feed.

## 9. Active storage boundaries

Core storage includes users/sessions, natal charts, content interpretations/cache, `personal_forecast_questions`, synastry cache, unlocks, entitlements, payments, archive/check-in data, and operational notification/admin/support tables.

Deprecated product data is removed only through additive migrations. V3 adds data structures without deleting old forecast content or restoring the removed chat table.

## 10. Architecture sources

The shipped architecture is maintained in:

- `docs/CURRENT_ARCHITECTURE.md`;
- `docs/MVP_PRODUCT_AND_CONTENT_SYSTEM.md`;
- `docs/CONTENT_CACHE_AND_PREWARM.md`;
- `docs/NEXT_TASK_CONTEXT.md`.

The V3 specification remains `docs/PERSONAL_FORECAST_FEED_V3_SPEC.md`. Do not add duplicate task documents.
