# Current Architecture

The active application is "Tvoi Goroskop" / "Your Horoscope".

- App identity is resolved through `requireAppUser` / `appAuth`.
- Feature access is defined by `accessMatrix`; content policy is defined by `contentMatrix`; content surface access is defined by `contentAccessMatrix`.
- AI prompt assembly is in `contentPromptBuilders`, `natalHumanInterpretation`, and related content modules, with shared voice rules from `appVoice`.
- Product content is served by `/api/content/*`.
- Natal chart calculation, primary repair, and multi-chart management use `/api/charts/*`.
- Sign horoscopes are Free and shared-cache friendly.
- Personal daily content is a single saved canvas sliced into Free/Premium responses by the backend.
- Database migrations are immutable history; cleanup is implemented by additive migrations rather than deleting already-applied migration history.
- Removed pre-MVP product surfaces are tracked in `docs/MVP_LEGACY_REMOVAL_LOG.md` and are not active architecture.
