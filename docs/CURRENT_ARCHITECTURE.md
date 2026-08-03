# Current Architecture

The active application is «Твой Гороскоп» / “Your Horoscope”.

The existing global content architecture remains active: `accessMatrix` owns product access, `contentMatrix` owns content definitions, `contentPromptBuilders` serves the products that use those builders, and authenticated `/api/content/*` routes remain the server boundary. Feed V3 adds its stricter structured contract without replacing those unrelated layers.

## Runtime entry and startup

- `App.tsx` resolves the authenticated profile and immediately reuses a valid local natal chart.
- A usable chart is enough to render `Dashboard`; personal forecast generation, natal text generation, and server chart refresh are not startup gates.
- Startup checks only the current-day personal package in cache, then starts missing-content generation in the background.
- The client uses stale-while-revalidate: local package first, server cache second, generation only on a miss. Refresh and background errors never remove a usable package already on screen.
- Client in-flight maps, process-local locks, and PostgreSQL advisory locks deduplicate parallel startup and screen requests across server replicas.
- Identity is enforced by `requireAppUser`; chart ownership, language, timezone, and Premium entitlement are resolved on the server.

## Personal Forecast Feed V3

`Dashboard` is the only personal forecast screen for `day`, `week`, and `month`. There is no separate topic reader or `personal_daily` route.

Every `PersonalForecastPackage` contains:

1. one overview;
2. the fixed life sections in this order: mood, love, home and family, friends, tasks/work/money, wishes;
3. two to four simple life-dynamic sections selected from calculated evidence;
4. separate astro-accent sections only for strong Moon, Mercury, or retrograde factors;
5. weak factors as inline accents;
6. local explanation anchors and verified evidence IDs;
7. calculated cross-period links only when a factor really continues into another period.

Fixed and dynamic sections are interspersed into one vertical feed. The model cannot invent a section key, reorder the fixed sequence, invent an evidence ID, or add an unsupported date.

The calculation and generation path is:

1. `lib/personalForecastEvidence.ts` samples the complete requested period in the chart timezone and calculates evidence with Swiss Ephemeris. Aspects and transit-house placements are split into contiguous episodes; short-lived noise is excluded from long periods.
2. Code creates stable evidence IDs, assigns one unique primary factor per section, weights factors, chooses dynamics, and builds the ordered section plan. House evidence is disabled when birth-time quality does not support house personalization.
3. `lib/personalForecastGeneration.ts` sends the compact natal chart, calculated evidence, and the complete section plan in one structured period request.
4. The server validates the complete wire package: period boundaries, version metadata, canonical section identities, previews, evidence, visuals, cross-links, order, counts, dates, text limits, repetition, and app-voice rules.
5. The complete canonical package is stored once and sliced by server-side entitlement at response time.

All user-facing model calls use `getAppSystemVoice(language)`. Model selection continues to use the existing production `getUnifiedContentModel()` resolver; Feed V3 does not change the configured model. `lib/appVoice.ts` remains the sole runtime voice source.

The private endpoint is `/api/content/forecast/personal`:

- `GET` is cache-only;
- `POST` ensures a missing package under a generation lock;
- the client cannot submit trusted chart, calculation, or Premium data.

## Feed UI and access

- `views/Dashboard.tsx` renders overview, all period sections, native promos, questions, and the global “How it works” entry in one full-width vertical feed.
- Full period tabs live at the top. Compact tabs appear as soon as the user scrolls upward and disappear on downward scrolling.
- Important conclusions have local `i` explanations; exact verified evidence is shown in a bottom sheet only on request.
- A thin side rail opens the section list on tap and supports long-press scrubbing.
- Missing content reports status only inside the affected feed surface and offers a scoped retry.
- A refresh keeps the last usable package visible.

Free/Premium slicing is enforced on the server:

- Today Free: overview, wishes, the strongest calculated section, and one deterministic rotating section;
- other Today sections retain a real 5–10-word lead, real blurred continuation, a real teaser, and an unlock action;
- Week and Month are fully Premium, but their locked feed exposes a personalized preview and concrete benefit without exposing full section text;
- questions are Premium for every period;
- after purchase, Dashboard remains mounted and replaces the sliced package in place without resetting scroll.

## Questions

The approved catalog in `lib/personalForecastQuestionCatalog.ts` contains the audited 84 bilingual questions with stable IDs, themes, live search, and period support.

- Limits are 20 answers and 3 custom submissions per user per day.
- Catalog questions and only high-confidence, period-framed relevant custom questions are approved automatically; a theme keyword by itself is never enough.
- Unsafe, nonsensical, off-topic, or duplicate custom questions are rejected with approved alternatives.
- Doubtful questions remain `pending` for manual moderation.
- Manual approval generates an answer from the saved period feed, natal chart, and verified evidence, then creates an unread in-app notification.
- Question identity includes the exact feed input hash, chart fingerprint, period/key, normalized wording, answer prompt, and voice. An expired saved feed is readable only by this exact identity; stale chart/content versions are rejected permanently rather than retried forever.
- Question and saved-feed text are delimited as untrusted data in the task prompt. Answers must cite known evidence IDs and cannot add unsupported dates or guaranteed future events.
- Pending, approved, answered, and retry states stay inside the current period block; there is no chat or separate “My questions” screen.
- Persistence uses `personal_forecast_questions`; the removed `astro_questions` chat table is not restored.

Admin moderation is available through `/api/admin/v2/forecast-questions` and the Content section of Admin v2. Raw questions, answers, user IDs, and chart IDs require both `content.publish` and `user.pii.view`.

## Native promos and visuals

- Each complete feed has exactly two mandatory native promos: natal chart and compatibility.
- A Zodiac promo is added only when a strong astro-accent provides a relevant anchor; no product or visual format repeats in the same feed.
- Sign-horoscope generation remains a separate `Зодиак` product and never powers personal periods.

`lib/personalForecastVisuals.ts` resolves `[overview, ...sections]` in one deterministic pass using the dedicated Feed asset set.

- assignments are keyed by section ID;
- adjacent backgrounds do not repeat;
- unused relevant assets are preferred before any reuse;
- previous-period reuse is avoided when an alternative exists;
- bounded calculated lookahead may create links to the current longer-period tab; no generation-time target period key is persisted;
- responsive crop, scale, optional mirror, overlay preset, and CSS fallback are deterministic;
- visual versioning is independent from text/prompt cache versioning.

Generated, reviewed Feed source assets are committed under `public/assets/forecast-feed/`; transient generator output is never referenced by runtime code.

## Persistence and migration boundary

- Canonical forecast packages stay in `content_interpretations`, scoped by user/chart/period/language/chart fingerprint/chart calculation/forecast calculation/prompt/voice/model identity. `PERSONAL_FORECAST_CALCULATION_VERSION` is part of both server and local cache identity and must match package metadata.
- Cross-period links retain immutable continuation timing and are exposed only when that continuation belongs to the target period currently reachable from Dashboard.
- `mvp_038_personal_forecast_questions` additively creates the versioned question/moderation/notification workflow.
- Old forecast, daily-canvas, period-extra, and sign-based Dashboard rows remain stored but cannot match V3 identities.
- Natal, `Зодиак`, compatibility, synastry, payments, archive, and unrelated notification data are not invalidated.

Removed pre-MVP product surfaces remain documented in `docs/MVP_LEGACY_REMOVAL_LOG.md`.
