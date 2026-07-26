# Current Architecture

The active application is «Твой Гороскоп» / “Your Horoscope”.

## Runtime entry and startup

- Identity is enforced by `requireAppUser`; feature access uses `accessMatrix`, content policy uses `contentMatrix`, and non-forecast prompt builders remain in `contentPromptBuilders`.
- Product APIs live under `/api/content/*`.
- `App.tsx` resolves the authenticated profile and immediately reuses the available local natal chart.
- A usable local chart is enough to render `Dashboard`; personal forecast generation, natal text generation, and server chart refresh are not startup gates.
- Startup runs a cache-only check for the current personal day package after the Dashboard is available, then starts missing-content generation in the background.
- Dashboard uses stale-while-revalidate: local package first, server cache second, background generation only on a miss. A refresh never clears a usable package already on screen.
- Client in-flight maps and server content-generation locks deduplicate parallel startup and screen requests.

## Personal forecast V2

The personal Dashboard is one chart-based product for `day`, `week`, `month`, and `year`. All periods use `PersonalForecastPackage` from `lib/personalForecastContract.ts`.

Each package contains exactly seven fixed topics:

1. `overview`
2. `love`
3. `work`
4. `money`
5. `mood_energy`
6. `communication`
7. `luck`

The server selects two or three additional static, localized dynamic topic keys from calculated evidence. The model never invents topic titles.

The calculation and generation path is:

1. `lib/personalForecastEvidence.ts` samples the complete requested period in the chart timezone.
2. Swiss Ephemeris transit positions are converted into stable evidence IDs for transit-to-natal aspects, houses, lunations, ingresses, and stations.
3. Evidence is weighted and assigned to topics in code; one continuing factor is grouped into one period window.
4. `lib/personalForecastGeneration.ts` sends only a topic’s assigned evidence to GPT.
5. GPT returns `card`, `reading`, `astrology.explanation`, and up to four supplied evidence IDs.
6. The server validates IDs, dates, field limits, and app-voice rules, then builds exact evidence views from deterministic data.

All user-facing model calls use `getAppSystemVoice(language)`. Model selection uses `getUnifiedContentModel()` with the fixed default `gpt-4.1`. `lib/appVoice.ts` and `APP_VOICE_VERSION` were not changed by this migration.

The private endpoint is `/api/content/forecast/personal`:

- `GET` is cache-only;
- `POST` ensures a missing package under a generation lock;
- profile, chart ownership, language, timezone, and Premium entitlement are resolved on the server;
- the client cannot submit trusted chart or Premium data.

## Access and reading UI

- Overview and all short card texts remain visible to Free users.
- `love` is the configured additional Free full reading.
- Other full readings, dynamic readings, and detailed calculation rows are server-sliced and locked for Free.
- `views/PersonalForecastScreen.tsx` renders the layers in order: `reading`, “Почему такой прогноз”, then collapsible exact evidence.
- A missing or failed package shows a status only inside the affected cards and offers a retry. It never falls back to a sign horoscope or invented forecast text.

## Separate products

- General sign horoscopes remain a separate Free `Зодиак` product with shared sign/period/language caches.
- Natal readings, sign compatibility, chart-based synastry, Matrix of Destiny, payments, archive, notification, support, and admin systems remain separate products.
- The personal Dashboard does not call sign-horoscope endpoints.

## Visual resolver

`lib/personalForecastVisuals.ts` assigns the entire forecast screen in one deterministic pass using user, period, period key, topic, slot, and `forecast-visual-v2`.

- No `asset.path` can repeat on one screen.
- Every real forecast asset belongs to one period only.
- Day/week/month/year use separate hero pools.
- Previous-period reuse is avoided when the pool has an alternative.
- Missing or exhausted slots use the period-specific editorial CSS fallback and set `visualFallback`.
- Visual assignments are independent of GPT content and can change with the manifest version alone.

Current repository inventory:

| Scope | WebP | SVG | Total |
|---|---:|---:|---:|
| Entire `public/` | 157 | 19 | 176 |
| Forecast heroes | 5 | 0 | 5 |
| Forecast personal topics | 18 | 0 | 18 |
| Other card backgrounds: products/questions/strips/universal | 7 | 18 | 25 |

No image or `generated_images` file is added by this migration.

### Missing forecast asset slots

The current art is real and distinct, but it does not fill every unique period/topic slot. The exact follow-up inventory is 57 files:

- hero rotation: `hero_week_02`, `hero_month_02`, `hero_year_02` — 3;
- fixed topics — 12:
  - love: week, month;
  - work: week, year;
  - money: day, year;
  - mood_energy: week, month;
  - communication: day, year;
  - luck: day, month;
- dynamic topics with no dedicated art yet — 36:
  - business, study, creativity, travel_movement, documents_deals, purchases_property, rest_recovery, physical_activity, important_choice: one asset for each of day/week/month/year;
- partially covered dynamic topics — 6:
  - home_family: day, year;
  - friends_social: week, month;
  - public_visibility: week, month.

Until those assets exist, the resolver uses CSS fallback rather than copying, renaming, or repeating another topic’s image.

## Persistence and migration boundary

- Personal packages are stored in `content_interpretations` as canonical chart/user-scoped Premium rows and sliced at response time.
- The additive `mvp_037_personal_forecast_yearly_variant` migration permits the `yearly` content variant without deleting rows or rewriting migration history.
- Legacy daily-canvas, personal period-extra, and sign-based Dashboard rows remain in storage but cannot match V2 cache keys.
- Separate `Зодиак`, natal, compatibility, synastry, payment, and archive data is not invalidated.

Removed pre-MVP product surfaces remain documented in `docs/MVP_LEGACY_REMOVAL_LOG.md`.
