# MVP Legacy Removal Log

This file is the single changelog-style place where removed legacy product names
may be mentioned during the cleanup. Runtime code, UI copy, active prompts, and
the final product documentation must not depend on these names.

## Baseline

- Branch: `codex/mvp-product-cleanup`
- Baseline commit: `23d683a5d1b5e797893f7f0cce4130a5af6d261c`
- Initial git state: clean tracked tree; untracked local folders `.preview/`, `.qwen/`, `.vscode/`
- Stack: Next.js pages router, React, TypeScript, Jest, ESLint, PostgreSQL migrations in `lib/migrations.ts`
- Package manager: npm / `package-lock.json`
- Auth: Telegram init data plus guest/session helpers
- Billing: Telegram Stars for Premium plans
- AI gateway at baseline: `lib/anthropic.ts` name wrapping OpenAI usage, plus OpenAI model settings
- Database connection note: `.env.local` points at Railway URLs. Destructive reset is blocked until the target is verified as the test database for this repository.

## Baseline Checks

- `npx tsc --noEmit`: passed
- `npm run build`: passed
- `npm test -- --runInBand`: passed, 61 suites / 369 tests
- `npm run lint`: failed at baseline

Baseline lint errors:

- `App.tsx`: unused `handleAdminOwnProfilePatch`
- `pages/api/admin/v2/settings/index.ts`: `let value` should be `const`
- `pages/api/admin/v2/users/[id].ts`: unused `getAdminContext`
- `pages/api/cron/tick.ts`: unused `weekday`

## Baseline Active Route Families

- App pages: `/`, `/_app`, `/_document`
- User/auth/profile APIs: `/api/auth/*`, `/api/users/*`, `/api/charts/*`
- MVP content APIs already present: sign horoscopes, natal content, synastry, subscriptions, Premium entitlement
- Admin/support APIs: `/api/admin/v2/*`, `/api/support/*`
- Legacy routes to remove or replace: weather APIs, question/ask APIs, today pulse/action APIs, legacy natal compatibility API

## Legacy Runtime Surface Found At Baseline

- Removed chat/question UI and APIs still present.
- Removed weather APIs and service still present.
- Removed standalone today pulse and assistant routes/modules still present.
- Removed internal product naming still present in runtime UI and docs.
- Removed one-off currency language still appears in legacy code paths and docs.
- Hardcoded demo date exists in dashboard content.
