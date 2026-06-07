# Current Lumia architecture

This document is the concise source of truth for the active application architecture.

- Authentication is resolved through `requireAppUser` / `appAuth` for Telegram, signed web guests, and native-ready clients.
- Product access is defined by `accessMatrix` and content availability by `contentMatrix`.
- AI content prompts are assembled by `contentPromptBuilders`.
- Product content is served by `/api/content/*`; natal chart persistence and chart management use `/api/charts/*`.
- Natal chart calculation remains available at `/api/astrology/natal-chart` while chart clients are migrated to `/api/charts/*`.
- Horoscope, Natal, and Synastry UI flows use the current content endpoints. Synastry extended readings use `/api/content/synastry/extended`.
- Database migrations are immutable history and must never be deleted during legacy cleanup.

Legacy `profile.generatedContent` types may remain only as compatibility input for server-side fallback resolvers. New client flows must not generate, synchronize, or read that aggregate.
