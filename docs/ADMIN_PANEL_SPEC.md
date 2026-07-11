# Admin Panel Spec

The admin panel is an operational subsystem for the MVP.

## Scope

- User lookup and support-safe account inspection.
- Premium entitlement visibility.
- Notification templates, schedules, delivery logs, and assets.
- Content/model health visibility.
- Basic analytics for onboarding, chart creation, Premium, and notification delivery.

## Rules

- Admin tools support the live MVP; they do not define consumer roadmap.
- Admin copy and templates must follow `docs/MVP_PRODUCT_AND_CONTENT_SYSTEM.md`.
- Removed product surfaces must not appear as segments, templates, deep links, or scenarios.
- Any destructive admin action must be explicit, logged, and scoped to the selected user or environment.

## Event Taxonomy

Use stable product events for startup, onboarding, chart creation, horoscope opens, compatibility flows, Premium lifecycle, notifications, support, and account deletion.
