import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('birth-time honesty', () => {
  it('keeps an unknown time nullable in the legacy self-chart route', () => {
    const route = read('pages/api/charts/[id].ts');

    expect(route).toContain("const birthTime = user?.birth_time || ''");
    expect(route).toContain('birthTime,');
    expect(route).not.toContain("birthTime || '12:00'");
    expect(route).not.toContain('normalizedBirthTime');
  });

  it('uses noon only as a disclosed calculation reference and never repairs invalid input', () => {
    const calculator = read('lib/swisseph-calculator.ts');

    expect(calculator).toContain("housesComputedFrom: birthTimeQuality === 'exact' ? 'exact_time' : 'default_noon'");
    expect(calculator).toContain("throw new Error('Invalid birth time format. Expected HH:MM in 24-hour time')");
    expect(calculator).toContain('Ascendant and houses are omitted from interpretation because birth time is unknown.');
    expect(calculator).not.toContain('using 12:00');
  });
});
