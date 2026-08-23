#!/bin/sh
set -eu

echo "[start] Validating production environment"
npm run validate:production-env

echo "[start] Running database migrations"
npm run migrate

echo "[start] Starting Next.js server"
exec node server.js
