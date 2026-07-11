# Next Task Context

This repository is the MVP app "Tvoi Goroskop" / "Your Horoscope".

## Product

- Home and personal daily reading.
- Sign horoscopes.
- Natal chart and natal readings.
- Free sign compatibility.
- Premium chart-based relationship reading.
- Matrix of Destiny.
- Premium calendar/archive.
- Settings, onboarding, subscription, support, admin, and notification operations.

## Architecture

- Root UI is `App.tsx`; screens are in `views/`; reusable components are in `components/`.
- App auth is `lib/auth/appAuth.ts`.
- Primary chart and saved chart APIs are `/api/charts/*`.
- Product content APIs are `/api/content/*`.
- Access is enforced by `lib/accessMatrix.ts`, `lib/contentAccessMatrix.ts`, and Premium entitlement helpers.
- AI voice source is `lib/appVoice.ts`.
- Product/system truth is `docs/MVP_PRODUCT_AND_CONTENT_SYSTEM.md`.

## QA Checklist

- Telegram Mini App safe areas.
- Telegram back/swipe behavior.
- deep links and start parameters.
- Light/dark theme readability.
- slow network behavior.
- Free/Premium API responses do not leak locked text.
