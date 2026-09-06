# Parallel pre-launch workstreams

Purpose: finish everything that can be safely prepared while Personal Forecast Feed V3 is still being completed in a separate local branch.

## Rule of isolation

Do not edit these active runtime areas until the forecast branch is committed and published:

- `App.tsx` navigation and dashboard composition;
- `views/Dashboard.tsx`;
- `views/PersonalForecastScreen.tsx` or its replacement;
- `lib/personalForecast*`;
- forecast question APIs, storage and migrations;
- shared forecast CSS and notification deep links.

Parallel work must live in independent docs, assets, a standalone marketing-site folder, store metadata files or a separate branch.

## Workstream A — Onboarding product package

Can be completed now:

- final flow and decision logic;
- RU / EN / ES copy;
- validation/error copy;
- event taxonomy without raw personal data;
- accessibility requirements;
- versioning and restart behaviour;
- text-free visual asset briefs;
- onboarding prototype outside the production runtime;
- QA scenarios.

Must wait for forecast branch:

- route wiring into the new Dashboard;
- first-calculation progress integration;
- exact landing section IDs;
- purchase and notification interactions that depend on final runtime.

## Workstream B — Marketing/legal/SEO website

Can be built now as a standalone deployable app:

- locale routing RU / EN / ES;
- homepage and product-page shell;
- Privacy, Terms, Subscription Terms, Support and Delete Account routes;
- placeholder-based operator configuration;
- sitemap, robots, canonical and hreflang;
- health endpoint and Railway instructions;
- cookieless V1 analytics posture;
- store badge placeholders;
- account-deletion request UI with a configurable destination.

Cannot be finalized without owner inputs:

- legal operator identity and address;
- final public domain;
- support/privacy email;
- store URLs;
- final subscription plans and trial terms;
- exact production processors and retention periods;
- minimum age and governing jurisdiction.

## Workstream C — Store package

Can be completed now:

- store title/subtitle baseline;
- long/short descriptions RU / EN / ES;
- screenshot storyboards and caption copy;
- feature graphic brief;
- category, tags and content-rating preparation;
- privacy/data-safety inventory template;
- release notes templates;
- support and deletion URL contract.

Must wait:

- final screenshots from the finished app;
- real AAB/APK metadata;
- real store product IDs and subscription prices;
- production privacy inventory verified against the final binary.

## Workstream D — Legal/data inventory

Can be completed now:

- a data-processing inventory table;
- mapping app features to data categories and purpose;
- deletion matrix;
- retention placeholders;
- processor/subprocessor checklist;
- in-app settings page requirements;
- consent copy for birth data;
- support and complaint workflow.

Legal text remains a production template until the operator details and actual deployed providers are verified.

## Workstream E — Release readiness

Can be prepared now:

- master QA matrix;
- Android viewport/device list;
- offline/slow-network/API-failure scenarios;
- accessibility checklist;
- crash/analytics event catalogue;
- launch monitoring checklist;
- rollback and database-backup checklist;
- Google Play closed-test recruitment plan.

## Professional decisions already locked

1. One onboarding flow, not two disconnected introductions.
2. A real path choice on screen 3.
3. Zodiac access does not require birth data.
4. Personal setup requests birth data only after explicit choice.
5. Onboarding is brief, interactive, skippable and versioned.
6. No forced paywall before product value.
7. Visuals follow the existing bright editorial illustration system; no cosmic template, no beige photography, no baked UI.
8. RU / EN / ES are first-class locales from the start.
9. Website is a real acquisition/support/legal product, not a one-page policy placeholder.
10. Account deletion must work in-app and through a stable public web route.

## Completion order

1. Lock documentation and visual production pack.
2. Build standalone website preview.
3. Prepare legal/data placeholders and owner-input form.
4. Prepare store metadata and screenshot storyboards.
5. Generate and review text-free onboarding assets.
6. After Forecast V3 is published, rebase onboarding implementation and wire it into final runtime.
7. Verify final binary against Privacy/Data Safety declarations before store submission.
