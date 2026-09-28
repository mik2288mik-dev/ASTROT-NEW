# Repository working rules

## Scope

- Do exactly the task the user asked for.
- Inspect the relevant existing code before changing it.
- Do not invent product behavior, requirements, architecture, or UX that the user did not request.
- Do not make unrelated refactors, redesigns, cleanups, migrations, or dependency changes.
- Preserve unrelated local changes and untracked files.
- Change only files required for the task.

## Product information

- This file contains working rules for coding agents only.
- Product behavior, feature logic, architecture, UI decisions, content rules, and business rules do not belong in AGENTS.md.
- Use the current user instruction as the highest-priority product requirement.
- Treat repository documentation, tests, comments, and existing code as evidence of the current implementation, not as permission to override a new explicit user decision.
- If documentation, tests, and implementation disagree, identify the conflict instead of guessing.

## Git and remote work

- Local work is the default.
- Do not push, merge, delete branches, run remote workflows, or change repository settings unless the user explicitly asks for remote work.
- Never force-push or rewrite protected history.
- Never delete a user-created or unmerged branch unless explicitly asked.
- If the agent creates a temporary branch or worktree for a task, clean it up after the changes are confirmed in main and it is safe to remove.
- Do not leave temporary branches, worktrees, debug files, one-off scripts, or one-off workflows behind after the task is complete.

## Commands

- Run commands from the repository root.
- Install locked dependencies with `npm ci` when setup is required.
- Start development with `npm run dev`.
- Run a focused Jest test with `npm test -- --runInBand <path-to-test>`.
- Run broader checks such as `npx tsc --noEmit`, `npm run lint`, or `npm run build` only when they are relevant to the task or requested.

## Tests and verification

- Use the smallest relevant verification for the change.
- Do not fix unrelated failing tests or diagnostics.
- If an explicit product change makes an old test obsolete, update the test instead of restoring obsolete behavior just to make it pass.
- Before finishing, review the diff and confirm that only task-related files changed.

## Documentation hygiene

- Do not create new Markdown specifications, handoff files, context files, status files, or duplicate documentation unless the task requires them.
- Update an existing relevant document instead of creating another source of truth when possible.
- Do not copy the same product rule into multiple files.
- Remove temporary task artifacts created by the agent when the task is complete and they are no longer needed.
