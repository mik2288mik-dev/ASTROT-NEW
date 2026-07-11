# Content Cache And Prewarm

The cache model is deliberately small for the MVP.

| Layer | Storage | Policy |
| --- | --- | --- |
| Primary natal chart | `natal_charts` | Canonical input hash, Swiss Ephemeris calculation, primary repair through `/api/charts` |
| Personal daily canvas | `content_interpretations` | One canvas per chart/date/prompt/input hash; tabs slice the same saved row |
| Sign horoscope | `content_cache` | Shared by sign/date/period/language |
| Natal readings | `content_interpretations` | Chart-scoped, prompt-versioned |
| Premium synastry | `synastry_cache` and content rows | Pair-scoped by two chart versions/input hash |

Premium prewarm is additive and idempotent. It may prepare Premium layers after entitlement changes, but it must not block startup or generate heavy AI content before the app has identity, chart, and cache context.

Client dedup: `chartService` keeps an in-flight calculation map. Server dedup: `/api/charts` uses `LockKeys.primaryChartCalculation`, while generated content uses content-generation locks.
