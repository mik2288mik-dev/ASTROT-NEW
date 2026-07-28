# Android store release

## Current technical baseline

- Capacitor 8.4.2; Android minSdk 24, compileSdk/targetSdk 36; AGP 8.13.0 and Gradle 8.14.3.
- Flavors: `development`, `telegram`, `rustore`, `googlePlay`. Only `rustore` compiles RuStore Pay SDK (`ru.rustore.sdk:bom:2026.06.01` / `pay`); Google Play and Telegram do not include it.
- `telegram` alone can invoke Telegram Stars. `google_play` has no checkout action until Google Play Billing is a separate project.
- `rustore` uses a Capacitor native bridge, return deep link, server validation, and encrypted callback endpoint. Do not use the deprecated RuStore BillingClient.
- Release build has minification, `allowBackup=false`, cleartext disabled and requires signing. Debug remains available as `assembleDevelopmentDebug`.

## Owner values required before first upload

1. Final package ID: replace `com.yourhoroscope.app` in `android/app/build.gradle` (`namespace`, `applicationId`), `capacitor.config.ts` (`appId`), `android/app/src/main/res/values/strings.xml` (`package_name`, `custom_url_scheme`), Java package/path, and `RUSTORE_PACKAGE_NAME`. Run `npm run android:validate:release` afterwards.
2. Permanent keystore: create once with `keytool -genkeypair -v -keystore your-horoscope-release.jks -alias your-horoscope -keyalg RSA -keysize 4096 -validity 10000`; store it plus passwords in a password manager and encrypted offline backup. The same signing identity is required for every future update.
3. Copy `signing.properties.example` to ignored `android/signing.properties`, or use CI environment variables. Never commit either a keystore or passwords.
4. Set a stable HTTPS `NEXT_PUBLIC_API_URL`; the APK/AAB must not use a provider-specific temporary host.

## Commands

```powershell
$env:NEXT_PUBLIC_API_URL = 'https://api.example.ru'
$env:NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'development'
npm run build:mobile
npx cap sync android
cd android; .\gradlew.bat assembleDevelopmentDebug

# With all owner values, signing and legal configuration set:
npm run android:rustore:apk
npm run android:rustore:aab
npm run android:google-play:aab
```

The release script validates channel, package consistency, versions, legal URLs, signing and RuStore fields; builds the web export, syncs Capacitor, emits an artifact path and SHA-256, and never uploads it.

## RuStore owner setup

In RuStore Console: create the app with the final signed package, enable monetization, create the chosen subscriptions/products, copy their product IDs from **Monetization**, and insert them into `NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_*` and `RUSTORE_ALLOWED_PRODUCT_IDS`. Copy application ID from the Console URL into `RUSTORE_CONSOLE_APP_ID`, request a Public API token into server-only `RUSTORE_PUBLIC_API_TOKEN`, and configure the callback URL `https://<public-domain>/api/payments/rustore/notifications`. Save the AES-256 callback key only in `RUSTORE_NOTIFICATION_AES_KEY` server secret. Add test VK IDs in the Console before sandbox testing.

The callback payload is AES-256-GCM decrypted server-side. Premium is never granted by an APK response; it is granted after server validation of a permitted subscription and linked to one user/purchase ID only.
