import { readFileSync } from 'fs';
import { join } from 'path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('canonical natal chart persistence flow', () => {
  it('calculates through Swiss Ephemeris and persists the primary chart', () => {
    const persistence = read('lib/natalChartPersistence.ts');
    const api = read('pages/api/charts/index.ts');

    expect(persistence).toContain("import { calculateNatalChart, resolveBirthCoordinates } from './swisseph-calculator';");
    expect(persistence).toContain('await calculateNatalChart(');
    expect(persistence).toContain('await db.natal_charts.persistPrimary');
    expect(api).toContain('ensureCanonicalPrimaryChart({');
    expect(api).toContain("persistChartIdentity(result.chart, 'self', null)");
  });

  it('never accepts a client chart payload as the canonical calculation', () => {
    const persistence = read('lib/natalChartPersistence.ts');
    const legacyApi = read('pages/api/charts/[id].ts');

    expect(persistence).not.toContain('isCanonicalNatalChartDataComplete(args.chartData)');
    expect(legacyApi).toContain('ensureCanonicalPrimaryChart({');
    expect(legacyApi).not.toContain('db.natal_charts.set(');
  });
});
