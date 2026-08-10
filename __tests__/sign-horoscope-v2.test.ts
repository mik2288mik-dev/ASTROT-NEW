import type { PlanetaryTransitsAtResult } from '../lib/swisseph-calculator';
import type { SignHoroscopePeriod, SignHoroscopeReadingV2 } from '../types';
import { ZODIAC_KEYS, type ZodiacKey } from '../lib/zodiacKeys';
import {
  buildMoscowSignSampleDates,
  buildSignSkyBatchDigest,
  collectAllowedEvidenceIds,
  getSignRulers,
  getWholeSignSolarHouse,
} from '../lib/horoscope/signSkyDigest';
import { generateSignHoroscopeBatchWithRunner } from '../lib/horoscope/signBatchGeneration';
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
  const entries = PLANETS.map((planet, index) => [
    planet,
    position(planet, index * 31 + drift * (index < 2 ? 0.5 : 0.02), index === 7 ? -0.01 : 0.2),
  ]);
  return {
    source: 'swisseph',
    date: date.toISOString(),
    julianDay: 0,
    ...Object.fromEntries(entries),
  } as PlanetaryTransitsAtResult;
}

function reading(
  sign: ZodiacKey,
  period: SignHoroscopePeriod,
  periodKey: string,
  evidenceId: string,
): SignHoroscopeReadingV2 {
  const block = (text: string) => ({ text, evidenceIds: [evidenceId] });
  return {
    schemaVersion: 'sign-horoscope-reading-v3',
    sign,
    period,
    periodKey,
    headline: `${sign} keeps the signal clear`,
    mood: block(`Mood for ${sign}`),
    relationships: block(`Relationships for ${sign}`),
    work: block(`Work for ${sign}`),
    innerState: block(`Inner state for ${sign}`),
    advice: block(`Advice for ${sign}`),
    warning: null,
    astrology: block(`Mars and Venus form the calculated basis for ${sign}.`),
  };
}

describe('Sign Horoscope V2 calculation contract', () => {
  it('maps modern and traditional co-rulers without dropping either ruler', () => {
    expect(getSignRulers('Scorpio')).toMatchObject([
      { planet: 'pluto', tradition: 'modern' },
      { planet: 'mars', tradition: 'traditional' },
    ]);
    expect(getSignRulers('Aquarius')).toMatchObject([
      { planet: 'uranus', tradition: 'modern' },
      { planet: 'saturn', tradition: 'traditional' },
    ]);
    expect(getSignRulers('Pisces')).toMatchObject([
      { planet: 'neptune', tradition: 'modern' },
      { planet: 'jupiter', tradition: 'traditional' },
    ]);
    expect(getSignRulers('Aries')).toMatchObject([{ planet: 'mars', tradition: 'both' }]);
  });

  it('maps whole-sign solar houses from the selected Sun sign', () => {
    expect(getWholeSignSolarHouse('Aries', 'Aries')).toBe(1);
    expect(getWholeSignSolarHouse('Aries', 'Libra')).toBe(7);
    expect(getWholeSignSolarHouse('Scorpio', 'Taurus')).toBe(7);
    expect(getWholeSignSolarHouse('Pisces', 'Aquarius')).toBe(12);
  });

  it('samples Moscow day, ISO week, and calendar month deterministically', () => {
    const day = buildMoscowSignSampleDates('day', '2026-08-09');
    expect(day).toHaveLength(5);
    expect(day[0].toISOString()).toBe('2026-08-08T21:00:00.000Z');
    expect(day[4].toISOString()).toBe('2026-08-09T20:59:00.000Z');

    const week = buildMoscowSignSampleDates('week', '2026-W32');
    expect(week).toHaveLength(7);
    expect(week[0].toISOString()).toBe('2026-08-03T09:00:00.000Z');
    expect(week[6].toISOString()).toBe('2026-08-09T09:00:00.000Z');

    expect(buildMoscowSignSampleDates('month', '2028-02')).toHaveLength(29);
  });

  it('builds numeric Swiss facts, aspects, solar houses, and stable evidence ids', () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    expect(digest.source).toBe('Swiss Ephemeris');
    expect(digest.samples).toHaveLength(5);
    expect(digest.samples.every((sample) => sample.positions.length === 10)).toBe(true);
    expect(digest.signs).toHaveLength(12);
    expect(digest.signs.find((item) => item.sign === 'Scorpio')?.rulers).toHaveLength(2);
    expect(digest.signs.every((item) => item.solarHousePlacements.length >= 10)).toBe(true);
    expect([...collectAllowedEvidenceIds(digest, 'Aries')].every((id) => id.length > 0)).toBe(true);
  });

  it('records applying aspects, ingresses, and stations from sampled motion', () => {
    const start = Date.parse('2026-08-08T21:00:00.000Z');
    const calculator = (date: Date): PlanetaryTransitsAtResult => {
      const step = Math.round((date.getTime() - start) / (6 * 3_600_000));
      const rows = PLANETS.map((planet, index) => {
        if (planet === 'sun') return [planet, position(planet, 0, 1)];
        if (planet === 'moon') return [planet, position(planet, 3, 0)];
        if (planet === 'mercury') return [planet, position(planet, 29 + step * 1.2, step < 2 ? -0.2 : 0.2)];
        return [planet, position(planet, 45 + index * 27, 0.1)];
      });
      return {
        source: 'swisseph', date: date.toISOString(), julianDay: 0, ...Object.fromEntries(rows),
      } as PlanetaryTransitsAtResult;
    };
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', calculator);
    const sunMoon = digest.samples[0].aspects.find((item) => item.from === 'sun' && item.to === 'moon');
    expect(sunMoon).toMatchObject({ type: 'conjunction', phase: 'applying' });
    expect(digest.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'ingress', planet: 'mercury', fromSign: 'Aries', toSign: 'Taurus' }),
      expect.objectContaining({ kind: 'station', planet: 'mercury', motion: 'direct' }),
    ]));
  });

  it('does not invent a station from a same-direction speed minimum', () => {
    const start = Date.parse('2026-08-08T21:00:00.000Z');
    const speeds = [0.2, 0.08, 0.01, 0.08, 0.2];
    const calculator = (date: Date): PlanetaryTransitsAtResult => {
      const step = Math.min(4, Math.max(0, Math.round((date.getTime() - start) / (6 * 3_600_000))));
      return {
        source: 'swisseph',
        date: date.toISOString(),
        julianDay: 0,
        ...Object.fromEntries(PLANETS.map((planet, index) => [
          planet,
          position(planet, 15 + index * 31, planet === 'mercury' ? speeds[step] : 0.2),
        ])),
      } as PlanetaryTransitsAtResult;
    };
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', calculator);
    expect(digest.events.some((event) => event.kind === 'station' && event.planet === 'mercury')).toBe(false);
  });

  it('repairs headlines outside the exact 2-8 word contract', () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const allowedEvidenceIds = collectAllowedEvidenceIds(digest, 'Aries');
    const evidenceId = [...allowedEvidenceIds][0];
    expect(validateSignHoroscopeReading(
      { ...reading('Aries', 'day', digest.periodKey, evidenceId), headline: 'Wait' },
      { sign: 'Aries', period: 'day', periodKey: digest.periodKey, allowedEvidenceIds },
    ).ok).toBe(false);
    expect(validateSignHoroscopeReading(
      { ...reading('Aries', 'day', digest.periodKey, evidenceId), headline: 'One two three four five six seven eight nine' },
      { sign: 'Aries', period: 'day', periodKey: digest.periodKey, allowedEvidenceIds },
    ).ok).toBe(false);
  });

  it('rejects a shared sign reading that exceeds 130 words', () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const evidenceId = [...collectAllowedEvidenceIds(digest, 'Aries')][0];
    const tooLong = Array.from({ length: 131 }, () => 'direct').join(' ');
    expect(validateSignHoroscopeReading(
      {
        ...reading('Aries', 'day', digest.periodKey, evidenceId),
        mood: { text: tooLong, evidenceIds: [evidenceId] },
      },
      { sign: 'Aries', period: 'day', periodKey: digest.periodKey, allowedEvidenceIds: collectAllowedEvidenceIds(digest, 'Aries') },
    ).ok).toBe(false);
  });

  it('keeps technical astrology terms out of the forecast blocks', () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const evidenceId = [...collectAllowedEvidenceIds(digest, 'Aries')][0];
    expect(validateSignHoroscopeReading(
      {
        ...reading('Aries', 'day', digest.periodKey, evidenceId),
        mood: { text: 'Mars makes every answer urgent.', evidenceIds: [evidenceId] },
      },
      { sign: 'Aries', period: 'day', periodKey: digest.periodKey, allowedEvidenceIds: collectAllowedEvidenceIds(digest, 'Aries') },
    ).ok).toBe(false);
  });

  it('prewarms the current day plus tomorrow and next week/month at a Moscow boundary evening', () => {
    const targets = getSignPrewarmTargets(new Date('2026-05-31T16:00:00.000Z'));
    expect(targets).toEqual(expect.arrayContaining([
      { period: 'day', periodKey: '2026-05-31' },
      { period: 'day', periodKey: '2026-06-01' },
      expect.objectContaining({ period: 'week' }),
      { period: 'month', periodKey: '2026-06' },
    ]));
  });

  it('generates all 12 signs and repairs only the missing sign', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const calls: string[][] = [];
    const result = await generateSignHoroscopeBatchWithRunner(digest, 'en', async ({ user }) => {
      const request = JSON.parse(user);
      calls.push(request.targetSigns);
      const targets: ZodiacKey[] = request.targetSigns;
      const returned = calls.length === 1 ? targets.filter((sign) => sign !== 'Pisces') : targets;
      return JSON.stringify({
        readings: returned.map((sign) => {
          const evidenceId = [...collectAllowedEvidenceIds(digest, sign)][0];
          return reading(sign, 'day', digest.periodKey, evidenceId);
        }),
      });
    });

    expect(Object.keys(result)).toEqual([...ZODIAC_KEYS]);
    expect(calls[0]).toEqual([...ZODIAC_KEYS]);
    expect(calls[1]).toEqual(['Pisces']);
  });

  it('returns a cached sign before calculating the sky or calling the model', async () => {
    const cached = reading('Leo', 'day', '2026-08-09', 'cached:evidence');
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockResolvedValue(cached),
      buildDigest: jest.fn(),
      generateBatch: jest.fn(),
      storeBatch: jest.fn(),
    };
    await expect(getOrGenerateSignHoroscope('day', 'Leo', '2026-08-09', 'en', runtime)).resolves.toBe(cached);
    expect(runtime.buildDigest).not.toHaveBeenCalled();
    expect(runtime.generateBatch).not.toHaveBeenCalled();
    expect(runtime.storeBatch).not.toHaveBeenCalled();
  });

  it('does not generate when the shared cache read is operationally unavailable', async () => {
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockRejectedValue(new Error('database unavailable')),
      buildDigest: jest.fn(),
      generateBatch: jest.fn(),
      storeBatch: jest.fn(),
    };
    await expect(getOrGenerateSignHoroscope('day', 'Leo', '2026-08-09', 'en', runtime))
      .rejects.toThrow('database unavailable');
    expect(runtime.generateBatch).not.toHaveBeenCalled();
  });

  it('does not report uncached generated content as ready after persistence fails', async () => {
    const digest = buildSignSkyBatchDigest('day', '2026-08-09', transitAt);
    const evidenceId = [...collectAllowedEvidenceIds(digest, 'Leo')][0];
    const batch = Object.fromEntries(
      ZODIAC_KEYS.map((sign) => [sign, reading(sign, 'day', digest.periodKey, evidenceId)]),
    ) as Record<ZodiacKey, SignHoroscopeReadingV2>;
    const runtime: SignHoroscopeRuntime = {
      readCached: jest.fn().mockResolvedValue(null),
      buildDigest: jest.fn().mockReturnValue(digest),
      generateBatch: jest.fn().mockResolvedValue(batch),
      storeBatch: jest.fn().mockRejectedValue(new Error('cache write unavailable')),
    };
    await expect(getOrGenerateSignHoroscope('day', 'Leo', digest.periodKey, 'en', runtime))
      .rejects.toThrow('cache write unavailable');
  });
});
