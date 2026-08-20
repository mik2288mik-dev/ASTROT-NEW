# Next-task context

## Personal forecast

- `views/Dashboard.tsx` presents one diary reading; one controlled Today/Week/Month tablist sits directly below its header. Today is a 4–6-fragment editorial feed; Week and Month are cohesive stories.
- Forecast prose comes from OpenAI Luna through `lib/openaiResponses.ts` with `store: false` and strict JSON Schema. Luna writes the entire reading from the selected period and private saved natal context, including hidden prose/pull-quote/paper-note presentation metadata for Today and one required typed `closing` that the server appends to the final fragment. The current Today renderer displays every fragment as continuous prose and does not branch on the presentation metadata. Rejected draft text stays inside server validation and never enters the repair prompt.
- The generation input must contain the exact date/range, timezone, available birth date/time/place, and a compact saved natal profile. It must not invent or calculate a new period transit/evidence package.
- `lib/personalForecastCache.ts` persists only the completed forecast package. Its identity includes the authenticated user, owned chart ID, full saved-natal fingerprint, hash of sanitized profile fields, period and timezone-aware key, language, model, and calculation, contract, prompt, and voice versions.
- Anti-repeat input contains up to 15 recent fragments for the same user and chart across `day`, `week`, and `month`; it is never biography or fallback copy.
- Keep forecast copy short, concrete, personal, and readable: one visible common opening hook of 2–5 words plus 4–6 untitled Today fragments or one untitled Week/Month story, at most 150 words. The final fragment closes with practical guidance, a wish, or brief motivation without a visible rubric; do not add visible themes, lists, explanations, questions, or CTAs.
- Active Today uses the deterministic `calendar-editorial` composition: 15 clock presets and 12 line presets selected from the user and date, then continuous prose fragments. The former five-layout personal asset planner and its image/paper catalogs remain library-only and inactive. Luna never chooses a preset, image, coordinates, colours, or layout.
- The inactive personal manifests remain separate from the Zodiac-only legacy source of 48 explicitly allowlisted assets under `/assets/zodiac-legacy-special/` (24 psychedelic and 24 approved funny-animal).
- `lib/appVoice.ts` is the only shared runtime voice source. Personal-forecast voice v3 uses ten period-local examples from `lib/personalForecastExamples.ts`: four Today and three each for Week and Month.
- One shared `LumiaBottomTabBar` is mounted on the main screens; the old drawer is not mounted. The top profile action owns profile data and saved charts, while forecast periods stay inside the Diary tablist.
- Client delivery is local-first, then server `GET`, then generation `POST`. After `202`, the client repeats `POST` with `regenerate: false`. Startup prewarm is non-blocking: Free requests only `day`; Premium sequentially requests `day`, `week`, and `month`.

## Keep separate

- `lib/swisseph-calculator.ts` is still required for natal charts.
- `Зодиак` is a separate sign-based product and keeps its DeepSeek route.
- Natal questions are separate from the diary forecast and remain in the natal-reading flow.

## Safety boundaries

- Do not restore daily-canvas, period extras, a separate personal forecast reader, the old drawer, a second navigation shell, a question block, feedback prompt, or promo banner inside the forecast screen.
- Do not delete database data or migrations during code cleanup.
- Do not remove a route, admin tool, or shared utility solely because the current React screen does not import it; first trace its runtime consumers.
