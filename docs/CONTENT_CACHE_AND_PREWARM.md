# Content Cache And Prewarm

## Active cache layers

| Layer | Storage | Policy |
|---|---|---|
| Primary natal chart | local chart cache + `natal_charts` | Reuse a valid local/server chart; recalculate only when birth input or calculation version changes |
| Personal Day/Week/Month/Year | local storage + `content_interpretations` | One canonical package per user/chart/period key/language/version/model |
| Sign horoscope (`Зодиак`) | `content_cache` | Shared by sign, period, language, and its own content versions |
| Natal readings | local report cache + `content_interpretations` | Chart fingerprint and prompt/version scoped |
| Premium synastry | `synastry_cache` and content rows | Pair-scoped by both chart versions/input hash |

## Personal forecast key

The canonical key has the readable form:

```text
personal-forecast-v2:<identity-hash>:<period>:<periodKey>
```

The identity hash includes:

- authenticated user ID;
- owned chart ID or primary-chart marker;
- chart fingerprint and chart calculation version;
- period and timezone-aware period key;
- timezone and language;
- `PERSONAL_FORECAST_PROMPT_VERSION`;
- `APP_VOICE_VERSION`;
- unified model ID from `getUnifiedContentModel()`.

The package input hash also includes `PERSONAL_FORECAST_CALCULATION_VERSION`. Any relevant chart, calculation, prompt, voice, language, timezone, or model change therefore creates a miss without deleting old rows.

Storage variants are:

| Period | `content_variant` | Validity |
|---|---|---|
| day | `daily` | local midnight to next local midnight |
| week | `weekly` | ISO-week start to next ISO-week start |
| month | `monthly` | calendar-month start to next month |
| year | `yearly` | calendar-year start to next year |

Rows are canonical Premium packages; Free/Premium slicing happens after server entitlement resolution. This prevents duplicate GPT generation by access tier while keeping the response policy server-controlled.

## Read and generation flow

1. Dashboard synchronously reads the V2 local cache and paints it if valid.
2. `GET /api/content/forecast/personal` checks only the server cache.
3. On a miss, the already visible Dashboard remains interactive.
4. Background `POST /api/content/forecast/personal` generates under a content lock.
5. The completed package replaces local/server state. Errors preserve the last usable package.

Client requests are deduplicated by the full local context key and request mode. Server generation uses `buildContentGenerationLockKey` with user, chart, canonical access tier, forecast surface, content variant, V2 cache key, and prompt version.

The local prefix is `tvoi-goroskop:personal-forecast-v2`; legacy personal local entries cannot validate as V2. Server legacy rows have different prompt/cache identities and remain untouched. This incompatibility is limited to the personal forecast screen; `Зодиак` caches are unchanged.

## Startup and prewarm

Startup never awaits generation:

- after profile plus local/server chart resolution, Dashboard opens;
- cache-only startup checks only the current `day` package needed by the first screen;
- generate-missing runs in the background;
- natal base-report prefetch is independent and non-blocking.

Server/cron prewarm cadence:

- day: current day; next day after 20:00 in the chart timezone;
- week: current week; next week Friday through Sunday;
- month: current month; next month during the final three calendar days;
- year: current year; next year from December 20.

Week, month, and year are not regenerated daily. Current packages are reused until their period boundary or a versioned input changes.

## Retention and migrations

- Packages are non-persistent cache rows with `valid_from`/`valid_to`; cache reads exclude expired rows.
- This migration does not delete expired or legacy records and does not perform bulk regeneration.
- `mvp_037_personal_forecast_yearly_variant` only expands existing database constraints to include `yearly`.
- Archive reads do not trigger generation.

## Visual cache boundary

Text cache identity does not include art selection. The resolver uses `forecast-visual-v2`, so a manifest update can change deterministic visual assignments without regenerating GPT text.
