import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('legal acknowledgement durable storage contract', () => {
  it('creates and verifies the append-only journal with bounded fields and indexes', () => {
    const migrations = read('lib/migrations.ts');
    const start = migrations.indexOf('async function mvp050LegalAcknowledgements');
    const end = migrations.indexOf('export async function runMigrations', start);
    const migration = migrations.slice(start, end);

    expect(migration).toContain("const migrationName = 'mvp_050_legal_acknowledgements'");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS user_legal_acknowledgements');
    expect(migration).toContain('user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(migration).toContain("CHECK (document_type IN ('personal_data', 'terms', 'entertainment_notice'))");
    expect(migration).toContain("CHECK (action IN ('accepted', 'withdrawn'))");
    expect(migration).toContain("CHECK (action <> 'withdrawn' OR document_type = 'personal_data')");
    expect(migration).toContain('idx_user_legal_acknowledgements_latest');
    expect(migration).toContain('idx_user_legal_acknowledgements_document_audit');
    expect(migrations).toContain('await mvp050LegalAcknowledgements(migrationDb)');
    expect(migrations).toContain("'user_legal_acknowledgements'");
  });

  it('records legal actions only through INSERT and never stores request fingerprints or birth data', () => {
    const route = read('pages/api/users/legal-acknowledgements.ts');
    const helper = read('lib/legalAcknowledgement.ts');
    const migration = read('lib/migrations.ts');

    expect(route).toContain('INSERT INTO user_legal_acknowledgements');
    expect(route).not.toMatch(/UPDATE\s+user_legal_acknowledgements/i);
    expect(route).not.toMatch(/DELETE\s+FROM\s+user_legal_acknowledgements/i);
    expect(route).not.toContain('req.headers');
    expect(route).not.toContain('req.socket');
    expect(`${route}\n${helper}`).not.toMatch(/userAgent|user-agent|ipAddress|birthDate|birthTime/);

    const tableStart = migration.indexOf('CREATE TABLE IF NOT EXISTS user_legal_acknowledgements');
    const tableEnd = migration.indexOf('CREATE INDEX IF NOT EXISTS idx_user_legal_acknowledgements_latest');
    const table = migration.slice(tableStart, tableEnd);
    expect(table).not.toMatch(/\bip(?:_address)?\b/i);
    expect(table).not.toMatch(/user_agent|device|birth_/i);
  });

  it('keeps document versions server-owned and rejects client version fields', () => {
    const route = read('pages/api/users/legal-acknowledgements.ts');
    const helper = read('lib/legalAcknowledgement.ts');

    expect(route).toContain('CURRENT_LEGAL_DOCUMENT_VERSIONS[mutation.documentType]');
    expect(helper).not.toContain("'documentVersion',");
    expect(helper).toContain('LEGAL_ACKNOWLEDGEMENT_BODY_LIMIT_BYTES = 8 * 1024');
  });
});
