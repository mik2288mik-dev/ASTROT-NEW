# Website + Legal + SEO V1

Project: Твой Гороскоп / Your Horoscope / Tu Horóscopo
Languages: Russian, English, Spanish.
Hosting target: Railway or equivalent Node/static deployment.

## 1. Website goals

The website must serve four purposes at once:

1. Marketing — explain the app and send visitors to stores.
2. SEO — attract search traffic around horoscopes, natal charts, compatibility and zodiac signs.
3. Legal — host all mandatory policies and account-deletion information.
4. Support — provide a stable public contact and help center.

It must not be only a one-page legal placeholder.

## 2. Recommended architecture

Use one codebase with locale-prefixed URLs:

- `/ru/...`
- `/en/...`
- `/es/...`

Root `/` detects language once and redirects, while a visible language switcher remains available.

Recommended stack:

- Next.js or another SSR/SSG framework already compatible with the project/team;
- static generation for evergreen SEO pages;
- server rendering only where necessary;
- Railway deployment;
- custom domain;
- HTTPS;
- sitemap.xml per locale;
- robots.txt;
- canonical tags;
- hreflang RU/EN/ES;
- Open Graph and social cards;
- structured data for SoftwareApplication, FAQPage and BreadcrumbList where valid.

## 3. Public page map

### Core marketing pages

- `/ru` — main landing page
- `/ru/personal-horoscope`
- `/ru/natal-chart`
- `/ru/compatibility`
- `/ru/zodiac-horoscope`
- `/ru/questions`
- `/ru/about`
- `/ru/faq`
- `/ru/support`

Equivalent `/en` and `/es` routes.

### Zodiac SEO hub

- `/ru/zodiac`
- `/ru/zodiac/aries`
- `/ru/zodiac/taurus`
- ... all 12 signs

Each sign page must be useful and evergreen, not a doorway page containing only two paragraphs and an install button.

### Editorial SEO hub

- `/ru/guides`
- `/ru/guides/what-is-a-natal-chart`
- `/ru/guides/how-compatibility-works`
- `/ru/guides/why-birth-time-matters`
- `/ru/guides/ascendant-explained`
- `/ru/guides/retrograde-mercury-without-panic`

Equivalent localized pages should be rewritten natively, not machine-spun duplicates.

### Legal and account pages

- `/ru/privacy`
- `/ru/terms`
- `/ru/subscription-terms`
- `/ru/delete-account`
- `/ru/cookies`
- `/ru/contact`

Equivalent `/en` and `/es` routes.

## 4. Homepage structure

1. Hero
   - clear product promise;
   - app store buttons;
   - one real product visual;
   - no vague cosmic slogan.

2. Personal forecast
   - Today / Week / Month / Year;
   - why personal data improves relevance;
   - CTA to install.

3. Natal chart
   - explain practical value;
   - no pseudo-scientific guarantees.

4. Compatibility
   - relationships, communication, repeating patterns;
   - avoid “perfect match” promises.

5. Zodiac horoscope
   - accessible even before personal setup;
   - link to 12 sign pages.

6. Questions
   - explain approved-question catalog and personalized answers;
   - do not promise unrestricted advice.

7. App voice / difference
   - direct, friendly, non-fatalistic;
   - no generic horoscope filler.

8. FAQ
   - 6–10 useful questions.

9. Final CTA
   - store buttons;
   - support/legal links in footer.

## 5. Initial SEO clusters

### Russian

- личный гороскоп
- гороскоп на сегодня
- гороскоп на неделю
- натальная карта
- натальная карта по дате рождения
- совместимость по дате рождения
- совместимость знаков зодиака
- асцендент
- ретроградный Меркурий
- гороскоп по знаку зодиака

### English

- personal horoscope
- daily horoscope
- weekly horoscope
- birth chart
- natal chart calculator
- zodiac compatibility
- astrology compatibility
- rising sign
- Mercury retrograde
- zodiac horoscope

### Spanish

- horóscopo personal
- horóscopo de hoy
- horóscopo semanal
- carta natal
- carta astral
- compatibilidad de signos
- compatibilidad astrológica
- ascendente
- Mercurio retrógrado
- horóscopo por signo

SEO pages must answer the query first and sell the app second.

## 6. Brand naming by locale

- RU: `Твой Гороскоп`
- EN: `Your Horoscope`
- ES: `Tu Horóscopo`

Until store naming is formally approved for Spanish, `Tu Horóscopo` is a website localization label, not automatically the final store title.

## 7. Legal document set

### Privacy Policy

Must disclose at minimum:

- operator/controller identity;
- contact details;
- data categories collected;
- account identifiers;
- birth date, time and place;
- natal chart and calculated astrology data;
- questions and generated answers;
- subscription/purchase status;
- technical logs, device and diagnostics data;
- analytics data;
- notification tokens if used;
- why each category is processed;
- legal bases by region where applicable;
- processors/subprocessors;
- OpenAI or other AI processing where actually used;
- hosting/database providers;
- retention periods or criteria;
- international transfers;
- user rights;
- account deletion;
- minors/age policy;
- security measures at a reasonable level;
- policy update date.

Never claim that data is not collected when SDKs or server logs collect it.

### Terms of Use

Must cover:

- service description;
- eligibility and account rules;
- user responsibility for accurate birth data;
- informational/entertainment nature of astrology content;
- no medical, legal, financial or emergency advice;
- no guarantee of outcomes;
- acceptable use;
- prohibited questions/content;
- intellectual property;
- account suspension/termination;
- service changes and outages;
- limitation of liability subject to local law;
- governing law/jurisdiction placeholders pending owner details;
- contact details.

### Subscription Terms

Must cover:

- plans offered;
- billing period;
- displayed local price controls;
- trial rules if used;
- auto-renewal;
- cancellation;
- restore purchases;
- refund handling through the relevant store where applicable;
- access after cancellation;
- price changes;
- grace period/billing retry if supported;
- current feature list may evolve without removing paid access deceptively.

### Delete Account page

Must provide:

- exact in-app deletion path;
- web request form or support method;
- identity verification approach;
- what is deleted;
- what may be retained and why;
- expected processing time;
- difference between account deletion and subscription cancellation;
- warning that deleting the account does not always cancel a store subscription automatically.

### Cookies page

Needed if the website uses non-essential analytics, advertising or consent-requiring technologies. Keep the site cookieless or essential-only for V1 where practical.

## 8. Required technical inputs from the owner

These are the only business details that cannot be invented:

- legal operator name: individual, sole proprietor or company;
- country and legal address;
- public support email;
- privacy/contact email if separate;
- final domain;
- store links once available;
- final subscription plans and trial terms;
- exact hosting/database/analytics providers in production;
- minimum user age;
- governing law/jurisdiction preference;
- data-retention decisions where not technically fixed.

All legal pages must use explicit placeholders until these facts are supplied. Do not fabricate them.

## 9. Railway deployment requirements

- environment-based public URL;
- no secrets committed;
- health endpoint;
- production build command documented;
- automatic deploy from a dedicated branch;
- custom-domain setup documented;
- redirects from non-locale routes;
- cache headers for static assets;
- image optimization;
- error logging;
- uptime monitoring;
- backup/rollback plan;
- preview deployment for review.

## 10. SEO quality rules

- no automatically generated thousands of thin daily pages;
- no fake “today” pages that become stale in search results;
- evergreen sign pages plus useful guides first;
- daily content, if indexed later, needs canonical/date/archive rules;
- unique title, description and H1 per page;
- one clear search intent per page;
- internal links between guides, functions and zodiac pages;
- no keyword stuffing;
- localized screenshots and store links;
- page speed and Core Web Vitals monitored;
- all AI-assisted articles require human editorial review before publishing.

## 11. V1 delivery phases

### Phase A — Legal shell

- homepage;
- privacy;
- terms;
- subscription terms;
- delete account;
- support/contact;
- RU/EN/ES routing;
- Railway deployment;
- temporary store badges disabled until links exist.

### Phase B — Marketing

- personal horoscope;
- natal chart;
- compatibility;
- zodiac horoscope;
- FAQ;
- real app visuals;
- analytics with consent-aware configuration.

### Phase C — SEO foundation

- 12 zodiac pages × 3 languages;
- 4–6 high-quality guides × 3 languages;
- sitemap/hreflang/canonical checks;
- Search Console/Bing Webmaster setup;
- editorial publishing workflow.

## 12. Acceptance criteria

1. Website deploys to Railway preview and production.
2. RU/EN/ES URLs are indexable and correctly linked by hreflang.
3. Legal pages are reachable without logging in.
4. Delete-account page has a stable public URL.
5. Store listing can reference Privacy and Delete Account URLs.
6. No invented operator or provider details remain in production.
7. Homepage sells the full product, not only daily horoscope.
8. All 12 zodiac pages provide real standalone value.
9. Sitemap, robots, canonical and metadata validate.
10. Website remains usable before store links are available.
