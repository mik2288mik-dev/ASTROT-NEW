# MEOU data-flow map

Verified against the repository at commit `f6d6b340` and live production on
23 August 2026. `Current retention` describes implemented or provider rules,
not a recommended legal period.

## Identity, profile and authentication

| Data | Source → API | Processor / storage / logs | Third party | Current retention → delete flow |
|---|---|---|---|---|
| Name | User → onboarding/profile APIs | `users`, `natal_charts`; may appear in AI prompts and current application logs | OpenAI for personalised content | Database until account deletion; cascades with `users`. OpenAI abuse-monitoring logs may persist up to 30 days. |
| Email | User → registration/login/recovery APIs | `account_identities`, auth challenge tables; Railway request/app logs may contain route/IP but email must not be deliberately logged | Resend receives address and OTP message; auth provider when selected | Identity and challenges delete/cascade with account; challenge expiry exists but one published retention schedule is missing. Resend states sending data/logs are retained 30 days and backups 7 days. |
| OAuth/VK/Yandex IDs | Native SDK/browser provider → auth APIs | `account_identities`, `app_sessions` | VK ID or Yandex ID verifies identity | Identity/session rows delete with account; provider-side records follow that provider's own rules. |
| Account/session IDs, access/refresh credentials | App/provider → auth APIs | `users`, `account_identities`, `app_sessions`, revocation tables; device local secure/preferences storage | Hosting network and auth provider | Sessions revoke/delete on account deletion. Revocation evidence remains until the latest issued token can no longer be valid; exact cleanup job must be verified. |
| IP and user agent | Network connection → every web/API request | Railway HTTP logs include source IP, user agent, method/path/host/region; app logs can add IDs | Railway Corp | Railway plan-dependent log retention: 7/30/up to 90 days. Current production plan is not evidenced. Not removed by the database account-delete transaction. |

## Birth data, calculations and personalised content

| Data | Source → API | Processor / storage / logs | Third party | Current retention → delete flow |
|---|---|---|---|---|
| Birth date/time/place | User → profile/chart APIs | `users`, `natal_charts`, calculation snapshots/content tables | OpenAI receives exact profile context in personalised generation; geocoding services receive typed place | Stored until deletion and cascades. External copies follow provider retention. |
| Coordinates/time zone | Client geocoder or server geocoder → chart APIs | Natal chart/profile records and deterministic calculation input | Open-Meteo geocoding and Nominatim can receive search text and requester IP | Stored with chart until deletion. Foreign request logs are outside MEOU's deletion transaction. |
| Saved natal charts and personality report | Deterministic Swiss Ephemeris calculation → chart/content APIs | `natal_charts`, interpretations, calculation snapshots, content/cache tables | OpenAI receives chart facts/evidence needed for generated reading | Cascades with user/chart. Provider-side request retention remains separate. |
| Compatibility profile for another person | Account user → compatibility/chart APIs | Counterpart chart, synastry calculation/cache/history tables; may include name, date/time/place/coordinates | OpenAI for generated compatibility; geocoder for place | Owned rows cascade with the account. No implemented evidence that the account user had authority to submit the other person's data. |
| Personal Today/Week/Month prompts and responses | Profile/chart/history → forecast APIs | Forecast cache/history/request tables; generated response returned to app | OpenAI Responses API with `store:false` | Database history cascades with account. `store:false` does not remove OpenAI abuse-monitoring logs (up to 30 days absent approved ZDR/MAM). |
| Zodiac content | Sign/period → zodiac content path | Shared content/cache; not intended to identify an account | DeepSeek API | No account identity is required; payload boundary must remain enforced. DeepSeek policy permits storage/processing in PRC and does not publish a fixed short deletion period. |
| User questions and AI answers | User text + chart context → question API | `personal_forecast_questions` and related content/history | OpenAI receives the question and personalised chart context | Cascades with account; external provider retention remains. |
| AI prompts/responses and admin prompt versions | Product/admin input → generation/admin APIs | Prompt/config/version tables, application logs on failure, response caches | OpenAI or DeepSeek depending on route | User-owned generation rows cascade; admin prompt records can remain after author ID is nulled. Provider retention remains separate. |

## Device, diagnostics, payment, support and deletion

| Data | Source → API | Processor / storage / logs | Third party | Current retention → delete flow |
|---|---|---|---|---|
| Device identifiers | Native/auth SDK and HTTP client → provider/app APIs | No advertising ID collection or analytics SDK was found; session metadata may contain client/device context | VK ID/Yandex/RuStore SDKs as applicable | No independent MEOU advertising/device-ID store was found. Declare identifiers if final SDK/network inspection confirms collection. |
| Diagnostics and server errors | Backend and Android runtime | `lib/errorTracking.ts` keeps the latest 100 errors in process memory and writes error/name/message/userId/endpoint to console; Railway captures stdout/stderr | Railway | Process-memory buffer ends with instance lifetime; Railway log retention is plan dependent and not linked to account deletion. No crash-reporting SDK was found. |
| Purchase/subscription information | RuStore Pay SDK/callback/Public API → payment APIs | `store_purchases`, provider-event inbox, Premium entitlements/history | RuStore (`ООО «Много приложений»`) | User-linked ledger and entitlements delete/cascade; event payload and external purchase ID are scrubbed. RuStore retains its own transaction records independently. Monetisation is disabled for the first release config until explicitly enabled. |
| Support request | `mailto:` on site or authenticated in-app support APIs | Email mailbox and/or support ticket/message tables | Mail provider selected by the user/operator | Account deletion nulls user/author IDs but keeps ticket/message text. A justified retention period and mailbox deletion routine are not implemented/documented. |
| Account deletion request | Authenticated user → `DELETE /api/users/account` | One PostgreSQL transaction; session revocations; application/Railway logs | Hosting provider; RuStore remains separate | Profile, charts, content/history, questions, sessions, credentials, entitlements and user-linked purchases delete. Support text is anonymised, provider events scrubbed. Logs and backups are not erased synchronously. |
| Database backups | Production PostgreSQL service | Current evidence points to Railway PostgreSQL; enabled backup configuration is not available in repo | Railway | If Railway volume backups are enabled: daily 6 days, weekly 1 month, monthly 3 months. Account rows can remain in immutable backups until rotation; restore procedure must reapply deletion tombstones or restrict restored copies. |

## Flow summary

```text
Android/web user
  → Railway edge + API instance (Amsterdam; request memory and logs)
  → Railway PostgreSQL (current production evidence; non-Russian)
  → OpenAI (personalised generation, foreign)
  → DeepSeek (non-personal Zodiac only, PRC)
  → Resend (email + OTP, United States)
  → Open-Meteo / Nominatim (birth-place query + requester/server IP)
  → Yandex ID / VK ID / RuStore where the user selects those functions
```

## Deletion gaps that block a clean public promise

1. No production-wide retention register ties database tables, Railway logs,
   email logs, support mailboxes and backups to one deletion schedule.
2. Railway logs are not account-delete aware and can contain direct user IDs.
3. Restored backups do not have a documented deletion-replay procedure.
4. Support text remains after IDs are nulled; free text can still identify a
   person.
5. Foreign processors cannot be synchronously erased by the local deletion
   transaction.
