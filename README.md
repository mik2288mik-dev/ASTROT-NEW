# Your Horoscope

Next.js, React, TypeScript, Jest, PostgreSQL, Telegram Mini App, and Telegram Stars Premium billing.

## MVP

- Home screen with one personal AI-written story for today; week and month are selected from the diary drawer.
- Sign horoscopes.
- Natal chart.
- Free sign compatibility.
- Premium chart-based relationship reading.
- Matrix of Destiny.
- Premium calendar/archive.
- Settings, profile, onboarding, subscription, support, admin, and notifications.

## Main Commands

```bash
npm install
npx tsc --noEmit
npm test -- --runInBand
npm run build
npm run lint
```

## Core Routes

- `/api/charts/*` - natal chart calculation, primary repair, saved charts.
- `/api/content/*` - horoscopes, personal day/week/month stories, natal readings, synastry, matrix-related content.
- `/api/subscriptions/*` and `/api/telegram/*` - Premium through Telegram Stars.
- `/api/admin/v2/*` - operational admin.
- `/api/support/*` - support flows.

## Current Product Documentation

See `docs/MVP_PRODUCT_AND_CONTENT_SYSTEM.md`.

## Visual card system

- [Visual system, composition, rotation, expanded covers, and seasonal rules](docs/design/card-background-system/README.md)
- [Guide for generating new illustrated card assets](docs/design/card-background-system/ASSET_GENERATION_GUIDE.md)
- [Production asset manifest](docs/design/card-background-system/card-background-manifest.json)
