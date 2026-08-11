# Current architecture

## Runtime

- `App.tsx` restores the authenticated profile and a saved natal chart without making generation a startup gate.
- `Dashboard` is the only personal-reading surface. Today, Week, and Month are internal periods selected from the diary drawer, not tabs on the main screen.
- The client is local-first: it keeps a usable cached reading visible while a server refresh runs in the background.

## Personal forecasts

- `lib/swisseph-calculator.ts` remains the deterministic source for the saved natal chart. It is not called to calculate forecast-period transits or evidence.
- `lib/personalForecastGeneration.ts` builds one private prompt input from the selected date/range, profile, and compact saved natal context, then asks OpenAI Luna to author the reading. The active product contract requires available birth date/time/place to be included deliberately when they improve the personalisation; align the generator before claiming that input is complete.
- Luna uses the Responses API with strict JSON Schema through `lib/openaiResponses.ts`.
- The model writes only one heading and one or two paragraphs. It is the author of the personal forecast, not a renderer of precomputed themes or a calculator of period events. The server validates format, length, voice, safety, and visible astrology terms before persisting the story.
- `lib/personalForecastCache.ts` caches one materialized story by user, chart, period, language, prompt, voice, and model identity. It does not write transit/evidence snapshots for the forecast period.
- `lib/appVoice.ts` is the shared runtime source for generated-content voice.

## Product separation

- `Зодиак` remains a separate sign-based product and keeps its DeepSeek compatibility route.
- Swiss Ephemeris remains required for natal-chart calculation and its permanent interpretations.
- “Вопрос астрологу” belongs to the natal reading and opens from that product; it is not a block inside the personal forecast.

## Visual and navigation boundaries

- The left drawer owns primary navigation. Forecast periods are internal to the diary.
- Text is the default forecast presentation. A forecast uses at most one strong editorial visual; a rare curated sticker is an optional pause after the story, never an explanation or a topic selector.
- Generated text is never rendered over an image or inside an additional visual frame, card, or promo banner.

## Persistence boundary

- Existing migrations and stored data are append-only history; do not delete database tables as a code-cleanup step.
- Legacy forecast-question server routes remain isolated until their shared natal-question utilities are explicitly migrated. They are not part of the rendered forecast UI.
