import fs from 'fs';
import path from 'path';
import {
  buildFreePrewarmPlan,
  buildPremiumDailyReadinessMap,
  buildPremiumPrewarmPlan,
  buildUserPrewarmPlan,
  filterPremiumDailyReadinessTaskIds,
  planUsesContentGenerationLock,
  PREMIUM_DAILY_READINESS_SECTION_KEYS,
  PREMIUM_DAILY_READINESS_TASK_IDS,
} from '../lib/contentPrewarm';
import { buildContentGenerationLockKey } from '../lib/contentGenerationLock';
import { humanDailyCacheKey } from '../lib/natalHumanShared';
import { assertInterpretationContent, EMPTY_INTERPRETATION } from '../lib/contentInterpretation';
import { resetPrewarmSessionForTests, prewarmUserContent } from '../services/contentPrewarmService';

const ROOT = path.resolve(__dirname, '..');

jest.mock('../services/astrologyService', () => ({
  getCachedDailyForecastLayer: jest.fn().mockResolvedValue({ date: '2026-05-29', headline: 'h', summary: 's', chance: 'c', risk: 'r', focus: 'f', reading: 'r', context: 'c', advice: [] }),
  getCachedNatalAnchorLayer: jest.fn().mockResolvedValue({ title: 'anchor', summary: 's', sections: [] }),
  getCachedFullDaypartForecast: jest.fn().mockResolvedValue(null),
  getCachedWeeklyForecastLayer: jest.fn().mockResolvedValue(null),
  getCachedMonthlyForecastLayer: jest.fn().mockResolvedValue(null),
  getCachedPremiumNatalFullLayer: jest.fn().mockResolvedValue(null),
  getDailyForecastLayer: jest.fn(),
  getNatalAnchorLayer: jest.fn(),
  getFullDaypartForecast: jest.fn(),
  ensureWeeklyForecastLayer: jest.fn(),
  ensureMonthlyForecastLayer: jest.fn(),
  getPremiumNatalFullLayer: jest.fn(),
}));

jest.mock('../services/natalReadingService', () => ({
  getCachedHumanDailySection: jest.fn().mockResolvedValue(null),
  ensureHumanDailySection: jest.fn().mockResolvedValue({ content: { title: 't', content: 'c' } }),
}));

import {
  getCachedDailyForecastLayer,
  getDailyForecastLayer,
  getFullDaypartForecast,
  getPremiumNatalFullLayer,
  ensureWeeklyForecastLayer,
  ensureMonthlyForecastLayer,
} from '../services/astrologyService';
import { ensureHumanDailySection, getCachedHumanDailySection } from '../services/natalReadingService';

const profileFixture = {
  id: 'user-1',
  name: 'Test',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Moscow',
  isSetup: true,
  language: 'ru' as const,
  theme: 'dark' as const,
  isPremium: true,
  isAdmin: false,
  loginStreak: 0,
  chartSlots: 1,
};

const chartFixture = {
  sun: { sign: 'Aries', degree: 10 },
  moon: { sign: 'Taurus', degree: 20 },
  rising: { sign: 'Gemini', degree: 30 },
} as any;

describe('content prewarm', () => {
  beforeEach(() => {
    resetPrewarmSessionForTests();
    jest.clearAllMocks();
    (getCachedDailyForecastLayer as jest.Mock).mockResolvedValue({
      date: '2026-05-29',
      headline: 'h',
      summary: 's',
      chance: 'c',
      risk: 'r',
      focus: 'f',
      reading: 'r',
      context: 'c',
      advice: [],
    });
    (getCachedHumanDailySection as jest.Mock).mockResolvedValue(null);
  });

  it('Free startup prewarm plan contains forecast daily, natal anchor, daily_overview', () => {
    const plan = buildFreePrewarmPlan('2026-05-29');
    const ids = plan.map((item) => item.id);
    expect(ids).toContain('forecast_daily');
    expect(ids).toContain('natal_anchor');
    expect(ids).toContain('human_daily_overview');
  });

  it('Premium startup prewarm plan contains all Free items plus premium layers', () => {
    const free = buildFreePrewarmPlan('2026-05-29').map((item) => item.id);
    const premium = buildPremiumPrewarmPlan('2026-05-29').map((item) => item.id);
    for (const id of free) {
      expect(premium).toContain(id);
    }
    expect(premium).toContain('forecast_daypart_day');
    expect(premium).toContain('human_daily_love');
    expect(premium).toContain('human_daily_money');
  });

  it('Premium daily readiness scope is exactly the four critical daily sections', () => {
    expect([...PREMIUM_DAILY_READINESS_SECTION_KEYS]).toEqual([
      'daily_love',
      'daily_work_business',
      'daily_money',
      'daily_goals',
    ]);
    expect([...PREMIUM_DAILY_READINESS_TASK_IDS]).toEqual([
      'human_daily_love',
      'human_daily_work_business',
      'human_daily_money',
      'human_daily_goals',
    ]);
    expect(buildPremiumDailyReadinessMap(['human_daily_love', 'human_daily_goals'], 'preparing')).toEqual({
      daily_love: 'preparing',
      daily_goals: 'preparing',
    });
  });

  it('cache-only startup does not call generation methods', async () => {
    await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: profileFixture,
      chartData: chartFixture,
      isPremium: true,
      dateKey: '2026-05-29',
      mode: 'cache-only',
      blockingBudgetMs: 2_500,
    });

    expect(getDailyForecastLayer).not.toHaveBeenCalled();
    expect(getFullDaypartForecast).not.toHaveBeenCalled();
    expect(ensureHumanDailySection).not.toHaveBeenCalled();
    expect(getPremiumNatalFullLayer).not.toHaveBeenCalled();
    expect(ensureWeeklyForecastLayer).not.toHaveBeenCalled();
    expect(ensureMonthlyForecastLayer).not.toHaveBeenCalled();
  });

  it('Free generate-missing never generates Premium daily readiness sections', async () => {
    await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: { ...profileFixture, isPremium: false },
      chartData: chartFixture,
      isPremium: false,
      dateKey: '2026-05-29',
      mode: 'generate-missing',
      blockingBudgetMs: 120_000,
    });

    const generatedSections = (ensureHumanDailySection as jest.Mock).mock.calls.map((call) => call[1]);
    for (const key of PREMIUM_DAILY_READINESS_SECTION_KEYS) {
      expect(generatedSections).not.toContain(key);
    }
  });

  it('Premium readiness generation runs only missing critical daily tasks after cache probe', async () => {
    const cacheResult = await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: profileFixture,
      chartData: chartFixture,
      isPremium: true,
      dateKey: '2026-05-29',
      mode: 'cache-only',
      blockingBudgetMs: 2_500,
    });
    const missingCritical = filterPremiumDailyReadinessTaskIds(cacheResult.missingTaskIds);
    expect(missingCritical).toEqual([...PREMIUM_DAILY_READINESS_TASK_IDS]);

    jest.clearAllMocks();
    resetPrewarmSessionForTests();

    await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: profileFixture,
      chartData: chartFixture,
      isPremium: true,
      dateKey: '2026-05-29',
      mode: 'generate-missing',
      onlyTaskIds: missingCritical,
      blockingBudgetMs: 120_000,
    });

    const generatedSections = (ensureHumanDailySection as jest.Mock).mock.calls.map((call) => call[1]);
    expect(generatedSections).toEqual([...PREMIUM_DAILY_READINESS_SECTION_KEYS]);
    expect(getFullDaypartForecast).not.toHaveBeenCalled();
    expect(getPremiumNatalFullLayer).not.toHaveBeenCalled();
    expect(ensureWeeklyForecastLayer).not.toHaveBeenCalled();
    expect(ensureMonthlyForecastLayer).not.toHaveBeenCalled();
  });

  it('repeated startup with cached content does not call generation', async () => {
    await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: profileFixture,
      chartData: chartFixture,
      isPremium: true,
      dateKey: '2026-05-29',
      mode: 'cache-only',
    });
    jest.clearAllMocks();
    resetPrewarmSessionForTests();

    await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: profileFixture,
      chartData: chartFixture,
      isPremium: true,
      dateKey: '2026-05-29',
      mode: 'cache-only',
    });

    expect(getDailyForecastLayer).not.toHaveBeenCalled();
    expect(getFullDaypartForecast).not.toHaveBeenCalled();
    expect(ensureHumanDailySection).not.toHaveBeenCalled();
  });

  it('Premium startup skips background readiness when critical daily sections are cached', async () => {
    (getCachedHumanDailySection as jest.Mock).mockResolvedValue({ content: { title: 'cached', content: 'ready' } });

    const cacheResult = await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: profileFixture,
      chartData: chartFixture,
      isPremium: true,
      dateKey: '2026-05-29',
      mode: 'cache-only',
      blockingBudgetMs: 2_500,
    });

    expect(filterPremiumDailyReadinessTaskIds(cacheResult.missingTaskIds)).toEqual([]);
    expect(filterPremiumDailyReadinessTaskIds(cacheResult.cachedTaskIds)).toEqual([...PREMIUM_DAILY_READINESS_TASK_IDS]);
    expect(ensureHumanDailySection).not.toHaveBeenCalled();
  });

  it('human-daily prewarm and Horoscope use the same cacheKey', () => {
    const dateKey = '2026-05-29';
    const loveItem = buildPremiumPrewarmPlan(dateKey).find((item) => item.id === 'human_daily_love');
    expect(loveItem?.cacheKey).toBe(humanDailyCacheKey(dateKey, 'daily_love'));
    expect(loveItem?.accessTier).toBe('premium');
    expect(loveItem?.contentVariant).toBe('living');

    const daypartItem = buildPremiumPrewarmPlan(dateKey).find((item) => item.id === 'forecast_daypart_day');
    expect(daypartItem?.cacheKey).toBe(`${dateKey}:day`);
    expect(daypartItem?.accessTier).toBe('premium');
  });

  it('forecast daily prewarm uses content generation lock on API', () => {
    const item = buildUserPrewarmPlan(false, '2026-05-29').find((row) => row.id === 'forecast_daily');
    expect(item).toBeDefined();
    expect(planUsesContentGenerationLock(item!)).toBe(true);
    const key = buildContentGenerationLockKey({
      userId: 'user-1',
      chartId: 7,
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'daily',
      cacheKey: '2026-05-29',
    });
    expect(key).toContain('content-generation:7:free:forecast:daily:2026-05-29');
  });

  it('App startup uses cache-only first, then critical Premium daily readiness in background', () => {
    const source = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    expect(source).toContain("mode: 'cache-only'");
    expect(source).not.toContain('blockingBudgetMs: 38_000');
    expect(source).toContain('getPrimaryChartId');
    expect(source).toContain('startPremiumDailyReadinessPrewarm');
    expect(source).toContain('filterPremiumDailyReadinessTaskIds');
    expect(source).toContain("mode: 'generate-missing'");
    expect(source).toContain('onlyTaskIds: missingTaskIds');
    expect(source).toContain('PREMIUM_DAILY_READINESS_TASK_IDS');
    expect(source).not.toContain('ENABLE_AUTO_BACKGROUND_PREWARM_GENERATION');
    const flags = fs.readFileSync(path.join(ROOT, 'lib/appStartupFlags.ts'), 'utf8');
    expect(flags).not.toContain('ENABLE_AUTO_BACKGROUND_PREWARM_GENERATION');
  });

  it('ordinary app startup delegates generate-missing only to premium daily readiness helper', () => {
    const source = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    const loadDataBlock = source.match(/const loadData = async[\s\S]*?void loadData\(\)/)?.[0] ?? '';
    expect(loadDataBlock).toContain("mode: 'cache-only'");
    expect(loadDataBlock).toContain('startPremiumDailyReadinessPrewarm');
    expect(loadDataBlock).not.toContain('onlyTaskIds: cacheResult.missingTaskIds');
  });

  it('human-daily endpoint uses withContentGenerationLock', () => {
    const source = fs.readFileSync(path.join(ROOT, 'pages/api/content/natal/human-daily.ts'), 'utf8');
    expect(source).toContain('withContentGenerationLock');
    expect(source).toContain('readCached');
  });

  it('services throw EMPTY_INTERPRETATION when interpretation.content is missing', () => {
    expect(() => assertInterpretationContent({ interpretation: { content: null } })).toThrow();
    try {
      assertInterpretationContent({ interpretation: { content: null } });
    } catch (error: any) {
      expect(error.code).toBe(EMPTY_INTERPRETATION);
    }
  });

  it('natalReadingService treats 202 as an error, not ready content', () => {
    const source = fs.readFileSync(path.join(ROOT, 'services/natalReadingService.ts'), 'utf8');
    expect(source).toContain("response.status === 202");
    expect(source).toContain('GENERATION_IN_PROGRESS');
    expect(source).toContain('EMPTY_INTERPRETATION');
  });

  it('user-facing views avoid forbidden system copy', () => {
    const forbidden = [
      /Ежедневная интерпретация/i,
      /Premium-слой/i,
      /не общий гороскоп/i,
      /по карте рождения и текущей дате/i,
      /повторного списания/i,
    ];
    const targets = ['views/Horoscope.tsx', 'components/NatalReading/HumanReport.tsx', 'lib/natalHumanShared.ts'];
    for (const rel of targets) {
      const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it('Premium daily cards use cache-first then on-demand generation', () => {
    const horoscope = fs.readFileSync(path.join(ROOT, 'views/Horoscope.tsx'), 'utf8');
    expect(horoscope).toContain('getCachedHumanDailySection');
    expect(horoscope).toContain('ensureHumanDailySection');
    expect(horoscope).toContain('resolveDailySectionKey');
    expect(horoscope).toContain('daily_money');

    const humanReport = fs.readFileSync(path.join(ROOT, 'components/NatalReading/HumanReport.tsx'), 'utf8');
    const cachedDailyBlock = humanReport.match(/const openDailyCachedSection[\s\S]*?if \(loading\)/)?.[0] ?? '';
    expect(cachedDailyBlock).toContain('getCachedHumanDailySection');
    expect(cachedDailyBlock).toContain('ensureHumanDailySection');

    const dashboard = fs.readFileSync(path.join(ROOT, 'views/Dashboard.tsx'), 'utf8');
    expect(dashboard).toContain("dailySectionKey: 'daily_money'");
    expect(dashboard).toContain("dailySectionKey: 'daily_work_business'");
    expect(dashboard).toContain("dailySectionKey: 'daily_goals'");

    expect(horoscope).toContain('PREMIUM_HUMAN_HYDRATE_KEYS');
    expect(horoscope).toMatch(/PREMIUM_HUMAN_HYDRATE_KEYS[\s\S]*'daily_goals'/);
  });
});
