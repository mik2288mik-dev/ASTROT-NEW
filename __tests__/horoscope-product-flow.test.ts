import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Horoscope product flow', () => {
  it('keeps sign and personal modes distinct and supports another sign plus today/week', () => {
    const source = read('views/Horoscope.tsx');
    expect(source).toContain("type HoroscopeMode = 'sign' | 'personal'");
    expect(source).toContain("type SignPeriod = 'today' | 'week'");
    expect(source).toContain("'Другой знак'");
    expect(source).toContain("'По знаку'");
    expect(source).toContain("'Личный день'");
    expect(source).toContain('ZODIAC_SIGNS.map');
  });

  it('uses accessMatrix for personal day gates and persists selected sign', () => {
    const source = read('views/Horoscope.tsx');
    expect(source).toContain("canAccessFeature('personal_daily'");
    expect(source).toContain('selectedZodiacSign: sign');
    expect(source).toContain('saveProfile(updated)');
    expect(source).toContain('lumia:selected-zodiac-sign');
  });

  it('exposes Horoscope as a bottom tab', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    expect(tabs).toContain("id: 'horoscope'");
    expect(tabs).toContain("active: view === 'horoscope'");
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
