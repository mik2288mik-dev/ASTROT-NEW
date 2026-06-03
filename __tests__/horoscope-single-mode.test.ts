import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('premium daily card navigation', () => {
  it('Dashboard quick action cards open separate daily views, not Horoscope layers', () => {
    const source = read('views/Dashboard.tsx');

    expect(source).toContain("openHoroscope('sign', { mode: 'single', source: 'home_card_today' })");
    expect(source).toContain("openPremiumDaily('daily_love')");
    expect(source).toContain("openPremiumDaily('daily_money')");
    expect(source).toContain("openPremiumDaily('daily_work')");
    expect(source).toContain("openPremiumDaily('daily_goals')");
    expect(source).toContain("openPremiumDaily('personal_forecast')");
    expect(source).toContain('onOpenPremiumDaily: (view: PremiumDailyViewState) => void');
    expect(source).not.toContain("openHoroscope('love'");
    expect(source).not.toContain("openHoroscope('work_money'");
    expect(source).not.toContain("openHoroscope('chart', { mode: 'single', source: 'home_card_rhythm' })");
  });

  it('App has explicit daily view states and renders dedicated screens', () => {
    const source = read('App.tsx');

    expect(source).toContain('DailyLoveScreen');
    expect(source).toContain('DailyMoneyScreen');
    expect(source).toContain('DailyWorkScreen');
    expect(source).toContain('DailyGoalsScreen');
    expect(source).toContain('PersonalForecastScreen');
    expect(source).toContain('const openPremiumDailyView = useCallback((dailyView: PremiumDailyViewState)');
    expect(source).toContain('navigateTo(dailyView)');
    expect(source).toContain("view === 'daily_love'");
    expect(source).toContain("view === 'daily_money'");
    expect(source).toContain("view === 'daily_work'");
    expect(source).toContain("view === 'daily_goals'");
    expect(source).toContain("view === 'personal_forecast'");
    expect(source).toContain('onOpenPremiumDaily={openPremiumDailyView}');
    expect(source).toContain("openPremiumDailyView('daily_love')");
    expect(source).toContain("openPremiumDailyView('personal_forecast')");
  });

  it('dedicated daily screens own their content keys and loaders', () => {
    const source = read('views/DailyContentScreens.tsx');

    expect(source).toContain('export const DailyLoveScreen');
    expect(source).toContain('export const DailyMoneyScreen');
    expect(source).toContain('export const DailyWorkScreen');
    expect(source).toContain('export const DailyGoalsScreen');
    expect(source).toContain('export const PersonalForecastScreen');
    expect(source).toContain('sectionKey="daily_love"');
    expect(source).toContain('sectionKey="daily_money"');
    expect(source).toContain('sectionKey="daily_work_business"');
    expect(source).toContain('sectionKey="daily_goals"');
    expect(source).toContain('loadHumanDailySection');
    expect(source).toContain('ensureFullDaypartForecast');
    expect(source).toContain('maxInProgressRetries: 45');
    expect(source).not.toContain('layers.map');
    expect(source).not.toContain('<Horoscope');
    expect(source).not.toMatch(/Stars|one-off|requestStars/i);
    expect(source).not.toMatch(/Готовим|Вернись позже|Повторить|Этот раздел сейчас недоступен/);
  });

  it('daily generators are split by section and routed from the legacy entrypoint', () => {
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
    expect(source).toContain('return generateDailyLoveSection(profile, chart, dateKey)');
  });

  it('generation endpoints keep lock/cache behavior and save fallbacks instead of empty screens', () => {
    const humanDaily = read('pages/api/content/natal/human-daily.ts');
    expect(humanDaily).toContain('withContentGenerationLock');
    expect(humanDaily).toContain('readCached');
    expect(humanDaily).toContain('buildHumanDailyFallback');
    expect(humanDaily).toContain("source: 'fallback'");

    const daypart = read('pages/api/content/forecast/daypart.ts');
    expect(daypart).toContain('withContentGenerationLock');
    expect(daypart).toContain('readCached');
    expect(daypart).toContain('allowStaticFallback: true');
  });
});
