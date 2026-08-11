# Personal Forecast Feed guide

## Ownership

`Dashboard` composes the personal reading for the selected period. `ForecastSectionBlock` renders the text; `ForecastPromotion` renders cross-product banners.

## Do not change by accident

- Do not create a separate forecast reader, chat, or section screen.
- Do not restore forecast cards, swipe cards, or a permanent opaque navigation panel.
- Do not alter the saved natal-profile context, the fixed Luna Responses route, access slicing, cache architecture, or generation endpoint for a visual-only request.
- Do not move the existing application header or bottom navigation while changing the feed.

## Visual rules

- Section scenes are semantic and light, with readable dark text and a white fade at both ends.
- Avoid animals, generic mystical imagery, visible technical astrology, watermarks, and text embedded in images.
- Keep each visible section visually distinct. The visual resolver owns deterministic assignment and should avoid adjacent repeats.
- Only the native navigation promos use a bounded banner-card treatment.

## Content rules

- Lead with the period conclusion, then ordinary-life consequence, then a compact reason.
- Keep a candid, kind, direct voice. Avoid fatalism, coaching language, generic reassurance, repetition, and technical astrology in the feed.
- Local `i` explanations must use the saved natal-profile reference and explain it in plain language.

## Checks

Run the personal-forecast Jest tests plus typecheck and lint for the files touched. If prompt length or content instruction changes, bump the prompt/cache version deliberately.
