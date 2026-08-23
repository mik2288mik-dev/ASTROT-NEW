# MEOU Android / RuStore release readiness

Code presence is not sandbox, device or store-release proof. Keep each remaining
owner/environment check open until it is verified against the final signed artifact.

| Item | Status | Evidence in the current code | Remaining release proof | Owner |
|---|---|---|---|---|
| Android identity | SOURCE_READY | `capacitor.config.ts` and both Android string locales use `MEOU`; manifest labels resolve through `@string/app_name` / `@string/title_activity_main`; application ID remains `ru.tvoygoroskop.app` | build the final signed artifact and inspect its package and rendered label | engineering/owner |
| Distribution isolation | SOURCE_READY | `lib/distributionChannel.ts`; only the `rustore` flavor includes RuStore Pay | inspect dependencies and checkout availability in the final RuStore artifact | engineering |
| RuStore Pay client | IMPLEMENTED_NEEDS_PROOF | Pay SDK/native bridge, catalog, subscription purchase, pending-order deduplication, restore and subscription management are implemented; release validation requires payments enabled | configure Console products and prices, enable `NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED=1`, then test purchase, cancel, retry, restore and restart on a physical sandbox device | engineering/owner |
| Server Premium validation | IMPLEMENTED_NEEDS_PROOF | `lib/rustorePayments.ts`, product allowlist, ownership constraint, Public API validation and durable encrypted callback queue | confirm migrations `mvp_039` and `mvp_040` in the target database; verify real sandbox Public API validation, callback delivery/retry and entitlement changes | engineering/owner |
| Guest → Premium recovery | IMPLEMENTED_NEEDS_PROOF | checkout checks recovery before native purchase; missing identity opens the existing VK ID/Yandex/email link flow, preserves paywall context and plan, and returns to checkout; backend `RECOVERY_IDENTITY_REQUIRED` uses the same path | verify both guest handoff and already-linked direct checkout on the signed physical-device sandbox build | engineering/owner |
| Account recovery/auth | IMPLEMENTED_NEEDS_PROOF | protected `account_identities`, revocable `app_sessions`, VK ID, Yandex, email registration/login/reset and native session persistence | configure provider credentials/fingerprints and email delivery; confirm `mvp_043` in the target database; run live link/login/reset/restart tests | engineering/owner |
| Release signing | OWNER_REQUIRED | Gradle release guard and `signing.properties.example` are present | supply the permanent keystore and secrets; build and archive the final signed APK/AAB plus SHA-256 | owner |
| Production API/config | OWNER_REQUIRED | validators cover stable HTTPS API URL, RuStore package/catalog/server secrets and production pay mode | run release and production-env validators with final values; verify live health/auth/payment endpoints | owner/environment |
| Legal/store listing | OWNER_REQUIRED | privacy, terms, deletion routes and `docs/store/rustore/STORE_LISTING.md` exist with the `MEOU` name | final controller/support/legal values, rating, screenshots, listing review and Console submission | owner/legal/design |
| Account deletion/logout | IMPLEMENTED_NEEDS_PROOF | transaction/revocation routes and local cleanup exist | verify against the migrated target database and signed device build | engineering/owner |

## Required final device/sandbox scenarios

- guest → paywall → select plan → VK ID/Yandex/email link → same plan restored → RuStore purchase can start;
- already linked account → paywall → select plan → RuStore purchase starts without an auth step;
- successful purchase → backend-confirmed Premium; cancellation grants nothing;
- process restart and manual restore recover the same subscription without a duplicate order;
- callback retry, renewal, cancellation, grace and expiry update the canonical entitlement on the server.
