# Next Task Context

This repository is the MVP app "Твой Гороскоп" / "Your Horoscope".

## Active task

The only active implementation contract for the personal forecast screen is:

`docs/PERSONAL_FORECAST_SCREEN_V2_TASK.md`

It covers the complete personal screen `Сегодня / Неделя / Месяц / Год`, seven fixed topics, 2–3 calculated dynamic topics, evidence-first generation, cache/prewarm, Free/Premium slicing, reading screens, and period-specific visual backgrounds.

The current runtime still contains the old daily canvas and sign-based week/month/year Dashboard flow. Treat those files as migration input, not as the target product design.

## Mandatory local/GitHub reconciliation before editing

The coding agent works locally, while recent specification and model changes were committed directly to `origin/main`. Do not start from an unsynchronised working tree.

Run and record:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
git fetch origin --prune
git rev-parse origin/main
git log --oneline --decorate -n 15 --all
```

Verify that the fetched history contains the unified-model commit and the current forecast task:

```bash
git merge-base --is-ancestor 96da083f2d601a0569124bb85a43f00743ff05dd origin/main
git merge-base --is-ancestor 841f0820762cc5d56d67535b0fb0c69c08f021ab origin/main
```

If the working tree is clean:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/personal-forecast-screen-v2
```

If local changes exist, preserve them first with a clearly named local WIP commit or `git stash push -u`; then fetch/rebase and inspect the diff before restoring them. Never use `git reset --hard`, never discard untracked files, and never force-push to `main`.

Before implementation, compare local work with remote:

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
```

Resolve conflicts deliberately. Keep valid local work, but do not restore superseded model slots, the today-only task, or the old product contract.

## Documentation precedence and cleanup

For this migration, `docs/PERSONAL_FORECAST_SCREEN_V2_TASK.md` overrides conflicting forecast-screen sections in older architecture/product/cache documents.

The same implementation branch must update these documents to the final shipped architecture:

- `docs/CURRENT_ARCHITECTURE.md`
- `docs/MVP_PRODUCT_AND_CONTENT_SYSTEM.md`
- `docs/CONTENT_CACHE_AND_PREWARM.md`
- this file

Do not add another forecast task document. Delete obsolete task notes instead of leaving redirect files.

## Architecture boundaries

- Root UI: `App.tsx`; screens: `views/`; reusable UI: `components/`.
- App auth: `lib/auth/appAuth.ts`.
- Canonical charts: `/api/charts/*`.
- Product content APIs: `/api/content/*`.
- Access enforcement: `lib/accessMatrix.ts`, `lib/contentAccessMatrix.ts`, and Premium entitlement helpers.
- Unified user-facing model resolver: `getUnifiedContentModel()`; default model: GPT-4.1.
- AI voice source: `lib/appVoice.ts`.
- Sign horoscopes remain a separate `Зодиак` product and must not power the personal Dashboard periods.

## Required completion checks

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Do not merge into `main` until the migration, dead-code cleanup, documentation update, and production build are all complete.