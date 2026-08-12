# Personal forecast cache and generation

## Canonical unit

A cached personal forecast is one complete AI-written package for one person
and one current period: `day`, `week`, or `month`. Today persists its first
fragment as `overview` and the remaining ordered fragments as `sections`;
Week and Month persist one cohesive `overview`. It does not cache prompts,
questions, concrete visual assets, or a visual layout plan.

The server cache identity includes the authenticated user, owned natal chart and
its fingerprint, period and timezone-aware period key, language, model, prompt
version, voice version, and forecast-contract version. A relevant change creates
a cache miss; old rows remain historical data and are not silently reused as a
new reading.

## Input and output boundary

The server composes one private input containing:

- the concrete date or date range and the user's timezone;
- language and only the profile fields needed for a natural address;
- birth date, time, and place when available and needed by the active prompt;
- a compact, saved natal-profile summary.

OpenAI Luna returns only forecast copy and hidden service metadata in a strict
schema: one short heading plus 4–6 Today fragments, or one cohesive Week/Month
fragment. Today presentation metadata may mark ordinary prose, one pull quote,
and one short paper note. The model does not choose images, layouts, colours,
coordinates, promotions, navigation, access tier, or database keys. It does not
calculate a separate period chart or return public-facing evidence.

The Today visual plan is computed statelessly from user, date, contract, and
visual-engine versions. It is not stored in the forecast package or database,
so a refresh preserves the plan without creating competing cache identities.

Server validation enforces the JSON shape, word cap, period wording, application
voice, and prohibited astrology/guarantee language before persistence.

## Read and generation flow

1. Dashboard may paint a valid local cached story immediately.
2. `GET /api/content/forecast/personal` reads the current server cache.
3. A cache miss keeps the diary usable and shows the honest loading state; it
   does not render fake forecast text or a skeleton story.
4. A background `POST /api/content/forecast/personal` generates one package
   under the existing process and PostgreSQL advisory locks.
5. A validated result replaces stale client/server state. A failure preserves a
   usable older result when it is still safe, otherwise the UI offers retry.

Generation is never a startup gate. The first screen may request only the
current day; week and month are requested when selected. Do not mass-generate
stories for every user or add unbounded historical/future requests.

Client requests are deduplicated while the same forecast package is in flight.
Startup never awaits model generation; a cache miss continues through the
non-blocking diary loading flow.

## Access and history

The server, not the client, applies any Free/Premium entitlement rules after it
has resolved the canonical story. Access state must not create competing model
versions of the same period. Questions, notifications, and legacy feed records
are independent historical systems; they are not rendered inside the personal
forecast without an explicit migration.
