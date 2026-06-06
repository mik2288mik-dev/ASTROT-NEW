import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('product daily navigation', () => {
  it('Dashboard quick action cards open one personal_daily screen with focused tabs', () => {
    const source = read('views/Dashboard.tsx');

    expect(source).toContain("openHoroscope('sign', { mode: 'single', source: 'home_card_today' })");
    expect(source).toContain("openPersonalDaily('money')");
    expect(source).toContain("openPersonalDaily('overview')");
    expect(source).toContain('onOpenPersonalDaily: (section?: PersonalDailySection) => void');
    expect(source).not.toContain('onOpenPremiumDaily');
    expect(source).not.toContain("openPremiumDaily('daily_love')");
    expect(source).not.toContain("openHoroscope('love'");
    expect(source).not.toContain("openHoroscope('work_money'");
  });

  it('App uses a single personal_daily view and maps legacy daily links to it', () => {
    const source = read('App.tsx');

    expect(source).toContain('PersonalDailyScreen');
    expect(source).toContain('const openPersonalDailyView = useCallback');
    expect(source).toContain("navigateTo('personal_daily')");
    expect(source).toContain("view === 'personal_daily'");
    expect(source).toContain('onOpenPersonalDaily={openPersonalDailyView}');
    expect(source).toContain("daily_love: 'personal_daily'");
    expect(source).toContain("case 'daily_love':");
    expect(source).not.toContain('DailyLoveScreen');
    expect(source).not.toContain('DailyMoneyScreen');
    expect(source).not.toContain('DailyWorkScreen');
    expect(source).not.toContain('DailyGoalsScreen');
    expect(source).not.toContain("view === 'daily_love'");
    expect(source).not.toContain("view === 'personal_forecast'");
  });

  it('PersonalDailyScreen owns the personal day tabs and content keys', () => {
    const source = read('views/DailyContentScreens.tsx');

    expect(source).toContain('export const PersonalDailyScreen');
    expect(source).toContain("id: 'love'");
    expect(source).toContain("sectionKey: 'daily_love'");
    expect(source).toContain("sectionKey: 'daily_money'");
    expect(source).toContain("sectionKey: 'daily_work_business'");
    expect(source).toContain("sectionKey: 'daily_goals'");
    expect(source).toContain('loadHumanDailySection');
    expect(source).toContain('ensureFullDaypartForecast');
    expect(source).not.toContain('export const DailyLoveScreen');
    expect(source).not.toContain('layers.map');
    expect(source).not.toContain('<Horoscope');
    expect(source).not.toMatch(/Stars|one-off|requestStars/i);
    expect(source).not.toMatch(/LUMIA не получила|Вернись позже|Повторить/);
  });

  it('Horoscope keeps personal generation in PersonalDailyScreen', () => {
    const source = read('views/Horoscope.tsx');

    expect(source).toContain('ZODIAC_SIGNS');
    expect(source).toContain('ensureDailySignHoroscope');
    expect(source).toContain('getCachedDailySignHoroscope');
    expect(source).not.toContain('loadHumanDailySection');
    expect(source).not.toContain('ensureFullDaypartForecast');
    expect(source).not.toContain('layers.map');
    expect(source).not.toContain('daily_love');
    expect(source).not.toContain('work_money');
    expect(source).not.toContain('PremiumDailyReadiness');
  });

  it('daily generators remain split by product section', () => {
    const source = read('lib/natalHumanInterpretation.ts');

    expect(source).toContain('function buildDailyLovePrompt');
    expect(source).toContain('function buildDailyMoneyPrompt');
    expect(source).toContain('function buildDailyWorkPrompt');
    expect(source).toContain('function buildDailyGoalsPrompt');
    expect(source).toContain('export async function generateDailyLoveSection');
    expect(source).toContain('export async function generateDailyMoneySection');
    expect(source).toContain('export async function generateDailyWorkSection');
    expect(source).toContain('export async function generateDailyGoalsSection');
    expect(source).toContain("case 'daily_love'");
    expect(source).toContain("case 'daily_money'");
    expect(source).toContain("case 'daily_work_business'");
    expect(source).toContain("case 'daily_goals'");
  });
});
