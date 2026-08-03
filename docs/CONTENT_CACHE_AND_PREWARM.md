# Content Cache And Prewarm

## Active cache layers

| Layer | Storage | Policy |
|---|---|---|
| Primary natal chart | local chart cache + `natal_charts` | Reuse a valid chart; recalculate only when birth input or calculation version changes |
| Personal Day/Week/Month | local storage + `content_interpretations` | One canonical V3 feed per user/chart/period key/language/version/model |
| Forecast questions | `personal_forecast_questions` | Reuse by exact feed input hash, user/chart fingerprint, period, question text, answer prompt and voice; store moderation and unread-answer state |
| Sign horoscope (`Зодиак`) | `content_cache` | Shared by sign, period, language, and its own content versions |
| Natal readings | local report cache + `content_interpretations` | Chart fingerprint and prompt/version scoped |
| Premium synastry | `synastry_cache` and content rows | Pair-scoped by both chart versions/input hash |

## Personal forecast key

The V3 canonical key has the readable form:

```text
personal-forecast-feed-v3:<identity-hash>:<period>:<periodKey>
```

The identity includes:

- authenticated user ID;
- owned chart ID or primary-chart marker;
- chart fingerprint, birth-time/chart-quality flags, and chart calculation version;
- period and timezone-aware period key;
- timezone and language;
- `PERSONAL_FORECAST_PROMPT_VERSION`;
- `APP_VOICE_VERSION`;
- model ID from the existing `getUnifiedContentModel()` resolver.

Both the canonical cache key and input hash include `PERSONAL_FORECAST_CALCULATION_VERSION`; the local cache identity includes it as well. Package metadata must match that version. Any relevant chart, calculation, prompt, voice, language, timezone, or model change creates a miss without deleting old rows.

Storage variants are:

| Period | `content_variant` | Validity |
|---|---|---|
| day | `daily` | local midnight to next local midnight |
| week | `weekly` | ISO-week start to next ISO-week start |
| month | `monthly` | calendar-month start to next month |

Rows contain canonical complete packages. Free/Premium slicing happens only after server entitlement resolution, so access tiers do not cause duplicate model generation.

## Read and generation flow

1. Dashboard synchronously reads the V3 local cache and paints it when valid.
2. `GET /api/content/forecast/personal` checks only the server cache.
3. A miss leaves Dashboard interactive and keeps any previous usable package visible.
4. Background `POST /api/content/forecast/personal` generates the entire period feed once under a process-local lock plus a PostgreSQL advisory lock shared by all server replicas.
5. The completed package replaces client/server state; an error preserves the last usable package.

Client requests are deduplicated by full context and request mode. The client validates period, period key, prompt/voice versions, and entitlement lock metadata before memory/local writes. It accepts stripped text only for IDs explicitly listed as locked.

The public generation endpoint accepts only the current timezone-aware period key. Free Week and Month responses contain only access-sliced personalized previews; their complete section text, evidence, and links remain server-redacted. Future boundary prewarm is an internal cron operation and calls the locked cache layer directly, so an authenticated client cannot request unbounded historical or future generation.

The local prefix is `tvoi-goroskop:personal-forecast-feed-v3`. V2 and damaged payloads cannot validate as V3. Old server rows remain untouched and cannot match the V3 prompt/cache identity.

## Startup and prewarm

Startup never awaits model generation:

- profile plus a usable local/server chart opens Dashboard;
- cache-only startup checks only the current `day` feed required by the first screen;
- generate-missing runs in the background with client/server deduplication;
- natal base-report prefetch remains independent and non-blocking;
- Week, Month, questions, and secondary products are not mass-generated at startup.

Server/cron prewarm cadence:

- day: current day; next day after 20:00 in the chart timezone;
- week: current week; next week Friday through Sunday;
- month: current month; next month during the final three calendar days;

Current packages are reused until their boundary or a versioned input changes.

## Question identity and quotas

Question records include user, chart ID/fingerprint, exact forecast input hash, period/key, language, source, stable catalog ID plus normalized catalog text or normalized custom text, answer-prompt version, and voice version.

- An advisory transaction lock serializes quota checks for one user/day in the stable account profile timezone, independent of the selected chart.
- Duplicate lookup happens before quota enforcement, so reopening a saved answer does not consume another slot.
- At most 20 non-rejected answer requests and 3 custom submissions are accepted per user/day.
- One record moves through pending/approved/generating/answered/rejected states; retries claim the same record.
- Manual approval writes the cached answer and unread payload instead of starting a separate chat.
- A pending question can read its exact expired period feed, but only when the stored cache/input identity still matches.
- If chart, feed, answer prompt, or voice identity changed, the stale question is rejected as incompatible instead of remaining in an infinite retry loop.

## Retention and migrations

- Forecast packages use `valid_from`/`valid_to`; normal reads exclude expired rows. The only expired reads are exact-identity previous-period rotation and saved-question grounding.
- No migration deletes old content or triggers bulk generation.
- `mvp_038_personal_forecast_questions` additively creates the V3 question workflow. Deleting a chart nulls its foreign key but preserves quota/history rows and their immutable chart/feed fingerprints.
- Archive reads do not trigger generation.

## Visual cache boundary

Text identity does not include art selection. The resolver uses `forecast-feed-visual-v3`, so a manifest/version update can change deterministic assignments without regenerating model text.
