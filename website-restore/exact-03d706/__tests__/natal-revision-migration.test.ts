const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockEnd = jest.fn();

jest.mock('../lib/database-url', () => ({ resolveDatabaseUrl: () => 'postgres://local-test' }));
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: (...args: unknown[]) => mockQuery(...args),
    connect: async () => ({ query: (...args: unknown[]) => mockQuery(...args), release: mockRelease }),
    end: mockEnd,
  })),
}));

import { runMigrations } from '../lib/migrations';

describe('natal revision migration', () => {
  const migrationName = 'mvp_053_natal_chart_revisions';
  const applied = new Set<string>();

  beforeEach(() => {
    jest.clearAllMocks();
    applied.clear();
    mockEnd.mockResolvedValue(undefined);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockQuery.mockImplementation(async (sql: string, values: unknown[] = []) => {
      if (sql.includes('SELECT COUNT(*) FROM migrations')) {
        return { rows: [{ count: values[0] !== migrationName || applied.has(String(values[0])) ? '1' : '0' }] };
      }
      if (sql.includes('INSERT INTO migrations (name)') && values[0] === migrationName) applied.add(migrationName);
      if (sql.includes('SELECT EXISTS')) return { rows: [{ exists: true }] };
      return { rows: [], rowCount: 0 };
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('preserves populated tables, records existing snapshots, and applies once', async () => {
    await runMigrations();

    const statements = mockQuery.mock.calls.map(([sql]) => String(sql));
    const create = statements.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS natal_chart_revisions'))!;
    const snapshot = statements.find((sql) => sql.includes('INSERT INTO natal_chart_revisions'))!;
    expect(create).toContain('chart_data JSONB NOT NULL');
    expect(create).toContain('UNIQUE (chart_id, input_hash, calculation_hash)');
    expect(snapshot).toContain('FROM natal_charts');
    expect(snapshot).toContain('ON CONFLICT (chart_id, input_hash, calculation_hash) DO NOTHING');
    expect(snapshot).toContain('md5(chart_data::text)');
    expect(statements.some((sql) => /(?:DELETE FROM|TRUNCATE|UPDATE) natal_charts/.test(sql))).toBe(false);
    expect(statements.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS natal_chart_revision_id'))).toBe(true);
    expect(applied.has(migrationName)).toBe(true);

    mockQuery.mockClear();
    await runMigrations();
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO natal_chart_revisions'))).toBe(false);
    expect(mockRelease).toHaveBeenCalledTimes(2);
    expect(mockEnd).toHaveBeenCalledTimes(2);
  });

  it('does not mark a failed snapshot backfill as applied and releases the deployment lock', async () => {
    const normalQuery = mockQuery.getMockImplementation()!;
    mockQuery.mockImplementation(async (sql: string, values: unknown[] = []) => {
      if (sql.includes('INSERT INTO natal_chart_revisions')) throw new Error('database unavailable');
      return normalQuery(sql, values);
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runMigrations()).rejects.toThrow('database unavailable');

    expect(applied.has(migrationName)).toBe(false);
    expect(mockQuery).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', expect.any(Array));
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});
