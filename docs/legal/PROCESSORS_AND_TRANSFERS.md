# Processors and cross-border transfers

Status: 23 August 2026. A transfer is marked **yes** where data leaves the
Russian Federation or is made available to a foreign recipient. The operator
must submit the separate Article 12 notification **before** beginning each
notified transfer and must not confuse it with the Article 22 operator notice.

| Recipient / legal entity | Country / observed region | Data and purpose | Necessary/minimised? | Cross-border / release status |
|---|---|---|---|---|
| Railway Corp | United States; live MEOU edge/API observed in `ams1` (Amsterdam, Netherlands) | Every API request reaches foreign compute memory; HTTP logs include IP/UA/path/host/region; stdout/stderr may contain user/chart IDs; current PostgreSQL evidence is Railway | Not minimised enough for application PD; host-only public files still cause foreign IP/UA logs | **Yes. P0 BLOCKED** for API, DB and logs under localisation. Public static site is lower risk but still processes visitor IP abroad. |
| OpenAI, L.L.C. | United States/global API infrastructure; no Russian processing region published | Name, exact birth date/time/place/time zone, chart facts/evidence, forecast history and user question for personalised output | Email/account/device identifiers are not intentionally sent; exact name/place and raw birth fields can be reduced to pseudonymous calculated context where product quality permits | **Yes.** Submit Article 12 notice before use, disclose it, and complete recipient safeguards. `store:false` is enabled but abuse-monitoring logs can remain up to 30 days. |
| Hangzhou DeepSeek AI Co., Ltd. | People's Republic of China | Zodiac/sign content prompts and model responses | Acceptable only while routes enforce no account identity or personal natal data | **Potential yes.** Treat as notified transfer if any user-derived text or identifier can enter the request; otherwise document non-personal shared-content boundary. |
| Resend, Inc. | United States; Resend states stored data remains in the US even with EU sending region | Email address, OTP email body/delivery metadata, provider logs | Required only for email login/recovery. OTP must not contain birth/profile data | **Yes. P0 until notified/assessed.** Fastest risk reduction is a Russian transactional-email provider or Russian-hosted SMTP with confirmed logging/retention. |
| Open-Meteo | Foreign service/infrastructure | Typed birthplace query and requester IP for city autocomplete | Place can be proxied, rate limited and stripped of account IDs; client-direct request leaks user IP | **Yes/potential.** Move behind Russian backend/cache or replace with an RF geocoder before release. |
| OpenStreetMap Nominatim instances | Community/foreign endpoint used as server fallback | Birthplace search text and API server IP | No account ID is needed; use a controlled RF-hosted geocoder/cache | **Potential yes.** Recipient/host may vary; unsuitable for an unqualified release declaration. |
| ООО «Яндекс» (Yandex ID) | Russian Federation | OAuth subject ID, authorization assertion, optionally disclosed account fields | Request only identity scopes required for sign-in | **No international transfer identified in MEOU flow**, subject to final SDK/network inspection and contract. Disclose as authentication provider. |
| VK ID / ООО «В Контакте» | Russian Federation | OAuth subject ID, authorization assertion, optionally disclosed account fields | Request only identity scopes required for sign-in | **No international transfer identified in MEOU flow**, subject to final SDK/network inspection and contract. |
| RuStore / ООО «Много приложений» | Russian Federation | App/account purchase identifier, product, subscription status, callbacks and transaction history | Required only when Premium is enabled; no payment card data should reach MEOU | **No international transfer identified in MEOU flow.** RuStore remains an independent recipient/controller for its store records. |
| Production PostgreSQL | Current evidence: Railway/non-RF; target: Russian managed PostgreSQL | All account, profile, birth, chart, content, support and entitlement records | Primary store is necessary; direct public exposure is not | **P0 BLOCKED** until a Russian location, contract, backups and restore evidence are documented. |

## Minimal release-safe target

1. Put API compute, primary PostgreSQL, queues/cache/temp files, application
   logs and backups in a Russian data centre under a documented provider
   contract.
2. Remove PII from access/application logs and set finite retention.
3. Keep foreign AI optional to the specific feature, send a pseudonymous
   minimum payload, submit Article 12 notice before production use and record
   recipient responses/safeguards.
4. Replace Resend and client-direct foreign geocoding for the fastest clean
   localisation position. If retained, notify and document them before use.
5. A Railway static marketing site has no form, trackers or cookies, but visitor
   IP/UA still reaches a foreign host. Treat it as a temporary, disclosed
   exception—not proof that the Android service is localised.
