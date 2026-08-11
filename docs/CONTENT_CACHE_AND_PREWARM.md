# Personal forecast cache and generation

## Canonical unit

A cached personal forecast is one complete AI-written story for one person and
one current period: `day`, `week`, or `month`. It is not a feed of sections,
evidence cards, visual assignments, prompts, or questions.

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

OpenAI Luna returns only the story copy in a strict schema: one short heading
and one or two paragraphs. The model does not choose images, promotions,
navigation, access tier, or database keys. It does not calculate a separate
period chart or return public-facing evidence for a forecast.

Server validation enforces the JSON shape, word cap, period wording, application
voice, and prohibited astrology/guarantee language before persistence.

## Read and generation flow

1. Dashboard may paint a valid local cached story immediately.
2. `GET /api/content/forecast/personal` reads the current server cache.
3. A cache miss keeps the diary usable and shows the honest loading state; it
   does not render fake forecast text or a skeleton story.
4. A background `POST /api/content/forecast/personal` generates one story
   under the existing process and PostgreSQL advisory locks.
5. A validated result replaces stale client/server state. A failure preserves a
   usable older result when it is still safe, otherwise the UI offers retry.

Generation is never a startup gate. The first screen may request only the
current day; week and month are requested when selected. Do not mass-generate
stories for every user or add unbounded historical/future requests.

## Access and history

The server, not the client, applies any Free/Premium entitlement rules after it
has resolved the canonical story. Access state must not create competing model
versions of the same period. Questions, notifications, and legacy feed records
are independent historical systems; they are not rendered inside the personal
forecast without an explicit migration.
