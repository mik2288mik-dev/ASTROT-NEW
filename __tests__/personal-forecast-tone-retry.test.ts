const getPrimary = jest.fn();
const getByUser = jest.fn();
const upsertByUser = jest.fn();
const generate = jest.fn();
jest.mock('../lib/natalChartV2Repository', () => ({ natalChartV2Repository: { getPrimary } }));
jest.mock('../lib/db', () => ({ db: { content_interpretations: { getByUser, upsertByUser } }, getPool: () => ({ query: jest.fn(async () => ({ rows: [] })) }) }));
jest.mock('../lib/appSettings', () => ({ getUnifiedContentModel: async () => 'test-model' }));
jest.mock('../lib/forecastDeliveryMetrics', () => ({ logForecastDeliveryMetric: jest.fn() }));
jest.mock('../lib/contentGenerationLock', () => ({ buildContentGenerationLockKey: () => 'test', withContentGenerationLock: async ({ generate: run }: any) => ({ status: 'ready', value: await run() }) }));
jest.mock('../lib/personalForecastGeneration', () => ({
  ...jest.requireActual('../lib/personalForecastGeneration'),
  generatePersonalForecastPackage: (...args: unknown[]) => generate(...args),
}));

import { ensurePersonalForecast } from '../lib/personalForecastCache';
import { buildCanonicalNatalInputHash } from '../lib/natalChartCanonical';
import samples from './fixtures/readingSamples.json';
import type { UserProfile } from '../types';

it('retries when the provider produced no readable forecast and never saves an empty result', async () => {
  const person = samples.people[0];
  const profile = person.profile as UserProfile;
  const inputHash = buildCanonicalNatalInputHash({ ...profile, latitude: person.chart.birth.latitude, longitude: person.chart.birth.longitude, timezone: person.chart.birth.timezone });
  getPrimary.mockResolvedValue({ user_id: profile.id, input_hash: inputHash, chart_data: person.chart });
  generate.mockRejectedValue(new Error('PERSONAL_FORECAST_GENERATION_INVALID:EMPTY_READING'));
  await expect(ensurePersonalForecast({ userId: profile.id!, profile, accessTier: 'premium', period: 'day', periodKey: '2026-09-08' }))
    .rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID:EMPTY_READING');
  expect(generate).toHaveBeenCalledTimes(3);
  expect(generate.mock.calls[1][0].retryReason).toBe('PERSONAL_FORECAST_GENERATION_INVALID:EMPTY_READING');
  expect(upsertByUser).not.toHaveBeenCalled();
});
