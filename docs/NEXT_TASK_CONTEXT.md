# Next-task context

## Personal forecast

- `views/Dashboard.tsx` presents one diary reading; Today, Week, and Month are selected only from the drawer. Today is a 4–6-fragment editorial feed; Week and Month are cohesive stories.
- Forecast prose comes from OpenAI Luna through `lib/openaiResponses.ts` using strict JSON Schema. Luna writes the entire reading from the selected period and private natal context, including hidden prose/pull-quote/paper-note presentation metadata for Today.
- The generation input must contain the exact date/range, timezone, available birth date/time/place, and a compact saved natal profile. It must not invent or calculate a new period transit/evidence package.
- `lib/personalForecastCache.ts` persists only the completed forecast package; deterministic visual layout/assets are derived separately and are not stored.
- Keep forecast copy short, concrete, personal, and readable: one heading plus 4–6 Today fragments or one Week/Month story, at most 150 words. Advice is optional; do not add visible themes, lists, explanations, questions, or CTAs.
- Today layouts and assets are application-owned. The personal source contains 309 assets under `/assets/personal-editorial/` (202 `editorial-v2`, 45 cats, 38 capybaras, and 24 objects), plus 19 empty runtime-text templates under `/assets/personal-paper-templates/`. Embedded-text and review-excluded assets stay catalogued but are not auto-selected. Its manifests and selector are separate from the Zodiac-only legacy source of 48 explicitly allowlisted assets under `/assets/zodiac-legacy-special/` (24 psychedelic and 24 approved funny-animal). Luna never chooses images, coordinates, colours, or layout.
- `lib/appVoice.ts` is the only shared runtime voice source.

## Keep separate

- `lib/swisseph-calculator.ts` is still required for natal charts.
- `Зодиак` is a separate sign-based product and keeps its DeepSeek route.
- Natal questions are separate from the diary forecast and remain in the natal-reading flow.

## Safety boundaries

- Do not restore daily-canvas, period extras, a separate personal forecast reader, main-screen period tabs, a question block, feedback prompt, or promo banner inside the forecast screen.
- Do not delete database data or migrations during code cleanup.
- Do not remove a route, admin tool, or shared utility solely because the current React screen does not import it; first trace its runtime consumers.
