import { calculateMoonPhaseFromLongitudes, type SkyMoonPhaseKey } from './skyToday';
import { HOUSE_AREAS_RU } from './natalInterpretation/meanings';
import { SIGN_LOCATIVE_RU } from './natalMoments';

/**
 * «Небо сегодня»: the Moon phase with the coming quarters and Mercury's
 * direction with its next retrograde window, computed on the device with
 * astronomy-engine. With the user's house cusps it also says which house of
 * their chart the Moon and Mercury pass through.
 */

type AstronomyEngine = typeof import('astronomy-engine');

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

const DAY_MS = 86_400_000;

const PHASE_ADVICE_RU: Record<SkyMoonPhaseKey, string> = {
  'new-moon': 'Хорошее время задумать новое и записать планы',
  'waxing-crescent': 'Хорошо начинать и пробовать',
  'first-quarter': 'Время решений: сдвинуть то, что застряло',
  'waxing-gibbous': 'Доводи начатое до ума, дел прибавляется',
  'full-moon': 'Эмоции громче обычного, не спеши с выводами',
  'waning-gibbous': 'Хорошее время доделывать начатое, а не браться за новое',
  'last-quarter': 'Время разбирать завалы и отпускать лишнее',
  'waning-crescent': 'Сбавь темп и отдохни перед новым циклом',
};

const QUARTERS: Array<{ angle: number; label: string }> = [
  { angle: 0, label: 'новолуние' },
  { angle: 90, label: 'первая четверть' },
  { angle: 180, label: 'полнолуние' },
  { angle: 270, label: 'последняя четверть' },
];

export type SkyMonitorPersonal = { house: number; area: string };

export type SkyMonitor = {
  moon: {
    phaseKey: SkyMoonPhaseKey;
    phaseLabel: string;
    illumination: number;
    waxing: boolean;
    sign: string;
    signIn: string;
    advice: string;
    personal: SkyMonitorPersonal | null;
  };
  calendar: Array<{ date: Date; label: string }>;
  mercury: {
    retrograde: boolean;
    sign: string;
    signIn: string;
    window: { start: Date; end: Date } | null;
    windowSignIn: string | null;
    daysUntilStart: number | null;
    personal: SkyMonitorPersonal | null;
  };
};

function normalize(value: number): number {
  return ((value % 360) + 360) % 360;
}

function signOf(longitude: number): string {
  return SIGNS[Math.floor(normalize(longitude) / 30)];
}

function eclipticLongitude(engine: AstronomyEngine, body: 'Sun' | 'Moon' | 'Mercury', date: Date): number {
  return normalize(engine.Ecliptic(engine.GeoVector(body as Parameters<AstronomyEngine['GeoVector']>[0], date, true)).elon);
}

function mercuryRetrograde(engine: AstronomyEngine, date: Date): boolean {
  const now = eclipticLongitude(engine, 'Mercury', date);
  const later = eclipticLongitude(engine, 'Mercury', new Date(date.getTime() + 3_600_000));
  return ((later - now + 540) % 360) - 180 < 0;
}

/**
 * The station: the moment the retrograde flag stops being `from`, scanning
 * day by day and then narrowing to the hour, so the date is the real one.
 */
function nextFlip(engine: AstronomyEngine, start: Date, from: boolean, step: number, limitDays: number): Date | null {
  for (let day = 1; day <= limitDays; day += 1) {
    const date = new Date(start.getTime() + step * day * DAY_MS);
    if (mercuryRetrograde(engine, date) === from) continue;
    // Bisect between the last sample with `from` and this one.
    let inside = new Date(start.getTime() + step * (day - 1) * DAY_MS).getTime();
    let outside = date.getTime();
    while (Math.abs(outside - inside) > 3_600_000) {
      const middle = (inside + outside) / 2;
      if (mercuryRetrograde(engine, new Date(middle)) === from) inside = middle;
      else outside = middle;
    }
    return new Date(outside);
  }
  return null;
}

/** Which house a longitude falls in, given twelve cusp longitudes ordered by house. */
export function houseOfLongitude(longitude: number, cusps: readonly number[]): number | null {
  if (cusps.length !== 12 || cusps.some((cusp) => !Number.isFinite(cusp))) return null;
  const point = normalize(longitude);
  for (let index = 0; index < 12; index += 1) {
    const start = normalize(cusps[index]);
    const end = normalize(cusps[(index + 1) % 12]);
    const span = normalize(end - start);
    if (normalize(point - start) < span) return index + 1;
  }
  return null;
}

function personal(longitude: number, cusps: readonly number[] | null): SkyMonitorPersonal | null {
  if (!cusps) return null;
  const house = houseOfLongitude(longitude, cusps);
  return house && HOUSE_AREAS_RU[house] ? { house, area: HOUSE_AREAS_RU[house] } : null;
}

export function buildSkyMonitor(
  engine: AstronomyEngine,
  now: Date,
  cusps: readonly number[] | null = null,
): SkyMonitor {
  const sun = eclipticLongitude(engine, 'Sun', now);
  const moonLongitude = eclipticLongitude(engine, 'Moon', now);
  const phase = calculateMoonPhaseFromLongitudes(sun, moonLongitude);
  const moonSign = signOf(moonLongitude);

  const calendar = QUARTERS
    .map(({ angle, label }) => ({ date: engine.SearchMoonPhase(angle, now, 32)?.date ?? null, label }))
    .filter((item): item is { date: Date; label: string } => item.date instanceof Date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const mercuryLongitude = eclipticLongitude(engine, 'Mercury', now);
  const retrograde = mercuryRetrograde(engine, now);
  let window: { start: Date; end: Date } | null = null;
  if (retrograde) {
    const before = nextFlip(engine, now, true, -1, 40);
    const after = nextFlip(engine, now, true, 1, 40);
    if (before && after) window = { start: before, end: after };
  } else {
    const start = nextFlip(engine, now, false, 1, 200);
    const end = start ? nextFlip(engine, start, true, 1, 40) : null;
    if (start && end) window = { start, end };
  }
  const stationLongitude = window ? eclipticLongitude(engine, 'Mercury', window.start) : mercuryLongitude;

  return {
    moon: {
      phaseKey: phase.phaseKey,
      phaseLabel: phase.phaseLabel,
      illumination: phase.illumination,
      waxing: phase.elongation < 180,
      sign: moonSign,
      signIn: SIGN_LOCATIVE_RU[moonSign],
      advice: PHASE_ADVICE_RU[phase.phaseKey],
      personal: personal(moonLongitude, cusps),
    },
    calendar,
    mercury: {
      retrograde,
      sign: signOf(mercuryLongitude),
      signIn: SIGN_LOCATIVE_RU[signOf(mercuryLongitude)],
      window,
      windowSignIn: window ? SIGN_LOCATIVE_RU[signOf(stationLongitude)] : null,
      daysUntilStart: window && !retrograde ? Math.max(1, Math.ceil((window.start.getTime() - now.getTime()) / DAY_MS)) : null,
      personal: personal(retrograde ? mercuryLongitude : stationLongitude, cusps),
    },
  };
}
