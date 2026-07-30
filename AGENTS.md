# Repository working rules

## Start safely

- Before changing code, run `git fetch origin`, switch to `main`, and use `git pull --ff-only origin main`.
- Preserve untracked local folders such as `.preview/`, `.qwen/`, and `.vscode/`; never add them implicitly.
- Keep changes scoped to the user request. Do not combine a UI task with backend, model, database, or deployment changes unless asked.

## Product boundaries

- `views/Dashboard.tsx` is the only Personal Forecast Feed screen. Keep it one continuous scrollable feed.
- Do not change the global header, bottom navigation, generation model, astrology calculations, server access control, or Free/Premium contract without explicit approval.
- Feed explanations use existing local `i` bottom sheets. Do not expose calculation internals, weights, or service fields in the main text.
- Premium previews stay in place in the feed; do not replace them with a lock screen or generic placeholder.

## Voice and copy — hard rule

- `lib/appVoice.ts` is the only runtime source of the generated-content voice. `docs/APP_VOICE.md` documents the same contract.
- The voice is direct, bold, calculation-led, and easy to understand. Use ordinary human language.
- Natal text is descriptive. Forecasts and question answers may be directive when the calculation supports a clear action, risk, or condition.
- Every sentence must add concrete information. Delete filler that can be removed without changing the meaning.
- Do not add pseudo-psychological, coaching, mystical, cosmic, therapeutic, or inspirational language.
- Do not invent trauma, childhood, parental relationships, diagnoses, profession, income, events, or biography.
- Do not promise guaranteed future events. Show conditions, risks, likely developments, and available choices.
- Do not write slogans such as «карта сложилась», «это про тебя», «что сейчас активно», «внутренний рисунок», «повторяющиеся сценарии», «энергия дня», «замедлись», «прислушайся к себе», «позволь себе», «отпусти контроль», «побереги ресурс», or close paraphrases.
- Avoid abstract transitions such as «мы нашли», «карта показывает» or «тема проявляется сильнее». State the actual conclusion instead.
- Static UI copy, fallbacks, prompts, notifications, paywalls, onboarding, and generated text follow the same rule. Do not treat the voice as an AI-only concern.
- When changing user-facing copy, add or update a regression test that rejects the bad phrasing.

## Visual work

- Forecast sections are text-led. Images are soft background scenes with fades into the white feed, never forecast cards or full-screen posters.
- Keep generated visual assets under `public/assets/forecast-feed/` and reference them through `lib/personalForecastVisuals.ts`.
- Native navigation promos may be banner cards; forecast sections themselves may not.

## Verification and publishing

- For a focused feed change, run targeted Jest tests, `npx tsc --noEmit`, `npx eslint` on changed files, and `git diff --check`.
- Stage only task files. Verify the staged path list before committing.
- When direct publication to `main` is explicitly requested, make one scoped commit, push `git push origin main:main`, then verify local `HEAD`, `origin/main`, and `git ls-remote origin refs/heads/main` match.
