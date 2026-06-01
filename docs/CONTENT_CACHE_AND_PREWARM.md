# Content cache and Premium prewarm

## 1. Calculation vs interpretation

| Layer | What it is | Storage |
|-------|------------|---------|
| **Calculation** | Swiss Ephemeris output: planets, houses, aspects, ASC/MC, coordinates | `natal_charts.chart_data` (+ `input_hash`, `calculation_version`) |
| **Interpretation** | User-facing text/cards for UI | `content_interpretations` (and legacy bridges) |

Interpretations are always generated **from** stored `chart_data`, never by re-running the full natal calculation for copy.

## 2. Natal chart calculation (once per birth data)

Flow:

1. User enters birth date, time, place.
2. `ensureCanonicalPrimaryChart` / `POST /api/astrology/natal-chart` computes via Swiss Ephemeris **once** per canonical `input_hash`.
3. Result is persisted in `natal_charts.chart_data`.
4. Re-open app: `chartService.getChartFromDB` reads DB; **no recalc** if hash unchanged.
5. Birth data change → new `input_hash` → chart row updated → **cached interpretations for that chart id are deleted** (static + synastry cache).

Client dedup: `chartService` uses `calculationInFlight` lock; API uses `LockKeys.natalChartCalculation`.

## 3. Static interpretations (generate once, then DB)

| Surface | Variant | Access | cacheKey | Notes |
|---------|---------|--------|----------|-------|
| natal | anchor | free | `base` | Not date-scoped |
| natal | full | premium | `personality` | Not date-scoped |
| natal | planet_insight | premium | `planet:{id}:lang:{ru\|en}:calc:{version}` | Per planet/topic |
| synastry | brief | free | stable hash / pair | Per chart pair |
| synastry | full | premium | `buildSynastryExtendedCacheKey(...)` | SHA-256 of pair + inputs |

Matrix flags: `shouldPersistCalculation: true`, `shouldPersistInterpretation: true`.

API pattern:

- **GET**: read `getContentLayer` only → 404 if missing (no OpenAI on GET).
- **POST**: if cached + current `promptVersion` → return cache; else generate once → `upsert` → return.

## 4. Daily interpretations (one row per date / slot)

| Surface | Variant | cacheKey |
|---------|---------|----------|
| forecast | daily | `YYYY-MM-DD` (Moscow) |
| forecast | morning / day / evening | `YYYY-MM-DD:morning` etc. |
| natal | living | `periodKey` (= Moscow date today; **daily cadence**) |

Free `forecast/daily` uses `accessTier: 'free'` always in API. Premium dayparts use `accessTier: 'premium'`.

`shouldPersistCalculation: false` for forecast means we do **not** store a separate calculation artifact — interpretations are still persisted per `cacheKey` with `validFrom` / `validTo`.

## 5. Periodic interpretations

| Surface | Variant | cacheKey |
|---------|---------|----------|
| forecast | weekly | ISO week key (`getMoscowIsoWeekKey`) |
| forecast | monthly | month key (`getMoscowMonthKey`) |

## 6. Premium prewarm (target behaviour)

**Status:** not implemented in runtime yet (`lib/premiumContentPrewarm.ts` = spec stub).

When implemented, prewarm must be **idempotent**:

1. `getContentLayer` / DB lookup for each layer.
2. If interpretation exists → skip.
3. If missing → generate once → upsert.

Suggested prewarm set after Premium activation or Premium onboarding:

**Once (static):**

- natal: full
- planet_insight (UI-critical planets only)
- synastry: full for saved partners (optional)

**Current day:**

- forecast: daily (if missing)
- forecast: morning, day, evening

**Current period:**

- forecast: weekly, monthly

Must **not** run full prewarm on every app open or every screen navigation.

## 7. On-demand fallback

If prewarm did not run:

1. GET returns 404 / NOT_FOUND.
2. UI shows loading state.
3. POST generates once, saves, returns.
4. Duplicate POST with same keys returns existing row.

Duplicate generation guards:

- Natal chart: `serverLocks` + `calculationInFlight`
- Content: unique DB key `(chart_id, access_tier, surface, variant, cache_key)` via upsert

## 8. Invalidation rules

| Event | Action |
|-------|--------|
| Same birth data | Keep `chart_data` + interpretations |
| Birth data / place / time change | Recalculate chart; delete `content_interpretations` + `synastry_cache` for primary chart id |
| Prompt version bump | API returns STALE until POST regenerates |
| New calendar day | New forecast cache keys only (not static natal) |

## 9. Additive Premium (content access)

Premium does **not** replace Free. Premium users keep free baseline layers and gain premium-only layers. See `lib/contentAccessMatrix.ts` and `__tests__/content-access-matrix.test.ts`.

## 10. What must never happen

- Do not regenerate **natal full** every day.
- Do not regenerate **natal anchor** on every screen open.
- Do not regenerate **synastry full** on every open.
- Do not regenerate the same **planet_insight** cacheKey twice.
- Do not generate **forecast daily** more than once per user/chart/date.
- Do not regenerate **morning/day/evening** on every tab switch if DB row exists.
- Do not start a second generation if the same layer is already in DB (check before OpenAI).
- Do not treat Premium as a separate product that hides Free baseline.
- Do not make general **forecast daily** premium-only.
- Do not use **today's date** as cacheKey for natal anchor, natal full, or planet_insight.
- Do not run OpenAI on **GET** for interpretation endpoints (read path only).
