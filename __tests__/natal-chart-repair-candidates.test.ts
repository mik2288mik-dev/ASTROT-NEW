import fs from 'fs';
import path from 'path';

const mockQuery = jest.fn();
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: (...args: unknown[]) => mockQuery(...args), on: jest.fn() })), Client: jest.fn() }));
jest.mock('../lib/database-url', () => ({ resolveDatabaseUrl: () => 'postgres://test:test@localhost/test' }));

import { db } from '../lib/db';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

function row(id: number | null, data: unknown = canonicalNatalChart()) {
  return { user_id: '42', chart_id: id, display_name: 'Анна', birth_date: '1990-01-01',
    birth_time: null, birth_place: 'Москва', input_hash: 'stored-input', chart_data: data,
    sun_sign: null, moon_sign: null, ascendant_sign: null, calculation_version: 'older-engine-version' };
}

describe('explicit natal repair selection', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('skips complete stored charts despite old calculator versions and empty legacy scalar columns', async () => {
    const unknown = canonicalNatalChart({ calculationVersion: 'old-supported-calculator', time: {
      mode: 'unknown', localTime: null, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null,
    } });
    mockQuery.mockResolvedValue({ rows: [row(1), row(2, unknown)] });

    expect(await db.natal_charts.listRepairCandidates()).toEqual([]);
  });

  it('selects missing and damaged calculations without borrowing the owner birth time', async () => {
    mockQuery.mockResolvedValue({ rows: [row(null, null), row(2, {}), { ...row(3), input_hash: null }, row(4)] });

    const result = await db.natal_charts.listRepairCandidates();

    expect(result.map((candidate) => candidate.chartId)).toEqual([null, 2, 3]);
    expect(result.every((candidate) => candidate.birthTime === '')).toBe(true);
  });

  it('scans beyond a full healthy page so healthy charts never consume the repair limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: Array.from({ length: 200 }, (_, index) => row(index + 1)) })
      .mockResolvedValueOnce({ rows: [row(201, {}), row(202, {})] });

    expect(await db.natal_charts.listRepairCandidates(1)).toMatchObject([{ chartId: 201 }]);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][1]).toEqual(['42', 200, 200]);
  });

  it('keeps maintenance dry by default and identifies the admin verification exception without birth data', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts/repair-canonical-natal-charts.ts'), 'utf8');
    const verify = fs.readFileSync(path.join(process.cwd(), 'pages/api/admin/v2/charts/verify.ts'), 'utf8');
    expect(script).toContain("const apply = args.includes('--apply')");
    expect(script).toMatch(/if \(apply\)\s*\{[\s\S]*await runMigrations\(\)/);
    expect(script.indexOf('if (!apply)')).toBeLessThan(script.indexOf('for (const candidate'));
    expect(verify).toContain("console.info('[natal/chart]', { chart_source: 'calculated', reason: 'admin_verify' })");
  });
});
