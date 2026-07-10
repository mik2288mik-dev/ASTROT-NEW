import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('product daily navigation', () => {
  it('App uses a single personal_daily view and maps old daily links into it', () => {
    const source = read('App.tsx');

    expect(source).toContain('PersonalDailyScreen');
    expect(source).toContain('const openPersonalDailyView = useCallback');
    expect(source).toContain("navigateTo('personal_daily')");
    expect(source).toContain("view === 'personal_daily'");
    expect(source).toContain("daily_love: 'personal_daily'");
    expect(source).toContain("case 'daily_love':");
    expect(source).not.toContain('DailyLoveScreen');
    expect(source).not.toContain('DailyMoneyScreen');
    expect(source).not.toContain('DailyWorkScreen');
    expect(source).not.toContain('DailyGoalsScreen');
    expect(source).not.toContain("view === 'daily_love'");
    expect(source).not.toContain("view === 'personal_forecast'");
    expect(source).not.toContain("view === 'oracle'");
    expect(source).not.toContain("view === 'hook'");
  });

  it('PersonalDailyScreen owns the personal day sections without chat or one-off unlocks', () => {
    const source = read('views/DailyContentScreens.tsx');

    expect(source).toContain('export const PersonalDailyScreen');
    for (const id of ['overview', 'love', 'money', 'work', 'goals', 'family', 'friends']) {
      expect(source).toContain(`id: '${id}'`);
    }
    expect(source).toContain('loadHumanDailySection');
    expect(source).not.toContain('ensureFullDaypartForecast');
    expect(source).not.toContain('export const DailyLoveScreen');
    expect(source).not.toContain('<Horoscope');
    expect(source).not.toMatch(/Stars|one-off|requestStars/i);
    expect(source).not.toContain('onOpenOracle');
  });

  it('HoroscopeReader keeps general sign horoscopes separate from personal daily generation', () => {
    const source = read('views/v2/HoroscopeReader.tsx');

    expect(source).toContain('ZODIAC_KEYS');
    expect(source).toContain('ensureDailySignHoroscope');
    expect(source).toContain('getCachedDailySignHoroscope');
    expect(source).not.toContain('loadHumanDailySection');
    expect(source).not.toContain('ensureFullDaypartForecast');
    expect(source).not.toContain('PremiumDailyReadiness');
  });
});
