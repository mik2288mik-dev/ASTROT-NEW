const mockContentInterpretations = {
  getByChart: jest.fn(),
  getByUser: jest.fn(),
  getLatestByChartVariant: jest.fn(),
  getLatestByUserVariant: jest.fn(),
  upsertByChart: jest.fn(),
  upsertByUser: jest.fn(),
};
const mockDbQuery = jest.fn();

jest.mock('../lib/db', () => ({
  db: { content_interpretations: mockContentInterpretations },
  getPool: jest.fn(() => ({ query: (...args: unknown[]) => mockDbQuery(...args) })),
}));

jest.mock('../lib/appSettings', () => ({
  getUnifiedContentModel: jest.fn(async () => 'gpt-4.1'),
}));

const mockBuildContentGenerationLockKey = jest.fn((..._args: unknown[]) => 'personal-forecast-lock');
jest.mock('../lib/contentGenerationLock', () => ({
  buildContentGenerationLockKey: (...args: unknown[]) => mockBuildContentGenerationLockKey(...args),
  withContentGenerationLock: jest.fn(async (input: {
    readCached: () => Promise<unknown>;
    generate: () => Promise<unknown>;
  }) => {
    const cached = await input.readCached();
    if (cached) {
      return {
        status: 'ready',
        value: (cached as { value: unknown }).value,
        fromCache: true,
      };
    }
    return { status: 'ready', value: await input.generate(), fromCache: false };
  }),
}));

const mockGeneratePersonalForecastPackage = jest.fn();
jest.mock('../lib/personalForecastGeneration', () => ({
  generatePersonalForecastPackage: (...args: unknown[]) => mockGeneratePersonalForecastPackage(...args),
}));

import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
} from '../lib/personalForecastContract';
import {
  ensurePersonalForecast,
  getCompatibleStalePersonalForecast,
} from '../lib/personalForecastCache';
import { chartFixture, personalForecastFixture } from './personal-forecast-fixture';

const profile = {
  id: '42',
  name: 'Михаил',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Москва',
  birthTimezone: 'Europe/Moscow',
  language: 'ru' as const,
  isPremium: true,
  isSetup: true,
  theme: 'light' as const,
};

const request = {
  ctx: {
    user: { id: '42' },
    profile,
    chartId: 7,
    chartData: chartFixture,
  },
  period: 'day' as const,
  periodKey: '2026-07-26',
};

const previousForecasts = Array.from({ length: 15 }, (_, index) => ({
  period: 'day',
  periodKey: `2026-07-${String(25 - index).padStart(2, '0')}`,
  overview: {
    title: `Короткий вход ${index + 1}`,
    text: `Прошлый главный фрагмент ${index + 1}`,
    semanticFingerprint: `overview:${index + 1}`,
  },
  sections: [{
    text: `Прошлый следующий фрагмент ${index + 1}`,
    semanticFingerprint: `section:${index + 1}`,
  }],
}));

describe('personal forecast package cache path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentInterpretations.getByChart.mockResolvedValue(null);
    mockContentInterpretations.getLatestByChartVariant.mockResolvedValue(null);
    mockContentInterpretations.upsertByChart.mockResolvedValue(undefined);
    mockDbQuery.mockResolvedValue({
      rows: previousForecasts.map((content) => ({ content })),
    });
  });

  it('passes the previous 15 same-user readings and saved natal chart to Luna, then persists the result', async () => {
    const forecast = personalForecastFixture();
    mockGeneratePersonalForecastPackage.mockResolvedValueOnce(forecast);

    await expect(ensurePersonalForecast(request as never)).resolves.toMatchObject({
      status: 'ready',
      fromCache: false,
      value: forecast,
    });

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $1'),
      ['42', 7, 'premium', 15],
    );
    expect(mockGeneratePersonalForecastPackage).toHaveBeenCalledWith(expect.objectContaining({
      period: 'day',
      profile: expect.objectContaining({ id: '42' }),
      chartData: chartFixture,
      recentForecasts: expect.arrayContaining([
        expect.objectContaining({
          periodKey: '2026-07-25',
          fragments: expect.arrayContaining([
            expect.objectContaining({ kind: 'headline', text: 'Короткий вход 1' }),
            expect.objectContaining({ text: 'Прошлый главный фрагмент 1' }),
          ]),
        }),
      ]),
    }));
    expect(mockGeneratePersonalForecastPackage.mock.calls[0][0].recentForecasts).toHaveLength(15);
    expect(mockContentInterpretations.upsertByChart).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        content: forecast,
        promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
        calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      }),
      '42',
    );
    expect(mockContentInterpretations.upsertByUser).not.toHaveBeenCalled();
    expect(mockBuildContentGenerationLockKey).toHaveBeenCalledWith(expect.objectContaining({
      chartId: 7,
      contentVariant: 'daily',
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
    }));
  });

  it('returns an exact cache hit without loading history or calling Luna', async () => {
    const forecast = personalForecastFixture();
    mockGeneratePersonalForecastPackage.mockResolvedValueOnce(forecast);
    await ensurePersonalForecast(request as never);
    const saved = mockContentInterpretations.upsertByChart.mock.calls[0][1];

    jest.clearAllMocks();
    mockContentInterpretations.getByChart.mockResolvedValueOnce(saved);

    await expect(ensurePersonalForecast(request as never)).resolves.toMatchObject({
      status: 'ready',
      fromCache: true,
      value: forecast,
    });
    expect(mockGeneratePersonalForecastPackage).not.toHaveBeenCalled();
    expect(mockDbQuery).not.toHaveBeenCalled();
  });

  it('forces a real rewrite while retaining the same-user anti-repeat history', async () => {
    const forecast = personalForecastFixture();
    mockContentInterpretations.getByChart.mockResolvedValue({ content: personalForecastFixture() });
    mockGeneratePersonalForecastPackage.mockResolvedValueOnce(forecast);

    await expect(ensurePersonalForecast(request as never, {
      forceRegenerate: true,
    })).resolves.toMatchObject({
      status: 'ready',
      fromCache: false,
      value: forecast,
    });

    expect(mockGeneratePersonalForecastPackage).toHaveBeenCalledWith(expect.objectContaining({
      chartData: chartFixture,
      recentForecasts: expect.any(Array),
    }));
    expect(mockGeneratePersonalForecastPackage.mock.calls[0][0].recentForecasts).toHaveLength(15);
  });

  it('requires the validated saved chart instead of falling back to raw birth details', async () => {
    await expect(ensurePersonalForecast({
      ...request,
      ctx: { ...request.ctx, chartData: null },
    } as never)).rejects.toThrow('PERSONAL_FORECAST_CHART_REQUIRED');
    expect(mockGeneratePersonalForecastPackage).not.toHaveBeenCalled();
  });

  it('never serves a previous prompt product as compatible stale content', async () => {
    const stale = personalForecastFixture();
    mockContentInterpretations.getLatestByChartVariant.mockResolvedValueOnce({
      cacheKey: 'old-cache-key',
      inputHash: 'old-input-hash',
      promptVersion: 'personal-forecast-feed.v27.luna-editorial-presentations',
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      content: stale,
    });

    await expect(getCompatibleStalePersonalForecast(request as never)).resolves.toBeNull();
  });
});
