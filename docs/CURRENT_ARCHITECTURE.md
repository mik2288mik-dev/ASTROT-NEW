# Current Architecture

The active application is «Твой Гороскоп» / “Your Horoscope”.

## Current runtime

- App identity is resolved through `requireAppUser` / `appAuth`.
- Feature access is defined by `accessMatrix`; content policy by `contentMatrix`; content-surface access by `contentAccessMatrix`.
- AI prompt assembly is spread across `contentPromptBuilders`, `natalHumanInterpretation`, and related content modules, with shared voice rules from `appVoice`.
- Product content is served by `/api/content/*`.
- Natal chart calculation, primary repair, and multi-chart management use `/api/charts/*`.
- Sign horoscopes are a separate Free product and use shared cache.
- The current personal Dashboard is inconsistent: Today uses the legacy saved daily canvas, while Week/Month/Year still load sign-based forecasts and separate period extras.
- Database migrations are immutable history; schema cleanup is additive rather than deleting applied migrations.

## Active migration target

The authoritative target for the complete personal forecast screen is:

`docs/PERSONAL_FORECAST_SCREEN_V2_TASK.md`

That migration replaces the mixed Dashboard flow with one chart-based personal product for Day/Week/Month/Year, seven fixed topics, calculated dynamic topics, evidence-backed explanations, unified GPT-4.1 writing, compatible cache/prewarm, and period-specific visual assignments.

Until that branch is merged, this document describes the old runtime only. After the migration, update this file in the same PR and remove references to the legacy daily canvas from active architecture documentation.

Removed pre-MVP product surfaces are tracked in `docs/MVP_LEGACY_REMOVAL_LOG.md` and are not active architecture.