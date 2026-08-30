# NEBO data inventory

This file is the evidence index for store data declarations and public legal
text. Re-check live provider settings, retention periods, processing regions,
and the finished Android artifact before each submission.

## Current data flows

| Data | Purpose and storage | External processing | Account deletion |
|---|---|---|---|
| Name, verified email, and provider identity IDs | Authentication, account linking, and recovery in PostgreSQL | Enabled VK ID, Yandex ID, Google, Telegram, or email flows | Sessions are revoked and direct account identifiers are removed |
| Birth date, time, place, coordinates, timezone, and gender when supplied | Natal calculation and personalisation in the profile and chart records | The personal-forecast brief receives the required birth profile through OpenAI; Swiss Ephemeris runs as the deterministic calculation engine | Profile, charts, generated content, and caches are removed |
| Natal chart, forecasts, compatibility results, and saved profiles | Product features and compatible content caches in PostgreSQL | OpenAI handles personal forecast generation; Zodiac remains a separate provider path | Account-owned results and caches are removed |
| Accepted natal questions and generated answers | Premium question history in PostgreSQL | OpenAI receives only questions answerable from the saved chart and the required chart context | Question history is removed |
| RuStore purchase IDs, product IDs, callback events, and entitlement state | Server-side purchase validation and Premium access | RuStore Pay, Public API, and encrypted callbacks | Entitlement and account-owned purchase records are removed; retained event rows lose direct purchase identifiers |
| Session token, IP address, user agent, diagnostics, and security events | Authentication, abuse prevention, reliability, and incident analysis | Railway hosts the API, public site, PostgreSQL, jobs, and runtime logs | Sessions are revoked; policy text must state the verified log and backup retention |
| Notification preferences and delivery state | User-controlled reminders and delivery operations | Only the enabled delivery channel | Account-owned preferences and queued deliveries are removed |
| Support message and supplied contact details | Answering a support request | Operator support channel | Direct user identifiers are anonymised according to the published retention rule |

## Release checks

- Public Privacy Policy, consent, account deletion, support, and requisites pages
  must describe the same active flows.
- Consent to personal-data processing remains separate, explicit, and unchecked
  before profile data is first sent.
- Secrets, callback keys, provider tokens, and signing material stay server-side
  and never use `NEXT_PUBLIC_*`.
- Re-check merged SDK traffic in the release APK. VK ID and RuStore dependencies
  include analytics components, so do not claim that analytics code is absent.
- Do not declare a provider, retention period, or processing region from source
  code alone; confirm the live Railway and provider configuration.
