# Release readiness status

| Item | Status | Evidence | Remaining | Owner |
|---|---|---|---|---|
| Distribution isolation | DONE | `lib/distributionChannel.ts`, tests | Google Billing intentionally absent | engineering |
| RuStore Pay SDK | DEFERRED | Pay SDK 10.5.0, `rustore` flavor/native bridge/API callback queue; `NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED=0` produces a free build | Enable only after IP/bank readiness; Console products and sandbox test | owner |
| Server Premium validation | PARTIAL | `lib/rustorePayments.ts`, purchase ownership constraint, durable callback retry queue | apply `mvp_039` + `mvp_040` in staging/production; test with real Public API token | engineering/owner |
| Guest and account recovery | PARTIAL | email/password with confirmation/reset codes; Google Credential Manager; Yandex LoginSDK 3.1.3; VK ID SDK 2.7.2 with OAuth 2.1/PKCE/state; protected multi-provider `account_identities`; native session restore/link UI | provider credentials/fingerprints, email delivery, Railway secrets, `mvp_043` production migration, live Android tests | owner |
| Revocable sessions | DONE | `app_sessions`, current/all revoke API, old-token checks, deletion revocation | production migration only | engineering |
| Release signing | PARTIAL | Gradle guard, `signing.properties.example` | permanent key and secrets | owner |
| App identity | DONE | `ru.tvoygoroskop.app`; `Твой гороскоп: натальная карта`; validator and APK manifest inspection | none in application code | engineering |
| Legal URLs/data controller | BLOCKED | public routes/config validation | owner/legal data and final review | owner/legal |
| Account deletion/logout | PARTIAL | transaction/revocation routes; schema audit | isolated PostgreSQL integration test and production migration | engineering/owner DB |
| APK/AAB inspection | PARTIAL | local `app-rustore-debug.apk`, package/version/SDK inspection and v2 signature verification | production API URL, permanent release signing and final release APK/AAB | owner/environment |
| RF migration | PARTIAL | runbook/health/readiness | Timeweb resources and dry run | owner |
| Store imagery | BLOCKED_BY_FINAL_VISUALS | shot list | final approved screens | design |
