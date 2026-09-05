const request = jest.fn();
const getByUser = jest.fn();
const upsertByUser = jest.fn();
const query = jest.fn();

jest.mock('../lib/openaiResponses', () => ({ callStructuredWithBudgetRetry: (...args: unknown[]) => request(...args) }));
jest.mock('../lib/db', () => ({
  db: { content_interpretations: { getByUser, upsertByUser } },
  getPool: () => ({ query }),
}));
jest.mock('../lib/appSettings', () => ({ getUnifiedContentModel: async () => 'gpt-5.6-luna' }));
jest.mock('../lib/forecastDeliveryMetrics', () => ({ logForecastDeliveryMetric: jest.fn() }));
jest.mock('../lib/contentGenerationLock', () => ({
  buildContentGenerationLockKey: () => 'forecast-roundtrip',
  withContentGenerationLock: async ({ readCached, generate }: {
    readCached: () => Promise<{ value: unknown } | null>;
    generate: () => Promise<unknown>;
  }) => {
    const cached = await readCached();
    return { status: 'ready', value: cached ? cached.value : await generate(), fromCache: Boolean(cached) };
  },
}));
jest.mock('../services/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));

import type { UserProfile } from '../types';
import { ensurePersonalForecast, getCachedPersonalForecast, getCompatibleStalePersonalForecast } from '../lib/personalForecastCache';
import { isPersonalForecastPackage, slicePersonalForecastForAccess } from '../lib/personalForecastContract';
import { clearPersonalForecastSessionCache, loadPersonalForecast } from '../services/personalForecastService';
import { apiFetch } from '../services/apiClient';

const profile: UserProfile = {
  id: 'forecast-roundtrip', name: 'Лина', birthDate: '1990-01-17', birthTime: '08:15',
  birthPlace: 'Москва', birthTimezone: 'Europe/Moscow', gender: 'female', language: 'ru',
  isSetup: true, isPremium: true, theme: 'light',
};
const context = { userId: profile.id!, profile, accessTier: 'premium' as const, period: 'day' as const, periodKey: '2026-09-05' };
const brief = {
  tone: 'favorable',
  situation: 'При выборе бытовой вещи цена окажется выше ожидаемой',
  turn: 'После короткого разговора продавец предложит более дешёвый вариант',
  outcome: 'При сравнении похожих моделей покупка может обойтись дешевле',
  observable_detail: 'На ценнике рядом появится другая сумма',
};
const reading = {
  title: 'Ценник, ты серьёзно?',
  forecast: 'Сегодня при выборе бытовой вещи цена может оказаться выше, чем ты ожидаешь. В разговоре с продавцом может найтись похожая модель с меньшей ценой. Если разница тебе подходит, покупка обойдётся дешевле, чем кажется сначала.',
  closing: 'Сравни цену и саму модель.',
};

describe('personal forecast real generation, persistence and client boundary', () => {
  let stored: Record<string, any> | null;

  beforeEach(() => {
    jest.clearAllMocks();
    clearPersonalForecastSessionCache();
    stored = null;
    query.mockResolvedValue({ rows: [] });
    getByUser.mockImplementation(async () => stored);
    upsertByUser.mockImplementation(async (_userId, value) => { stored = structuredClone(value); });
    request.mockImplementation(async ({ schemaName }: { schemaName: string }) => ({
      attempts: 1,
      result: {
        content: JSON.stringify(schemaName === 'personal_forecast_astrologer_brief' ? brief : reading),
        responseId: 'synthetic-provider-response', inputTokens: 100, outputTokens: 100, reasoningTokens: 0,
      },
    }));
  });

  it('materializes a real accepted brief and writer result, then reuses the durable package on server and client', async () => {
    const first = await ensurePersonalForecast(context);
    expect(first.status).toBe('ready');
    if (first.status !== 'ready') throw new Error('Expected a ready forecast');
    expect(isPersonalForecastPackage(first.value)).toBe(true);
    expect(first.value.overview.title).toBe(reading.title);
    expect(first.value.overview.contentBlocks).toEqual([expect.objectContaining({ role: 'detail', text: reading.forecast })]);
    expect(first.value.sections).toEqual([expect.objectContaining({
      title: undefined, contentBlocks: [expect.objectContaining({ role: 'action', text: reading.closing })],
    })]);
    expect(upsertByUser).toHaveBeenCalledTimes(1);

    const cached = await ensurePersonalForecast(context);
    expect(cached).toEqual(expect.objectContaining({ status: 'ready', fromCache: true, value: first.value }));
    expect(await getCompatibleStalePersonalForecast(context)).toEqual(expect.objectContaining({ forecast: first.value }));
    expect(request).toHaveBeenCalledTimes(2);

    const briefInput = JSON.parse(request.mock.calls[0][0].input);
    expect(briefInput.personal_profile.birth_date).toBe(profile.birthDate);
    const writerInput = request.mock.calls[1][0].input as string;
    const writerData = JSON.parse(writerInput.slice(writerInput.indexOf('{')));
    expect(Object.keys(writerData)).toEqual(['selected_period', 'reader', 'astrologer_brief', 'anti_repeat_context']);
    expect(writerData.astrologer_brief).toEqual(brief);
    expect(writerData.reader).toEqual({ name: profile.name, language: 'ru', grammatical_gender: 'female' });
    for (const forbidden of ['birth_date', 'birth_time', 'chart_data', 'longitude', 'transit', 'swiss']) {
      expect(writerInput.toLowerCase()).not.toContain(forbidden);
    }

    (apiFetch as jest.Mock).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ ...slicePersonalForecastForAccess(first.value, true), accessTier: 'premium', source: 'cache' }),
    });
    const input = { profile, period: context.period, periodKey: context.periodKey, options: { cacheOnly: true } };
    expect((await loadPersonalForecast(input)).forecast).toEqual(first.value);
    expect((await loadPersonalForecast(input)).forecast).toEqual(first.value);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['missing metadata', (value: any) => { delete value.content.meta; }],
    ['old prompt', (value: any) => { value.content.meta.promptVersion = 'previous-writer'; }],
    ['old voice', (value: any) => { value.content.meta.voiceVersion = 'previous-voice'; }],
    ['old fragments', (value: any) => { value.content.sections.push(structuredClone(value.content.sections[0])); }],
    ['wrong period window', (value: any) => {
      value.content.periodKey = '2026-09-04'; value.content.periodStart = '2026-09-04'; value.content.periodEnd = '2026-09-04';
    }],
  ])('treats %s as a cache miss without throwing or accepting stale content', async (_label, corrupt) => {
    await ensurePersonalForecast(context);
    corrupt(stored);
    await expect(getCachedPersonalForecast(context)).resolves.toBeNull();
    await expect(getCompatibleStalePersonalForecast(context)).resolves.toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects a previous prompt even when the API labels its package stale', async () => {
    const generated = await ensurePersonalForecast(context);
    if (generated.status !== 'ready') throw new Error('Expected a ready forecast');
    const old = structuredClone(generated.value);
    old.meta.promptVersion = 'previous-writer';
    (apiFetch as jest.Mock).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ ...slicePersonalForecastForAccess(old, true), accessTier: 'premium', source: 'stale' }),
    });
    await expect(loadPersonalForecast({
      profile, period: context.period, periodKey: context.periodKey, options: { cacheOnly: true },
    })).rejects.toMatchObject({ code: 'PERSONAL_FORECAST_RESPONSE_INVALID' });
  });

  it('does not report a ready forecast after a failed durable write', async () => {
    upsertByUser.mockRejectedValueOnce(new Error('synthetic database failure'));
    await expect(ensurePersonalForecast(context)).rejects.toMatchObject({ code: 'PERSONAL_FORECAST_CACHE_WRITE_FAILED' });
    await expect(getCachedPersonalForecast(context)).resolves.toBeNull();
  });

  it('does not retry a provider quota failure or persist invented fallback prose', async () => {
    request.mockRejectedValueOnce(Object.assign(new Error('quota unavailable'), { code: 'insufficient_quota', status: 429 }));
    await expect(ensurePersonalForecast(context)).rejects.toMatchObject({ code: 'insufficient_quota' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(upsertByUser).not.toHaveBeenCalled();
  });

  it('persists an otherwise valid story without retrying an editorial headline preference', async () => {
    request.mockImplementation(async ({ schemaName }: { schemaName: string }) => ({
      attempts: 1,
      result: {
        content: JSON.stringify(schemaName === 'personal_forecast_astrologer_brief'
          ? brief
          : { ...reading, title: 'Вот это поворот' }),
        responseId: 'synthetic-editorial-warning', inputTokens: 100, outputTokens: 100, reasoningTokens: 0,
      },
    }));
    const generated = await ensurePersonalForecast(context);
    expect(generated.status).toBe('ready');
    expect(request).toHaveBeenCalledTimes(2);
    expect(upsertByUser).toHaveBeenCalledTimes(1);
  });
});
