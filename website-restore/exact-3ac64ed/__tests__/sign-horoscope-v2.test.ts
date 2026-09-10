import type { PlanetaryTransitsAtResult } from '../lib/swisseph-calculator';
import type { SignHoroscopePeriod, SignHoroscopeReadingV2 } from '../types';
import { ZODIAC_KEYS, type ZodiacKey } from '../lib/zodiacKeys';
import {
  buildMoscowSignSampleDates,
  buildSignSkyBatchDigest,
  getSignRulers,
  getWholeSignSolarHouse,
} from '../lib/horoscope/signSkyDigest';
import {
  generateSignHoroscopeBatchWithRunner,
  SIGN_HOROSCOPE_MODEL,
  type SignHoroscopeBatchGenerationResult,
} from '../lib/horoscope/signGeneration';
import { validateSignHoroscopeReading } from '../lib/horoscope/signContract';
import {
  fillMissingSignHoroscopes,
  getOrGenerateSignHoroscope,
  type SignHoroscopeRuntime,
} from '../lib/horoscope/signOrchestrator';
import {
  SIGN_MONTH_PREWARM_WORK_LIMIT,
  buildSignMonthPrewarmTargets,
  getSignPrewarmTargets,
  prewarmNextSignMonthIncrement,
} from '../lib/horoscope/signPrewarm';

const PLANETS = [
  'sun', 'moon', 'mercury', 'venus', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
] as const;

function position(planet: string, longitude: number, speedLongitude = 0.2) {
  const normalized = ((longitude % 360) + 360) % 360;
  const sign = ZODIAC_KEYS[Math.floor(normalized / 30)];
  return {
    planet,
    sign,
    longitude: normalized,
    degree: normalized % 30,
    retrograde: speedLongitude < 0,
    speedLongitude,
  };
}

function transitAt(date: Date): PlanetaryTransitsAtResult {
  const drift = date.getTime() / 86_400_000;
  return {
    source: 'swisseph',
    date: date.toISOString(),
    julianDay: 0,
    ...Object.fromEntries(PLANETS.map((planet, index) => [
      planet,
      position(planet, index * 31 + drift * (index < 2 ? 0.5 : 0.02), index === 7 ? -0.01 : 0.2),
    ])),
  } as PlanetaryTransitsAtResult;
}

function reading(
  sign: ZodiacKey,
  period: SignHoroscopePeriod,
  periodKey: string,
): SignHoroscopeReadingV2 {
  return {
    schemaVersion: 'sign-horoscope-reading-v4',
    sign,
    period,
    periodKey,
    headline: 'Keep the answer clear',
    text: `For ${sign}, the period rewards a direct choice and a calm pace. Finish the useful conversation before adding another task.`,
  };
}

function modelPayload(signs: readonly ZodiacKey[], invalidSign?: ZodiacKey): string {
  return JSON.stringify({
    readings: signs.map((sign) => ({
      sign,
      headline: sign === invalidSign ? '' : 'Keep the answer clear',
      text: sign === invalidSign
        ? ''
        : `For ${sign}, finish the useful conversation before adding another task.`,
    })),
  });
}

describe('shared sign horoscope contract', () => {
  it('keeps the deterministic Swiss calculation as the hidden source', () => {
    expect(getSignRulers('Scorpio')).toMatchObject([
      { planet: 'pluto', tradition: 'modern' },
      { planet: 'mars', tradition: 'traditional' },
    ]);
    expect(getSignRulers('Aquarius')).toHaveLength(2);
    expect(getWholeSignSolarHouse('Aries', 'Libra')).toBe(7);

    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    expect(digest.source).toBe('Swiss Ephemeris');
    expect(digest.samples).toHaveLength(5);
    expect(digest.signs).toHaveLength(12);
    expect(digest.signs.every((item) => item.solarHousePlacements.length >= 10)).toBe(true);
  });

  it('samples day, week, and month in Moscow deterministically', () => {
    const day = buildMoscowSignSampleDates('day', '2026-08-09');
    expect(day).toHaveLength(5);
    expect(day[0].toISOString()).toBe('2026-08-08T21:00:00.000Z');
    expect(day[4].toISOString()).toBe('2026-08-09T20:59:00.000Z');
    expect(buildMoscowSignSampleDates('week', '2026-W32')).toHaveLength(7);
    expect(buildMoscowSignSampleDates('month', '2028-02')).toHaveLength(29);
  });

  it('accepts only one headline and one coherent text', () => {
    const result = validateSignHoroscopeReading(
      { headline: 'Choose the clean answer', text: 'The useful move is already visible. Make it without adding drama.' },
      { sign: 'Aries', period: 'day', periodKey: '2026-08-09' },
    );
    expect(result).toEqual({
      ok: true,
      reading: {
        schemaVersion: 'sign-horoscope-reading-v4',
        sign: 'Aries',
        period: 'day',
        periodKey: '2026-08-09',
        headline: 'Choose the clean answer',
        text: 'The useful move is already visible. Make it without adding drama.',
      },
    });
  });

  it('counts headline and text together in the 130-word limit', () => {
    const text = Array.from({ length: 127 }, () => 'direct').join(' ');
    expect(validateSignHoroscopeReading(
      { headline: 'Three clear words', text },
      { sign: 'Aries', period: 'day', periodKey: '2026-08-09' },
    ).ok).toBe(true);
    expect(validateSignHoroscopeReading(
      { headline: 'Four very clear words', text },
      { sign: 'Aries', period: 'day', periodKey: '2026-08-09' },
    ).ok).toBe(false);
  });

  it('rejects astrology and planet names in every user-facing field', () => {
    expect(validateSignHoroscopeReading(
      { headline: 'Mars sets the pace', text: 'Act calmly.' },
      { sign: 'Aries', period: 'day', periodKey: '2026-08-09' },
    ).ok).toBe(false);
    expect(validateSignHoroscopeReading(
      { headline: 'Keep the pace clear', text: 'A retrograde transit demands a pause.' },
      { sign: 'Aries', period: 'day', periodKey: '2026-08-09' },
    ).ok).toBe(false);
  });

  it('asks DeepSeek once for all twelve signs and sends the Swiss digest once', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const calls: Array<{ system: string; user: string }> = [];
    const result = await generateSignHoroscopeBatchWithRunner(
      digest,
      ZODIAC_KEYS,
      'ru',
      async (request) => {
        calls.push(request);
        return modelPayload(ZODIAC_KEYS);
      },
    );

    expect(SIGN_HOROSCOPE_MODEL).toMatch(/^deepseek-/);
    expect(result.readings).toHaveLength(12);
    expect(result.failures).toEqual([]);
    expect(calls).toHaveLength(1);
    const request = JSON.parse(calls[0].user);
    expect(request.signs).toEqual(ZODIAC_KEYS);
    expect(request.calculatedContext.signs).toHaveLength(12);
    expect(calls[0].user.match(/"source":"Swiss Ephemeris"/g)).toHaveLength(1);
    expect(calls[0].user).not.toContain('evidenceId');
    expect(calls[0].user).not.toContain('"astrology"');
  });

  it('repairs only the invalid sign after the twelve-sign batch', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const requestedSigns: ZodiacKey[][] = [];
    const result = await generateSignHoroscopeBatchWithRunner(
      digest,
      ZODIAC_KEYS,
      'en',
      async ({ user }) => {
        const signs = JSON.parse(user).signs as ZodiacKey[];
        requestedSigns.push(signs);
        return requestedSigns.length === 1
          ? modelPayload(signs, 'Pisces')
          : modelPayload(signs);
      },
    );

    expect(result.readings).toHaveLength(12);
    expect(result.failures).toEqual([]);
    expect(requestedSigns).toEqual([ZODIAC_KEYS, ['Pisces']]);
  });

  it('returns valid signs even when one repair remains invalid', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const result = await generateSignHoroscopeBatchWithRunner(
      digest,
      ['Aries', 'Pisces'],
      'en',
      async ({ user }) => {
        const signs = JSON.parse(user).signs as ZodiacKey[];
        return modelPayload(signs, 'Pisces');
      },
    );

    expect(result.readings.map((item) => item.sign)).toEqual(['Aries']);
    expect(result.failures).toEqual([
      expect.objectContaining({ sign: 'Pisces' }),
    ]);
  });

  it('returns a cached sign before calculating or calling DeepSeek', async () => {
    const cached = reading('Leo', 'day', '2026-08-09');
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockImplementation(async (_period, sign) => sign === 'Leo' ? cached : null),
      readCachedBatch: jest.fn(),
      buildDigest: jest.fn(),
      generate: jest.fn(),
      store: jest.fn(),
    };
    await expect(getOrGenerateSignHoroscope('day', 'Leo', '2026-08-09', 'en', runtime)).resolves.toBe(cached);
    expect(runtime.buildDigest).not.toHaveBeenCalled();
    expect(runtime.readCachedBatch).not.toHaveBeenCalled();
    expect(runtime.generate).not.toHaveBeenCalled();
    expect(runtime.store).not.toHaveBeenCalled();
  });

  it('fills an empty period with one twelve-sign generation call', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const generated: SignHoroscopeBatchGenerationResult = {
      readings: ZODIAC_KEYS.map((sign) => reading(sign, 'day', digest.periodKey)),
      failures: [],
    };
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockResolvedValue(null),
      readCachedBatch: jest.fn().mockResolvedValue({}),
      buildDigest: jest.fn().mockReturnValue(digest),
      generate: jest.fn().mockResolvedValue(generated),
      store: jest.fn().mockResolvedValue(undefined),
    };

    await expect(getOrGenerateSignHoroscope('day', 'Leo', digest.periodKey, 'en', runtime))
      .resolves.toMatchObject({ sign: 'Leo' });
    expect(runtime.generate).toHaveBeenCalledTimes(1);
    expect(runtime.generate).toHaveBeenCalledWith(digest, ZODIAC_KEYS, 'en');
    expect(runtime.store).toHaveBeenCalledTimes(12);
    expect(runtime.readCachedBatch).toHaveBeenCalledTimes(1);
  });

  it('persists valid signs independently when one row fails', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const cachedSigns = ZODIAC_KEYS.filter((sign) => sign !== 'Aries' && sign !== 'Pisces');
    const cachedReadings = Object.fromEntries(
      cachedSigns.map((sign) => [sign, reading(sign, 'day', digest.periodKey)]),
    );
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockResolvedValue(null),
      readCachedBatch: jest.fn().mockResolvedValue(cachedReadings),
      buildDigest: jest.fn().mockReturnValue(digest),
      generate: jest.fn().mockResolvedValue({
        readings: [reading('Aries', 'day', digest.periodKey), reading('Pisces', 'day', digest.periodKey)],
        failures: [],
      }),
      store: jest.fn().mockImplementation(async (_period, _periodKey, _language, item: SignHoroscopeReadingV2) => {
        if (item.sign === 'Pisces') throw new Error('single row failed');
      }),
    };

    const result = await fillMissingSignHoroscopes('day', digest.periodKey, 'en', runtime);
    expect(result.generatedSigns).toEqual(['Aries']);
    expect(result.failures).toEqual([
      expect.objectContaining({ sign: 'Pisces', issues: ['single row failed'] }),
    ]);
    expect(runtime.store).toHaveBeenCalledTimes(2);
    expect(runtime.generate).toHaveBeenCalledWith(digest, ['Aries', 'Pisces'], 'en');
  });

  it('does not generate a sign target that already has all twelve signs', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const cachedReadings = Object.fromEntries(
      ZODIAC_KEYS.map((sign) => [sign, reading(sign, 'day', digest.periodKey)]),
    );
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn(),
      readCachedBatch: jest.fn().mockResolvedValue(cachedReadings),
      buildDigest: jest.fn(),
      generate: jest.fn(),
      store: jest.fn(),
    };
    const result = await fillMissingSignHoroscopes('day', digest.periodKey, 'en', runtime);
    expect(result.cachedSigns).toEqual(ZODIAC_KEYS);
    expect(result.generatedSigns).toEqual([]);
    expect(runtime.generate).not.toHaveBeenCalled();
    expect(runtime.store).not.toHaveBeenCalled();
  });

  it('prewarms current and upcoming Moscow periods', () => {
    const targets = getSignPrewarmTargets(new Date('2026-05-31T16:00:00.000Z'));
    expect(targets).toEqual(expect.arrayContaining([
      { period: 'day', periodKey: '2026-05-31' },
      { period: 'day', periodKey: '2026-06-01' },
      expect.objectContaining({ period: 'week' }),
      { period: 'month', periodKey: '2026-06' },
    ]));
  });

  it('builds every calendar day, each unique ISO week, and one month target', () => {
    const targets = buildSignMonthPrewarmTargets('2026-09');
    const dayTargets = targets.filter((target) => target.period === 'day');
    const weekTargets = targets.filter((target) => target.period === 'week');
    const monthTargets = targets.filter((target) => target.period === 'month');
    expect(dayTargets).toHaveLength(30);
    expect(dayTargets[0].periodKey).toBe('2026-09-01');
    expect(dayTargets[29].periodKey).toBe('2026-09-30');
    expect(weekTargets.map((target) => target.periodKey)).toEqual([
      '2026-W36', '2026-W37', '2026-W38', '2026-W39', '2026-W40',
    ]);
    expect(new Set(weekTargets.map((target) => target.periodKey)).size).toBe(weekTargets.length);
    expect(monthTargets).toEqual([{ period: 'month', periodKey: '2026-09' }]);
  });

  it('uses at most one missing sign batch per incremental tick and resumes deterministically', async () => {
    expect(SIGN_MONTH_PREWARM_WORK_LIMIT).toBe(1);
    const completed = new Set<string>();
    const prewarmTarget = jest.fn(async (target: { period: SignHoroscopePeriod; periodKey: string }) => {
      const key = `${target.period}:${target.periodKey}`;
      if (completed.has(key)) return 'cached' as const;
      completed.add(key);
      return 'generated' as const;
    });
    const first = await prewarmNextSignMonthIncrement({
      now: new Date('2026-08-25T09:00:00.000Z'), prewarmTarget,
    });
    const second = await prewarmNextSignMonthIncrement({
      now: new Date('2026-08-25T09:00:00.000Z'), prewarmTarget,
    });
    expect(first).toMatchObject({ workUsed: 1, generated: 1, scannedTargets: 1 });
    expect(second).toMatchObject({ workUsed: 1, generated: 1, scannedTargets: 2, cached: 1 });
    expect(prewarmTarget).toHaveBeenCalledTimes(3);
  });

  it('leaves a failed incremental target eligible for an idempotent retry', async () => {
    let attempts = 0;
    const prewarmTarget = jest.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary provider failure');
      return 'generated' as const;
    });
    const first = await prewarmNextSignMonthIncrement({
      now: new Date('2026-08-25T09:00:00.000Z'), prewarmTarget,
    });
    const retry = await prewarmNextSignMonthIncrement({
      now: new Date('2026-08-25T09:00:00.000Z'), prewarmTarget,
    });
    expect(first).toMatchObject({ workUsed: 1, failed: 1 });
    expect(retry).toMatchObject({ workUsed: 1, generated: 1 });
    expect(prewarmTarget).toHaveBeenNthCalledWith(1,
      { period: 'day', periodKey: '2026-09-01' }, 'ru');
    expect(prewarmTarget).toHaveBeenNthCalledWith(2,
      { period: 'day', periodKey: '2026-09-01' }, 'ru');
  });
});
