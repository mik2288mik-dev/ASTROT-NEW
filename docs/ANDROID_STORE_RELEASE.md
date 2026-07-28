# Android release preparation: RuStore and Google Play

## Current project values

- Application ID: `com.yourhoroscope.app` — placeholder; choose the final, globally unique ID before the first public build and keep it forever.
- Version: `APP_VERSION_CODE` (integer, increase for every upload) and `APP_VERSION_NAME` (user-visible version, default `1.0.0`).
- SDK: min 24, compile/target 36. Only `INTERNET` is declared.
- Existing adaptive launcher icon and Android 12 splash resources are used by the Capacitor project.
- The app uses HTTPS-only networking. Legal pages are normal HTTPS Next.js routes: `/privacy`, `/terms`, `/delete-account`.

## Signing: create once, keep forever

Do not commit a keystore or passwords. Before the first upload, create and back up one permanent key:

```bash
keytool -genkeypair -v -keystore your-horoscope-release.jks -alias your-horoscope -keyalg RSA -keysize 4096 -validity 10000
```

Store the file and all passwords in a password manager and an encrypted offline backup. Every future APK/AAB update must use this same key (or, for Google Play, the configured Play App Signing upload key).

Set these only in CI secrets, environment variables, or untracked `android/signing.properties`:

```properties
RELEASE_STORE_FILE=/absolute/path/to/your-horoscope-release.jks
RELEASE_STORE_PASSWORD=...
RELEASE_KEY_ALIAS=your-horoscope
RELEASE_KEY_PASSWORD=...
APP_VERSION_CODE=1
APP_VERSION_NAME=1.0.0
```

## Release commands

```bash
export NEXT_PUBLIC_API_URL=https://[УКАЖИТЕ_PRODUCTION_API_HOST]
npm run build:mobile
npx cap sync android
cd android
./gradlew assembleRelease    # signed APK for testing/RuStore
./gradlew bundleRelease      # signed AAB for Google Play
```

Expected outputs: `android/app/build/outputs/apk/release/` and `android/app/build/outputs/bundle/release/`.

## Store-console checklist still requiring owner input

1. Final application ID and public developer/app name.
2. Production HTTPS API URL for `NEXT_PUBLIC_API_URL`.
3. Developer/legal entity name, address, support email, privacy retention details, and final legal review.
4. Public production domain hosting `/privacy`, `/terms`, and `/delete-account` over HTTPS.
5. Permanent release keystore and passwords; Google Play / RuStore developer accounts.
6. Store listing assets, content rating, Data Safety / privacy disclosures, and the deletion-page URL in Play Console.

## Data and permissions inventory for future declarations

The app processes profile name, Telegram/native session identifier, birth date/time/place and derived natal chart, forecast/questions, notification preferences, and Premium/account records. Android declares only network access. Verify every actual production SDK and server processor before completing store forms.
