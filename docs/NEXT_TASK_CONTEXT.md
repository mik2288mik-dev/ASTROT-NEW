# Next-task context

## Personal forecast

- `views/Dashboard.tsx` presents Today, Week, and Month as periods of one diary screen.
- Forecast prose comes from OpenAI Luna through `lib/openaiResponses.ts` using strict JSON Schema.
- `lib/personalForecastGeneration.ts` gives Luna the saved natal profile and user profile. It does not run Swiss transit/evidence calculation for each period.
- `lib/personalForecastCache.ts` persists only the completed interpretation cache; forecast-period calculation snapshots are retired.
- Keep forecast copy short, concrete, personal, and readable. The headline and advice must be materially different across periods.
- `lib/appVoice.ts` is the only shared runtime voice source.

## Keep separate

- `lib/swisseph-calculator.ts` is still required for natal charts.
- `Зодиак` is a separate sign-based product and keeps its DeepSeek route.
- Natal questions are separate from the diary forecast and remain in the natal-reading flow.

## Safety boundaries

- Do not restore daily-canvas, period extras, a separate personal forecast reader, or a question block inside the forecast screen.
- Do not delete database data or migrations during code cleanup.
- Do not remove a route, admin tool, or shared utility solely because the current React screen does not import it; first trace its runtime consumers.
