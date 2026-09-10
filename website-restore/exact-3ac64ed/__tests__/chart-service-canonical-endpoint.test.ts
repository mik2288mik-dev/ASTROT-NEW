import { readFileSync } from 'fs';
import { join } from 'path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('chart service canonical calculation endpoint', () => {
  it('calculates onboarding charts through the canonical charts endpoint', () => {
    const source = read('services/chartService.ts');

    expect(source).toContain("const url = '/api/charts';");
    expect(source).toContain('apiFetch(');
    expect(source).toContain('primary: true');
    expect(source).not.toContain('/api/astrology/natal-chart');
    expect(source).toContain('writeLocalNatalChart(profile, chart)');
  });
});
