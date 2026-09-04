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

SOURCE_SHA="${SOURCE_COMMIT:-${RAILWAY_GIT_COMMIT_SHA:-}}"
if [[ ! "$SOURCE_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    SOURCE_SHA="$(git rev-parse HEAD)"
  else
    echo "Missing valid SOURCE_COMMIT/RAILWAY_GIT_COMMIT_SHA for APK provenance" >&2
    exit 2
  fi
fi
export SOURCE_COMMIT="$(printf '%s' "$SOURCE_SHA" | tr '[:upper:]' '[:lower:]')"

npm run build:mobile
npx cap sync android

cd android
chmod +x gradlew
./gradlew --no-daemon assembleDevelopmentRelease
cd ..

APK=android/app/build/outputs/apk/development/release/app-development-release.apk
test -s "$APK"
unzip -t "$APK" >/dev/null
cp "$APK" /app/nebo-auth-test.apk

{
  echo "STABLE TEST SIGNING CERTIFICATE"
  keytool -list -v -keystore /tmp/nebo-auth-test.jks -storepass "$AUTH_TEST_KEYSTORE_PASSWORD" -alias "$AUTH_TEST_KEY_ALIAS" | grep -E "SHA1:|SHA256:"
  echo
  echo "APK SHA-256:"
  sha256sum /app/nebo-auth-test.apk
  echo
  echo "Package: ru.tvoygoroskop.app"
  echo "Source main commit: ${SOURCE_COMMIT}"
  echo "Builder branch commit: ${RAILWAY_GIT_COMMIT_SHA:-unknown}"
  echo "Build channel: development-release (stable test signing)"
  echo "API origin: ${NEXT_PUBLIC_API_URL}"
  if [[ -n "${MYTRACKER_SDK_KEY:-}" ]]; then
    echo "MyTracker: enabled"
  else
    echo "MyTracker: disabled (SDK key not configured)"
  fi
} > /app/fingerprints.txt