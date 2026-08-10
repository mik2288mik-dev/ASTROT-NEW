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
  generateSignHoroscopeWithRunner,
  SIGN_HOROSCOPE_MODEL,
} from '../lib/horoscope/signGeneration';
import { validateSignHoroscopeReading } from '../lib/horoscope/signContract';
import {
  getOrGenerateSignHoroscope,
  type SignHoroscopeRuntime,
} from '../lib/horoscope/signOrchestrator';
import { getSignPrewarmTargets } from '../lib/horoscope/signPrewarm';

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
      { headline: 'Марс задаёт темп', text: 'Действуй спокойно.' },
      { sign: 'Aries', period: 'day', periodKey: '2026-08-09' },
    ).ok).toBe(false);
    expect(validateSignHoroscopeReading(
      { headline: 'Держи ясный темп', text: 'Ретроградный Меркурий требует паузы.' },
      { sign: 'Aries', period: 'day', periodKey: '2026-08-09' },
    ).ok).toBe(false);
  });

  it('asks DeepSeek for one sign and exposes no astrology or evidence output fields', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const calls: Array<{ system: string; user: string }> = [];
    const result = await generateSignHoroscopeWithRunner(digest, 'Aries', 'ru', async (request) => {
      calls.push(request);
      return JSON.stringify({
        headline: 'Выбирай без лишнего шума',
        text: 'Сейчас полезнее завершить один ясный разговор, чем распыляться на пять новых задач. Спокойный темп даст больше результата.',
      });
    });

    expect(SIGN_HOROSCOPE_MODEL).toMatch(/^deepseek-/);
    expect(result.sign).toBe('Aries');
    expect(result.periodKey).toBe('2026-08-09');
    expect(calls).toHaveLength(1);
    expect(calls[0].user).toContain('"sign":"Aries"');
    expect(calls[0].user).not.toContain('evidenceId');
    expect(calls[0].user).not.toContain('"astrology"');
    expect(calls[0].user).not.toContain('"readings"');
  });

  it('retries validation for the same sign only', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const requestedSigns: string[] = [];
    const result = await generateSignHoroscopeWithRunner(digest, 'Pisces', 'en', async ({ user }) => {
      requestedSigns.push(JSON.parse(user).sign);
      return requestedSigns.length === 1
        ? JSON.stringify({ headline: '', text: '' })
        : JSON.stringify({ headline: 'Protect the useful rhythm', text: 'Keep one promise to yourself before accepting another request.' });
    });
    expect(result.sign).toBe('Pisces');
    expect(requestedSigns).toEqual(['Pisces', 'Pisces']);
  });

  it('returns a cached sign before calculating or calling DeepSeek', async () => {
    const cached = reading('Leo', 'day', '2026-08-09');
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockResolvedValue(cached),
      buildDigest: jest.fn(),
      generate: jest.fn(),
      store: jest.fn(),
    };
    await expect(getOrGenerateSignHoroscope('day', 'Leo', '2026-08-09', 'en', runtime)).resolves.toBe(cached);
    expect(runtime.buildDigest).not.toHaveBeenCalled();
    expect(runtime.generate).not.toHaveBeenCalled();
    expect(runtime.store).not.toHaveBeenCalled();
  });

  it('persists one completed sign before returning it', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const generated = reading('Leo', 'day', digest.periodKey);
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockResolvedValue(null),
      buildDigest: jest.fn().mockReturnValue(digest),
      generate: jest.fn().mockResolvedValue(generated),
      store: jest.fn().mockResolvedValue(undefined),
    };
    await expect(getOrGenerateSignHoroscope('day', 'Leo', digest.periodKey, 'en', runtime)).resolves.toBe(generated);
    expect(runtime.generate).toHaveBeenCalledWith(digest, 'Leo', 'en');
    expect(runtime.store).toHaveBeenCalledWith('day', digest.periodKey, 'en', generated);
  });

  it('does not discard another sign when one sign fails to persist', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockResolvedValue(null),
      buildDigest: jest.fn().mockReturnValue(digest),
      generate: jest.fn().mockImplementation(async (_digest, sign: ZodiacKey) => reading(sign, 'day', digest.periodKey)),
      store: jest.fn().mockImplementation(async (_period, _periodKey, _language, item: SignHoroscopeReadingV2) => {
        if (item.sign === 'Pisces') throw new Error('single row failed');
      }),
    };
    await expect(getOrGenerateSignHoroscope('day', 'Aries', digest.periodKey, 'en', runtime))
      .resolves.toMatchObject({ sign: 'Aries' });
    await expect(getOrGenerateSignHoroscope('day', 'Pisces', digest.periodKey, 'en', runtime))
      .rejects.toThrow('single row failed');
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
});
