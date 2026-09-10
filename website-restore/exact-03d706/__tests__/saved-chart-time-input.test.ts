import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('saved-person birth-time input contract', () => {
  it('requires a time for exact and approximate modes and clears it for unknown mode', () => {
    const view = read('views/MyCharts.tsx');

    expect(view).toContain("useState<SavedChartBirthTimeMode>('exact')");
    expect(view).toContain("{ value: 'exact', ru: 'Знаю', en: 'Exact' }");
    expect(view).toContain("{ value: 'approximate', ru: 'Примерно', en: 'Approximate' }");
    expect(view).toContain("{ value: 'unknown', ru: 'Не знаю', en: 'Unknown' }");
    expect(view).toContain("if (addTimeMode !== 'unknown' && !addTime) missingFields.push('time')");
    expect(view).toContain("if (option.value === 'unknown') setAddTime('')");
    expect(view).toContain("disabled={addTimeMode === 'unknown'}");
  });

  it('sends the selected mode and the product-standard 30-minute uncertainty', () => {
    const view = read('views/MyCharts.tsx');
    const storage = read('services/storageService.ts');

    expect(view).toContain('birthTimeMode: addTimeMode');
    expect(view).toContain("birthTimeUncertaintyMinutes: addTimeMode === 'approximate' ? 30 : null");
    expect(storage).toContain('birthTimeMode?: BirthTimeMode');
    expect(storage).toContain('birthTimeUncertaintyMinutes?: number | null');
  });

  it('requires manual compatibility time unless the active mode is unknown', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const api = read('pages/api/content/synastry/extended.ts');

    expect(room).toContain("subjectSource === 'birth' && sTimePrecision !== 'unknown' && !sTime");
    expect(room).toContain("partnerSource === 'birth' && fTimePrecision !== 'unknown' && !fTime");
    expect(api).toContain("birthTimeUncertaintyMinutes: input.birthTimeQuality === 'approximate' ? 30 : undefined");
    expect(api).toContain('createOrReuseCanonicalChart({');
    expect(api).not.toContain('swisseph-calculator');
  });
});
