# Release readiness status

| Item | Status | Evidence | Remaining | Owner |
|---|---|---|---|---|
| Distribution isolation | DONE | `lib/distributionChannel.ts`, tests | Google Billing intentionally absent | engineering |
| RuStore Pay SDK | PARTIAL | `rustore` flavor/native bridge/API callbacks | Console app, products, sandbox device test | owner |
| Server Premium validation | PARTIAL | `lib/rustorePayments.ts`, `store_purchases` migration | run pending `mvp_039_rustore_pay` migration in isolated staging, then production | engineering/owner |
| Release signing | PARTIAL | Gradle guard, `signing.properties.example` | permanent key and secrets | owner |
| Final package ID | BLOCKED | `scripts/validate-store-release.mjs` | one final ID | owner |
| Legal URLs/data controller | BLOCKED | public routes/config validation | owner/legal data and final review | owner/legal |
| Account deletion/logout | PARTIAL | transaction/revocation routes; schema audit | isolated PostgreSQL integration test and production migration | engineering/owner DB |
| APK/AAB inspection | BLOCKED | release commands | JDK/SDK, signing, final configuration | owner/environment |
| RF migration | PARTIAL | runbook/health/readiness | Timeweb resources and dry run | owner |
| Store imagery | BLOCKED_BY_FINAL_VISUALS | shot list | final approved screens | design |
