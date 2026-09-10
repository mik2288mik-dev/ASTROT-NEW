import fs from 'node:fs';
import ts from 'typescript';

describe('support delivery outbox migration', () => {
  const migrations = fs.readFileSync('lib/migrations.ts', 'utf8');

  it('creates a bounded metadata-only queue with delivery lifecycle constraints', () => {
    const source = ts.createSourceFile('lib/migrations.ts', migrations, ts.ScriptTarget.Latest, true);
    const declarations = source.statements.filter(ts.isFunctionDeclaration)
      .filter((node) => node.name?.text === 'mvp051SupportDeliveryOutbox');
    expect(declarations).toHaveLength(1);
    const declaration = declarations[0];
    expect(declaration?.body).toBeDefined();
    if (!declaration?.body) throw new Error('Support outbox migration function is missing');
    const start = declaration.getStart(source);
    const end = declaration.getEnd();
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(end).toBeLessThanOrEqual(migrations.length);
    const migration = migrations.slice(start, end);

    expect(migration).toContain("const migrationName = 'mvp_051_support_delivery_outbox'");
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
