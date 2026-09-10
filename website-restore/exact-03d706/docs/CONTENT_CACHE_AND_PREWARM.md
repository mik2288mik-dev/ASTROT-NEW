# NEBO content cache and prewarm

This reference describes the active personal forecast cache.

## Cache identity

The server cache varies by authenticated user, access tier, normalized
birth-profile fingerprint, period, timezone-aware period key, language, model,
and calculation, contract, prompt, voice, and cache versions. Calculated chart
identity is not part of the key.

The accepted hidden brief is stored in `meta.astrologerBrief` and returned
inside `PersonalForecastPackage`; the UI does not render it as forecast text.
Rejected provider output is not cached.

## Request flow

1. Render compatible local content when available.
2. Check the server cache with `GET`.
3. Start missing generation with `POST`.
4. Poll a `202` response with the same `POST` and `regenerate: false`.
5. Replace local content only with a validated compatible package.

Client requests are deduplicated. The server also uses generation locks so
parallel requests do not create duplicate provider work.

## Prewarm

Startup never awaits model generation. Free access prewarms the current day.
Premium may prewarm day, week, and month sequentially. A failed prewarm does
not block startup or discard compatible cached content.

## Anti-repeat

The brief provider receives bounded same-user semantic history and selected
cross-user `coreForecast` and `secondaryForecast` signatures for repetition
control. The writer receives only the accepted brief and up to 15 same-user
forecasts. Full cross-user forecast text remains server-local and is used only
by validation.
