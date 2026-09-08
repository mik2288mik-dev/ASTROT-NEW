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
import { generatePersonalForecastPackage } from '../lib/personalForecastGeneration';
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
    expect(params).toEqual(['42', 60]);
  });

  it('filters foreign owners, unknown versions, malformed content and duplicates while retaining prior copies of the current period', async () => {
    const own = priorReading();
    query.mockResolvedValue({ rows: [
      row(priorReading({ periodKey: '2026-07-24' }), 'another-account'),
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

  it('retains a previously shown current-day forecast after a tier or generator change', async () => {
    query.mockResolvedValue({ rows: [row(priorReading({ periodKey: context.periodKey }))] });
    const history = await getRecentPersonalForecastHistory({ ...context, accessTier: 'premium' });
    expect(history).toHaveLength(1);
    expect(history[0].periodKey).toBe(context.periodKey);
    expect(query.mock.calls[0][0]).not.toContain("NOT (content->>'period'");
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
    forecast.meta.contractVersion = 'personal-forecast-feed-v29-period-horoscope' as typeof PERSONAL_FORECAST_CONTRACT_VERSION;
    forecast.sections = [{ ...forecast.overview, id: 'semantic:closing', kind: 'dynamic', text: 'A meeting may change the plan.', contentBlocks: [{ ...forecast.overview.contentBlocks[0], text: 'A meeting may change the plan.', role: 'action', atomId: 'closing' }]}];
    forecast.meta.semanticSignature!.closing = forecast.sections[0].text;
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

  it('retains the v30 lead-role closing separately after a writer upgrade', async () => {
    const forecast = personalForecastFixture();
    forecast.meta.contractVersion = 'personal-forecast-feed-v29-period-horoscope' as typeof PERSONAL_FORECAST_CONTRACT_VERSION;
    forecast.sections = [{ ...forecast.overview, id: 'semantic:closing', kind: 'dynamic', text: 'A meeting may change the plan.', contentBlocks: [{ ...forecast.overview.contentBlocks[0], text: 'A meeting may change the plan.', role: 'action', atomId: 'closing' }]}];
    forecast.meta.contractVersion = 'personal-forecast-feed-v30-nebo-human-voice' as typeof PERSONAL_FORECAST_CONTRACT_VERSION;
    forecast.sections[0].contentBlocks[0].role = 'lead';
    query.mockResolvedValue({ rows: [row(forecast)] });
    const [history] = await getRecentPersonalForecastHistory(context);
    expect(history.fragments.filter((fragment) => fragment.kind === 'closing')).toHaveLength(1);
    expect(history.semanticSignature?.forecast).toBe(forecast.overview.text);
  });

});
