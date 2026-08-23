# Railway Database Migrations

Railway starts the app with:

```text
sh scripts/railway-start.sh
```

This is configured in `railway.json` and mirrored in the Dockerfile `CMD`.

## Runtime Contract

- `npm run validate:production-env` must pass before the database is touched.
- `npm run migrate` must finish successfully before `node server.js` starts.
- `exec node server.js` makes the Next.js server the main container process after migrations, so it receives shutdown signals directly.
- In Railway/production/CI, missing `DATABASE_URL` is a fatal error.
- Any migration error exits with code `1`.
- Database URLs are logged only as safe connection metadata: host, port, database, user, and optional `sslmode`.
- The app runtime does not run non-blocking background migrations from `lib/db.ts`.
- `runMigrations` holds its PostgreSQL advisory lock and all migration queries on the same dedicated connection, so concurrent migration attempts serialize instead of racing.

## Local Behavior

For local development without a database URL, `npm run migrate` prints a clear skip message and exits successfully. Local DB checks that require a connection, such as `npm run audit:db`, still fail if no DB URL is configured.

## Reset Safety

Destructive reset is not automated in deployment. The historical `lumia_reset`
step only records its marker on a fresh database. If that marker is absent while
application tables already exist, startup fails with
`DESTRUCTIVE_MIGRATION_BLOCKED` before deleting anything.

The separate `natal_v2_clean_calculation_storage_20260803` migration adds its
columns automatically only when there are no existing natal charts or populated
birth profiles. Otherwise it fails with
`DESTRUCTIVE_NATAL_V2_MIGRATION_BLOCKED`. Take and restore-test a backup, decide
the data conversion/reset explicitly, then run an owner-reviewed one-off
procedure. Never bypass either guard by editing production history blindly.

A database reset must be run intentionally after confirming the target Railway
PostgreSQL service belongs to this project and environment.
