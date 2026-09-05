# Personal AI forecast

## Reading contract

Today, Week and Month each show one short, coherent personal forecast:

- `title`: a sharp, specific name, 1–5 words;
- `forecast`: the complete reading, with ordinary paragraphs only where meaning calls for them;
- `closing`: one brief ending in the same voice, without a compulsory instruction or moral.

Use 40–60 Russian words for Day, 60–80 for Week and 80–100 for Month, including title and closing. Do not fill a quota with repetition. There is no separate punchline, mandatory paragraph count, calendar breakdown, or Love/Work/Mood checklist. A couple of connected observations should form a picture of the period, not a chain of invented events about one ride, purchase, or repair.

The stored `overview` contains the whole forecast. The remaining section contains the closing. The renderer must not turn each observation or newline into a separate editorial card or widely spaced fragment.

## Generation and history

```text
raw birth input + selected period
→ hidden AI brief
→ writer + accepted brief + own recent reading history
→ validation
→ durable saved forecast
→ reading and later reuse
```

Personal forecasts do not use Swiss Ephemeris, calculated natal charts, chart IDs, planets, houses, aspects or transits. Do not imply that the AI performed a period calculation. Natal readings and saved-chart compatibility have separate calculation paths.

The writer receives the reader's name, language, known grammatical gender, period, accepted brief and up to 15 of that same user's previous forecasts. History crosses Free/Premium and known previous content versions; serving a cached forecast still requires the current contract. Never pass another user's reading to the writer. Cross-user signatures may inform the brief and server validation only.

`lib/personalForecastExamples.ts` is the runtime reference corpus. Each few-shot pairs an accepted input brief with its output. Examples teach the transformation and voice; they are not a catalog of topics to assign to users. The live brief supplies the actual content.

## Voice and verification

Use ordinary, direct Russian, as in conversation. Be specific without inventing biography, diagnoses, guaranteed events or nonexistent calculations. Humor is optional, never a quota. Avoid coaching instructions, mystical imagery, psychological labels, corporate language, padding and repeated modal openings. Positive possibilities do not need an artificial warning attached.

Keep the general app voice separate from the versioned forecast voice. Bump prompt, contract and cache identities when the format changes; do not serve the rejected microstories or fragment-based readings as current output.

## Installed Android clients

The client sends its forecast contract in the request. Requests without that field come from older installed APKs and need the v25 wire shape. `lib/personalForecastWireCompatibility.ts` projects the already generated reading into that shape; it never calls the writer or calculates a chart. Keep the original generation identity alongside the compatibility metadata. A wire adapter does not make old content valid in the current generation cache.

Test access and rendering for both shapes when changing the API. A new backend deployment reaches installed APKs before a store update does. Do not require every installed client to understand a new prompt version immediately, and do not expose paid text through a compatibility response.

Preserve bounded provider retries, strict output shape and `store:false`. Validate meaning and repetition without turning every editorial preference into a retry. Read real generated Day, Week and Month examples critically: schema success alone does not prove good writing. Check save/reuse and owner-scoped history as well as generation.
