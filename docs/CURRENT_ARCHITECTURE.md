# Current architecture

## Runtime

- `App.tsx` restores the authenticated profile and a saved natal chart without making generation a startup gate.
- `Dashboard` is the only personal-reading surface. Today, Week, and Month are internal periods selected from the diary drawer, not tabs on the main screen.
- The client is local-first: it keeps a usable cached reading visible while a server refresh runs in the background.

## Personal forecasts

- `lib/swisseph-calculator.ts` remains the deterministic source for the saved natal chart. It is not called to calculate forecast-period transits or evidence.
- `lib/personalForecastGeneration.ts` builds one private prompt input from the selected date/range, available birth details, saved natal positions/aspects, and bounded anti-repeat history, then asks OpenAI Luna to author the reading. It does not inject a preselected generic psychological topic.
- Luna uses the Responses API with strict JSON Schema through `lib/openaiResponses.ts`.
- For Today the model writes one shared headline plus 4–6 ordered fragments. The server materializes the first fragment as `overview` and the remaining fragments as untitled `sections`. Week and Month require one cohesive fragment and no additional sections.
- The structured writer also returns hidden post-hoc keys for the used main idea, life plot, advice, and comparison. They are never rendered. Server validation combines compact exact/token signatures from these keys with headline checks, normalized openings, and text similarity to reject repeats.
- The model is the author of the personal forecast, not a renderer of precomputed themes or a calculator of period events. The server validates format, length, language, forecast voice, safety, unsupported claims, repetition, and visible astrology before persisting the result. Writer attempts remain capped at two.
- `lib/personalForecastCache.ts` caches one materialized package by user, chart, period, language, prompt, voice, and model identity. Before a miss is generated, it reads bounded same-period history with `allowExpired` plus one safe latest excerpt, including the previous headline; this history is negative prompt context only and is never served as the requested forecast. Compatible stale output must have the current prompt identity.
- `lib/appVoice.ts` contains the shared runtime voice and a separately versioned personal-forecast layer. Forecast-specific character and occasional irony do not make the global app voice comedic.

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
