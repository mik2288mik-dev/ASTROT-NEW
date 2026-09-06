# Marketing site build brief

Build a standalone `marketing-site/` application in a separate branch. Railway root directory: `marketing-site`.

## V1 routes

- `/ru`, `/en`, `/es`
- `/{locale}/personal-horoscope`
- `/{locale}/natal-chart`
- `/{locale}/compatibility`
- `/{locale}/zodiac-horoscope`
- `/{locale}/support`
- `/{locale}/privacy`
- `/{locale}/terms`
- `/{locale}/subscription-terms`
- `/{locale}/delete-account`
- `/api/health`

## V1 implementation constraints

- no dependency on unfinished app runtime;
- no invented operator details;
- environment-configured support email/domain/store URLs;
- locale-prefixed canonical URLs and hreflang;
- sitemap and robots;
- no nonessential cookies by default;
- bright editorial visual system, no cosmic template;
- app screenshots remain placeholders until release candidate;
- legal pages visibly marked draft in non-production when required inputs are missing;
- production build must fail or display a hard admin warning when mandatory legal configuration is absent.
