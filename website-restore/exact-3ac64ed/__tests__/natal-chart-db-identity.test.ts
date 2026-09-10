import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'lib/db.ts'), 'utf8');
const migrations = fs.readFileSync(path.join(process.cwd(), 'lib/migrations.ts'), 'utf8');
const persistence = fs.readFileSync(path.join(process.cwd(), 'lib/natalChartPersistence.ts'), 'utf8');
const natalCharts = source.slice(
  source.indexOf('natal_charts: {'),
  source.indexOf('/** OpenAI cache - interpretations table */'),
);

function between(start: string, end: string): string {
  const startIndex = natalCharts.indexOf(start);
  const endIndex = natalCharts.indexOf(end, startIndex);
  return natalCharts.slice(startIndex, endIndex === -1 ? natalCharts.length : endIndex);
}

describe('natal chart database identity contract', () => {
  it('hydrates explicit identity metadata and excludes archived charts from active reads', () => {
    expect(natalCharts).toContain('is_primary, subject_type, relation_label, archived_at');
    expect(natalCharts).toContain("subject_type: row.subject_type === 'self' ? 'self' : 'saved_person'");
    expect(natalCharts).toContain('relation_label: row.relation_label || null');
    expect(natalCharts).toContain('archived_at: row.archived_at || null');

    const getPrimary = between('async getPrimary(', 'async getAll(');
    expect(getPrimary).toContain("subject_type = 'self'");
    expect(getPrimary).toContain('archived_at IS NULL');

    const getAll = between('async getAll(userId:', 'async getById(');
    expect(getAll).toContain('archived_at IS NULL');

    const getById = between('async getById(', 'async _updateChartRow(');
    expect(getById).toContain('archived_at IS NULL');
  });

  it('keeps an unknown birth time nullable instead of persisting fake noon precision', () => {
    expect(source).toContain('function normalizeStoredBirthTime(value?: string | null): string | null');

    const payload = between('_toPersistencePayload(', 'async _queryOne(');
    expect(payload).toContain('const normalizedBirthTime = normalizeStoredBirthTime(data.birthTime)');
    expect(payload).toContain('birthTime: normalizedBirthTime');
    expect(payload).not.toContain("birthTime: normalizedBirthTime || data.birthTime || '12:00'");

    const repairCandidates = between('async listRepairCandidates(', '/** OpenAI cache');
    expect(repairCandidates).toContain('COALESCE(nc.birth_time, u.birth_time) AS birth_time');
    expect(repairCandidates).toContain("birthTime: normalizeStoredBirthTime(row.birth_time) || ''");
  });

  it('keeps self identity immutable and archives saved people without deleting rows', () => {
    const identity = between('async setIdentityMetadata(', 'async setPrimary(');
    expect(identity).toContain('chart.subject_type !== subjectType');
    expect(identity).toContain('Chart subject identity is immutable');
    expect(identity).toContain('normalizeRelationLabel(relationLabel)');

    const setPrimary = between('async setPrimary(', 'async archive(');
    expect(setPrimary).toContain("chart.subject_type !== 'self'");

    const archive = between('async archive(', 'async get(userId:');
    expect(archive).toContain('SET archived_at = CURRENT_TIMESTAMP');
    expect(archive).toContain("subject_type = 'saved_person'");
    expect(archive).not.toContain('DELETE FROM natal_charts');
    expect(archive).not.toContain('DELETE FROM astrology_');
    expect(archive).not.toContain('DELETE FROM content_interpretations');
  });

  it('enforces five additional Premium charts (six including self) transactionally without users.chart_slots', () => {
    const create = between('async create(userId:', 'async setIdentityMetadata(');
    expect(create).toContain("pg_advisory_xact_lock(hashtext('natal-chart-limit:'");
    expect(create).toContain('COUNT(*)::int AS total');
    expect(create).toContain('archived_at IS NULL');
    expect(create).toContain('u.premium_until > CURRENT_TIMESTAMP');
    expect(create).toContain("pe.status = 'active'");
    expect(create).toContain('pe.ends_at > CURRENT_TIMESTAMP');
    expect(create).toContain('const slots = PREMIUM_ACTIVE_CHART_LIMIT');
    expect(create).not.toContain('chart_slots');
    expect(create).toContain("subjectType: 'saved_person'");
    expect(create.indexOf('has_current_premium_until')).toBeLessThan(
      create.indexOf('existingSameHashResult'),
    );

    const persistPrimary = between('async persistPrimary(', 'async create(userId:');
    expect(persistPrimary).toContain("pg_advisory_xact_lock(hashtext('natal-chart-self:'");
    expect(persistPrimary).toContain("subject_type = 'self'");
  });

  it('treats a saved person as input hash plus normalized name while self stays hash-only', () => {
    const findByHash = between('async findByInputHash(', 'async getPrimary(');
    expect(findByHash).toContain("subjectType?: 'self' | 'saved_person'");
    expect(findByHash).toContain("identity?: { subjectType?: 'self' | 'saved_person'; name?: string }");
    expect(findByHash).toContain('normalizeChartIdentityName(identity.name)');

    const create = between('async create(userId:', 'async setIdentityMetadata(');
    expect(create).toContain("subject_type = 'saved_person'");
    expect(create).toContain('normalizeChartIdentityName(payload.name)');
    expect(create).toContain("REGEXP_REPLACE(BTRIM(COALESCE(name, ''))");
    expect(create).toContain('this._updateChartRow(client, existing.id, payload, false)');

    expect(persistence).toMatch(/subjectType:\s*'self'/);
    expect(persistence).toMatch(/subjectType:\s*'saved_person'/);
    expect(persistence).toContain('name: args.name');

    const migrationStart = migrations.indexOf('async function mvp042SavedPersonIdentity');
    const migrationEnd = migrations.indexOf('async function mvp043PasswordAuthentication', migrationStart);
    const migration = migrations.slice(migrationStart, migrationEnd);
    expect(migration).toContain('DROP INDEX IF EXISTS idx_natal_charts_user_input_hash');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_natal_charts_active_identity_hash');
    expect(migration).not.toContain('CREATE UNIQUE INDEX');
    expect(migrations).toContain('await mvp042SavedPersonIdentity(migrationDb)');
  });
});
