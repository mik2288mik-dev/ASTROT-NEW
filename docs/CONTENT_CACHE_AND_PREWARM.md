# Content Cache And Prewarm

## Current runtime

| Layer | Storage | Current policy |
| --- | --- | --- |
| Primary natal chart | `natal_charts` | Canonical input hash, Swiss Ephemeris calculation, primary repair through `/api/charts` |
| Personal Today | `content_interpretations` | Legacy daily canvas per chart/date/prompt/input hash; UI slices the saved row |
| Personal Week/Month/Year on Dashboard | mixed | Currently sign-based forecast cache plus separate period extras; this is transitional and must not remain the personal product |
| Sign horoscope (`Зодиак`) | `content_cache` | Shared by sign/date/period/language |
| Natal readings | `content_interpretations` | Chart-scoped and prompt-versioned |
| Premium synastry | `synastry_cache` and content rows | Pair-scoped by two chart versions/input hash |

## Active migration target

The authoritative cache/prewarm contract for the personal forecast screen is in:

`docs/PERSONAL_FORECAST_SCREEN_V2_TASK.md`

The V2 implementation must use one period-aware key builder for personal Day/Week/Month/Year and include user/chart identity, period, period key, timezone, chart calculation version, prompt version, voice version, and unified model ID.

Legacy daily-canvas rows, personal period extras, and sign-based Dashboard period rows must be considered incompatible only for the personal forecast screen. Do not invalidate the separate `Зодиак`, natal-reading, compatibility, synastry, payment, or archive data by accident.

Prewarm must follow period cadence rather than regenerating every layer daily: Day today/tomorrow, Week current/next near rollover, Month current/next near rollover, Year current/next only near year rollover.

Client and server generation remain deduplicated with in-flight maps and content-generation locks. The implementation PR must update this document again with the final concrete key format, endpoints, lock keys, retention policy, and migration behavior.