# Russian infrastructure migration runbook

No production migration is performed by this repository change. Target MVP: a Russian VDS/Cloud Server running Docker, Managed PostgreSQL in the same region/private network, Russian-region S3 for files/backups, stable HTTPS API and legal-page domains, and DNS rollback to the old host.

1. Owner exports current service list, Node (`.nvmrc`/Dockerfile), PostgreSQL version/extensions, database size, ephemeris size (`ephe/`), scheduler/cron list, Telegram webhook and domains.
2. Provision the target network, database backups, off-site encrypted logical backup and least-privilege secrets. Do not put a database URL in an Android build.
3. Build the existing Dockerfile, run `npm run migrate` exactly once (advisory lock protects concurrent runners), check `/api/health` and strict `/api/readiness`, then verify Swiss Ephemeris files and scheduler.
4. Create a logical dump outside the repository: `pg_dump --format=custom --no-owner --file=backup.dump "$DATABASE_URL"`; verify `pg_restore --list backup.dump`; restore to an isolated test database; compare row counts for `users`, `natal_charts`, `personal_forecast_questions`, `premium_entitlements`, `star_payments`, `store_purchases`.
5. Run smoke tests for profile, chart, forecast, question, logout/account deletion, Telegram webhook and RuStore callback. Point a staging mobile build only at staging API.
6. Lower DNS TTL, take a final write pause/dump, restore/migrate, validate health/readiness, update `WEBHOOK_BASE_URL` and Telegram webhook, then switch the stable API DNS record. Monitor logs/DB/scheduler and retain the old service for rollback.
7. Roll back DNS and webhook to the known-good host if smoke checks fail. Archive or remove Railway only after owner approval and a verified backup restore.

`NEXT_PUBLIC_API_URL` is the stable domain consumed by mobile releases; no Railway hostname may be compiled into APK/AAB.
