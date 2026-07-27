# Your Horoscope marketing site

Standalone multilingual Next.js website for RU / EN / ES. It is intentionally isolated from the mobile app runtime and can be deployed on Railway with this folder as the service root directory.

## What is included

- locale-prefixed routes (`/ru`, `/en`, `/es`);
- marketing pages for personal forecasts, natal chart, compatibility, zodiac and questions;
- 12 evergreen zodiac pages per language;
- Markdown publishing for guides and current horoscopes;
- legal/support/delete-account pages with production placeholders;
- sitemap, robots, RSS, canonical, hreflang, Open Graph and JSON-LD;
- health endpoint for Railway;
- optional authenticated IndexNow endpoint;
- no advertising cookies and no analytics by default.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Production checks

```bash
npm run typecheck
npm run build
```

Set `LEGAL_READY=true` only after all legal placeholders are replaced with verified facts. Until then, Privacy, Terms and Subscription Terms are `noindex` and excluded from the sitemap.

## Railway

1. Create a service from the repository.
2. Set Root Directory to `/website` after this package is moved into the main repository.
3. Add variables from `.env.example`.
4. Deploy. Railway uses `Dockerfile` and checks `/api/health`.
5. Connect a custom domain only after `NEXT_PUBLIC_SITE_URL` is set to the final HTTPS URL.

## Publishing

See `PUBLISHING.md` for guide and horoscope frontmatter rules.
