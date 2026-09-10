#!/bin/sh
set -eu

# Keep this script in Railway watch scope so UI releases can be explicitly retriggered when needed.
echo "[predeploy] Validating production runtime environment"
npm run validate:production-env

echo "[predeploy] Running database migrations"
npm run migrate

echo "[predeploy] Production validation and migrations completed"
