import fs from 'fs';
import path from 'path';
import {
  buildFreePrewarmPlan,
  buildPremiumPrewarmPlan,
  buildUserPrewarmPlan,
  getStartupRequiredTaskIds,
  planUsesContentGenerationLock,
  FREE_STARTUP_REQUIRED_TASK_IDS,
  PREMIUM_STARTUP_REQUIRED_TASK_IDS,
} from '../lib/contentPrewarm';
import { buildContentGenerationLockKey } from '../lib/contentGenerationLock';
import { assertInterpretationContent, EMPTY_INTERPRETATION } from '../lib/contentInterpretation';
import { resetPrewarmSessionForTests, prewarmUserContent } from '../services/contentPrewarmService';

const ROOT = path.resolve(__dirname, '..');

jest.mock('../services/astrologyService', () => ({
  getCachedDailyForecastLayer: jest.fn().mockResolvedValue(null),
  getCachedDailySignHoroscope: jest.fn().mockResolvedValue({ date: '2026-05-29', headline: 'h', summary: 's', chance: 'c', risk: 'r', focus: 'f', reading: 'r', context: 'c', advice: [] }),
  getCachedNatalAnchorLayer: jest.fn().mockResolvedValue(null),
  getCachedFullDaypartForecast: jest.fn().mockResolvedValue(null),
  getCachedWeeklyForecastLayer: jest.fn().mockResolvedValue(null),
  getCachedMonthlyForecastLayer: jest.fn().mockResolvedValue(null),
  getCachedPremiumNatalFullLayer: jest.fn().mockResolvedValue(null),
  getDailyForecastLayer: jest.fn(),
  ensureDailySignHoroscope: jest.fn().mockResolvedValue({ reading: 'generated' }),
  getNatalAnchorLayer: jest.fn(),
  getFullDaypartForecast: jest.fn().mockResolvedValue(undefined),
  ensureWeeklyForecastLayer: jest.fn(),
  ensureMonthlyForecastLayer: jest.fn(),
  getPremiumNatalFullLayer: jest.fn(),
}));

jest.mock('../services/natalReadingService', () => ({
  getCachedHumanBaseReport: jest.fn().mockResolvedValue(null),
  ensureHumanBaseReport: jest.fn(),
  getCachedHumanDailySection: jest.fn().mockResolvedValue(null),
  ensureHumanDailySection: jest.fn(),
  getCachedHumanPaidSection: jest.fn().mockResolvedValue(null),
  loadHumanPaidSection: jest.fn(),
}));

import {
  getCachedDailySignHoroscope,
  getCachedFullDaypartForecast,
  getDailyForecastLayer,
  ensureDailySignHoroscope,
  getFullDaypartForecast,
  getPremiumNatalFullLayer,
  ensureWeeklyForecastLayer,
  ensureMonthlyForecastLayer,
} from '../services/astrologyService';
import {
  ensureHumanBaseReport,
  ensureHumanDailySection,
  getCachedHumanBaseReport,
  getCachedHumanDailySection,
  getCachedHumanPaidSection,
  loadHumanPaidSection,
} from '../services/natalReadingService';

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
    (getCachedDailySignHoroscope as jest.Mock).mockResolvedValue({
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
    (getCachedFullDaypartForecast as jest.Mock).mockResolvedValue(null);
    (getCachedHumanBaseReport as jest.Mock).mockResolvedValue(null);
    (getCachedHumanDailySection as jest.Mock).mockResolvedValue(null);
    (getCachedHumanPaidSection as jest.Mock).mockResolvedValue(null);
  });

  it('Free startup prewarm plan contains only the sign horoscope probe', () => {
    const ids = buildFreePrewarmPlan('2026-05-29').map((item) => item.id);
    expect(ids).toEqual(['sign_daily']);
    expect(ids).not.toContain('forecast_daily');
    expect(ids).not.toContain('human_base');
    expect(ids).not.toContain('human_daily_overview');
    expect(ids).not.toContain('human_daily_love');
  });

  it('Premium startup prewarm probes sign horoscope and cached personal day only', () => {
    const ids = buildPremiumPrewarmPlan('2026-05-29').map((item) => item.id);
    expect(ids).toEqual(['sign_daily', 'forecast_daypart_day']);
    expect(ids).not.toContain('human_daily_love');
    expect(ids).not.toContain('human_daily_money');
    expect(ids).not.toContain('human_paid_work_business');
    expect(ids).not.toContain('human_paid_love_relationships');
  });

  it('startup required task scope is tiny for quick app entry', () => {
    expect([...FREE_STARTUP_REQUIRED_TASK_IDS]).toEqual(['sign_daily']);
    expect([...PREMIUM_STARTUP_REQUIRED_TASK_IDS]).toEqual(['sign_daily']);
    expect(getStartupRequiredTaskIds(false)).toEqual(['sign_daily']);
    expect(getStartupRequiredTaskIds(true)).toEqual(['sign_daily']);
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

    expect(ensureDailySignHoroscope).not.toHaveBeenCalled();
    expect(getDailyForecastLayer).not.toHaveBeenCalled();
    expect(ensureHumanBaseReport).not.toHaveBeenCalled();
    expect(getFullDaypartForecast).not.toHaveBeenCalled();
    expect(ensureHumanDailySection).not.toHaveBeenCalled();
    expect(loadHumanPaidSection).not.toHaveBeenCalled();
    expect(getPremiumNatalFullLayer).not.toHaveBeenCalled();
    expect(ensureWeeklyForecastLayer).not.toHaveBeenCalled();
    expect(ensureMonthlyForecastLayer).not.toHaveBeenCalled();
  });

  it('Free generate-missing never generates Premium personal daily sections', async () => {
    (getCachedDailySignHoroscope as jest.Mock).mockResolvedValue(null);

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

    expect(ensureDailySignHoroscope).toHaveBeenCalledTimes(1);
    expect(ensureHumanDailySection).not.toHaveBeenCalled();
    expect(getFullDaypartForecast).not.toHaveBeenCalled();
    expect(loadHumanPaidSection).not.toHaveBeenCalled();
  });

  it('Premium generate-missing does not fill daily love/work/money/goals or paid natal sections', async () => {
    (getCachedDailySignHoroscope as jest.Mock).mockResolvedValue(null);

    await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: profileFixture,
      chartData: chartFixture,
      isPremium: true,
      dateKey: '2026-05-29',
      mode: 'generate-missing',
      blockingBudgetMs: 120_000,
    });

    expect(ensureDailySignHoroscope).toHaveBeenCalledTimes(1);
    expect(getFullDaypartForecast).toHaveBeenCalledTimes(1);
    expect(ensureHumanDailySection).not.toHaveBeenCalled();
    expect(loadHumanPaidSection).not.toHaveBeenCalled();
  });

  it('repeated startup with cached content does not call generation', async () => {
    (getCachedFullDaypartForecast as jest.Mock).mockResolvedValue({ summary: 'cached' });

    await prewarmUserContent({
      userId: 'user-1',
      chartId: 42,
      profile: profileFixture,
      chartData: chartFixture,
      isPremium: true,
      dateKey: '2026-05-29',
      mode: 'generate-missing',
    });

    expect(ensureDailySignHoroscope).not.toHaveBeenCalled();
    expect(getFullDaypartForecast).not.toHaveBeenCalled();
    expect(ensureHumanDailySection).not.toHaveBeenCalled();
    expect(loadHumanPaidSection).not.toHaveBeenCalled();
  });

  it('sign daily prewarm uses content generation lock on API', () => {
    const item = buildUserPrewarmPlan(false, '2026-05-29').find((row) => row.id === 'sign_daily');
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

  it('App startup uses cache-only DB probe without background generation', () => {
    const source = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    expect(source).toContain('prepareUserContentDbFirst');
    expect(source).toContain("mode: 'cache-only'");
    expect(source).not.toContain("mode: 'generate-missing'");
    expect(source).not.toContain('awaitGeneration');
    expect(source).not.toContain('backgroundPrewarmKeyRef');
    expect(source).toContain('CACHE_ONLY_PREWARM_BUDGET_MS');
    expect(source).toContain('STARTUP_SAFETY_TIMEOUT_MS');
    expect(source).toContain('getPrimaryChartId');
  });

  it('Dashboard stays mounted while navigating away from home', () => {
    const source = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    expect(source).toContain("view === 'dashboard' ? 'flex h-full min-h-0 overflow-hidden' : 'hidden'");
    expect(source).toContain('<Dashboard');
    expect(source).toContain('chartId={primaryChartId}');
    expect(source).toContain('setPrimaryChartId(primaryChartId)');
  });

  it('Horoscope keeps sign content separate while PersonalDaily renders the startup package', () => {
    const horoscope = fs.readFileSync(path.join(ROOT, 'views/v2/HoroscopeReader.tsx'), 'utf8');
    expect(horoscope).toContain('ensureDailySignHoroscope');
    expect(horoscope).not.toContain('loadHumanDailySection');
    expect(horoscope).not.toContain('daily_love');
    expect(horoscope).not.toContain('layers.map');

    const personalDaily = fs.readFileSync(path.join(ROOT, 'views/DailyContentScreens.tsx'), 'utf8');
    expect(personalDaily).toContain('PersonalDailyScreen');
    expect(personalDaily).not.toContain('loadHumanDailySection');
    expect(personalDaily).toContain('dailyPackage: DailyCanvas | null');
    expect(personalDaily).toContain('sectionFromDailyCanvas');
    // Вкладка «День» теперь читает summary/do/dont из ЕДИНОГО полотна (daily_overview),
    // а не из старого daypart-генератора — источник personal-текста только canvas.
    expect(personalDaily).toContain("sectionKey: 'daily_overview'");
    expect(personalDaily).not.toContain('ensureFullDaypartForecast');
    expect(personalDaily).toContain("sectionKey: 'daily_love'");
    expect(personalDaily).toContain("sectionKey: 'daily_money'");
    expect(personalDaily).toContain("sectionKey: 'daily_work_business'");
    expect(personalDaily).toContain("sectionKey: 'daily_goals'");
    expect(personalDaily).not.toContain('layers.map');

    const humanReport = fs.readFileSync(path.join(ROOT, 'components/NatalReading/HumanReport.tsx'), 'utf8');
    expect(humanReport).not.toContain('HUMAN_DAILY_SECTION_KEYS');
    expect(humanReport).not.toContain('getCachedHumanDailySection');
    expect(humanReport).toContain('ensureHumanBaseReport');
  });

  it('human-daily endpoint uses lock/cache without fake fallback packages', () => {
    const humanDaily = fs.readFileSync(path.join(ROOT, 'pages/api/content/natal/human-daily.ts'), 'utf8');
    // Единое дневное полотно: один запрос генерит весь разбор, эндпоинт режет на секции.
    expect(humanDaily).toContain('withContentGenerationLock');
    expect(humanDaily).toContain('readCached');
    expect(humanDaily).toContain('isUsableCanvas');
    expect(humanDaily).toContain('generateDailyCanvas');
    expect(humanDaily).not.toContain('buildDailyCanvasFallback');
    expect(humanDaily).not.toContain('fallbackCanvas');
    expect(humanDaily).toContain('CONTENT_GENERATION_UNAVAILABLE');
    expect(humanDaily).toContain('persistenceStatus');
  });

  it('services throw EMPTY_INTERPRETATION when interpretation.content is missing', () => {
    expect(() => assertInterpretationContent({ interpretation: { content: null } })).toThrow();
    try {
      assertInterpretationContent({ interpretation: { content: null } });
    } catch (error: any) {
      expect(error.code).toBe(EMPTY_INTERPRETATION);
    }
  });
});
