/**
 * Transits Calculator
 *
 * Uses Swiss Ephemeris for production transit calculations. The lightweight
 * algorithmic approximation is available only in non-production runtimes when
 * ALLOW_APPROXIMATE_TRANSITS=true is set explicitly.
 */

import { logger } from './logger';

export interface PlanetTransit {
  planet: string;
  sign: string;
  degree: number;
  longitude?: number;
  description?: string;
}

export interface CurrentTransits {
  date: string;
  sun: PlanetTransit;
  moon: PlanetTransit;
  mercury?: PlanetTransit;
  venus?: PlanetTransit;
  mars?: PlanetTransit;
  jupiter?: PlanetTransit;
  saturn?: PlanetTransit;
  moonPhase?: string;
  summary?: string;
  source?: 'swisseph' | 'algorithmic';
}

export class TransitsUnavailableError extends Error {
  code = 'TRANSITS_UNAVAILABLE';

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TransitsUnavailableError';
    if (cause) {
      (this as any).cause = cause;
    }
  }
}

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

function isApproximateTransitFallbackAllowed() {
  return process.env.ALLOW_APPROXIMATE_TRANSITS === 'true' && !isProductionRuntime();
}

function normalizeDegree(value: number): number {
  const next = value % 360;
  return next < 0 ? next + 360 : next;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function daysSinceJ2000(date: Date): number {
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0, 0);
  return (date.getTime() - j2000) / 86_400_000;
}

function transitFromLongitude(
  planet: string,
  longitude: number,
  description: (sign: string) => string
): PlanetTransit {
  const normalized = normalizeDegree(longitude);
  const signIndex = Math.floor(normalized / 30) % 12;
  const sign = ZODIAC_SIGNS[signIndex] || 'Aries';
  return {
    planet,
    sign,
    degree: Number((normalized % 30).toFixed(2)),
    longitude: Number(normalized.toFixed(6)),
    description: description(sign),
  };
}

function calculateApproximateLongitudes(date: Date) {
  const n = daysSinceJ2000(date);
  const meanSun = normalizeDegree(280.460 + 0.9856474 * n);
  const sunAnomaly = normalizeDegree(357.528 + 0.9856003 * n);
  const sun = normalizeDegree(
    meanSun + 1.915 * Math.sin(toRadians(sunAnomaly)) + 0.020 * Math.sin(toRadians(2 * sunAnomaly))
  );

  const moonMean = normalizeDegree(218.316 + 13.176396 * n);
  const moonAnomaly = normalizeDegree(134.963 + 13.064993 * n);
  const moon = normalizeDegree(moonMean + 6.289 * Math.sin(toRadians(moonAnomaly)));

  const mercury = normalizeDegree(sun + 23 * Math.sin((2 * Math.PI * n) / 116));
  const venus = normalizeDegree(sun + 37 * Math.sin((2 * Math.PI * n) / 584));
  const mars = normalizeDegree(355.433 + 0.524039 * n + 8 * Math.sin((2 * Math.PI * n) / 780));
  const jupiter = normalizeDegree(34.351 + 0.083086 * n);
  const saturn = normalizeDegree(50.077 + 0.033459 * n);

  return { sun, moon, mercury, venus, mars, jupiter, saturn };
}

function fromSwissPlanet(
  planet: string,
  position: { sign: string; degree: number; longitude: number } | null | undefined
): PlanetTransit | undefined {
  if (!position) return undefined;
  return {
    planet,
    sign: position.sign,
    degree: position.degree,
    longitude: position.longitude,
    description: `${planet} is currently in ${position.sign}.`,
  };
}

export async function getCurrentTransits(date?: Date): Promise<CurrentTransits> {
  const targetDate = date || new Date();
  const dateString = targetDate.toISOString().split('T')[0];
  const timeString = targetDate.toISOString().slice(11, 16);

  logger.info({
    scope: 'transits-calculator',
    event: 'transit_calculation_start',
    metadata: { date: dateString, time: timeString },
  });

  try {
    const { calculatePlanetaryTransitsAt } = await import('./swisseph-calculator');
    const transitChart = calculatePlanetaryTransitsAt(targetDate);
    const moonPhase = getMoonPhase(transitChart.moon.longitude);

    const transits: CurrentTransits = {
      date: dateString,
      sun: fromSwissPlanet('Sun', transitChart.sun)!,
      moon: fromSwissPlanet('Moon', transitChart.moon)!,
      mercury: fromSwissPlanet('Mercury', transitChart.mercury),
      venus: fromSwissPlanet('Venus', transitChart.venus),
      mars: fromSwissPlanet('Mars', transitChart.mars),
      jupiter: fromSwissPlanet('Jupiter', transitChart.jupiter),
      saturn: fromSwissPlanet('Saturn', transitChart.saturn),
      moonPhase,
      summary: `Current astrological transits for ${dateString}`,
      source: 'swisseph',
    };

    logger.info({
      scope: 'transits-calculator',
      event: 'swisseph_success',
      source: transits.source,
      status: 'ok',
      metadata: {
        date: dateString,
        sunSign: transits.sun.sign,
        moonSign: transits.moon.sign,
        moonPhase,
      },
    });

    return transits;
  } catch (error: any) {
    const unavailableError = new TransitsUnavailableError(
      `Swiss Ephemeris transits are unavailable for ${dateString} ${timeString}`,
      error
    );

    logger.error({
      scope: 'transits-calculator',
      event: 'swisseph_error',
      source: 'swisseph',
      status: 'error',
      errorCode: unavailableError.code,
      metadata: {
        error: error?.message || String(error),
        date: dateString,
        time: timeString,
        approximateFallbackAllowed: isApproximateTransitFallbackAllowed(),
        nodeEnv: process.env.NODE_ENV || 'development',
      },
    });

    if (!isApproximateTransitFallbackAllowed()) {
      logger.warn({
        scope: 'transits-calculator',
        event: 'approximate_fallback_blocked',
        source: 'swisseph',
        status: 'blocked',
        errorCode: unavailableError.code,
        metadata: { date: dateString, time: timeString },
      });
      throw unavailableError;
    }

    logger.warn({
      scope: 'transits-calculator',
      event: 'approximate_fallback_dev_only',
      source: 'algorithmic',
      status: 'fallback',
      metadata: { date: dateString, time: timeString },
    });
    return getAlgorithmicTransits(targetDate);
  }
}

function getAlgorithmicTransits(date: Date): CurrentTransits {
  const dateString = date.toISOString().split('T')[0];
  const longitudes = calculateApproximateLongitudes(date);

  return {
    date: dateString,
    sun: transitFromLongitude('Sun', longitudes.sun, (sign) => `Sun is currently in ${sign}.`),
    moon: transitFromLongitude('Moon', longitudes.moon, (sign) => `Moon is currently in ${sign}.`),
    mercury: transitFromLongitude('Mercury', longitudes.mercury, (sign) => `Mercury is currently in ${sign}.`),
    venus: transitFromLongitude('Venus', longitudes.venus, (sign) => `Venus is currently in ${sign}.`),
    mars: transitFromLongitude('Mars', longitudes.mars, (sign) => `Mars is currently in ${sign}.`),
    jupiter: transitFromLongitude('Jupiter', longitudes.jupiter, (sign) => `Jupiter is currently in ${sign}.`),
    saturn: transitFromLongitude('Saturn', longitudes.saturn, (sign) => `Saturn is currently in ${sign}.`),
    moonPhase: getMoonPhase(longitudes.moon),
    summary: `Approximate astrological transits for ${dateString}`,
    source: 'algorithmic',
  };
}

function getMoonPhase(moonDegree: number): string {
  const phase = Math.floor(normalizeDegree(moonDegree) / 45) % 8;

  const phases = [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ];

  return phases[phase] || 'Waxing';
}

export async function getTransitsForPeriod(
  startDate: Date,
  endDate: Date
): Promise<{
  startTransits: CurrentTransits;
  endTransits: CurrentTransits;
  summary: string;
}> {
  const startTransits = await getCurrentTransits(startDate);
  const endTransits = await getCurrentTransits(endDate);

  const summary = `Period from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}. ` +
    `Sun moves through ${startTransits.sun.sign}` +
    (startTransits.sun.sign !== endTransits.sun.sign ? ` into ${endTransits.sun.sign}` : '') +
    `.`;

  return {
    startTransits,
    endTransits,
    summary,
  };
}
