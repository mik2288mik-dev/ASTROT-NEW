import {
  ensurePersonalForecast,
  type PersonalForecastCacheContext,
} from '../lib/personalForecastCache';
import {
  buildPersonalForecastPrewarmProfile,
  buildPersonalForecastPrewarmTargets,
  prewarmPersonalForecastHorizon,
  prewarmPersonalForecastIncrement,
  resetPersonalForecastPrewarmForTests,
  type PersonalForecastPrewarmRuntime,
  type PersonalForecastIncrementRuntime,
} from '../lib/personalForecastPrewarm';
import {
  buildPersonalForecastBirthProfileFingerprint,
  getPersonalForecastRawProfile,
  getPersonalForecastDayHorizon,
  getPersonalForecastPeriodAccess,
  MAX_FUTURE_FORECAST_DAYS,
  isPersonalForecastPeriodAllowedForTier,
  type PersonalForecastRawProfile,
} from '../lib/personalForecastContract';

const profile: PersonalForecastRawProfile = {
  id: 'user-1',
  name: 'Mira',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Moscow',
  birthTimezone: 'Europe/Moscow',
  gender: 'female',
  language: 'ru',
};

function runtime(input: {
  cached?: Set<string>;
  ensureDelay?: Promise<void>;
} = {}): PersonalForecastPrewarmRuntime {
  const key = (target: PersonalForecastCacheContext) => (
    `${target.accessTier}:${target.period}:${target.periodKey}`
  );
  return {
    readCached: jest.fn(async (target) => (
      input.cached?.has(key(target)) ? ({ forecast: {} } as never) : null
    )),
    ensure: jest.fn(async () => {
      await input.ensureDelay;
      return { status: 'ready' as const, value: {} as never, fromCache: false };
    }),
  };
}

describe('personal forecast rolling prewarm', () => {
  beforeEach(() => {
    resetPersonalForecastPrewarmForTests();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses canonical approximate birth-time settings and timezone for cache identity', () => {
    const canonical = buildPersonalForecastPrewarmProfile('user-1', {
      name: 'Mira', birth_date: '1990-01-01', birth_time: '12:00', birth_place: 'Moscow',
      birth_time_mode: 'exact', birth_timezone: 'Europe/Moscow', gender: 'female', language: 'ru',
    }, {
      birth_time_mode: 'approximate', birth_time_uncertainty_minutes: 30,
    });

    expect(canonical).not.toBeNull();
    expect(getPersonalForecastRawProfile(canonical!)).toMatchObject({
      birth_time: '12:00',
      birth_time_mode: 'approximate',
      birth_time_uncertainty_minutes: 30,
      birth_timezone: 'Europe/Moscow',
    });
    expect(buildPersonalForecastBirthProfileFingerprint(canonical!)).toBe(
      buildPersonalForecastBirthProfileFingerprint({
        ...profile,
        birthTimeMode: 'approximate',
        birthTimeUncertaintyMinutes: 30,
      }),
    );
  });

  it('normalizes unknown birth time consistently even when a stale time remains', () => {
    const canonical = buildPersonalForecastPrewarmProfile('user-1', {
      name: 'Mira', birth_date: '1990-01-01', birth_time: '12:00', birth_place: 'Moscow',
      birth_timezone: 'Europe/Moscow', gender: 'female', language: 'ru',
    }, {
      birth_time_mode: 'unknown', birth_time_uncertainty_minutes: 30,
    });

    expect(canonical).not.toBeNull();
    expect(getPersonalForecastRawProfile(canonical!)).toMatchObject({
      birth_time: null,
      birth_time_mode: 'unknown',
      birth_time_uncertainty_minutes: null,
      birth_timezone: 'Europe/Moscow',
    });
    expect(buildPersonalForecastBirthProfileFingerprint(canonical!)).toBe(
      buildPersonalForecastBirthProfileFingerprint({
        ...profile,
        birthTime: '',
        birthTimeMode: 'unknown',
        birthTimeUncertaintyMinutes: null,
      }),
    );
  });

  it('builds Today and four following Free day targets without Week or Month', () => {
    const targets = buildPersonalForecastPrewarmTargets({
      accessTier: 'free',
      timezone: 'Europe/Moscow',
      now: new Date('2026-08-25T09:00:00.000Z'),
    });
    expect(targets).toEqual([
      { accessTier: 'free', period: 'day', periodKey: '2026-08-25' },
      { accessTier: 'free', period: 'day', periodKey: '2026-08-26' },
      { accessTier: 'free', period: 'day', periodKey: '2026-08-27' },
      { accessTier: 'free', period: 'day', periodKey: '2026-08-28' },
      { accessTier: 'free', period: 'day', periodKey: '2026-08-29' },
    ]);
    expect(isPersonalForecastPeriodAllowedForTier('free', 'week')).toBe(false);
    expect(isPersonalForecastPeriodAllowedForTier('free', 'month')).toBe(false);
  });

  it('does not regenerate cached rolling days', async () => {
    const cached = new Set([
      'free:day:2026-08-25',
      'free:day:2026-08-26',
      'free:day:2026-08-27',
    ]);
    const injected = runtime({ cached });
    const result = await prewarmPersonalForecastHorizon({
      userId: 'user-1', profile, accessTier: 'free', reason: 'app_open',
      now: new Date('2026-08-25T09:00:00.000Z'),
    }, injected);
    expect(result.cached).toHaveLength(3);
    expect(result.generated).toHaveLength(2);
    expect(injected.ensure).toHaveBeenCalledTimes(2);
  });

  it('does not use a Premium package to satisfy Free Today', async () => {
    const injected = runtime({ cached: new Set(['premium:day:2026-08-25']) });
    await prewarmPersonalForecastHorizon({
      userId: 'user-1', profile, accessTier: 'free', reason: 'app_open',
      now: new Date('2026-08-25T09:00:00.000Z'), maxMissingGenerations: 1,
    }, injected);
    expect(injected.ensure).toHaveBeenCalledWith(expect.objectContaining({
      accessTier: 'free', period: 'day', periodKey: '2026-08-25',
    }));
  });

  it('rejects direct Free Week and Month generation before cache identity resolution', async () => {
    const input = { userId: 'user-1', profile, accessTier: 'free' as const, periodKey: '2026-W35' };
    await expect(ensurePersonalForecast({ ...input, period: 'week' })).rejects
      .toThrow('PERSONAL_FORECAST_PREMIUM_REQUIRED');
    await expect(ensurePersonalForecast({ ...input, period: 'month', periodKey: '2026-08' })).rejects
      .toThrow('PERSONAL_FORECAST_PREMIUM_REQUIRED');
  });

  it('uses only Premium identities after an upgrade and never treats Free cache as complete', async () => {
    const injected = runtime({ cached: new Set(['free:day:2026-08-25']) });
    await prewarmPersonalForecastHorizon({
      userId: 'user-1', profile, accessTier: 'premium', reason: 'premium_activated',
      now: new Date('2026-08-25T09:00:00.000Z'), maxMissingGenerations: 1,
    }, injected);
    expect(injected.ensure).toHaveBeenCalledTimes(1);
    expect(injected.ensure).toHaveBeenCalledWith(expect.objectContaining({
      accessTier: 'premium', period: 'day', periodKey: '2026-08-25',
    }));
    for (const call of (injected.readCached as jest.Mock).mock.calls) {
      expect(call[0].accessTier).toBe('premium');
    }
  });

  it('coalesces concurrent horizon requests so each missing target is generated once', async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const injected = runtime({ ensureDelay: barrier });
    const input = {
      userId: 'user-1', profile, accessTier: 'free' as const, reason: 'forecast_open' as const,
      now: new Date('2026-08-25T09:00:00.000Z'),
    };
    const first = prewarmPersonalForecastHorizon(input, injected);
    const second = prewarmPersonalForecastHorizon(input, injected);
    release();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toBe(secondResult);
    expect(injected.ensure).toHaveBeenCalledTimes(5);
  });

  it('does not coalesce a changed birth profile with an older in-flight horizon', async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const injected = runtime({ ensureDelay: barrier });
    const common = {
      userId: 'user-1', accessTier: 'free' as const, reason: 'birth_profile_completed' as const,
      now: new Date('2026-08-25T09:00:00.000Z'), maxTargets: 1,
    };
    const first = prewarmPersonalForecastHorizon({ ...common, profile }, injected);
    const changed = prewarmPersonalForecastHorizon({
      ...common,
      profile: { ...profile, birthDate: '1991-01-01' },
    }, injected);
    release();
    const [firstResult, changedResult] = await Promise.all([first, changed]);
    expect(firstResult).not.toBe(changedResult);
    expect(injected.ensure).toHaveBeenCalledTimes(2);
  });

  it('finishes a full horizon requested during a bounded scheduled increment', async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const cached = new Set<string>();
    const injected = runtime({ cached });
    (injected.ensure as jest.Mock).mockImplementation(async (target: PersonalForecastCacheContext) => {
      await barrier;
      cached.add(`${target.accessTier}:${target.period}:${target.periodKey}`);
      return { status: 'ready', value: {}, fromCache: false };
    });
    const input = { userId: '1', profile, accessTier: 'free' as const, reason: 'app_open' as const, now: new Date('2026-09-08T12:00:00Z') };
    const incremental = prewarmPersonalForecastHorizon({ ...input, maxMissingGenerations: 1 }, injected);
    const complete = prewarmPersonalForecastHorizon(input, injected);
    release();
    await Promise.all([incremental, complete]);
    expect(cached.size).toBe(5);
    expect(injected.ensure).toHaveBeenCalledTimes(5);
  });

  it('prepares five days before the current Premium Week and Month across a calendar boundary', () => {
    const targets = buildPersonalForecastPrewarmTargets({
      accessTier: 'premium',
      timezone: 'Europe/Moscow',
      now: new Date('2026-08-28T09:00:00.000Z'),
    });
    expect(targets.filter((target) => target.period === 'day')).toHaveLength(5);
    expect(targets.slice(0, 5).every((target) => target.period === 'day')).toBe(true);
    expect(targets.filter((target) => target.period === 'week').map((target) => target.periodKey))
      .toEqual(['2026-W35']);
    expect(targets.filter((target) => target.period === 'month').map((target) => target.periodKey))
      .toEqual(['2026-08']);
  });

  it('uses profile-local dates across midnight, year rollover and daylight saving', () => {
    expect(getPersonalForecastDayHorizon('Pacific/Kiritimati', new Date('2026-12-31T12:00:00Z')))
      .toEqual(['2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05']);
    expect(getPersonalForecastDayHorizon('America/New_York', new Date('2026-11-01T04:30:00Z')))
      .toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  });

  it('permits Premium up to thirty calendar days while keeping Free future text locked', () => {
    const common = { timezone: 'Europe/Moscow', now: new Date('2026-09-08T12:00:00Z'), period: 'day' as const };
    expect(MAX_FUTURE_FORECAST_DAYS).toBe(30);
    for (const accessTier of ['free', 'premium'] as const) {
      expect(getPersonalForecastPeriodAccess({ ...common, accessTier, periodKey: '2026-09-08' })).toBe('allowed');
      expect(getPersonalForecastPeriodAccess({ ...common, accessTier, periodKey: '2026-09-09' })).toBe(accessTier === 'premium' ? 'allowed' : 'premium_required');
      expect(getPersonalForecastPeriodAccess({ ...common, accessTier, periodKey: '2026-10-08' })).toBe(accessTier === 'premium' ? 'allowed' : 'premium_required');
      for (const periodKey of ['2026-09-07', '2026-10-09', '2026-09-31', 'garbage']) {
        expect(getPersonalForecastPeriodAccess({ ...common, accessTier, periodKey })).toBe('outside_horizon');
      }
    }
  });

  it('fills Today across the scanned users before advancing to tomorrow', async () => {
    const empty = { targets: [], cached: [], generated: [], inProgress: [], failed: [], skippedEntitlement: [] };
    const now = new Date('2026-09-08T12:00:00Z');
    const ids = ['1', '2', '3'];
    const injected: PersonalForecastIncrementRuntime = {
      listUsers: jest.fn(async (after, limit) => ids.filter((id) => id > after).slice(0, limit)),
      loadUser: jest.fn(async (userId) => ({ userId, profile, accessTier: 'premium' as const })),
      prewarm: jest.fn(async () => ({ ...empty, generated: [{}] })),
    };
    expect(await prewarmPersonalForecastIncrement({ now, userLimit: 2 }, injected))
      .toEqual({ scanned: 2, generated: 2, inProgress: 0, failed: 0 });
    expect(await prewarmPersonalForecastIncrement({ now, userLimit: 2 }, injected))
      .toEqual({ scanned: 1, generated: 1, inProgress: 0, failed: 0 });
    expect((injected.prewarm as jest.Mock).mock.calls.slice(0, 3).every((call) => call[0].targetIndex === 0))
      .toBe(true);
    await prewarmPersonalForecastIncrement({ now, userLimit: 2 }, injected);
    expect((injected.prewarm as jest.Mock).mock.calls.slice(3).every((call) => call[0].targetIndex === 1))
      .toBe(true);
    expect(injected.listUsers).toHaveBeenLastCalledWith('', 2, now);
  });

  it('prepares Free fallback only from the calendar day Premium expires', async () => {
    const injected = runtime();
    const result = await prewarmPersonalForecastHorizon({
      userId: 'user-1', profile, accessTier: 'free', reason: 'scheduled_refresh',
      now: new Date('2026-08-25T09:00:00.000Z'), notBeforeDayKey: '2026-08-28',
    }, injected);
    expect(result.generated.map((target) => target.periodKey)).toEqual(['2026-08-28', '2026-08-29']);
    expect(injected.ensure).toHaveBeenCalledTimes(2);
  });

  it('keeps a partial reading available while retrying its complete replacement later', async () => {
    const injected = runtime();
    (injected.readCached as jest.Mock).mockResolvedValue({ forecast: {
      meta: {
        diagnosticCode: 'PERSONAL_FORECAST_PARTIAL_RECOVERY',
        generatedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      },
    } });
    const result = await prewarmPersonalForecastHorizon({
      userId: 'user-1', profile, accessTier: 'free', reason: 'scheduled_refresh',
      now: new Date('2026-08-25T09:00:00.000Z'), maxTargets: 1,
    }, injected);
    expect(result.generated).toHaveLength(1);
    expect(injected.ensure).toHaveBeenCalledWith(expect.objectContaining({
      period: 'day', periodKey: '2026-08-25',
    }), { forceRegenerate: true });
  });

  it('lets a later day be generated even when Today keeps failing', async () => {
    const now = new Date('2026-09-08T12:00:00Z');
    const injected = runtime();
    (injected.ensure as jest.Mock).mockImplementation(async (target: PersonalForecastCacheContext) => {
      if (target.periodKey === '2026-09-08') throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:VOICE:COACHING');
      return { status: 'ready', value: {} as never, fromCache: false };
    });
    const today = await prewarmPersonalForecastHorizon({
      userId: 'user-1', profile, accessTier: 'free', reason: 'scheduled_refresh', now,
      targetIndex: 0, maxMissingGenerations: 1,
    }, injected);
    const tomorrow = await prewarmPersonalForecastHorizon({
      userId: 'user-1', profile, accessTier: 'free', reason: 'scheduled_refresh', now,
      targetIndex: 1, maxMissingGenerations: 1,
    }, injected);
    expect(today.failed).toHaveLength(1);
    expect(tomorrow.generated).toHaveLength(1);
    expect(injected.ensure).toHaveBeenLastCalledWith(expect.objectContaining({ periodKey: '2026-09-09' }));
    expect((console.info as jest.Mock).mock.calls.some((call) =>
      String(call[1]).includes('PERSONAL_FORECAST_GENERATION_INVALID:VOICE:COACHING'))).toBe(true);
  });

  it('keeps concurrent background generations within the shared two-slot budget', async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    let twoStarted!: () => void;
    const started = new Promise<void>((resolve) => { twoStarted = resolve; });
    let active = 0;
    let peak = 0;
    const injected = runtime();
    (injected.ensure as jest.Mock).mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      if (active === 2) twoStarted();
      await barrier;
      active -= 1;
      return { status: 'ready', value: {}, fromCache: false };
    });
    const jobs = ['user-1', 'user-2', 'user-3'].map((userId) =>
      prewarmPersonalForecastHorizon({
        userId, profile: { ...profile, id: userId }, accessTier: 'free',
        reason: 'app_open', now: new Date('2026-09-08T12:00:00Z'), targetIndex: 0,
      }, injected));
    await started;
    release();
    await Promise.all(jobs);
    expect(peak).toBe(2);
  });

  it('coalesces overlapping scheduler ticks and releases the slot after a failure', async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const injected: PersonalForecastIncrementRuntime = {
      listUsers: jest.fn(async () => ['1']),
      loadUser: jest.fn(async (userId) => ({ userId, profile, accessTier: 'free' as const })),
      prewarm: jest.fn(async () => { await barrier; throw new Error('temporary failure'); }),
    };
    const first = prewarmPersonalForecastIncrement({}, injected);
    const second = prewarmPersonalForecastIncrement({}, injected);
    expect(first).toBe(second);
    release();
    expect(await first).toMatchObject({ failed: 1, generated: 0 });
    expect(injected.prewarm).toHaveBeenCalledTimes(1);
    await prewarmPersonalForecastIncrement({}, injected);
    expect(injected.prewarm).toHaveBeenCalledTimes(2);
  });
});
