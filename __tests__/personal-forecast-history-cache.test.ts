const query = jest.fn();
const getByUser = jest.fn();
const upsertByUser = jest.fn();
jest.mock('../lib/db', () => ({
  db: { content_interpretations: { getByUser, upsertByUser } },
  getPool: () => ({ query }),
}));
jest.mock('../lib/appSettings', () => ({ getUnifiedContentModel: async () => 'gpt-5.6-luna' }));
jest.mock('../lib/forecastDeliveryMetrics', () => ({ logForecastDeliveryMetric: jest.fn() }));
jest.mock('../lib/contentGenerationLock', () => ({
  buildContentGenerationLockKey: () => 'personal-user-lock',
  withContentGenerationLock: async ({ readCached, generate }: any) => {
    const cached = await readCached();
    return { status: 'ready', value: cached ? cached.value : await generate(), fromCache: Boolean(cached) };
  },
}));
jest.mock('../lib/personalForecastGeneration', () => ({
  ...jest.requireActual('../lib/personalForecastGeneration'),
  generatePersonalForecastPackage: jest.fn(),
}));

import {
  ensurePersonalForecast, getCachedPersonalForecast, getCompatibleStalePersonalForecast,
  getRecentPersonalForecastHistory, type PersonalForecastCacheContext,
} from '../lib/personalForecastCache';
import { buildPersonalForecastFeedPrompt, generatePersonalForecastPackage } from '../lib/personalForecastGeneration';
import { PERSONAL_FORECAST_CONTRACT_VERSION, resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import { personalForecastFixture } from './personal-forecast-fixture';

const generate = generatePersonalForecastPackage as jest.Mock;
const context: PersonalForecastCacheContext = {
  userId: '42', accessTier: 'free', period: 'day', periodKey: '2026-07-26',
  profile: { name: 'Мира', birthDate: '1990-01-01', birthTime: '08:15', birthPlace: 'Москва', birthTimezone: 'Europe/Moscow', language: 'ru' },
};
function priorReading(patch: Record<string, unknown> = {}) {
  return {
    period: 'day', periodKey: '2026-07-25',
    overview: { title: 'Собственный прошлый заголовок', text: 'Собственный сохранённый прогноз этого пользователя.' },
    sections: [{ id: 'semantic:closing', text: 'Собственное заключение.' }],
    meta: {
      contractVersion: 'personal-forecast-feed-v28-three-part-human',
      semanticSignature: { situation: 'Своё наблюдение', turn: 'Своё продолжение', outcome: 'Свой вывод', rawBirthData: 'PRIVATE_NESTED_DATA' },
      astrologerBrief: { briefSignature: 'own-prior-brief', rawBirthData: 'PRIVATE_BIRTH_DATA' },
      providerDebug: 'PRIVATE_PROVIDER_DEBUG',
    },
    ...patch,
  };
}
const row = <T>(content: T, userId = '42') => ({ user_id: userId, content });

describe('personal forecast own history across versions and access tiers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset().mockResolvedValue({ rows: [] });
    getByUser.mockReset().mockResolvedValue(null);
    upsertByUser.mockReset().mockResolvedValue(undefined);
    generate.mockReset();
  });

  it('reads the newest fifteen own packages across all periods, versions and former tiers', async () => {
    const rows = Array.from({ length: 18 }, (_, index) => row(priorReading({
      period: index % 3 === 0 ? 'week' : index % 3 === 1 ? 'month' : 'day',
      periodKey: index % 3 === 0 ? `2026-W${String(28 - index).padStart(2, '0')}`
        : index % 3 === 1 ? `2026-${String(12 - Math.floor(index / 3)).padStart(2, '0')}`
        : `2026-07-${String(25 - index).padStart(2, '0')}`,
      meta: { contractVersion: index % 2 === 0 ? 'personal-forecast-feed-v14-raw-profile' : PERSONAL_FORECAST_CONTRACT_VERSION },
    })));
    query.mockResolvedValue({ rows });
    const history = await getRecentPersonalForecastHistory({ ...context, accessTier: 'premium' });
    expect(history).toHaveLength(15);
    expect(history.map((item) => item.periodKey)).toEqual(rows.slice(0, 15).map((item) => item.content.periodKey));
    expect(new Set(history.map((item) => item.period))).toEqual(new Set(['day', 'week', 'month']));
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE user_id = $1 AND chart_id IS NULL');
    expect(sql).toContain("content_variant IN ('daily', 'weekly', 'monthly')");
    expect(sql).toContain('ORDER BY updated_at DESC, id DESC');
    expect(sql).not.toContain('access_tier =');
    expect(sql).not.toContain("contractVersion' =");
    expect(params).toEqual(['42', 'day', '2026-07-26', 60]);
  });

  it('filters foreign owners, unknown versions, malformed content, the current period and duplicate copies', async () => {
    const own = priorReading();
    query.mockResolvedValue({ rows: [
      row(priorReading({ periodKey: '2026-07-24' }), 'another-account'),
      row(priorReading({ periodKey: context.periodKey })),
      row(priorReading({ meta: { contractVersion: 'personal-forecast-feed-v999-future-shape' } })),
      row(priorReading({ meta: { contractVersion: 'zodiac-public-v29' } })),
      row(priorReading({ meta: { contractVersion: 'personal-forecast-feed-v13-chart-based' } })),
      row(priorReading({ periodKey: 'not-a-period' })),
      row(priorReading({ sections: [null] })),
      row(priorReading({ overview: { title: 'No body' }, sections: [] })),
      row(own), row(structuredClone(own)),
      row(priorReading({ period: 'month', periodKey: '2026-07' })),
    ] });
    const history = await getRecentPersonalForecastHistory(context);
    expect(history.map((item) => [item.period, item.periodKey])).toEqual([['day', '2026-07-25'], ['month', '2026-07']]);
    expect(history[0].fragments).toEqual([
      { kind: 'title', text: 'Собственный прошлый заголовок', semanticFingerprint: null },
      { kind: 'forecast', text: 'Собственный сохранённый прогноз этого пользователя.', semanticFingerprint: null },
      { kind: 'closing', text: 'Собственное заключение.', semanticFingerprint: null },
    ]);
    expect(history[0].semanticSignature).toEqual({
      situation: 'Своё наблюдение', turn: 'Своё продолжение', outcome: 'Свой вывод',
      title: 'Собственный прошлый заголовок', forecast: 'Собственный сохранённый прогноз этого пользователя.', closing: 'Собственное заключение.',
    });
    expect(history[0].briefSignature).toBe('own-prior-brief');
    expect(JSON.stringify(history)).not.toContain('PRIVATE_');
  });

  it('retains legacy visible fragments without mistaking every action paragraph for the closing', async () => {
    query.mockResolvedValue({ rows: [row(priorReading({
      meta: { contractVersion: 'personal-forecast-feed-v14-raw-profile' },
      sections: [
        { id: 'reading:one', text: 'Первое продолжение старого текста.', contentBlocks: [{ role: 'action', text: 'Старый совет внутри истории.' }] },
        { id: 'reading:two', text: 'Второе продолжение старого текста.' },
      ],
    }))] });
    const history = await getRecentPersonalForecastHistory(context);
    expect(history[0].fragments.at(-1)).toEqual({
      kind: 'forecast',
      text: 'Собственный сохранённый прогноз этого пользователя.\n\nПервое продолжение старого текста.\n\nВторое продолжение старого текста.',
      semanticFingerprint: null,
    });
    expect(history[0]).not.toHaveProperty('semanticSignature');
  });

  it('recognizes the real materializer hashed closing ID and keeps it separate from the body', async () => {
    const forecast = personalForecastFixture();
    forecast.periodKey = '2026-07-25';
    forecast.sections[0].id = 'semantic:direct-1-actual-content-hash';
    forecast.sections[0].contentBlocks[0].atomId = 'generated:semantic:direct-1-actual-content-hash:1';
    query.mockResolvedValue({ rows: [row(forecast)] });
    const [history] = await getRecentPersonalForecastHistory(context);
    expect(history.fragments.filter((fragment) => fragment.kind === 'forecast').map((fragment) => fragment.text)).toEqual([forecast.overview.text]);
    expect(history.fragments.filter((fragment) => fragment.kind === 'closing').map((fragment) => fragment.text)).toEqual([forecast.sections[0].text]);
    expect(history.semanticSignature?.forecast).toBe(forecast.overview.text);
    expect(history.semanticSignature?.closing).toBe(forecast.sections[0].text);
  });

  it('sends only bounded visible own history to the actual writer prompt, without saved metadata', async () => {
    const marker = 'PERSONAL_VISIBLE_HISTORY';
    query.mockResolvedValue({ rows: [row(priorReading({
      overview: { title: 'T'.repeat(300), text: marker + ' '.repeat(2) + 'word '.repeat(1000) },
      sections: [{ id: 'semantic:closing', text: 'C'.repeat(500) }],
    }))] });
    const history = await getRecentPersonalForecastHistory(context);
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'ru', period: context.period,
      window: resolvePersonalForecastWindow(context.period, context.periodKey, 'Europe/Moscow'),
      reader: { name: 'Мира', grammaticalGender: 'unspecified' },
      astrologerBrief: personalForecastFixture().meta.astrologerBrief,
      recentForecasts: history,
    });
    const payload = JSON.parse(prompt.slice(prompt.indexOf('{')));
    const previous = payload.anti_repeat_context.recent_forecasts;
    expect(previous).toHaveLength(1);
    expect(Object.keys(previous[0])).toEqual(['period', 'period_key', 'title', 'visible_text', 'closing']);
    expect(previous[0].title).toHaveLength(120);
    expect(previous[0].visible_text).toHaveLength(3000);
    expect(previous[0].visible_text).toContain(marker);
    expect(previous[0].closing).toHaveLength(220);
    expect(prompt).not.toContain('PRIVATE_');
    expect(prompt).not.toContain(context.profile.birthDate);
    expect(prompt).not.toContain('birth_date');
  });

  it('does not request history without an owner or silently generate with empty memory after a history failure', async () => {
    await expect(getRecentPersonalForecastHistory({ ...context, userId: '' })).rejects.toThrow('PERSONAL_FORECAST_PROFILE_REQUIRED');
    expect(query).not.toHaveBeenCalled();
    const failure = new Error('own history unavailable');
    query.mockRejectedValueOnce(failure);
    await expect(ensurePersonalForecast(context)).rejects.toBe(failure);
    expect(generate).not.toHaveBeenCalled();
    expect(upsertByUser).not.toHaveBeenCalled();
  });
});

describe('personal forecast durable history and current-cache separation', () => {
  type Stored = { user_id: string; content: ReturnType<typeof personalForecastFixture>; [key: string]: any };
  let stored: Stored[];

  beforeEach(() => {
    jest.clearAllMocks();
    stored = [];
    query.mockReset().mockImplementation(async (sql: string, values: string[]) => ({
      rows: sql.includes('user_id IS DISTINCT FROM') ? [] : stored
        .filter((item) => item.user_id === values[0]).slice().reverse()
        .map(({ user_id, content }) => ({ user_id, content })),
    }));
    getByUser.mockReset().mockImplementation(async (userId, tier, _surface, _variant, cacheKey) =>
      stored.find((item) => item.user_id === userId && item.accessTier === tier && item.cacheKey === cacheKey) || null);
    upsertByUser.mockReset().mockImplementation(async (userId, value) => {
      stored.push({ user_id: userId, ...structuredClone(value) });
    });
    generate.mockReset().mockImplementation(async ({ period, window }) => {
      const forecast = personalForecastFixture(period);
      forecast.meta.model = 'gpt-5.6-luna';
      forecast.periodKey = window.periodKey;
      forecast.periodStart = window.periodStart;
      forecast.periodEnd = window.periodEnd;
      return forecast;
    });
  });

  it('persists once, remembers that reading on the next period and reuses the new durable cache', async () => {
    await ensurePersonalForecast(context);
    expect(stored).toHaveLength(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0].recentForecasts).toEqual([]);
    const next = { ...context, periodKey: '2026-07-27', accessTier: 'premium' as const };
    await ensurePersonalForecast(next);
    expect(generate.mock.calls[1][0].recentForecasts).toEqual([
      expect.objectContaining({ period: 'day', periodKey: '2026-07-26' }),
    ]);
    expect(stored).toHaveLength(2);
    expect(stored[0].content.periodKey).toBe('2026-07-26');
    expect(stored[1].content.periodKey).toBe('2026-07-27');
    expect(await ensurePersonalForecast(next)).toEqual(expect.objectContaining({ status: 'ready', fromCache: true, value: stored[1].content }));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(upsertByUser).toHaveBeenCalledTimes(2);
  });

  it('uses previous-version content only as history and regenerates the requested current package', async () => {
    await ensurePersonalForecast(context);
    const old = stored[0];
    old.content.meta.contractVersion = 'personal-forecast-feed-v28-three-part-human' as typeof PERSONAL_FORECAST_CONTRACT_VERSION;
    expect(await getCachedPersonalForecast(context)).toBeNull();
    expect(await getCompatibleStalePersonalForecast(context)).toBeNull();
    const next = { ...context, periodKey: '2026-07-27' };
    expect(await getRecentPersonalForecastHistory(next)).toHaveLength(1);
    expect(await ensurePersonalForecast(context)).toEqual(expect.objectContaining({ fromCache: false }));
    expect(stored[1].content.meta.contractVersion).toBe(PERSONAL_FORECAST_CONTRACT_VERSION);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('never reuses another account or tier cache and keeps another account out of writer history', async () => {
    await ensurePersonalForecast(context);
    const other = { ...context, userId: '84' };
    expect(await getCachedPersonalForecast(other)).toBeNull();
    expect(await getRecentPersonalForecastHistory({ ...other, periodKey: '2026-07-27' })).toEqual([]);
    await ensurePersonalForecast(other);
    expect(generate.mock.calls[1][0].recentForecasts).toEqual([]);
    expect(await getCachedPersonalForecast({ ...context, accessTier: 'premium' })).toBeNull();
    expect(stored.map((item) => item.user_id)).toEqual(['42', '84']);
  });

  it('does not claim a persisted result when the write fails', async () => {
    upsertByUser.mockRejectedValueOnce(new Error('write failed'));
    await expect(ensurePersonalForecast(context)).rejects.toMatchObject({ code: 'PERSONAL_FORECAST_CACHE_WRITE_FAILED' });
    expect(stored).toHaveLength(0);
    expect(await getCachedPersonalForecast(context)).toBeNull();
  });
});
