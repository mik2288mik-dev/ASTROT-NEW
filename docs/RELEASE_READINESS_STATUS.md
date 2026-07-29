# Release readiness status

| Item | Status | Evidence | Remaining | Owner |
|---|---|---|---|---|
| Distribution isolation | DONE | `lib/distributionChannel.ts`, tests | Google Billing intentionally absent | engineering |
| RuStore Pay SDK | PARTIAL | Pay SDK 10.5.0, `rustore` flavor/native bridge/API callback queue | Console app, published products, physical-device sandbox test | owner |
| Server Premium validation | PARTIAL | `lib/rustorePayments.ts`, purchase ownership constraint, durable callback retry queue | apply `mvp_039` + `mvp_040` in staging/production; test with real Public API token | engineering/owner |
| Guest and account recovery | PARTIAL | multi-provider `account_identities`, OAuth/OTP APIs, Settings linking/recovery | provider console IDs/secrets and email delivery adapter; live provider tests | owner |
| Revocable sessions | DONE | `app_sessions`, current/all revoke API, old-token checks, deletion revocation | production migration only | engineering |
| Release signing | PARTIAL | Gradle guard, `signing.properties.example` | permanent key and secrets | owner |
| Final package ID | BLOCKED | `scripts/validate-store-release.mjs` | one final ID | owner |
| Legal URLs/data controller | BLOCKED | public routes/config validation | owner/legal data and final review | owner/legal |
| Account deletion/logout | PARTIAL | transaction/revocation routes; schema audit | isolated PostgreSQL integration test and production migration | engineering/owner DB |
| APK/AAB inspection | BLOCKED | release commands | JDK/SDK, signing, final configuration | owner/environment |
| RF migration | PARTIAL | runbook/health/readiness | Timeweb resources and dry run | owner |
| Store imagery | BLOCKED_BY_FINAL_VISUALS | shot list | final approved screens | design |
