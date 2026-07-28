# Personal Forecast Feed guide

## Ownership

`Dashboard` composes the continuous feed. `ForecastSectionBlock` renders a section; `ForecastPromotion` renders cross-product banners; `ForecastQuestions` remains inside the selected period.

## Do not change by accident

- Do not create a separate forecast reader, chat, or section screen.
- Do not restore forecast cards, swipe cards, or a permanent opaque navigation panel.
- Do not alter calculation evidence, the configured OpenAI model, access slicing, cache architecture, question moderation, or generation endpoint for a visual-only request.
- Do not move the existing application header or bottom navigation while changing the feed.

## Visual rules

- Section scenes are semantic and light, with readable dark text and a white fade at both ends.
- Avoid animals, generic mystical imagery, visible technical astrology, watermarks, and text embedded in images.
- Keep each visible section visually distinct. The visual resolver owns deterministic assignment and should avoid adjacent repeats.
- Only the native navigation promos use a bounded banner-card treatment.

## Content rules

- Lead with the period conclusion, then ordinary-life consequence, then a compact reason.
- Keep a candid, kind, direct voice. Avoid fatalism, coaching language, generic reassurance, repetition, and technical astrology in the feed.
- Local `i` explanations must use verified evidence and explain the reason in plain language.

## Checks

Run the personal-forecast Jest tests plus typecheck and lint for the files touched. If prompt length or content instruction changes, bump the prompt/cache version deliberately.
