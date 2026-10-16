jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: jest.fn() }));
jest.mock('../lib/horoscope/signClientCompatibility', () => ({ rememberNativeSignReader: jest.fn() }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: jest.fn() }));
jest.mock('../lib/personalForecastCache', () => ({
  ensurePersonalForecast: jest.fn(), getCompatibleStalePersonalForecast: jest.fn(), getCachedPersonalForecast: jest.fn(),
}));
jest.mock('../lib/personalForecastGeneration', () => ({ getPersonalForecastGenerationDiagnosticCode: () => 'GENERATION_FAILED' }));
jest.mock('../lib/personalForecastPrewarm', () => ({
  buildPersonalForecastPrewarmProfile: () => ({ id: 'wire-user', name: 'Mira', birthDate: '1990-01-01', birthTimezone: 'Europe/Moscow', language: 'ru' }),
  queuePersonalForecastPrewarm: jest.fn(),
}));
jest.mock('../lib/birthProfileRepository', () => ({ birthProfileRepository: { get: jest.fn() } }));
jest.mock('../lib/db', () => ({ db: { users: { get: jest.fn() } } }));
jest.mock('../lib/serverOperationalDiagnostics', () => ({
  startServerOperationalDiagnostic: () => ({ log: jest.fn(), error: jest.fn(), setUser: jest.fn() }),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../lib/contentArchitecture';
import { ensurePersonalForecast, getCachedPersonalForecast, getCompatibleStalePersonalForecast } from '../lib/personalForecastCache';
import { PERSONAL_FORECAST_CONTRACT_VERSION, PERSONAL_FORECAST_PROMPT_VERSION, isPersonalForecastPackage, type PersonalForecastPeriod } from '../lib/personalForecastContract';
import { LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION, RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION } from '../lib/personalForecastWireCompatibility';
import { db } from '../lib/db';
import handler from '../pages/api/content/forecast/personal';
import { personalForecastFixture } from './personal-forecast-fixture';

async function request(input: {
  period: PersonalForecastPeriod;
  method?: 'GET' | 'POST';
  version?: unknown;
  promptVersion?: unknown;
  periodKey?: string;
  regenerate?: boolean;
}) {
  const result: { status: number; body: any } = { status: 200, body: null };
  const response = {
    status(code: number) { result.status = code; return response; },
    json(body: unknown) { result.body = body; return response; },
  } as unknown as NextApiResponse;
  await handler({
    method: input.method || 'GET', headers: {},
    query: { period: input.period, ...(input.periodKey ? { periodKey: input.periodKey } : {}), ...(input.version === undefined ? {} : { contractVersion: input.version }), ...(input.promptVersion === undefined ? {} : { promptVersion: input.promptVersion }) },
    body: { period: input.period, ...(input.periodKey ? { periodKey: input.periodKey } : {}), ...(input.regenerate ? { regenerate: true } : {}) },
  } as unknown as NextApiRequest, response);
  return result;
}

describe('forecast API wire negotiation and entitlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAppUser as jest.Mock).mockResolvedValue({ userId: 'wire-user' });
    (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: true });
    (getCachedPersonalForecast as jest.Mock).mockResolvedValue(null);
    (getCompatibleStalePersonalForecast as jest.Mock).mockResolvedValue(null);
  });

  it('returns an app-open forecast in the same installed-APK POST when preparation already owns the lock', async () => {
    jest.useFakeTimers();
    try {
      const forecast = personalForecastFixture();
      (getCachedPersonalForecast as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ forecast });
      (ensurePersonalForecast as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve({ status: 'in_progress', retryAfterMs: 1500 }), 1500);
      }));
      let responded = false;
      const pending = request({ period: 'day', method: 'POST', version: RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION });
      void pending.then(() => { responded = true; });

      await jest.advanceTimersByTimeAsync(1500);
      expect(responded).toBe(false);
      await jest.advanceTimersByTimeAsync(3000);
      const result = await pending;

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ source: 'cache', forecast: {
        meta: { contractVersion: RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION },
      } });
      expect(ensurePersonalForecast).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it('keeps the 20-second response budget and compatible pending response when preparation takes longer', async () => {
    jest.useFakeTimers();
    try {
      (ensurePersonalForecast as jest.Mock).mockResolvedValue({ status: 'in_progress', retryAfterMs: 1500 });
      let responded = false;
      const pending = request({ period: 'day', method: 'POST', version: RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION });
      void pending.then(() => { responded = true; });

      await jest.advanceTimersByTimeAsync(19_999);
      expect(responded).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      const result = await pending;

      expect(result.status).toBe(202);
      expect(result.body).toMatchObject({ code: 'GENERATION_IN_PROGRESS', retryAfterMs: 1500 });
      expect(ensurePersonalForecast).toHaveBeenCalledTimes(1);
      const readsAtResponse = (getCachedPersonalForecast as jest.Mock).mock.calls.length;
      await jest.advanceTimersByTimeAsync(60_000);
      expect(getCachedPersonalForecast).toHaveBeenCalledTimes(readsAtResponse);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it('keeps an empty cache-only GET immediate and never starts or waits for generation', async () => {
    jest.useFakeTimers();
    try {
      const result = await request({ period: 'day', version: RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION });
      expect(result.status).toBe(404);
      expect(result.body.code).toBe('PERSONAL_FORECAST_NOT_READY');
      expect(ensurePersonalForecast).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it('does not return the previous saved text while waiting for an explicit regeneration', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T12:00:00Z'));
    try {
      const previous = personalForecastFixture();
      previous.meta.generatedAt = '2026-10-16T11:00:00Z';
      const fresh = personalForecastFixture();
      fresh.meta.generatedAt = '2026-10-16T12:00:01Z';
      (getCachedPersonalForecast as jest.Mock)
        .mockResolvedValueOnce({ forecast: previous })
        .mockResolvedValueOnce({ forecast: fresh });
      (ensurePersonalForecast as jest.Mock).mockResolvedValue({ status: 'in_progress', retryAfterMs: 1500 });
      let responded = false;
      const pending = request({ period: 'day', method: 'POST', regenerate: true, version: RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION });
      void pending.then(() => { responded = true; });

      await jest.advanceTimersByTimeAsync(1500);
      expect(responded).toBe(false);
      await jest.advanceTimersByTimeAsync(1500);
      const result = await pending;

      expect(result.status).toBe(200);
      expect(result.body.forecast.meta.generatedAt).toBe(fresh.meta.generatedAt);
      expect(ensurePersonalForecast).toHaveBeenCalledWith(expect.anything(), {
        forceRegenerate: true, minimumGeneratedAt: '2026-10-16T12:00:00.000Z',
      });
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it.each((['cache', 'stale', 'generated'] as const).flatMap((source) => (
    [undefined, RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION].map((version) => ({ source, version }))
  )))('projects the $source response for APK version $version without changing cache identity', async ({ source, version }) => {
    const forecast = personalForecastFixture();
    if (source === 'cache') (getCachedPersonalForecast as jest.Mock).mockResolvedValue({ forecast });
    if (source === 'stale') (getCompatibleStalePersonalForecast as jest.Mock).mockResolvedValue({ forecast });
    (ensurePersonalForecast as jest.Mock).mockResolvedValue({ status: 'ready', value: forecast, fromCache: false });
    const result = await request({ period: 'day', method: source === 'generated' ? 'POST' : 'GET', version });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ source, accessTier: 'premium', forecast: {
      meta: { contractVersion: version || LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION },
    } });
    expect(forecast.meta.contractVersion).toBe(PERSONAL_FORECAST_CONTRACT_VERSION);
    expect(ensurePersonalForecast).toHaveBeenCalledTimes(source === 'cache' ? 0 : 1);
    for (const [input] of (getCachedPersonalForecast as jest.Mock).mock.calls) {
      expect(input).not.toHaveProperty('contractVersion');
      expect(input).toMatchObject({ userId: 'wire-user', accessTier: 'premium' });
    }
  });

  it.each<PersonalForecastPeriod>(['day', 'week', 'month'])('serves a strict current Premium %s package on explicit negotiation', async (period) => {
    const forecast = personalForecastFixture(period);
    (getCachedPersonalForecast as jest.Mock).mockResolvedValue({ forecast });
    const result = await request({ period, version: PERSONAL_FORECAST_CONTRACT_VERSION, promptVersion: PERSONAL_FORECAST_PROMPT_VERSION });
    expect(result.status).toBe(200);
    expect(isPersonalForecastPackage(result.body.forecast)).toBe(true);
    expect(result.body.forecast.meta.contractVersion).toBe(PERSONAL_FORECAST_CONTRACT_VERSION);
    expect(ensurePersonalForecast).not.toHaveBeenCalled();
  });

  it.each([undefined, RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION, PERSONAL_FORECAST_CONTRACT_VERSION])('keeps Free Day complete with version %s', async (version) => {
    (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: false });
    const forecast = personalForecastFixture();
    (getCachedPersonalForecast as jest.Mock).mockResolvedValue({ forecast });
    const result = await request({ period: 'day', version });
    expect(result.status).toBe(200);
    expect(result.body.accessTier).toBe('free');
    const visible = [result.body.forecast.overview, ...result.body.forecast.sections]
      .filter((section) => !result.body.lockedSectionIds.includes(section.id));
    expect(visible.map((section) => section.text).join(' ').replace(/\s+/g, ' ').trim()).toBe(forecast.overview.text.replace(/\s+/g, ' ').trim());
    expect(getCachedPersonalForecast).toHaveBeenCalledWith(expect.objectContaining({ accessTier: 'free' }));
    expect(ensurePersonalForecast).not.toHaveBeenCalled();
  });

  it.each<PersonalForecastPeriod>(['week', 'month'])('denies Free %s for every wire version and method before any cache or generator call', async (period) => {
    (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: false });
    for (const version of [undefined, LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION, RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION, 'personal-forecast-feed-v30-nebo-human-voice', PERSONAL_FORECAST_CONTRACT_VERSION]) {
      for (const method of ['GET', 'POST'] as const) {
        const result = await request({ period, method, version });
        expect(result.status).toBe(403);
        expect(result.body.code).toBe('PERSONAL_FORECAST_PREMIUM_REQUIRED');
        expect(result.body).not.toHaveProperty('forecast');
      }
    }
    expect(getCachedPersonalForecast).not.toHaveBeenCalled();
    expect(getCompatibleStalePersonalForecast).not.toHaveBeenCalled();
    expect(ensurePersonalForecast).not.toHaveBeenCalled();
  });

  it('rejects unsupported versions clearly before reading personal content', async () => {
    for (const version of ['unknown-version', '', ['v25', PERSONAL_FORECAST_CONTRACT_VERSION]]) {
      const result = await request({ period: 'day', method: 'POST', version });
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ code: 'PERSONAL_FORECAST_CONTRACT_UNSUPPORTED', message: expect.any(String) });
    }
    expect(db.users.get).not.toHaveBeenCalled();
    expect(getCachedPersonalForecast).not.toHaveBeenCalled();
    expect(ensurePersonalForecast).not.toHaveBeenCalled();
  });

  it.each(['cache', 'stale', 'generated'] as const)('keeps the installed 1.0.5 prompt identity on the %s path', async (source) => {
    const forecast = personalForecastFixture();
    if (source === 'cache') (getCachedPersonalForecast as jest.Mock).mockResolvedValue({ forecast });
    if (source === 'stale') (getCompatibleStalePersonalForecast as jest.Mock).mockResolvedValue({ forecast });
    (ensurePersonalForecast as jest.Mock).mockResolvedValue({ status: 'ready', value: forecast, fromCache: false });
    const result = await request({ period: 'day', method: source === 'generated' ? 'POST' : 'GET', version: 'personal-forecast-feed-v34-direct-prose' });
    expect(result.status).toBe(200);
    expect(result.body.forecast.meta.promptVersion).toBe('personal-forecast-feed.v57-grounded-today+week-month+forecast-voice.16');
    expect(result.body.forecast.meta.currentGeneration.promptVersion).toBe(PERSONAL_FORECAST_PROMPT_VERSION);
    expect(forecast.meta.promptVersion).toBe(PERSONAL_FORECAST_PROMPT_VERSION);
  });

  it('rejects unsupported prompt identities before reading personal content', async () => {
    const result = await request({ period: 'day', version: PERSONAL_FORECAST_CONTRACT_VERSION, promptVersion: 'unknown-prompt' });
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('PERSONAL_FORECAST_CONTRACT_UNSUPPORTED');
    expect(db.users.get).not.toHaveBeenCalled();
    expect(getCachedPersonalForecast).not.toHaveBeenCalled();
  });

  it('gates future dates before cache access for both installed and current clients', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-08T12:00:00Z'));
    try {
      (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: false });
      for (const version of [undefined, PERSONAL_FORECAST_CONTRACT_VERSION]) {
        for (const method of ['GET', 'POST'] as const) {
          // Today and tomorrow are free; the day after belongs to NEBO Premium.
          const denied = await request({ period: 'day', periodKey: '2026-09-10', method, version });
          expect(denied.status).toBe(403);
          expect(denied.body).not.toHaveProperty('forecast');
        }
      }
      expect(getCachedPersonalForecast).not.toHaveBeenCalled();
      expect(ensurePersonalForecast).not.toHaveBeenCalled();
      (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: true });
      expect((await request({ period: 'day', periodKey: '2026-10-09', version: PERSONAL_FORECAST_CONTRACT_VERSION })).status).toBe(400);
      expect(getCachedPersonalForecast).not.toHaveBeenCalled();
      const forecast = personalForecastFixture();
      (getCachedPersonalForecast as jest.Mock).mockResolvedValue({ forecast });
      expect((await request({ period: 'day', periodKey: '2026-10-08', version: PERSONAL_FORECAST_CONTRACT_VERSION })).status).toBe(200);
      expect(getCachedPersonalForecast).toHaveBeenLastCalledWith(expect.objectContaining({ periodKey: '2026-10-08', accessTier: 'premium' }));
    } finally { jest.useRealTimers(); }
  });
});
