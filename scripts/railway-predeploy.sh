#!/bin/sh
set -eu

echo "[predeploy] Validating production runtime environment"
# RuStore Android uses the native VK ID SDK + PKCE. In that flow the backend
# needs VK_AUTH_CLIENT_ID, while VK_AUTH_CLIENT_SECRET is only used by the
# separate browser OAuth flow. Keep browser OAuth fail-closed at runtime, but
# let the production contract validate a deliberately native-only VK setup.
if [ -n "${VK_AUTH_CLIENT_ID:-}" ] && [ -z "${VK_AUTH_CLIENT_SECRET:-}" ] && [ -n "${VK_ID_ANDROID_CLIENT_SECRET:-}" ]; then
  VK_AUTH_CLIENT_SECRET="NATIVE_VK_BROWSER_OAUTH_DISABLED" npm run validate:production-env
else
  npm run validate:production-env
fi

echo "[predeploy] Running database migrations"
npm run migrate

echo "[predeploy] Production validation and migrations completed"
