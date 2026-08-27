# Android store release

## Current technical baseline

- Public store and Android system name: `MEOU`.
- Final Android package/application ID: `ru.tvoygoroskop.app`.
- Capacitor 8.4.2; Android minSdk 24, compileSdk/targetSdk 36; AGP 8.13.0 and Gradle 8.14.3.
- Flavors: `development`, `telegram`, `rustore`, `googlePlay`. Only `rustore` compiles RuStore Pay SDK 11.1.0 (`ru.rustore.sdk:bom:2026.08.01` / `pay`); Google Play and Telegram do not include it. This is the current Kotlin/Java version documented by RuStore on 23 August 2026.
- `telegram` alone can invoke Telegram Stars. `google_play` has no checkout action until Google Play Billing is a separate project.
- `rustore` uses a Capacitor native bridge, return deep link, server validation, and encrypted callback endpoint. The callback durably enqueues work and returns before Public API validation; `/api/cron/rustore-payment-events` or the common cron tick processes retries. Do not use the deprecated RuStore BillingClient. A subscription release requires `NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED=1` and passes the release validator only in production mode.
- A guest may use all Free functions. When a guest selects a subscription, the app keeps the paywall context and selected plan, opens the existing account-link flow, and returns to that plan after VK ID, Yandex ID or confirmed email/password recovery is linked. The same recovery path handles a backend `RECOVERY_IDENTITY_REQUIRED` response. The stable `users.id` is passed as `AppUserId`; Telegram alone does not satisfy Android recovery.
- Release build has minification, `allowBackup=false`, cleartext disabled and requires signing. Debug remains available as `assembleDevelopmentDebug`.

## Owner values required before first upload

1. Permanent keystore: create once with `keytool -genkeypair -v -keystore your-horoscope-release.jks -alias your-horoscope -keyalg RSA -keysize 4096 -validity 10000`; store it plus passwords in a password manager and encrypted offline backup. The same signing identity is required for every future update.
2. Copy `signing.properties.example` to ignored `android/signing.properties`, or use CI environment variables. Never commit either a keystore or passwords.
3. Set a stable HTTPS `NEXT_PUBLIC_API_URL`; the APK/AAB must not use a provider-specific temporary host.

## Commands

```powershell
$env:NEXT_PUBLIC_API_URL = 'https://api.example.ru'
$env:NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'development'
$env:NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED = '0'
npm run android:debug

# With all owner values, signing and legal configuration set:
npm run android:rustore:apk
npm run android:rustore:aab
npm run android:google-play:aab
```

The release script validates channel, package consistency, versions, legal URLs, signing and RuStore fields; builds the web export, syncs Capacitor, emits an artifact path and SHA-256, and never uploads it.

## RuStore owner setup

In RuStore Console: create the app with the final signed package, enable monetization, and create exactly three `SUBSCRIPTION` products for month, three months, and year. Do not configure a trial for the first release. Copy their product IDs from **Monetization** into `NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_*` and the exact server allowlist `RUSTORE_ALLOWED_PRODUCT_IDS`. Copy the application ID from the Console URL into `RUSTORE_CONSOLE_APP_ID`; store the Public API key ID in `RUSTORE_KEY_ID` and its PKCS#8 RSA private key as base64 in server-only `RUSTORE_PRIVATE_KEY_BASE64`. The server exchanges that key pair for short-lived JWE tokens and does not use a static Public API token. Configure the callback URL `https://<public-domain>/api/payments/rustore/notifications`. Save the AES-256 callback key only in `RUSTORE_NOTIFICATION_AES_KEY` server secret. Add test VK IDs in the Console before sandbox testing.

## Account provider owner setup

Android account entry is native-first:

- Google uses Credential Manager and returns an ID token for server-side verification. Configure the Web OAuth client ID used as `serverClientId`, plus Android package `ru.tvoygoroskop.app` and the real debug/release signing fingerprints.
- Yandex uses LoginSDK 3.1.3 and returns an access token for server-side user-info verification. Configure its Android application ID as `YANDEX_ANDROID_CLIENT_ID` in the provider console, Railway and the APK build; keep browser OAuth in `YANDEX_AUTH_CLIENT_ID` plus its secret.
- VK uses VK ID SDK 2.7.2. Its OAuth 2.1 authorization-code flow uses PKCE, state, `device_id`, and `vk<VK_ANDROID_CLIENT_ID>://vk.ru/blank.html`; configure that redirect, `VK_ANDROID_CLIENT_ID`, and the Android SDK client secret separately from browser `VK_AUTH_CLIENT_ID` plus its secret.
- Email uses password registration/login and one-time codes only for confirmation and reset. Configure the server-side delivery adapter and independent production HMAC/rate-limit secrets.
- On Railway keep `AUTH_TRUST_PROXY=0` until the trusted edge is confirmed to overwrite `X-Forwarded-For`; only then enable it so per-client auth limits use the real forwarded address without accepting spoofed values.

Put all server and build values in the non-public variables listed in `.env.example`; do not expose them through `NEXT_PUBLIC_*` or React code. Apply `mvp_043_password_authentication` through the normal production migration procedure. Live provider login/linking still requires a signed APK and physical-device verification.

The callback payload is AES-256-GCM decrypted server-side. Premium is never granted by an APK response; it is granted after server validation of a permitted subscription and linked to one user/purchase ID only.
