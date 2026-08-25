import {
  ensurePersonalForecast,
  type PersonalForecastCacheContext,
} from '../lib/personalForecastCache';
import {
  buildPersonalForecastPrewarmTargets,
  prewarmPersonalForecastHorizon,
  resetPersonalForecastPrewarmForTests,
  type PersonalForecastPrewarmRuntime,
} from '../lib/personalForecastPrewarm';
import {
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

  it('builds exactly five Free day targets and never includes Week or Month', () => {
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

  it('adds only the next Week and Month when the five-day Premium horizon crosses both boundaries', () => {
    const targets = buildPersonalForecastPrewarmTargets({
      accessTier: 'premium',
      timezone: 'Europe/Moscow',
      now: new Date('2026-08-28T09:00:00.000Z'),
    });
    expect(targets.filter((target) => target.period === 'day')).toHaveLength(5);
    expect(targets.filter((target) => target.period === 'week').map((target) => target.periodKey))
      .toEqual(['2026-W35', '2026-W36']);
    expect(targets.filter((target) => target.period === 'month').map((target) => target.periodKey))
      .toEqual(['2026-08', '2026-09']);
  });
});
