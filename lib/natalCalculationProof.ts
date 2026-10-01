import type {
  NatalAngleKey,
  NatalBodyKey,
  NatalChartDataV2,
} from './natalChartV2Types';
import { BODY_LABELS, signName } from './natalInterpretation/meanings';

/**
 * Transparency for a stored natal chart: the inputs, the exact positions
 * Swiss Ephemeris produced, and an optional cross-check against the
 * independent astronomy-engine library. Nothing here recalculates or
 * replaces the stored chart.
 */

type Language = 'ru' | 'en';
type AstronomyEngine = typeof import('astronomy-engine');

export const PROOF_BODY_KEYS: readonly NatalBodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode',
];

/** Bodies the independent library can reproduce. */
const VERIFIABLE_BODIES: Partial<Record<NatalBodyKey, string>> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
};

/** Two engines agree when the difference stays well inside one arc-minute-level rounding. */
export const PROOF_TOLERANCE_DEGREES = 0.1;

const ANGLE_LABELS: Record<NatalAngleKey, { ru: string; en: string }> = {
  ascendant: { ru: 'Асцендент', en: 'Ascendant' },
  mc: { ru: 'Середина неба (MC)', en: 'Midheaven (MC)' },
  descendant: { ru: 'Десцендент', en: 'Descendant' },
  ic: { ru: 'Глубина неба (IC)', en: 'Imum Coeli (IC)' },
};

export type ProofPositionRow = {
  key: string;
  label: string;
  sign: string;
  signLabel: string;
  degreeText: string;
  longitude: number;
  house: number | null;
  retrograde: boolean;
};

export type ProofHouseRow = {
  house: number;
  sign: string;
  signLabel: string;
  degreeText: string;
  longitude: number;
};

export type CalculationProof = {
  name: string;
  localDate: string;
  localTime: string | null;
  place: string;
  latitude: number;
  longitude: number;
  timezone: string;
  utc: string | null;
  utcOffsetText: string | null;
  engine: string;
  engineVersion: string;
  zodiac: string;
  houseSystem: string | null;
  calculatedAt: string;
  bodies: ProofPositionRow[];
  angles: ProofPositionRow[];
  houses: ProofHouseRow[];
};

export type ProofCheck = {
  key: string;
  label: string;
  reference: number;
  independent: number;
  difference: number;
  matches: boolean;
};

export type ProofVerification = {
  library: string;
  checks: ProofCheck[];
  unchecked: string[];
  maxDifference: number;
  allMatch: boolean;
};

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Shortest signed distance between two longitudes. */
export function angularDifference(a: number, b: number): number {
  return Math.abs(((normalizeDegrees(a) - normalizeDegrees(b) + 540) % 360) - 180);
}

/** 16.2408 → «16°14′». Minutes are floored so the sign never rolls over visually. */
export function formatSignDegree(longitude: number): string {
  const inSign = normalizeDegrees(longitude) % 30;
  let degrees = Math.floor(inSign);
  let minutes = Math.floor((inSign - degrees) * 60 + 1e-9);
  if (minutes >= 60) {
    degrees += 1;
    minutes -= 60;
  }
  return `${degrees}°${String(minutes).padStart(2, '0')}′`;
}

export function isCanonicalNatalChart(value: unknown): value is NatalChartDataV2 {
  const chart = value as Partial<NatalChartDataV2> | null;
  return Boolean(chart && chart.schemaVersion === 'natal-chart-data-v2' && chart.positions && chart.birth);
}

/** Offset of the local birth time from UTC, e.g. «UTC+3». */
export function formatUtcOffset(localDate: string, localTime: string | null, utc: string | null): string | null {
  if (!localTime || !utc) return null;
  const local = Date.parse(`${localDate}T${localTime.slice(0, 5)}:00Z`);
  const universal = Date.parse(utc);
  if (!Number.isFinite(local) || !Number.isFinite(universal)) return null;
  const minutes = Math.round((local - universal) / 60_000);
  const sign = minutes < 0 ? '−' : '+';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
}

export function buildCalculationProof(
  chart: NatalChartDataV2,
  name: string,
  language: Language,
): CalculationProof {
  const metadata = chart.calculationMetadata;
  const birth = chart.birth;
  const utc = birth.interval?.referenceUtc ?? null;
  const bodies = PROOF_BODY_KEYS.flatMap((key) => {
    const position = chart.positions[key];
    if (!position || !Number.isFinite(position.longitude)) return [];
    return [{
      key,
      label: BODY_LABELS[key][language],
      sign: position.sign,
      signLabel: signName(position.sign, language),
      degreeText: formatSignDegree(position.longitude),
      longitude: position.longitude,
      house: position.house ?? null,
      retrograde: position.retrograde === true,
    }];
  });
  const angles = (['ascendant', 'mc', 'descendant', 'ic'] as const).flatMap((key) => {
    const angle = chart.angles?.[key];
    if (!angle || !Number.isFinite(angle.longitude)) return [];
    return [{
      key,
      label: ANGLE_LABELS[key][language],
      sign: angle.sign,
      signLabel: signName(angle.sign, language),
      degreeText: formatSignDegree(angle.longitude),
      longitude: angle.longitude,
      house: null,
      retrograde: false,
    }];
  });
  const houses = (chart.houses ?? [])
    .filter((house) => Number.isFinite(house.longitude))
    .map((house) => ({
      house: house.house,
      sign: house.sign,
      signLabel: signName(house.sign, language),
      degreeText: formatSignDegree(house.longitude),
      longitude: house.longitude,
    }));

  return {
    name,
    localDate: birth.localDate,
    localTime: birth.localTime,
    place: birth.place,
    latitude: birth.latitude,
    longitude: birth.longitude,
    timezone: birth.timezone,
    utc,
    utcOffsetText: formatUtcOffset(birth.localDate, birth.localTime, utc),
    engine: metadata?.ephemerisEngine ?? 'Swiss Ephemeris',
    engineVersion: metadata?.ephemerisLibraryVersion ?? '',
    zodiac: metadata?.zodiac ?? 'tropical',
    houseSystem: metadata?.houseSystem ?? null,
    calculatedAt: metadata?.calculatedAt ?? '',
    bodies,
    angles,
    houses,
  };
}

function placidusCusp(
  ramc: number,
  latitude: number,
  obliquity: number,
  fraction: number,
  aboveHorizon: boolean,
): number {
  const rad = Math.PI / 180;
  let rightAscension = aboveHorizon ? ramc + fraction * 90 : ramc + 90 + fraction * 90;
  for (let step = 0; step < 60; step += 1) {
    const eclipticLongitude = Math.atan2(
      Math.sin(rightAscension * rad),
      Math.cos(rightAscension * rad) * Math.cos(obliquity * rad),
    ) / rad;
    const declination = Math.asin(Math.sin(obliquity * rad) * Math.sin(eclipticLongitude * rad));
    const ratio = Math.tan(latitude * rad) * Math.tan(declination);
    if (Math.abs(ratio) > 1) return Number.NaN;
    const ascensionalDifference = Math.asin(ratio) / rad;
    rightAscension = aboveHorizon
      ? ramc + fraction * (90 + ascensionalDifference)
      : ramc + 180 - (1 - fraction) * (90 - ascensionalDifference);
  }
  return normalizeDegrees(Math.atan2(
    Math.sin(rightAscension * rad),
    Math.cos(rightAscension * rad) * Math.cos(obliquity * rad),
  ) / rad);
}

/** Recomputes planets, angles and Placidus cusps with astronomy-engine and compares them. */
export function verifyCalculationProof(
  chart: NatalChartDataV2,
  engine: AstronomyEngine,
  language: Language,
): ProofVerification | null {
  const utc = chart.birth.interval?.referenceUtc;
  if (!utc) return null;
  const date = new Date(utc);
  if (!Number.isFinite(date.getTime())) return null;

  const checks: ProofCheck[] = [];
  const unchecked: string[] = [];
  const push = (key: string, label: string, reference: number, independent: number) => {
    if (!Number.isFinite(reference) || !Number.isFinite(independent)) return;
    const difference = angularDifference(reference, independent);
    checks.push({ key, label, reference, independent, difference, matches: difference <= PROOF_TOLERANCE_DEGREES });
  };

  for (const key of PROOF_BODY_KEYS) {
    const position = chart.positions[key];
    if (!position) continue;
    const body = VERIFIABLE_BODIES[key];
    if (!body) {
      unchecked.push(BODY_LABELS[key][language]);
      continue;
    }
    const vector = engine.GeoVector(body as Parameters<AstronomyEngine['GeoVector']>[0], date, true);
    push(key, BODY_LABELS[key][language], position.longitude, engine.Ecliptic(vector).elon);
  }

  const time = engine.MakeTime(date);
  const obliquity = engine.e_tilt(time).tobl;
  const ramc = normalizeDegrees(engine.SiderealTime(date) * 15 + chart.birth.longitude);
  const rad = Math.PI / 180;
  const latitude = chart.birth.latitude;
  const mc = normalizeDegrees(Math.atan2(Math.sin(ramc * rad), Math.cos(ramc * rad) * Math.cos(obliquity * rad)) / rad);
  const ascendant = normalizeDegrees(Math.atan2(
    Math.cos(ramc * rad),
    -(Math.sin(ramc * rad) * Math.cos(obliquity * rad) + Math.tan(latitude * rad) * Math.sin(obliquity * rad)),
  ) / rad);
  const ascAngle = chart.angles?.ascendant;
  const mcAngle = chart.angles?.mc;
  if (ascAngle) push('ascendant', ANGLE_LABELS.ascendant[language], ascAngle.longitude, ascendant);
  if (mcAngle) push('mc', ANGLE_LABELS.mc[language], mcAngle.longitude, mc);

  if (chart.calculationMetadata?.houseSystem === 'placidus' && !chart.calculationMetadata.houseFallbackUsed) {
    const c11 = placidusCusp(ramc, latitude, obliquity, 1 / 3, true);
    const c12 = placidusCusp(ramc, latitude, obliquity, 2 / 3, true);
    const c2 = placidusCusp(ramc, latitude, obliquity, 1 / 3, false);
    const c3 = placidusCusp(ramc, latitude, obliquity, 2 / 3, false);
    // Opposite cusps differ by exactly 180°, so six computed points cover all twelve houses.
    const cusps: Record<number, number> = {
      1: ascendant, 2: c2, 3: c3, 4: mc + 180, 5: c11 + 180, 6: c12 + 180,
      7: ascendant + 180, 8: c2 + 180, 9: c3 + 180, 10: mc, 11: c11, 12: c12,
    };
    for (const stored of chart.houses ?? []) {
      const independent = cusps[stored.house];
      if (independent === undefined) continue;
      push(`house-${stored.house}`, language === 'ru' ? `${stored.house} дом` : `House ${stored.house}`, stored.longitude, normalizeDegrees(independent));
    }
  }

  const maxDifference = checks.reduce((max, check) => Math.max(max, check.difference), 0);
  return {
    library: 'astronomy-engine',
    checks,
    unchecked,
    maxDifference,
    allMatch: checks.length > 0 && checks.every((check) => check.matches),
  };
}

/** Plain-text export a person can paste anywhere or compare with another service. */
export function formatCalculationProofText(
  proof: CalculationProof,
  verification: ProofVerification | null,
  language: Language,
): string {
  const ru = language === 'ru';
  const lines: string[] = [];
  lines.push(ru ? `Натальная карта: ${proof.name}` : `Birth chart: ${proof.name}`);
  lines.push(ru
    ? `Дата и время: ${proof.localDate} ${proof.localTime ?? 'время не указано'} (${proof.timezone}${proof.utcOffsetText ? `, ${proof.utcOffsetText}` : ''})`
    : `Date and time: ${proof.localDate} ${proof.localTime ?? 'time unknown'} (${proof.timezone}${proof.utcOffsetText ? `, ${proof.utcOffsetText}` : ''})`);
  if (proof.utc) lines.push(`UTC: ${proof.utc}`);
  lines.push(ru
    ? `Место: ${proof.place} (${proof.latitude.toFixed(4)}, ${proof.longitude.toFixed(4)})`
    : `Place: ${proof.place} (${proof.latitude.toFixed(4)}, ${proof.longitude.toFixed(4)})`);
  lines.push(ru
    ? `Расчёт: ${proof.engine} ${proof.engineVersion}, ${proof.zodiac === 'tropical' ? 'тропический зодиак' : proof.zodiac}, дома: ${proof.houseSystem ?? 'не рассчитаны'}`
    : `Engine: ${proof.engine} ${proof.engineVersion}, ${proof.zodiac} zodiac, houses: ${proof.houseSystem ?? 'not computed'}`);
  lines.push('');
  lines.push(ru ? 'Планеты и точки:' : 'Planets and points:');
  for (const row of [...proof.bodies, ...proof.angles]) {
    const house = row.house ? (ru ? `, ${row.house} дом` : `, house ${row.house}`) : '';
    lines.push(`  ${row.label}: ${row.signLabel} ${row.degreeText}${row.retrograde ? ' R' : ''}${house} (${row.longitude.toFixed(4)}°)`);
  }
  if (proof.houses.length) {
    lines.push('');
    lines.push(ru ? 'Куспиды домов:' : 'House cusps:');
    for (const row of proof.houses) {
      lines.push(`  ${row.house}: ${row.signLabel} ${row.degreeText} (${row.longitude.toFixed(4)}°)`);
    }
  }
  if (verification) {
    lines.push('');
    lines.push(ru
      ? `Независимая сверка (${verification.library}): ${verification.allMatch ? 'совпадает' : 'есть расхождения'}, максимум ${verification.maxDifference.toFixed(3)}°`
      : `Independent check (${verification.library}): ${verification.allMatch ? 'matches' : 'differences found'}, max ${verification.maxDifference.toFixed(3)}°`);
  }
  return lines.join('\n');
}
