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
import { parseCachedSignReading } from '../lib/horoscope/signCache';
import { projectSignHoroscopeForWire } from '../lib/horoscope/signWireCompatibility';
import {
  fillMissingSignHoroscopes,
  type SignHoroscopeRuntime,
} from '../lib/horoscope/signOrchestrator';
import {
  buildSignMonthPrewarmTargets,
  prewarmSignMonth,
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
    schemaVersion: 'sign-horoscope-reading-v5',
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
        schemaVersion: 'sign-horoscope-reading-v5',
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
    expect(request.outputContract).not.toHaveProperty('maxWordsTogetherPerSign');
    expect(calls[0].system).not.toContain('130');
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

  it('keeps an ordinary readable forecast without a style rewrite', async () => {
    const digest = buildSignSkyBatchDigest('week', '2026-W45', transitAt);
    const text = 'Появится возможность встретиться с друзьями.';
    const runner = jest.fn().mockResolvedValueOnce(
      JSON.stringify({ readings: [{ sign: 'Aries', headline: 'Хорошая неделя', text }] }),
    );

    const result = await generateSignHoroscopeBatchWithRunner(digest, ['Aries'], 'ru', runner);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(result.failures).toEqual([]);
    expect(result.readings).toEqual([expect.objectContaining({
      sign: 'Aries', period: 'week', periodKey: '2026-W45', headline: 'Хорошая неделя', text,
    })]);
  });

  it('keeps a readable repaired forecast despite style and length warnings', async () => {
    const digest = buildSignSkyBatchDigest('month', '2026-11', transitAt);
    const text = `Интерес к музыке вырастет. ${Array.from({ length: 135 }, () => 'музыка').join(' ')}`;
    const runner = jest.fn()
      .mockResolvedValueOnce(JSON.stringify({ readings: [{ sign: 'Pisces', headline: '', text: '' }] }))
      .mockResolvedValueOnce(JSON.stringify({ readings: [{ sign: 'Pisces', text, extra: true }] }));

    const result = await generateSignHoroscopeBatchWithRunner(digest, ['Pisces'], 'ru', runner);
    expect(result.failures).toEqual([]);
    expect(result.readings).toEqual([expect.objectContaining({
      sign: 'Pisces', period: 'month', periodKey: '2026-11', headline: 'Прогноз', text,
    })]);
  });

  it('keeps the first readable duplicate without rejecting ordinary words or long texts', async () => {
    const digest = buildSignSkyBatchDigest('week', '2026-W45', transitAt);
    const text = `Солнце выглянет из-за облаков. ${Array.from({ length: 140 }, () => 'слово').join(' ')}\n\nКонец.`;
    const runner = jest.fn().mockResolvedValue(JSON.stringify({ readings: [
      { sign: 'Aries', headline: '', text, extra: 'ignored' },
      { sign: 'Aries', headline: 'Другая версия', text: 'Второй ответ.' },
    ] }));
    const result = await generateSignHoroscopeBatchWithRunner(digest, ['Aries'], 'ru', runner);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(result.failures).toEqual([]);
    expect(result.readings).toEqual([expect.objectContaining({ sign: 'Aries', headline: 'Прогноз', text })]);
  });

  it('keeps complete forecasts when the provider truncates the outer JSON response', async () => {
    const digest = buildSignSkyBatchDigest('week', '2026-W45', transitAt);
    const truncated = '{"readings":[{"sign":"Aries","headline":"Первый","text":"Сохранённый {текст}."},'
      + '{"sign":"Pisces","headline":"Второй","text":"Знак \\" в строке."},{"sign":"Taurus","text":"unfinished';
    const runner = jest.fn().mockResolvedValueOnce(truncated).mockRejectedValueOnce(new Error('provider unavailable'));
    const result = await generateSignHoroscopeBatchWithRunner(digest, ['Aries', 'Pisces', 'Taurus'], 'ru', runner);
    expect(result.readings.map((item) => item.sign)).toEqual(['Aries', 'Pisces']);
    expect(result.readings[0].text).toBe('Сохранённый {текст}.');
    expect(result.failures).toEqual([expect.objectContaining({ sign: 'Taurus' })]);
    expect(JSON.parse(runner.mock.calls[1][0].user).signs).toEqual(['Taurus']);
  });

  it('preserves a readable forecast from the writer through storage, cache and the released wire format', async () => {
    const digest = buildSignSkyBatchDigest('week', '2026-W45', transitAt);
    const text = `Появится возможность встретиться с друзьями. ${Array.from({ length: 140 }, () => 'текст').join(' ')}\n\nСолнце выглянет из-за облаков.`;
    const stored = new Map<ZodiacKey, SignHoroscopeReadingV2>();
    const runner = jest.fn().mockImplementation(async ({ user }: { user: string }) => {
      const signs = JSON.parse(user).signs as ZodiacKey[];
      return JSON.stringify({ readings: signs.map((sign) => ({ sign, headline: '', text, extra: true })) });
    });
    const runtime: SignHoroscopeRuntime = {
      readCachedBatch: async (period, key, language, signs) => Object.fromEntries(signs.flatMap((sign) => {
        const cached = parseCachedSignReading(stored.get(sign), { sign, period, periodKey: key, language });
        return cached ? [[sign, cached]] : [];
      })),
      buildDigest: () => digest,
      generate: (input, signs, language) => generateSignHoroscopeBatchWithRunner(input, signs, language, runner),
      store: async (_period, _key, _language, item) => { stored.set(item.sign as ZodiacKey, item); },
    };
    const first = await fillMissingSignHoroscopes('week', '2026-W45', 'ru', runtime);
    const second = await fillMissingSignHoroscopes('week', '2026-W45', 'ru', runtime);
    expect(first.failures).toEqual([]);
    expect(second.cachedSigns).toHaveLength(12);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(projectSignHoroscopeForWire(second.readings.Aries!, 'Dalvik/2.1.0 (Linux; Android 13)'))
      .toMatchObject({ schemaVersion: 'sign-horoscope-reading-v4', periodKey: '2026-W45', headline: 'Прогноз', text });
  });

  it('does not invent text, attribute an unknown sign, or relabel a conflicting period', async () => {
    const digest = buildSignSkyBatchDigest('week', '2026-W45', transitAt);
    for (const candidate of [
      { sign: 'Pisces', headline: 'Прогноз', text: '' },
      { sign: 'Pisces', headline: 'Прогноз', text: '{"readings":[' },
      { sign: 'Aries', headline: 'Прогноз', text: 'Читаемый текст другого знака.' },
      { sign: 'Pisces', headline: 'Прогноз', text: 'Прогноз другого периода.', periodKey: '2026-W40' },
    ]) {
      const runner = jest.fn().mockResolvedValue(JSON.stringify({ readings: [candidate] }));
      const result = await generateSignHoroscopeBatchWithRunner(digest, ['Pisces'], 'ru', runner);
      expect(result.readings).toEqual([]);
      expect(result.failures).toEqual([expect.objectContaining({ sign: 'Pisces' })]);
    }
  });

  it('fills an empty period with one twelve-sign generation call', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const generated: SignHoroscopeBatchGenerationResult = {
      readings: ZODIAC_KEYS.map((sign) => reading(sign, 'day', digest.periodKey)),
      failures: [],
    };
    const runtime: SignHoroscopeRuntime = {
      readCachedBatch: jest.fn().mockResolvedValue({}),
      buildDigest: jest.fn().mockReturnValue(digest),
      generate: jest.fn().mockResolvedValue(generated),
      store: jest.fn().mockResolvedValue(undefined),
    };

    const result = await fillMissingSignHoroscopes('day', digest.periodKey, 'en', runtime);
    expect(result.generatedSigns).toEqual(ZODIAC_KEYS);
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

  it('fills the whole next month in one job and skips completed targets on restart', async () => {
    const completed = new Set<string>();
    const prewarmTarget = jest.fn(async (target: { period: SignHoroscopePeriod; periodKey: string }) => {
      const key = `${target.period}:${target.periodKey}`;
      if (completed.has(key)) return 'cached' as const;
      completed.add(key);
      return 'generated' as const;
    });
    const first = await prewarmSignMonth({ now: new Date('2026-08-25T09:00:00Z'), prewarmTarget });
    const second = await prewarmSignMonth({ targetMonthKey: '2026-09', prewarmTarget });
    expect(first).toMatchObject({ totalTargets: 36, generated: 36, scannedTargets: 36 });
    expect(second).toMatchObject({ generated: 0, cached: 36, scannedTargets: 36 });
    expect(prewarmTarget).toHaveBeenCalledTimes(72);
  });

  it('retries a transient failure within the same monthly job', async () => {
    const completed = new Set<string>();
    let failed = false;
    const wait = jest.fn(async () => undefined);
    const prewarmTarget = jest.fn(async (target: { period: SignHoroscopePeriod; periodKey: string }) => {
      const key = `${target.period}:${target.periodKey}`;
      if (completed.has(key)) return 'cached' as const;
      if (target.periodKey === '2026-09-02' && !failed) {
        failed = true;
        throw new Error('temporary provider failure');
      }
      completed.add(key);
      return 'generated' as const;
    });
    const result = await prewarmSignMonth({ targetMonthKey: '2026-09', prewarmTarget, wait });
    expect(result).toMatchObject({ generated: 36, failed: 0, scannedTargets: 36 });
    expect(wait).toHaveBeenCalledTimes(1);
    expect(prewarmTarget).toHaveBeenCalledTimes(37);
  });

  it('continues with later days after bounded failure and a later run fills the gap', async () => {
    const completed = new Set<string>();
    let available = false;
    const wait = jest.fn(async () => undefined);
    const prewarmTarget = jest.fn(async (target: { period: SignHoroscopePeriod; periodKey: string }) => {
      const key = `${target.period}:${target.periodKey}`;
      if (completed.has(key)) return 'cached' as const;
      if (target.periodKey === '2026-09-02' && !available) throw new Error('provider unavailable');
      completed.add(key);
      return 'generated' as const;
    });
    const first = await prewarmSignMonth({ targetMonthKey: '2026-09', prewarmTarget, wait });
    expect(first).toMatchObject({ generated: 35, failed: 1, scannedTargets: 36 });
    expect(completed.has('day:2026-09-03')).toBe(true);
    expect(wait).toHaveBeenCalledTimes(2);
    available = true;
    const retry = await prewarmSignMonth({ targetMonthKey: '2026-09', prewarmTarget, wait });
    expect(retry).toMatchObject({ generated: 1, cached: 35, failed: 0 });
  });

  it('limits repeated busy targets to avoid loading the provider for an entire month', async () => {
    const prewarmTarget = jest.fn().mockResolvedValue('in_progress');
    const wait = jest.fn(async () => undefined);
    const result = await prewarmSignMonth({ targetMonthKey: '2026-09', prewarmTarget, wait });
    expect(result).toMatchObject({ inProgress: 3, generated: 0, scannedTargets: 3 });
    expect(prewarmTarget).toHaveBeenCalledTimes(9);
    expect(wait).toHaveBeenCalledTimes(6);
  });

  it('continues with the next date when one target stays locked', async () => {
    const wait = jest.fn(async () => undefined);
    const prewarmTarget = jest.fn(async (target: { period: SignHoroscopePeriod; periodKey: string }) => (
      target.periodKey === '2026-09-01' ? 'in_progress' as const : 'generated' as const
    ));
    const result = await prewarmSignMonth({ targetMonthKey: '2026-09', prewarmTarget, wait });
    expect(result).toMatchObject({ inProgress: 1, generated: 35, scannedTargets: 36 });
    expect(prewarmTarget).toHaveBeenCalledWith({ period: 'day', periodKey: '2026-09-02' }, 'ru');
  });

  it('prepares the current day, week and month before the remaining targets in a catch-up', async () => {
    const prewarmTarget = jest.fn().mockResolvedValue('generated');
    const result = await prewarmSignMonth({
      targetMonthKey: '2026-09', now: new Date('2026-09-10T09:00:00Z'), prewarmTarget,
    });
    expect(prewarmTarget.mock.calls[0][0]).toEqual({ period: 'day', periodKey: '2026-09-10' });
    expect(prewarmTarget.mock.calls[1][0]).toEqual({ period: 'week', periodKey: '2026-W37' });
    expect(prewarmTarget.mock.calls[2][0]).toEqual({ period: 'month', periodKey: '2026-09' });
    expect(prewarmTarget.mock.calls[3][0]).toEqual({ period: 'day', periodKey: '2026-09-01' });
    expect(result).toMatchObject({ generated: 36, scannedTargets: 36 });
  });
});
