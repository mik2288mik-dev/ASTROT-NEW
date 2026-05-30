# Lumia Architecture Status

Honest map of content surfaces after Lumi economy removal and first Stars flows (Ask Lumia, Forecast full day).  
Last updated: sprint 3 stabilization (not a product marketing doc).

## Legend

| Column | Meaning |
|--------|---------|
| **Matrix** | Uses `contentAccessMatrix` for enforcement (not just docs) |
| **UserState** | Uses `buildContentAccessUserState` |
| **Layer** | Uses `getContentLayer` / `content_interpretations` |
| **Logger** | Uses `lib/logger` (structured, privacy-safe) |
| **Stars nonce** | Telegram invoice + `paymentNonce` + webhook confirm |
| **Charge fallback** | Legacy `starsPaymentChargeId` / `telegramPaymentChargeId` only |
| **Legacy bridge** | Client or service still calls `/api/astrology/*` |
| **Status** | `new` = matrix+logger aligned; `partial` = mixed; `legacy` = old path primary |

---

## Product monetization model

- **User-facing model:** Free + Premium.
- **No one-off content purchases** in current UI.
- **Telegram Stars** may be used only as a payment rail for Premium (`premium_week`), not as product currency.
- **Legacy one-off server support** (`ask_lumia_one_off`, `forecast_full_day`, `synastry_full`, `natal_human_*`) is deprecated and not used by current UI; old `content_unlocks` rows still read.

---

## 1. Surface map

### Question (Ask Lumia)

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/question/ask` |
| Access | free (`question/brief` starter) · stars (`question/one_off`) · premium (`question/full`) |
| Matrix | yes — enforced |
| UserState | yes |
| Layer | yes |
| Logger | yes (`scope: ask-lumia`) |
| Stars nonce | yes — full client flow |
| Charge fallback | yes — charge id still accepted |
| Legacy bridge | **removed** — dead `/api/astrology/chat` client call deleted |
| cacheKey | question hash from normalized question text |
| Status | **new** (reference implementation) |

### Forecast daily

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/forecast/daily` |
| Access | free |
| Matrix | no — free tier implicit |
| UserState | no |
| Layer | yes |
| Logger | no |
| Stars nonce | no |
| Charge fallback | no |
| Legacy bridge | **conditional** — `getDailyHoroscope` falls back to `/api/astrology/daily-horoscope` if v2 fails and `FORECAST_LEGACY_FALLBACK` enabled |
| cacheKey | Moscow date key `YYYY-MM-DD` |
| Status | **partial** |

### Forecast daypart (morning / day / evening = full day unlock)

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/forecast/daypart` |
| Access | premium · stars (one-off full day) |
| Matrix | yes — enforced |
| UserState | yes |
| Layer | yes (+ legacy `lumi` tier **read-only** for old rows) |
| Logger | yes (`scope: forecast-daypart`) |
| Stars nonce | yes — chart layer in Horoscope |
| Charge fallback | yes |
| Legacy bridge | no direct client call |
| cacheKey | date key; unlock keyed as `forecast/full` + same date |
| Status | **new** |

### Forecast weekly / monthly

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/forecast/weekly`, `.../monthly` |
| Access | free teaser + premium full (`tier=premium` on POST) |
| Matrix | documented only — API uses `getPremiumEntitlementState`, reads matrix for logging |
| UserState | no |
| Layer | yes |
| Logger | yes (`forecast-weekly`, `forecast-monthly`) |
| Stars nonce | no |
| Charge fallback | no |
| Legacy bridge | **none active** — `/api/astrology/weekly-horoscope` and `monthly-horoscope` exist but client uses content APIs |
| cacheKey | ISO week key / `YYYY-MM` month key |
| Status | **partial** |

### Natal anchor / intro

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/natal/anchor` |
| Access | free |
| Matrix | yes (anchor = free) |
| UserState | no |
| Layer | yes |
| Logger | no |
| Legacy bridge | **fallback** — `getNatalIntro` → `/api/astrology/natal-intro` if anchor fails |
| cacheKey | chart-level anchor hash |
| Status | **partial** |

### Natal full / living / portrait

| Field | Value |
|-------|-------|
| API | `.../natal/full`, `.../living`, `.../portrait` |
| Access | premium only |
| Matrix | yes (full, living = premium) |
| UserState | no |
| Layer | yes |
| Logger | no |
| Legacy bridge | no |
| cacheKey | surface-specific (living uses period keys) |
| Status | **partial** |

### Natal planet insight

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/natal/planet-insight` |
| Access | premium (client-gated; API stores `premium` or `free` tier row) |
| Matrix | yes — **premium only** (stars removed from matrix; was misleading) |
| UserState | no |
| Layer | yes |
| Logger | no |
| Stars | **not implemented** — no nonce, no charge path |
| cacheKey | `planet:{id}:{calcVersion}` |
| Status | **partial** |

### Natal human section (paid blocks)

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/natal/human-section` |
| Access | premium · stars (charge-id only, 300 Stars) |
| Matrix | **no row** — uses ad-hoc premium + unlock lookup |
| UserState | no |
| Layer | yes (variant `full`, per-section cacheKey) |
| Logger | yes (`natal-human-section`) |
| Stars nonce | **no** — not in this sprint |
| Charge fallback | yes — only path for stars |
| Legacy bridge | no |
| cacheKey | `human_v2.paid:{sectionKey}` |
| Status | **partial** |

### Natal human daily (Horoscope love/work layers)

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/natal/human-daily` |
| Access | free (`daily_overview`) · premium · stars (35 Stars, charge-id) |
| Matrix | **no dedicated row** — stored as `natal/living` |
| Logger | yes (`natal-human-daily`) |
| Stars nonce | **no** |
| Charge fallback | yes |
| cacheKey | `human_v2.daily:{date}:{sectionKey}` |
| Status | **partial** |

### Synastry brief

| Field | Value |
|-------|-------|
| API (canonical) | none — still `/api/astrology/synastry-brief` |
| Replacement planned | content synastry brief route not created |
| Access | free |
| Matrix | yes (`synastry/brief`) |
| Legacy bridge | **yes** — `calculateBriefSynastry` in `astrologyService.ts` |
| Status | **legacy** |

### Synastry full / extended

| Field | Value |
|-------|-------|
| API | `POST /api/content/synastry/extended` (+ legacy `/api/astrology/synastry-full` for premium path) |
| Access | premium · stars (180 Stars, charge-id only) |
| Matrix | yes — partial alignment |
| UserState | yes (extended API) |
| Layer | yes |
| Logger | yes (`synastry-extended`) |
| Stars nonce | **no** — UI not wired; do not implement this sprint |
| Charge fallback | yes |
| Legacy bridge | `calculateFullSynastry` still hits `/api/astrology/synastry-full` |
| cacheKey | `buildSynastryExtendedCacheKey(...)` |
| Status | **partial** |

### Today pulse

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/today/pulse` |
| Access | free (not paywalled) |
| Matrix | reuses `forecast/daily` conceptually — **storage anomaly** |
| Logger | yes (`today-pulse`) |
| cacheKey | `today-pulse:{date}:{tz}:{calcVersion}` stored under `forecast/daily` surface |
| Status | **partial** — needs own surface/variant in matrix long-term |

### Today overview / home

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/today/overview`, `.../today/home` |
| Access | free |
| Matrix | no |
| Logger | yes on overview (`today-overview`) |
| Legacy bridge | composes `forecast/daily` + `horoscope/sign-daily` |
| Status | **partial** |

### Today check-in / action-time

| Field | Value |
|-------|-------|
| API | `.../today/checkin`, `.../today/action-time` |
| Access | free |
| Logger | no |
| Status | **partial** |

### Horoscope sign-daily

| Field | Value |
|-------|-------|
| API | `GET/POST /api/content/horoscope/sign-daily` |
| Access | public / free |
| Matrix | no dedicated row |
| Logger | no |
| Status | **partial** |

### Natal deep dive

| Field | Value |
|-------|-------|
| API (new) | `.../content/natal/dive` |
| Legacy | `/api/astrology/deep-dive` via `getDeepDiveAnalysis` |
| Access | premium |
| Status | **legacy** client path still used by `contentGenerationService` |

---

## 2. Legacy `/api/astrology/*` client calls

| Endpoint | Called from | Content replacement | Remove now? | Why / unblock |
|----------|-------------|---------------------|-------------|---------------|
| `natal-chart` | `astrologyService`, `chartService` | N/A (calc infra) | **Keep** | Calculation core; not content tier |
| `natal-intro` | `getNatalIntro` fallback | `content/natal/anchor` | **Keep fallback** | Remove when anchor reliability = 100% |
| `synastry-brief` | `calculateBriefSynastry` | none yet | **Keep** | Need `content/synastry/brief` + client switch |
| `synastry-full` | `calculateFullSynastry` | `content/synastry/extended` | **Keep** | Premium path still uses legacy; migrate Synastry.tsx |
| `daily-horoscope` | `legacyGetDailyHoroscope*` fallback | `content/forecast/daily` | **Keep** | Controlled by `FORECAST_LEGACY_FALLBACK`; disable env when stable |
| `deep-dive` | `getDeepDiveAnalysis`, onboarding gen | `content/natal/dive` | **Keep** | Switch `contentGenerationService` + natal UI |
| `chat` | ~~`legacyChatWithAstra`~~ | `content/question/ask` | **Removed** | Dead code deleted this sprint |
| `weekly-horoscope` | none found | `content/forecast/weekly` | **Endpoint only** | Safe to deprecate server route later |
| `monthly-horoscope` | none found | `content/forecast/monthly` | **Endpoint only** | Safe to deprecate server route later |
| `regenerate` | none | N/A | n/a | Not in codebase |
| `refresh-natal-intro` | none (docs only) | anchor regen | n/a | Not in codebase |

---

## 3. Stars pricing map

| Amount | Surface | Defined in | In `starsPricing` | In matrix | UI hardcode |
|--------|---------|------------|---------------------|-----------|-------------|
| 80 | Forecast full day | `FORECAST_FULL_DAY_STARS_COST` | yes | yes (`forecast/morning|day|evening`) | Horoscope chart layer — uses constant |
| 120 | Ask Lumia one-off | `ASK_LUMIA_STARS_COST` | yes | yes (`question/one_off`) | OracleChat via API payload |
| 180 | Synastry extended | `SYNASTRY_EXTENDED_STARS_COST` | yes | yes (`synastry/full`) | Synastry UI via API |
| 300 | Human paid section | `HUMAN_PAID_STARS_COST` | re-export | **no row** | API responses only |
| 35 | Human daily layer | `HUMAN_DAILY_STARS_COST` | re-export | **no row** | Horoscope love/work — **fixed** to use constant |

Remaining hardcodes: API error messages embed costs via shared constants; Synastry/Natal Stars UX not on nonce yet by design.

---

## 4. Lumi read-paths (legacy-only, kept intentionally)

| Location | Purpose |
|----------|---------|
| `forecast/daypart.ts` `loadDaypartLayer` | Read old `content_interpretations` rows with `accessTier: 'lumi'` |
| `contentArchitecture.ts` unlock lookup | Match pre-migration `content_unlocks.access_tier = 'lumi'` |
| `human-section.ts`, `human-daily.ts` | Unlock lookup fallback for old rows |
| `synastry/extended.ts` cache load | Read cached synastry under `lumi` tier |
| `contentAccessMatrix` / `contentAccessTier` | Map `lumi` unlock entries → stars for access checks |
| `lib/db.ts`, `lib/migrations.ts` | DB constraints still allow `lumi` column values |
| `natalReadingService.ts` `allowLumiSpend` | Legacy param name; sends `accessTier: 'lumi'` — **deprecated path** |

No Lumi product UI or wallet. Old `content_unlocks` rows remain readable.

---

## 5. Logger coverage

| API | scope | Events |
|-----|-------|--------|
| `question/ask` | ask-lumia | request_start, access_check, cache_*, generation_*, payment_* |
| `forecast/daypart` | forecast-daypart | same pattern |
| `synastry/extended` | synastry-extended | request_start, access_check, cache_hit, payment_required, generation_* |
| `natal/human-section` | natal-human-section | request_start, access_check, unlock_required, payment_required, cache_hit, generation_* |
| `natal/human-daily` | natal-human-daily | same |
| `forecast/weekly` | forecast-weekly | request_start, access_check, unlock_required, cache_hit, generation_* |
| `forecast/monthly` | forecast-monthly | same |
| `today/pulse` | today-pulse | request_start, cache_hit, generation_* |
| `today/overview` | today-overview | request_start, cache_hit, generation_* |

Privacy: no question text, AI answers, or full birth data in logs.

---

## 6. Backlog

### P0 — next sprint candidates

- Wire **Synastry extended** Stars nonce (mirror Ask/daypart); keep charge fallback.
- Wire **Human section/daily** Stars nonce; Horoscope love/work payment UX.
- Migrate **synastry-brief** and **synastry-full** client off `/api/astrology/*`.
- Add matrix rows for **human paid/daily** or document as intentional exceptions in code.
- Extend logger to remaining content APIs (`forecast/daily`, `natal/anchor`, etc.).

### P1

- Disable `FORECAST_LEGACY_FALLBACK` in production after monitoring.
- Remove `getNatalIntro` → `natal-intro` fallback when anchor SLO is green.
- Switch `getDeepDiveAnalysis` to `content/natal/dive`.
- Add `today/pulse` as dedicated matrix surface (not `forecast/daily` storage).
- Planet insight: explicit `PREMIUM_REQUIRED` gate in API (client-only gate today).

### P2

- Deprecate unused `/api/astrology/weekly-horoscope` and `monthly-horoscope` routes.
- Centralize all Stars costs in `starsPricing` (human costs already re-exported).
- Matrix enforcement for weekly/monthly (optional — premium-only already correct).
- Remove `allowLumiSpend` / `accessTier: 'lumi'` from `natalReadingService` client payloads.

### P3

- DB migration to normalize `lumi` → `stars` in historical rows (read-paths can stay until then).
- Admin notification segment cleanup (`lumi` segment labels).
- Single content generation orchestrator replacing `contentGenerationService` legacy calls.
