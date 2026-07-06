import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Horoscope product flow', () => {
  it('keeps sign reader distinct from personal daily and supports sign picker', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    // Inline horizontal sign selector (replaced the bottom-sheet picker)
    expect(source).toContain('FreshSignCarousel');
    expect(source).toContain('ensureDailySignHoroscope');
    expect(source).toContain('getCachedDailySignHoroscope');
    expect(source).toContain('ensureWeeklySignHoroscope');
    expect(source).toContain('ZODIAC_KEYS');
    expect(source).not.toContain('loadHumanDailySection');
  });

  it('uses sign persistence and profile update on sign change', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    expect(source).toContain('selectedZodiacSign: normalized');
    expect(source).toContain('saveProfile(updated)');
    expect(source).toContain('lumia:selected-zodiac-sign');
  });

  it('exposes Zodiac and keeps Ask out of bottom tabs', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    expect(tabs).toContain("id: 'zodiac'");
    expect(tabs).toContain("active: view === 'horoscope'");
    expect(tabs).not.toContain("id: 'ask'");
    expect(tabs).not.toContain("active: view === 'oracle'");
    expect(tabs).toContain("'dashboard', 'horoscope', 'chart', 'synastry', 'settings'");
  });

  it('caches weekly sign content in shared content_cache scope', () => {
    const weekly = read('lib/horoscope/signWeekly.ts');
    expect(weekly).toContain("content_type = 'sign_weekly_horoscope'");
    expect(weekly).toContain("VALUES ('sign_weekly_horoscope'");
    expect(weekly).not.toContain('user_id =');
    expect(weekly).not.toContain('chart_id =');
  });
});
