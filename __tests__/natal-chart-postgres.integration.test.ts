import type { Pool } from 'pg';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

const mockSwiss = jest.fn();
const mockGeocode = jest.fn();
jest.mock('../lib/swisseph-calculator', () => ({
  calculateNatalChart: (...args: unknown[]) => mockSwiss(...args),
  resolveBirthCoordinates: (...args: unknown[]) => mockGeocode(...args),
}));

const testUrl = String(process.env.NATAL_CHART_TEST_DATABASE_URL || '').trim();

export function assertNatalTestDatabase(value: string): string {
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname)
    || !/(^|[_-])natal[_-]test($|[_-])/.test(decodeURIComponent(parsed.pathname.slice(1)))) {
    throw new Error('Natal integration requires a dedicated local natal_test database');
  }
  return value;
}
if (testUrl) assertNatalTestDatabase(testUrl);
const describeDatabase = testUrl ? describe : describe.skip;

describe('natal PostgreSQL test database guard', () => {
  it('accepts a named local test database and rejects production endpoints', () => {
    expect(assertNatalTestDatabase('postgres://localhost/nebo_natal_test')).toContain('nebo_natal_test');
    expect(() => assertNatalTestDatabase('postgres://localhost/nebo')).toThrow('dedicated local');
    expect(() => assertNatalTestDatabase('postgres://production.example/nebo_natal_test')).toThrow('dedicated local');
  });
});

describeDatabase('natal persistence with real PostgreSQL transactions', () => {
  let pool: Pool;
  let service: typeof import('../lib/natalChartPersistence');
  let history: typeof import('../lib/astrologyHistoryStore');
  let userId: string;
  let sequence = 0;
  const originalDatabase = process.env.DATABASE_URL;
  const location = { lat: 55.75, lon: 37.62, timezone: 'Europe/Moscow' };
  const userIds = new Set<string>();
  const input = () => ({ userId, name: 'Natal test', birthDate: '1990-01-01', birthTime: '08:15', birthTimeMode: 'exact' as const, birthPlace: 'Москва', coordinates: location });

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    pool = (await import('../lib/db')).getPool();
    service = await import('../lib/natalChartPersistence');
    history = await import('../lib/astrologyHistoryStore');
    const schema = await pool.query("SELECT to_regclass('natal_chart_revisions') AS revisions");
    if (!schema.rows[0].revisions) throw new Error('Run database migrations on natal_test before integration tests');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    userId = String(Date.now() * 1000 + ++sequence);
    userIds.add(userId);
    await pool.query('INSERT INTO users(id,name,is_guest,is_blocked,birth_date,birth_time,birth_place) VALUES($1,$2,FALSE,FALSE,$3,$4,$5)', [userId, 'Natal test', '1990-01-01', '08:15', 'Москва']);
    mockGeocode.mockImplementation(async (_place: string, coordinates: any) => ({ ...location, ...coordinates }));
    mockSwiss.mockImplementation(async (_name: string, birthDate: string, _clock: string, birthPlace: string, options: any) => {
      const chart = canonicalNatalChart({ birthDate, birthPlace, time: options.birthTime, coordinates: options.coordinates });
      chart.calculationMetadata.calculatedAt = new Date(Date.UTC(2026, 8, 4, 12, 0, mockSwiss.mock.calls.length)).toISOString();
      await new Promise((resolve) => setTimeout(resolve, 5));
      return chart;
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (userId && pool) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  });
  afterAll(async () => {
    if (pool) {
      for (const id of userIds) await pool.query('DELETE FROM users WHERE id=$1', [id]);
      await pool.end();
    }
    if (originalDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabase;
  });

  it('executes Swiss once across concurrent initial writes and 100 subsequent reads/writes', async () => {
    const first = await Promise.all(Array.from({ length: 12 }, () => service.ensureCanonicalPrimaryChart(input())));
    const repeats = await Promise.all(Array.from({ length: 100 }, () => service.ensureCanonicalPrimaryChart({ ...input(), forceRecalculate: true })));
    expect(mockSwiss).toHaveBeenCalledTimes(1);
    expect(mockGeocode).toHaveBeenCalledTimes(1);
    expect(new Set([...first, ...repeats].map((result) => result.chart.id)).size).toBe(1);
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM natal_charts WHERE user_id=$1', [userId]);
    expect(count.rows[0].total).toBe(1);
  });

  it('enforces Free capacity while competing additions wait on the database lock', async () => {
    await service.ensureCanonicalPrimaryChart(input());
    const additions = await Promise.allSettled(Array.from({ length: 4 }, (_, index) => service.createOrReuseCanonicalChart({ ...input(), name: `Person ${index}`, birthDate: `199${index + 1}-01-01` })));
    expect(additions.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of additions) if (result.status === 'rejected') expect(result.reason.code).toBe('CHART_LIMIT_REACHED');
    expect(mockSwiss).toHaveBeenCalledTimes(2);
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM natal_charts WHERE user_id=$1', [userId]);
    expect(count.rows[0].total).toBe(2);
  });

  it('persists 20 Premium people and retains every chart when subscription expires', async () => {
    await service.ensureCanonicalPrimaryChart(input());
    await pool.query("UPDATE users SET premium_until=CURRENT_TIMESTAMP+INTERVAL '1 day' WHERE id=$1", [userId]);
    const people = await Promise.all(Array.from({ length: 20 }, (_, index) => service.createOrReuseCanonicalChart({ ...input(), name: `Person ${index}` })));
    await expect(service.createOrReuseCanonicalChart({ ...input(), name: 'Overflow' })).rejects.toMatchObject({ code: 'CHART_LIMIT_REACHED' });
    expect(new Set(people.map((person) => person.chart.id)).size).toBe(20);
    expect(mockSwiss).toHaveBeenCalledTimes(1);
    await pool.query("UPDATE users SET premium_until=CURRENT_TIMESTAMP-INTERVAL '1 day' WHERE id=$1", [userId]);
    await expect(service.updateCanonicalSavedChart(userId, people[1].chart.id, { ...input(), name: 'Locked person' })).rejects.toMatchObject({ code: 'PREMIUM_REQUIRED' });
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM natal_charts WHERE user_id=$1 AND archived_at IS NULL', [userId]);
    expect(count.rows[0].total).toBe(21);
  });

  it('retains revisions across birth changes, reuses an old birth input, and links slow AI history to its original chart', async () => {
    const original = await service.ensureCanonicalPrimaryChart(input());
    const changed = await service.ensureCanonicalPrimaryChart({ ...input(), birthDate: '1991-01-01' });
    expect(changed.chart.id).toBe(original.chart.id);
    const historySnapshot = await history.appendCalculationSnapshot({
      userId, subjectChartId: original.chart.id, surface: 'natal', inputHash: 'late-ai-cache-key',
      calculationVersion: original.chart.chart_data.calculationVersion, ephemerisSource: 'swisseph', birthTimeStatus: 'exact',
      calculationPayload: {}, evidencePayload: [], schemaVersion: 'history-v1', natalSourceChart: original.chart.chart_data,
    });
    const linked = await pool.query('SELECT input_hash FROM natal_chart_revisions WHERE id=$1', [historySnapshot.natalChartRevisionId]);
    expect(linked.rows[0].input_hash).toBe(original.chart.input_hash);
    const reverted = await service.ensureCanonicalPrimaryChart(input());
    expect(reverted.chart.input_hash).toBe(original.chart.input_hash);
    expect(mockSwiss).toHaveBeenCalledTimes(2);
    const repaired = await service.getOrCreateCanonicalNatalChart(input(), { subjectType: 'self', explicitRepair: true });
    expect(repaired.chart.input_hash).toBe(original.chart.input_hash);
    const revisions = await pool.query('SELECT input_hash,calculation_hash FROM natal_chart_revisions WHERE chart_id=$1', [original.chart.id]);
    expect(revisions.rows).toHaveLength(3);
    expect(new Set(revisions.rows.map((row) => row.calculation_hash)).size).toBe(3);
  });

  it('rolls back chart, revision and profile writes when the database rejects profile synchronization', async () => {
    const initial = await service.ensureCanonicalPrimaryChart(input());
    const constraint = `natal_test_profile_${userId}`;
    await pool.query(`ALTER TABLE users ADD CONSTRAINT ${constraint} CHECK(id <> ${userId} OR birth_date <> DATE '1991-01-01')`);
    try {
      await expect(service.ensureCanonicalPrimaryChart({ ...input(), birthDate: '1991-01-01' })).rejects.toThrow();
      const chart = await pool.query('SELECT input_hash,birth_date FROM natal_charts WHERE id=$1', [initial.chart.id]);
      const user = await pool.query('SELECT birth_date::text AS birth_date FROM users WHERE id=$1', [userId]);
      const revisions = await pool.query('SELECT COUNT(*)::int AS total FROM natal_chart_revisions WHERE chart_id=$1', [initial.chart.id]);
      expect(chart.rows[0].input_hash).toBe(initial.chart.input_hash);
      expect(user.rows[0].birth_date).toBe('1990-01-01');
      expect(revisions.rows[0].total).toBe(1);
    } finally {
      await pool.query(`ALTER TABLE users DROP CONSTRAINT ${constraint}`);
    }
  });
});
