import fs from 'node:fs';
import path from 'node:path';

const migrations = fs.readFileSync(path.join(process.cwd(), 'lib/migrations.ts'), 'utf8');

describe('user app event idempotency migration', () => {
  it('adds a nullable event id and a partial unique index without rewriting old rows', () => {
    const start = migrations.indexOf('async function mvp052UserAppEventIdempotency');
    const end = migrations.indexOf('export async function runMigrations', start);
    const migration = migrations.slice(start, end);

    expect(migration).toContain("ALTER TABLE user_app_events ADD COLUMN IF NOT EXISTS event_id TEXT");
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_app_events_event_id_unique');
    expect(migration).toContain('WHERE event_id IS NOT NULL');
    expect(migration).not.toContain('DROP TABLE');
    expect(migrations).toContain('await mvp052UserAppEventIdempotency(migrationDb)');
  });
});
