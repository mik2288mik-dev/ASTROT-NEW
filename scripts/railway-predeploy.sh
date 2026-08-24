#!/bin/sh
set -eu

echo "[predeploy] Validating production runtime environment"
npm run validate:production-env

echo "[predeploy] Running database migrations"
npm run migrate

echo "[predeploy] Production validation and migrations completed"
