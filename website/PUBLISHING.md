# Editorial publishing rules

## Guides

Add Markdown to `content/<locale>/guides/`.

```md
---
title: "What is a natal chart?"
description: "A practical guide..."
slug: "what-is-a-natal-chart"
publishedAt: "2026-07-27"
updatedAt: "2026-07-27"
author: "Your Horoscope editorial team"
indexing: "index"
---

Article body.
```

Every guide must:

- answer one clear search intent;
- include original explanation or product expertise;
- be reviewed by a human before publication;
- avoid guaranteed outcomes and medical/legal/financial claims;
- have a unique localized version, not a machine-spun translation;
- use `noindex` while incomplete.

## Current horoscopes

Add Markdown to `content/<locale>/horoscopes/`.

```md
---
title: "Aries horoscope for today"
description: "..."
sign: "aries"
period: "today"
validFrom: "2026-07-27T00:00:00Z"
validThrough: "2026-07-27T23:59:59Z"
publishedAt: "2026-07-27T00:00:00Z"
indexing: "noindex"
---

Forecast body.
```

The public URL is stable: `/<locale>/horoscopes/<period>/<sign>`. Do not create dated archive URLs by default. This prevents thousands of thin, stale pages. A forecast may be indexable only when it is substantial, original, current, and deliberately approved.

After publishing or updating URLs, submit the sitemap in Google Search Console and optionally call `/api/indexnow` for Bing-compatible engines.
