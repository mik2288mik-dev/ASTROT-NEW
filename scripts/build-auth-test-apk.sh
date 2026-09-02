#!/usr/bin/env bash
set -euo pipefail

required=(NEXT_PUBLIC_API_URL YANDEX_AUTH_CLIENT_ID VK_AUTH_CLIENT_ID VK_ID_ANDROID_CLIENT_SECRET AUTH_TEST_KEYSTORE_BASE64 AUTH_TEST_KEYSTORE_PASSWORD AUTH_TEST_KEY_ALIAS AUTH_TEST_KEY_PASSWORD)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required build variable: ${name}" >&2
    exit 2
  fi
done

printf '%s' "$AUTH_TEST_KEYSTORE_BASE64" | base64 -d > /tmp/nebo-auth-test.jks
keytool -list -keystore /tmp/nebo-auth-test.jks -storepass "$AUTH_TEST_KEYSTORE_PASSWORD" -alias "$AUTH_TEST_KEY_ALIAS" >/dev/null

export YANDEX_ANDROID_CLIENT_ID="$YANDEX_AUTH_CLIENT_ID"
export VK_ANDROID_CLIENT_ID="$VK_AUTH_CLIENT_ID"
export RELEASE_STORE_PASSWORD="$AUTH_TEST_KEYSTORE_PASSWORD"
export RELEASE_KEY_ALIAS="$AUTH_TEST_KEY_ALIAS"
export RELEASE_KEY_PASSWORD="$AUTH_TEST_KEY_PASSWORD"

npm run build:mobile
npx cap sync android

cd android
chmod +x gradlew
./gradlew --no-daemon assembleDevelopmentRelease
cd ..

cp android/app/build/outputs/apk/development/release/app-development-release.apk /app/nebo-auth-test.apk
SOURCE_SHA="$(git rev-parse HEAD)"
{
  echo "STABLE TEST SIGNING CERTIFICATE"
  keytool -list -v -keystore /tmp/nebo-auth-test.jks -storepass "$AUTH_TEST_KEYSTORE_PASSWORD" -alias "$AUTH_TEST_KEY_ALIAS" | grep -E "SHA1:|SHA256:"
  echo
  echo "APK SHA-256:"
  sha256sum /app/nebo-auth-test.apk
  echo
  echo "Package: ru.tvoygoroskop.app"
  echo "Source commit: ${SOURCE_SHA}"
  echo "Build channel: development-release (stable test signing)"
  echo "API origin: ${NEXT_PUBLIC_API_URL}"
} > /app/fingerprints.txt