# Railway Database Migrations

Railway starts the app with:

```text
sh scripts/railway-start.sh
```

This is configured in `railway.json` and mirrored in the Dockerfile `CMD`.

## Runtime Contract

- `npm run migrate` must finish successfully before `node server.js` starts.
- `exec node server.js` makes the Next.js server the main container process after migrations, so it receives shutdown signals directly.
- In Railway/production/CI, missing `DATABASE_URL` is a fatal error.
- Any migration error exits with code `1`.
- Database URLs are logged only as safe connection metadata: host, port, database, user, and optional `sslmode`.
- The app runtime does not run non-blocking background migrations from `lib/db.ts`.
- `runMigrations` uses a PostgreSQL advisory lock so concurrent migration attempts serialize instead of racing.

## Local Behavior

For local development without a database URL, `npm run migrate` prints a clear skip message and exits successfully. Local DB checks that require a connection, such as `npm run audit:db`, still fail if no DB URL is configured.

## Reset Safety

Destructive reset is not automated in deployment. A database reset must be run intentionally after confirming the target Railway PostgreSQL service belongs to this project and environment.
