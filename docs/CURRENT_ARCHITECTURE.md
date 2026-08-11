# Current architecture

## Runtime

- `App.tsx` restores the authenticated profile and a saved natal chart without making generation a startup gate.
- `Dashboard` is the only personal-reading surface. Today, Week, and Month are internal periods of that screen.
- The client is local-first: it keeps a usable cached reading visible while a server refresh runs in the background.

## Personal forecasts

- `lib/swisseph-calculator.ts` remains the deterministic source for the natal chart. It is not called to calculate transits for every forecast period.
- `lib/personalForecastGeneration.ts` builds a compact context from the saved natal chart and profile, then asks OpenAI Luna for the reading.
- Luna uses the Responses API with strict JSON Schema through `lib/openaiResponses.ts`.
- The model writes only the headline, one or two paragraphs, one distinct piece of advice, and a visual cue. The server validates format, length, tone, forbidden time partitions, and the fixed profile evidence reference before persisting a package.
- `lib/personalForecastCache.ts` caches the materialized interpretation by user, chart, period, language, prompt, voice, and model identity. It does not write transit/evidence snapshots for the forecast period.
- `lib/appVoice.ts` is the shared runtime source for generated-content voice.

## Product separation

- `Зодиак` remains a separate sign-based product and keeps its DeepSeek compatibility route.
- Swiss Ephemeris remains required for natal-chart calculation and its permanent interpretations.
- “Вопрос астрологу” belongs to the natal reading and opens from that product; it is not a block inside the personal forecast.

## Visual and navigation boundaries

- The left drawer owns primary navigation. Forecast periods are internal to the diary.
- A forecast uses at most one strong editorial visual. Visual assets remain in `public/assets/forecast-feed/` and are resolved deterministically.
- Generated text is never rendered over an image or inside an additional visual frame.

## Persistence boundary

- Existing migrations and stored data are append-only history; do not delete database tables as a code-cleanup step.
- Legacy forecast-question server routes remain isolated until their shared natal-question utilities are explicitly migrated. They are not part of the rendered forecast UI.
