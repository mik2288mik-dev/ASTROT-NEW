# Data inventory (code and schema audit draft)

This is an engineering inventory, not legal advice. `Confirmed` means observed in
code/schema; `OWNER_REQUIRED` means the production vendor or retention rule is
not available in the repository.

| Data | Source / required | Purpose / storage | Transfer | Deletion / status |
|---|---|---|---|---|
| Name; Telegram/native/OAuth identifier; verified email | profile/authentication; required only for recovery | identity and access; `users`, `account_identities` | Telegram, VK ID, Yandex ID, Google, configured email adapter | deleted with account; direct ID; Confirmed |
| Birth date, time, place, coordinates | user profile; required for personalised calculation | natal calculation; `users`, `natal_charts` | calculation/generation path must be reviewed before production | deleted with account; personalised; Confirmed storage, transfer PARTIAL |
| Natal chart, forecasts and cache | derived from profile; required for the feature | personalised content; chart/content/cache tables | OpenAI Luna via Responses API; Zodiac is separate DeepSeek content | deleted with account; personalised; PARTIAL |
| Questions and AI answers | user input; optional | answer generation/history; `personal_forecast_questions` | OpenAI Luna Structured Outputs for approved generation | deleted with account; direct content; Confirmed |
| Premium state and payment identifiers | payment provider; required for paid access | entitlement/fraud prevention; entitlement, Stars and store tables | Telegram Stars or RuStore by configured channel | deleted under current policy; direct payment ID; Confirmed |
| Notification preference and delivery state | profile/app use; optional | notification operation; notification tables | Telegram delivery where enabled | deleted with account; Confirmed |
| Device/session token, IP, user-agent | HTTP/native session; required for security | authentication, abuse control and diagnostics | hosting/logging vendor is `OWNER_REQUIRED` | session revoked/deleted; logs retention `OWNER_REQUIRED` |
| Support request | user input; optional | support workflow; support tables | support vendor `OWNER_REQUIRED` | identifier anonymised; message retention `OWNER_REQUIRED` |

## External services to verify before production

- Confirmed in code: Telegram, OpenAI generation path, PostgreSQL, Swiss
  Ephemeris, RuStore Pay/API only for the RuStore channel.
- `OWNER_REQUIRED`: production host, CDN, error tracking, analytics, email,
  geocoding/timezone, object storage and the countries/regions where each one
  processes data. Do not claim transfer outside Russia either way until these
  deployed services are confirmed.
- RuStore Public API token and callback key are server-only. The Android bundle
  receives product IDs but not payment secrets.

Privacy Policy and store forms must be completed from this document only after
owner/legal review fixes the operator, retention periods, processors and public
URLs.
