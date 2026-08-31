import fs from 'node:fs';

describe('support delivery outbox migration', () => {
  const migrations = fs.readFileSync('lib/migrations.ts', 'utf8');

  it('creates a bounded metadata-only queue with delivery lifecycle constraints', () => {
    const start = migrations.indexOf("const migrationName = 'mvp_051_support_delivery_outbox'");
    const end = migrations.indexOf('export async function runMigrations', start);
    const migration = migrations.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS support_delivery_outbox');
    expect(migration).toContain('ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE');
    expect(migration).toContain("CHECK (channel IN ('email', 'telegram'))");
    expect(migration).toContain("CHECK (status IN ('pending', 'processing', 'failed', 'sent', 'dead'))");
    expect(migration).toContain('CHECK (attempts BETWEEN 0 AND 10)');
    expect(migration).toContain('UNIQUE (ticket_id, channel)');
    expect(migration).toContain('idx_support_delivery_outbox_due');
    for (const forbidden of ['message', 'body', 'reply_email', 'birth', 'device', 'user_id']) {
      expect(migration).not.toMatch(new RegExp(`\\b${forbidden}\\b`, 'iu'));
    }
  });

  it('runs and verifies the append-only migration', () => {
    expect(migrations).toContain('await mvp051SupportDeliveryOutbox(migrationDb)');
    expect(migrations).toContain("'support_delivery_outbox',");
  });
});
