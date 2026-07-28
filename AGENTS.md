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

## Visual work

- Forecast sections are text-led. Images are soft background scenes with fades into the white feed, never forecast cards or full-screen posters.
- Keep generated visual assets under `public/assets/forecast-feed/` and reference them through `lib/personalForecastVisuals.ts`.
- Native navigation promos may be banner cards; forecast sections themselves may not.

## Verification and publishing

- For a focused feed change, run targeted Jest tests, `npx tsc --noEmit`, `npx eslint` on changed files, and `git diff --check`.
- Stage only task files. Verify the staged path list before committing.
- When direct publication to `main` is explicitly requested, make one scoped commit, push `git push origin main:main`, then verify local `HEAD`, `origin/main`, and `git ls-remote origin refs/heads/main` match.
