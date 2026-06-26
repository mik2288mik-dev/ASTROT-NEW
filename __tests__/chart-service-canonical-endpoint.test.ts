import { readFileSync } from 'fs';
import { join } from 'path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('chart service canonical calculation endpoint', () => {
  it('calculates onboarding charts through the primary-chart repair endpoint', () => {
    const source = read('services/chartService.ts');

    expect(source).toContain('const url = `${API_BASE_URL}/api/astrology/natal-chart`;');
    expect(source).toContain('partial saves');
    expect(source).toContain('writeLocalNatalChart(profile, chart)');
  });
});
