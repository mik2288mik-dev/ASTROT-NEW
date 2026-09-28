# NEBO natal rebuild — temporary work plan

> Temporary checklist for the current natal rebuild. Delete this file only after every final cleanup item is complete.

## Progress

- [x] Stage 1 — separate branch, temporary work plan, canonical NEBO voice foundation, first unified natal interpretation/writer/API/UI skeleton.
- [x] Stage 2 — remove the old admin classic/catalog selector, delete its storage/helper/tests, fix per-field birth-time reliability handling, and align current shell tests with the unified reading.
- [x] Stage 3 — add the deterministic Swiss → evidence → meaning audit layer, neutralise the old negative routing, and add the temporary admin inspector for real saved charts. Human review of actual charts continues through the temporary inspector before final release.
- [x] Stage 4 — harden the Writer/semantic validation and verify Рассказ / По темам output: plain life-area topics, no duplicate topic meanings, strict anti-filler/pseudo-psychology checks, semantic fidelity review, no unvalidated fallback, one Premium reading for both views.
- [ ] Stage 5 — move Карта and Спросить о себе completely onto the same interpretation source.
- [ ] Stage 6 — remove unused legacy natal client/server code, caches, tests, and duplicate voice/prompt paths that are no longer needed by the current app.
- [ ] Stage 7 — end-to-end test build, old-client compatibility cutoff, final docs cleanup, then delete this temporary work plan.

## Final target

```text
birth data
→ Swiss Ephemeris
→ saved NatalChartDataV2
→ ONE deterministic natal interpretation layer
→ ONE validated meaning set
→ Writer
→ Рассказ / По темам / Карта / Спросить о себе
```

There must not be several independent natal meaning engines.

## 0. Freeze the calculation path

Do not change the calculation/storage path as part of this task:
- `lib/swisseph-calculator.ts`
- `lib/birthTime.ts`
- `lib/natalChartV2Types.ts`
- `lib/natalChartCanonical.ts`
- `lib/natalChartPersistence.ts`
- `lib/natalChartV2Repository.ts`
- `lib/natalChartRead.ts`
- `pages/api/charts/index.ts`
- `services/chartService.ts`

Before deleting old API code, verify which natal endpoints the currently supported RuStore APK still calls.

## 1. One NEBO voice

Runtime source of the global voice:
- `lib/voice/core.ts` — the only global voice text.
- `lib/voice/validators.ts` — global voice validation.
- `lib/voice/contracts/*.ts` — function-specific rules only.

Rules:
- Do not copy the global tone into each feature prompt.
- Feature contracts define only what the feature generates, allowed input/evidence, output shape and feature-specific boundaries.
- `lib/appVoice.ts` may temporarily keep compatibility exports/feature validators, but it must not keep a second competing global system prompt.
- `lib/natalReading/narrativeVoice.ts` must not remain a hidden second natal voice.
- Voice version must participate in prompt/cache identity.

## 2. One natal interpretation layer

Create a single module under `lib/natalInterpretation/`.

It must:
- consume saved `NatalChartDataV2`;
- never recalculate Swiss;
- include every reliable calculated chart fact in the interpretation input;
- exclude only facts that are not reliable for the supplied birth-time quality;
- never classify a fact in advance as “conflict”, “boredom”, “loss of interest”, “control”, etc.;
- never force positive/negative balance;
- keep traceability from every human meaning back to exact chart evidence;
- merge duplicate meanings without dropping their evidence.

AI is not allowed to invent the astrological meaning of raw chart data. It may only rewrite already approved meanings.

## 3. Remove the current biased meaning path from the active product

Replace active dependencies on:
- `lib/natalReading/permanentReport.ts` report-plan domain assignment;
- `lib/natalReading/reportCatalogEvidence.ts` answer/domain routing;
- `lib/natalReading/reportCatalogGeneration.ts` old meaning generation;
- `lib/natalReading/narrativeVoice.ts` prompt examples that prime meaning.

Do not delete compatibility code until the new path is active and old clients are checked.

## 4. Writer

Writer input:
- approved meaning IDs;
- approved human meanings;
- evidence IDs;
- requested product surface.

Writer output:
- plain NEBO language;
- no new astrological claims;
- no invented biography, motives, trauma, diagnosis, events or third-party thoughts;
- no visible astrology in the main prose;
- stable IDs preserved for validation.

No mandatory padding. Text length follows actual material, not word quotas.

## 5. Рассказ / По темам

Keep the agreed UX in `views/v2/NatalMagazine.tsx`:
- Обзор;
- Рассказ / По темам;
- Карта;
- Спросить.

Both Рассказ and По темам must be views over the same meaning set, not separate interpretations.

Remove UI heuristics such as deriving “Эмоции” by looking for Moon evidence or deriving a topic by regex over finished prose.

## 6. Interactive map

Keep the actual wheel/UI:
- `components/NatalReading/InteractiveNatalMap.tsx`
- `lib/natalChartWheelModel.ts`

Replace the independent semantic tables in:
- `components/NatalReading/mapExplanation.ts`

A tap must use the same interpretation source as the reading. Technical placement/aspect data may be shown as disclosure underneath.

## 7. Спросить о себе

Keep:
- `components/NatalReading/NatalQuestionExperience.tsx`
- `lib/natalReading/natalQuestionStore.ts`
- existing history, limits and access logic.

Change `lib/natalReading/natalQuestion.ts` so answers use the same interpretation layer. Raw chart data may support evidence display, not a second free-form interpretation.

## 8. Cache/version cutover

The new reading must have:
- new contract version;
- new prompt version;
- new server cache namespace;
- new client cache namespace.

New code must not read old catalog prose as if it were a new interpretation. A voice/content change must never trigger a Swiss recalculation.

## 9. Switch the app

Only after interpreter + writer + reading + map + questions work:
- make the new reading the only normal runtime path;
- verify Free/Premium;
- primary and saved charts;
- exact/approximate/unknown time;
- retry/error states;
- Android build.

## 10. Remove the classic path

After repository-wide import checks, remove obsolete classic-only pieces, including candidates:
- `components/NatalReading/HumanReport.tsx`
- `lib/natalReading/readingVariant.ts`
- `services/natalReadingService.ts`
- `lib/natalReading/permanentGeneration.ts`
- `lib/natalReading/permanentApi.ts`
- `pages/api/content/natal/human-base.ts`
- `pages/api/content/natal/human-premium.ts`
- `pages/api/content/natal/human-section.ts`
- classic-only caches/tests.

## 11. Remove old catalog path

Only after supported APK compatibility is verified, remove obsolete catalog-only pieces, including candidates:
- `lib/natalReading/reportCatalog.ts`
- `lib/natalReading/reportCatalogEvidence.ts`
- `lib/natalReading/reportCatalogGeneration.ts`
- `lib/natalReading/reportCatalogApi.ts`
- `services/natalCatalogService.ts`
- `pages/api/content/natal/catalog.ts`
- `pages/api/content/natal/catalog-answer.ts`
- catalog-only caches/tests/preview fixtures.

## 12. Remove older natal generators

Repository-wide search first, then remove unused legacy pieces such as:
- `lib/natalReading/generate.ts`
- `lib/natalReading/prompts.ts`
- `lib/natalReading/fallbacks.ts`
- `lib/natalReading/chartSerializer.ts`
- legacy portrait/aspects/today/week/dive endpoints and components.

## 13. Old semantic engines

When no active dependency remains, remove:
- `lib/natalSemanticCompiler.ts`
- `lib/natalHumanInterpretation.ts`

Do not copy their old biased meanings into the new interpreter.

## 14. PersonalityReport

`views/PersonalityReport.tsx` must not remain a hidden second natal interpretation engine.
Either migrate it to the same interpretation layer or remove its route/UI in a separately verified step.

## 15. Verification

Before completion:
- focused natal tests;
- full relevant Jest suite;
- TypeScript check;
- production web build;
- Android build;
- repository-wide search for stale imports, API paths and cache keys.

Search specifically for:
- `classic`
- `reportCatalog`
- `HumanReport`
- `natalSemanticCompiler`
- `natalHumanInterpretation`
- `conflict`
- `control_freedom_trust`
- `central_contradictions`
- `misunderstood`
- `boredom`
- `lose_interest`
- `irritation`

## 16. Documentation

After code is final, update:
- `docs/APP_VOICE.md`
- `docs/agents/natal-reading.md`
- `docs/CURRENT_ARCHITECTURE.md`
- any other document that still describes a removed natal path.

`AGENTS.md` should only keep coding-agent rules; durable product architecture belongs in the relevant docs.

## 17. Remove temporary Stage 3 inspector

Before final release, after semantic review is complete:
- [ ] remove `components/NatalReading/NatalInterpretationDebugPanel.tsx`;
- [ ] remove `lib/natalReading/natalInterpretationDebug.ts`;
- [ ] remove the `Проверка нового натала` toggle/import/state from `views/Settings.tsx`;
- [ ] remove the debug panel hookup from `views/v2/NatalMagazine.tsx`;
- [ ] remove `natal-debug-*` CSS;
- [ ] remove `__tests__/natal-interpretation-debug-ui.test.ts`;
- [ ] repository-wide search for `natalDebug`, `NatalInterpretationDebug`, and `nebo:admin:natal-interpretation-debug:v1`.

## 18. Finish and self-delete

The task is not complete merely because the new reading works.

Completion requires:
- one runtime global voice;
- one natal meaning engine;
- one active natal reading path;
- map and questions using the same meanings;
- old caches not read by the new client;
- obsolete code/tests/docs removed;
- supported old APK compatibility resolved;
- tests/builds green.

Then delete this temporary work-plan file itself.