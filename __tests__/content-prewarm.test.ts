import fs from 'fs';
import path from 'path';
import {
  buildFreePrewarmPlan,
  buildPremiumPrewarmPlan,
  buildUserPrewarmPlan,
  planUsesContentGenerationLock,
} from '../lib/contentPrewarm';
import { buildContentGenerationLockKey } from '../lib/contentGenerationLock';
import { assertInterpretationContent, EMPTY_INTERPRETATION } from '../lib/contentInterpretation';
import { resetPrewarmSessionForTests } from '../services/contentPrewarmService';

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
  getCachedHumanDailySection: jest.fn().mockResolvedValue({ content: { title: 't', content: 'c' } }),
  loadHumanDailySection: jest.fn().mockResolvedValue({ content: { title: 'ok', content: 'text' } }),
}));

import {
  getCachedDailyForecastLayer,
  getDailyForecastLayer,
} from '../services/astrologyService';
import { prewarmUserContent } from '../services/contentPrewarmService';

describe('content prewarm', () => {
  beforeEach(() => {
    resetPrewarmSessionForTests();
    jest.clearAllMocks();
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

    expect(premium).toContain('forecast_daypart_morning');
    expect(premium).toContain('forecast_daypart_day');
    expect(premium).toContain('forecast_daypart_evening');
    expect(premium).toContain('forecast_weekly');
    expect(premium).toContain('forecast_monthly');
    expect(premium).toContain('natal_full');
    expect(premium).toContain('human_daily_love');
    expect(premium).toContain('human_daily_work_business');
    expect(premium).toContain('human_daily_money');
  });

  it('prewarm skips existing cached content', async () => {
    const result = await prewarmUserContent({
      userId: 'user-1',
      chartId: 7,
      profile: {
        id: 'user-1',
        name: 'Test',
        birthDate: '1990-01-01',
        birthTime: '12:00',
        birthPlace: 'Moscow',
        isSetup: true,
        language: 'ru',
        theme: 'dark',
        isPremium: false,
        isAdmin: false,
        loginStreak: 0,
        chartSlots: 1,
      },
      chartData: {
        sun: { sign: 'Aries', degree: 10 },
        moon: { sign: 'Taurus', degree: 20 },
        rising: { sign: 'Gemini', degree: 30 },
      } as any,
      isPremium: false,
      dateKey: '2026-05-29',
      blockingBudgetMs: 5000,
    });

    expect(getCachedDailyForecastLayer).toHaveBeenCalled();
    expect(getDailyForecastLayer).not.toHaveBeenCalled();
    expect(result.completed.some((item) => item.id === 'forecast_daily' && item.status === 'skipped')).toBe(true);
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

  it('Horoscope uses retry flow instead of primary-generation-only copy', () => {
    const source = fs.readFileSync(path.join(ROOT, 'views/Horoscope.tsx'), 'utf8');
    expect(source).toContain('fetchLayerWithRetry');
    expect(source).toContain('getCachedFullDaypartForecast');
    expect(source).not.toContain('не подготовился');
    expect(source).not.toContain('Подробный разбор доступен в Premium');
    expect(source).not.toContain('повторного списания');
  });

  it('App startup calls prewarmUserContent after chart load', () => {
    const source = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    expect(source).toContain('prewarmUserContent');
    expect(source).toContain('getOrCalculateChart');
    expect(source).toContain('Готовим твой день');
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
});
