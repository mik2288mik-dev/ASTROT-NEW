# Next-task context

## Personal forecast

- `views/Dashboard.tsx` presents one diary story; Today, Week, and Month are selected only from the drawer.
- Forecast prose comes from OpenAI Luna through `lib/openaiResponses.ts` using strict JSON Schema. Luna writes the entire story from the selected period and private natal context.
- The generation input must contain the exact date/range, timezone, available birth date/time/place, and a compact saved natal profile. It must not invent or calculate a new period transit/evidence package.
- `lib/personalForecastCache.ts` persists only the completed story cache; forecast-period calculation snapshots are retired.
- Keep forecast copy short, concrete, personal, and readable: one heading plus one or two paragraphs, at most 150 words. Do not add advice, patterns, themes, lists, explanations, questions, or CTAs to the story.
- `lib/appVoice.ts` is the only shared runtime voice source.

## Keep separate

- `lib/swisseph-calculator.ts` is still required for natal charts.
- `Зодиак` is a separate sign-based product and keeps its DeepSeek route.
- Natal questions are separate from the diary forecast and remain in the natal-reading flow.

## Safety boundaries

- Do not restore daily-canvas, period extras, a separate personal forecast reader, main-screen period tabs, a question block, feedback prompt, or promo banner inside the forecast screen.
- Do not delete database data or migrations during code cleanup.
- Do not remove a route, admin tool, or shared utility solely because the current React screen does not import it; first trace its runtime consumers.
