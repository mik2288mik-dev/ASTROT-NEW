# MEOU public website deployment

Target: a **separate Railway service** in the existing project, built from
`Dockerfile.website` and `railway.website.json`. It must not inherit API/DB/
OAuth/AI/payment secrets or run migrations/schedulers.

## Release gates

The build is intentionally fail-closed unless all public operator, provider,
retention, localisation and cross-border confirmation variables in
`.env.example` are real. `NEXT_PUBLIC_LEGAL_PREVIEW=1` is permitted only for an
unpublished preview; it adds `noindex` and visible `OWNER_REQUIRED` notices.

Do not deploy an indexable build until:

1. the operator facts are signed off;
2. API/DB/logs/backups have moved to evidenced Russian infrastructure;
3. Article 22 and applicable Article 12 receipts are archived;
4. approved retention/minimum-age/provider values are supplied;
5. final legal pages have been re-read as rendered.

## Railway service configuration

1. Authenticate Railway CLI/Console with the owner's project access.
2. Create a new service from this branch/worktree. Do not change or delete the
   existing backend/PostgreSQL services.
3. Select `Dockerfile.website` (the committed Railway config already points to
   it). Healthcheck is `/`; port is supplied by Railway.
4. Set `MEOU_PUBLIC_SITE=1`, `NEXT_PUBLIC_MEOU_PUBLIC_SITE=1`,
   `NEXT_PUBLIC_LEGAL_PREVIEW=0`, `NEXT_PUBLIC_APP_NAME` and every
   required public variable from `.env.example`. Do not attach `DATABASE_URL`,
   auth secrets, API keys or payment keys.
5. Deploy and verify root/legal/SEO/security/404/API-isolation checks below.

## Domain and DNS

Canonical domain is `www.tvoi-goroskop.ru`; `tvoi-goroskop.ru` permanently
redirects to `www`. Canonical links, Open Graph, JSON-LD, robots and sitemap
must use the same `www` origin.

Railway generates the custom-domain DNS target only after the new service is
created. Copy that exact target from Railway—never guess it. In the delegated
DNS panel:

- preserve mail/TXT/MX and unrelated records;
- replace only the conflicting apex/`www` web records after a low-TTL staging
  check;
- use the record type/host/value Railway displays for the service;
- verify Railway certificate issuance before traffic cutover;
- archive before/after DNS exports and the Railway domain screen.

## Production verification

```text
GET /                                 200, MEOU landing
GET /privacy                         200, indexable, real operator facts
GET /terms                           200
GET /personal-data-consent           200
GET /delete-account                  200
GET /support                         200
GET /requisites                      200
GET /robots.txt                      200
GET /sitemap.xml                     200
GET /.well-known/security.txt        200
GET /unknown                         404
GET /api/health                      404
GET /auth/complete                   404
Host: tvoi-goroskop.ru                308 to www
```

Also verify valid HTTPS, canonical/OG/JSON-LD, all footer links, no
`OWNER_REQUIRED`, no Telegram/Google-Fonts/tracker requests, security headers,
mobile 390×844 and desktop 1440×900 without horizontal overflow, and image
loads. Save the headers, DOM checks and dated screenshots as release evidence.
