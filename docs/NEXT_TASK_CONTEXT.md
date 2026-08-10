# Next Task Context

This repository is the MVP app «Твой Гороскоп» / “Your Horoscope”.

## Current personal forecast architecture

The active contract is `docs/PERSONAL_FORECAST_FEED_V3_SPEC.md`.

- Today, Week, and Month are one chart-based continuous feed in `views/Dashboard.tsx`.
- The separate `PersonalForecastScreen` and `personal_daily` view no longer exist.
- Each package has one overview, six fixed life sections in the prescribed order, two to four calculated dynamics, optional strong astro accents, local explanation anchors, and verified cross-period links. Continuation links carry immutable timing and are filtered against the target period currently reachable from Dashboard.
- One OpenAI Luna Responses API request creates the copy/evidence-reference payload from server-calculated Swiss Ephemeris evidence. Its strict JSON Schema is not a substitute for server-side semantic validation.
- The non-Zodiac production model is fixed to `gpt-5.6-luna`; the separate sign-based Zodiac product keeps DeepSeek.
- `lib/appVoice.ts` and `getAppSystemVoice(language)` remain the only runtime source of the shared voice.
- Canonical packages are cached once, then server-sliced for Free/Premium. Week and Month stay fully locked for Free while the server returns only their personalized preview and benefit copy, never the full section text.
- Dashboard stays local-first and non-blocking.
- Native promos and visuals are deterministic. Reviewed Feed visual assets live in `public/assets/forecast-feed/` and are resolved through `lib/personalForecastVisuals.ts`.
- The audited bilingual question catalog, strict high-confidence automatic moderation, manual moderation, limits, cached answers, and unread answer notifications are part of the period feed. Raw admin moderation data requires both publishing and PII permissions.
- Saved questions are bound to the exact feed input hash, chart fingerprint, period/key, normalized wording, answer prompt, and voice. Do not loosen that identity or retry stale-version rows indefinitely.
- The separate sign-based `Зодиак` product remains intact.

Old database rows are retained. V3 cache, prompt, visual, and question identities prevent old personal content from being treated as current.

## Voice boundary

- Voice version 2 is the active contract.
- The voice is direct, bold, calculation-led, and written in ordinary human language.
- Natal copy is descriptive. Forecasts and question answers may be directive when the calculation supports a clear answer, action, condition, or risk.
- Start with the actual conclusion. Then show an ordinary situation. Explain the calculation only when it adds value.
- Static UI copy, fallbacks, onboarding, paywalls, notifications, prompts, and generated text use the same voice. This is not an AI-only rule.
- Do not add pseudo-psychological, coaching, mystical, cosmic, therapeutic, or motivational filler.
- Do not invent trauma, childhood, parental relationships, diagnoses, profession, income, events, or biography.
- Do not promise guaranteed future events.
- Reject phrases such as «карта сложилась», «это про тебя», «что сейчас активно», «внутренний рисунок», «повторяющиеся сценарии», «энергия дня», «замедлись», «прислушайся к себе», «позволь себе», «отпусти контроль», «побереги ресурс», and close paraphrases.
- Avoid empty introductions such as «мы нашли», «карта показывает», «тема проявляется сильнее». State the concrete conclusion instead.
- When changing user-facing copy, update a regression test that rejects the bad wording.

## Architecture boundaries

- Root UI and navigation: `App.tsx`.
- Continuous feed: `views/Dashboard.tsx`.
- Feed components: `components/PersonalForecastFeed/`.
- Contract and access slicing: `lib/personalForecastContract.ts`.
- Evidence: `lib/personalForecastEvidence.ts`.
- One-request generation and validation: `lib/personalForecastGeneration.ts`.
- Server cache and locks: `lib/personalForecastCache.ts`.
- Client stale-while-revalidate: `services/personalForecastService.ts`.
- Forecast endpoint: `/api/content/forecast/personal`.
- Prewarm: `lib/personalForecastPrewarm.ts`, `lib/contentPrewarm.ts`, `services/contentPrewarmService.ts`.
- Visual resolver: `lib/personalForecastVisuals.ts`.
- Promo resolver: `lib/personalForecastPromo.ts`.
- Question catalog/moderation/store/generation: `lib/personalForecastQuestion*.ts`.
- User question endpoint: `/api/content/forecast/questions`.
- Admin moderation: `/api/admin/v2/forecast-questions`.
- App auth: `lib/auth/appAuth.ts`.
- Canonical charts: `/api/charts/*`.
- AI voice source: `lib/appVoice.ts`.
- General sign horoscopes: separate `Зодиак` routes/services only.

## Safety boundaries

- Do not restore DailyCanvas, personal period extras, fallback forecast copy, a separate topic reader, or sign-based personal Dashboard periods.
- Do not delete old database content as part of unrelated work.
- Do not reference generator output outside the repository. New reviewed Feed assets belong in `public/assets/forecast-feed/` and must be registered through the versioned resolver.
- Keep visual-manifest versioning independent from prompt/text cache versioning.
- Preserve local-first startup: cache misses and background errors must not hide or close Dashboard.
- Keep question answers inside the period feed; do not recreate a chat.
- Do not restore a per-surface model setting or a DeepSeek fallback in personal-feed work.
- Update existing architecture documents; do not add another task document.

## Required completion checks

For changes touching this product run:

```bash
npm test -- --runInBand
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Also search for:

- working imports of `DailyCanvas`, personal `periodExtras`, and the removed `PersonalForecastScreen`;
- `personal_daily` view wiring;
- local persona/tone instructions in V3 task prompts;
- sign-horoscope endpoints or services in `views/Dashboard.tsx`;
- new image or `generated_images` files;
- pseudo-copy such as `карта показывает`, `мы нашли`, `активная тема`, `повторяющиеся сценарии`, `карта сложилась`, `это про тебя`, `замедлись`, `прислушайся к себе`, `позволь себе`, `отпусти контроль`, and `побереги ресурс`.

## Release manual QA

Verify Android and iPhone viewport screenshots, Telegram safe areas, back/swipe behavior, full and compact period tabs, long-press rail navigation, local/global explanation sheets, Free blur previews, in-place Premium reveal, question moderation states, unread-answer bell and deep links, slow network/background retry, and scroll retention.
