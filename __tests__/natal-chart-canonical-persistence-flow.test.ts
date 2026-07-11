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
    expect(api).toContain('return res.status(200).json(result.chart);');
  });
});
