# NEBO

NEBO is an Android-first astrology application built with Next.js, React,
TypeScript, Capacitor, PostgreSQL, and Jest.

- Public name: `NEBO гороскоп натальная карта`
- Android package: `ru.tvoygoroskop.app`
- Production API: `https://api.tvoi-goroskop.ru`
- Android distribution: RuStore

The package ID and `tvoi-goroskop.ru` domains are stable technical identifiers
used by the current release. The only customer-facing brand is NEBO.

## Quick start

```powershell
npm ci
npm run dev
```

Open the local UI Preview when you need deterministic product states:

```powershell
npm exec -- cross-env NEXT_PUBLIC_UI_PREVIEW=1 npm run dev
```

Run focused checks before broad checks:

```powershell
npm test -- --runInBand <path-to-test>
npx tsc --noEmit
npm run lint
npm run build
```

## Current product

- Personal forecasts for Today, Week, and Month.
- Zodiac forecasts for all 12 signs.
- Natal chart, permanent reading, and questions about the saved chart.
- Compatibility by sign and by two saved birth profiles.
- Matrix of Destiny and astrology encyclopedia.
- Free access without mandatory registration.
- Premium subscriptions through RuStore Pay.
- Account linking, recovery, support, and account deletion.

The persistent bottom navigation is: `Сегодня`, `Зодиак`, `Натальная карта`,
`Сравнить`, `Меню`.

## Canonical documentation

- [Architecture](docs/CURRENT_ARCHITECTURE.md)
- [Product boundaries](docs/MVP_PRODUCT_AND_CONTENT_SYSTEM.md)
- [Generated-content voice](docs/APP_VOICE.md)
- [Personal forecast runtime](docs/agents/personal-forecast.md)
- [Android and RuStore release](docs/ANDROID_STORE_RELEASE.md)
- [Current RuStore status](RUSTORE_LEGAL_RELEASE_CHECKLIST.md)
- [Legal surfaces](docs/legal/README.md)
- [Store listing](docs/store/rustore/STORE_LISTING.md)
