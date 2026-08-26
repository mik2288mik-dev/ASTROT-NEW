# Personal forecast cache and generation

## Canonical unit

A cached personal forecast is one complete AI-written package for one person
and one current period: `day`, `week`, or `month`. Today persists its first/main
fragment as `overview` and the remaining ordered fragments as `sections`.
Week and Month persist one cohesive body in `overview` and the separate advice
in `sections`. The cache does not store prompts, questions, concrete visual
assets, or a visual layout plan.

The server cache identity includes the authenticated user, owned chart ID, the
full saved-natal fingerprint, and a hash of the sanitized `name`, `birthDate`,
`birthTime`, `birthPlace`, and `birthTimezone` profile fields. It also includes
the period and timezone-aware period key, language, model, calculation,
contract, prompt, and voice versions. A relevant change creates a cache miss;
old rows remain historical data and are not silently reused as a new reading.

## Input and output boundary

The server composes one private input containing:

- the concrete date or date range and the user's timezone;
- language and only the profile fields needed for a natural address;
- birth date, time, and place when available and needed by the active prompt;
- a compact, saved natal-profile summary;
- up to 15 recent forecast fragments for the same user and saved chart across
  `day`, `week`, and `month`, used only to prevent repetition.

The personal Responses request explicitly uses `store: false`. A rejected draft
stays inside the server validator; a repair attempt receives only generic
validation errors, never the rejected text.

OpenAI Luna returns exactly four required strings in a strict schema: generated
`title`, separate sharp `punchline`, continuous `forecast`, and separate
concrete `closing` advice. The server materializes Today as 4–6 sequential text
fragments. Week keeps one longer body, and Month keeps one still longer body;
both end with the separate advice section. The visible copy contains no
astrological terminology. The model does not choose images, layouts, colours,
coordinates, promotions, navigation, access tier, or database keys. It does
not calculate a separate period chart or return public-facing evidence.

The active `calendar-editorial` Today visual is app-owned and deterministic.
`lib/todayVisualPresets.ts` selects one of 15 clock presets and one of 12 line
presets from the user and date; `TodayCalendarClock` and `TodayLineField` render
them around the continuous fragments. The visual choice is not stored in the
forecast package or database. The older five-layout asset planner and its
personal image and paper catalogs remain library-only and are not mounted by
the active Today renderer.

Server validation enforces the JSON shape, period-specific length and sentence
limits, application voice, closing contract, reference-example anti-copy rules,
and prohibited astrology/guarantee language before persistence.

## Read and generation flow

1. Dashboard may paint a valid local cached story immediately.
2. `GET /api/content/forecast/personal` reads the current server cache.
3. A cache miss keeps the diary usable and shows the honest loading state; it
   does not render fake forecast text or a skeleton story.
4. A background `POST /api/content/forecast/personal` generates one package
   under the existing process and PostgreSQL advisory locks.
5. After a `202`, the client waits for `retryAfterMs` and polls with the same
   `POST`, using `regenerate: false`, until the package is ready or the retry
   limit is reached.
6. A validated result replaces stale client/server state. A failure preserves a
   usable older result when it is still safe, otherwise the UI offers retry.

Generation is never a startup gate. Free startup prewarms only the current
`day`; Premium startup sequentially prewarms the current `day`, `week`, and
`month` in the background. Do not generate unbounded historical or future
periods.

Client requests are deduplicated while the same forecast package is in flight.
Startup never awaits model generation; a cache miss continues through the
non-blocking diary loading flow.

## Access and history

The server, not the client, applies any Free/Premium entitlement rules after it
has resolved the canonical story. Access state must not create competing model
versions of the same period. Questions, notifications, and legacy feed records
are independent historical systems; they are not rendered inside the personal
forecast without an explicit migration.

The active route, cache, and client service exchange the canonical
`PersonalForecastPackage` end to end. Legacy `aiPersonalHoroscope*` fields may
remain for compatibility, but they are not the active personal-forecast source.
