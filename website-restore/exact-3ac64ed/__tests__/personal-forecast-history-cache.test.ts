const query = jest.fn();
const getByUser = jest.fn();
const upsertByUser = jest.fn();
jest.mock('../lib/db', () => ({
  db: { content_interpretations: { getByUser, upsertByUser } },
  getPool: () => ({ query }),
}));
jest.mock('../lib/appSettings', () => ({ getUnifiedContentModel: async () => 'gpt-5.6-luna' }));
jest.mock('../lib/contentGenerationLock', () => ({
  buildContentGenerationLockKey: () => 'personal-user-lock',
  withContentGenerationLock: async ({ generate }: any) => ({ status: 'ready', value: await generate(), fromCache: false }),
}));
jest.mock('../lib/personalForecastGeneration', () => ({
  PERSONAL_FORECAST_CROSS_USER_REPEAT_FRAGMENT_LIMIT: 256,
  generatePersonalForecastPackage: jest.fn(),
}));

import { getRecentPersonalForecastHistory } from '../lib/personalForecastCache';

describe('personal forecast user-only history', () => {
  it('reads at most fifteen newest same-user packages and no chart key', async () => {
    query.mockResolvedValue({ rows: Array.from({ length: 18 }, (_, index) => ({ content: {
      period: 'day', periodKey: `2026-08-${String(index + 1).padStart(2, '0')}`,
      overview: { title: `Вход ${index}`, text: `Текст ${index}` }, sections: [],
      meta: { contractVersion: 'personal-forecast-feed-v14-raw-profile' },
    } })) });
    const history = await getRecentPersonalForecastHistory({
      userId: '42', accessTier: 'free', period: 'day', periodKey: '2026-08-20',
      profile: { name: 'Мира', birthDate: '1990-01-01', birthTime: '', birthPlace: '', language: 'ru' },
    });
    expect(history).toEqual([]);
    expect(query.mock.calls[0][0]).toContain('user_id = $1');
    expect(query.mock.calls[0][0]).not.toContain('chart_id');
  });
});
