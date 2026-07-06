/**
 * Transit → natal aspects — единый источник «что такое аспект» для дневного разбора.
 *
 * Раньше транзит↔натал взаимодействия считались ТОЛЬКО внутри todayPulse (для
 * числовой оценки дня, через per-layer aspectScore) и НЕ доходили до текстового
 * промпта — модель домысливала связь сама. Этот модуль перечисляет реальные
 * аспекты транзитных планет к натальным долготам человеко-читаемым текстом,
 * чтобы генерация текста опиралась на ТО ЖЕ, что посчитано, а не на догадки.
 *
 * Углы/орбы/тон согласованы с натальным calculateAspects (swisseph-calculator)
 * и с support/pressure-логикой todayPulse (соединение/секстиль/трин — на стороне
 * поддержки, квадрат/оппозиция — напряжение).
 */
import type { NatalChartData, PlanetPosition } from '../types';
import type { CurrentTransits, PlanetTransit } from './transits-calculator';

export type AspectTone = 'support' | 'pressure' | 'accent';

export type TransitAspect = {
  transitPlanet: string; // canonical EN key, e.g. 'mars'
  natalPlanet: string; // canonical EN key, e.g. 'sun'
  type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
  orb: number;
  tone: AspectTone;
};

type AspectDef = {
  type: TransitAspect['type'];
  angle: number;
  orb: number;
  tone: AspectTone;
};

// Один список определений аспектов (углы/орбы/тон). Тот же набор, что в натальном
// calculateAspects; тон соответствует support/pressure из todayPulse.
export const ASPECT_DEFS: AspectDef[] = [
  { type: 'conjunction', angle: 0, orb: 8, tone: 'accent' },
  { type: 'sextile', angle: 60, orb: 4, tone: 'support' },
  { type: 'square', angle: 90, orb: 6, tone: 'pressure' },
  { type: 'trine', angle: 120, orb: 6, tone: 'support' },
  { type: 'opposition', angle: 180, orb: 8, tone: 'pressure' },
];

const ZODIAC = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const PLANET_RU: Record<string, string> = {
  sun: 'Солнце',
  moon: 'Луна',
  mercury: 'Меркурий',
  venus: 'Венера',
  mars: 'Марс',
  jupiter: 'Юпитер',
  saturn: 'Сатурн',
  rising: 'Асцендент',
};

// Транзитный планет — родовое согласование для «транзитный/транзитная».
const TRANSIT_ADJ_RU: Record<string, string> = {
  sun: 'Транзитное',
  moon: 'Транзитная',
  mercury: 'Транзитный',
  venus: 'Транзитная',
  mars: 'Транзитный',
  jupiter: 'Транзитный',
  saturn: 'Транзитный',
};

const ASPECT_RU: Record<TransitAspect['type'], string> = {
  conjunction: 'соединение с',
  sextile: 'секстиль к',
  square: 'квадрат к',
  trine: 'трин к',
  opposition: 'оппозиция к',
};

const TONE_RU: Record<AspectTone, string> = {
  support: 'поддержка',
  pressure: 'напряжение',
  accent: 'усиление',
};

function normalizeDegree(value: number): number {
  const next = value % 360;
  return next < 0 ? next + 360 : next;
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function signIndex(sign?: string | null): number {
  return ZODIAC.findIndex((s) => s.toLowerCase() === String(sign || '').toLowerCase());
}

function natalLongitude(position?: PlanetPosition | null): number | null {
  if (!position) return null;
  if (typeof position.longitude === 'number' && Number.isFinite(position.longitude)) {
    return normalizeDegree(position.longitude);
  }
  const idx = signIndex(position.sign);
  if (idx < 0) return null;
  const degree = typeof position.degree === 'number' && Number.isFinite(position.degree) ? position.degree : 15;
  return normalizeDegree(idx * 30 + degree);
}

function transitLongitude(transit?: PlanetTransit | null): number | null {
  if (!transit) return null;
  if (typeof transit.longitude === 'number' && Number.isFinite(transit.longitude)) {
    return normalizeDegree(transit.longitude);
  }
  const idx = signIndex(transit.sign);
  if (idx < 0) return null;
  const degree = typeof transit.degree === 'number' && Number.isFinite(transit.degree) ? transit.degree : 15;
  return normalizeDegree(idx * 30 + degree);
}

// Асцендент участвует только при надёжном времени рождения (как везде в коде).
function hasReliableAscendant(chart: NatalChartData): boolean {
  const quality = (chart as any).chartQuality;
  const btq = (chart as any).birthTimeQuality || quality?.birthTimeQuality || 'exact';
  return btq === 'exact' && quality?.ascendantReliable !== false;
}

const TRANSIT_PLANETS: Array<keyof CurrentTransits> = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
];

/**
 * Перечисляет реальные аспекты транзитных планет к натальным долготам.
 * Возвращает отсортированный по точности (по орбу) список, обрезанный до `limit`.
 * Асцендент включается только если время рождения надёжно.
 */
export function detectTransitAspects(
  chart: NatalChartData,
  transits: CurrentTransits,
  options?: { limit?: number },
): TransitAspect[] {
  const natalKeys: Array<{ key: string; pos: PlanetPosition | null | undefined }> = [
    { key: 'sun', pos: chart.sun },
    { key: 'moon', pos: chart.moon },
    { key: 'mercury', pos: chart.mercury },
    { key: 'venus', pos: chart.venus },
    { key: 'mars', pos: chart.mars },
    { key: 'jupiter', pos: chart.jupiter },
    { key: 'saturn', pos: chart.saturn },
  ];
  if (hasReliableAscendant(chart)) {
    natalKeys.push({ key: 'rising', pos: chart.rising });
  }

  const found: TransitAspect[] = [];
  for (const tKey of TRANSIT_PLANETS) {
    const tLon = transitLongitude(transits[tKey] as PlanetTransit | undefined);
    if (tLon == null) continue;
    for (const natal of natalKeys) {
      const nLon = natalLongitude(natal.pos);
      if (nLon == null) continue;
      const distance = angularDistance(tLon, nLon);
      let best: { def: AspectDef; orb: number } | null = null;
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(distance - def.angle);
        if (orb <= def.orb && (!best || orb < best.orb)) {
          best = { def, orb };
        }
      }
      if (!best) continue;
      found.push({
        transitPlanet: String(tKey),
        natalPlanet: natal.key,
        type: best.def.type,
        orb: Number(best.orb.toFixed(1)),
        tone: best.def.tone,
      });
    }
  }

  found.sort((a, b) => a.orb - b.orb);
  const limit = options?.limit ?? 10;
  return found.slice(0, limit);
}

/** Человеко-читаемые строки аспектов для промпта (русский). */
export function formatTransitAspectsRu(aspects: TransitAspect[]): string[] {
  return aspects.map((a) => {
    const adj = TRANSIT_ADJ_RU[a.transitPlanet] || 'Транзитный';
    const tp = PLANET_RU[a.transitPlanet] || a.transitPlanet;
    const np = PLANET_RU[a.natalPlanet] || a.natalPlanet;
    const rel = ASPECT_RU[a.type];
    return `${adj} ${tp} — ${rel} натальному ${np} (орб ${a.orb.toFixed(1)}) — ${TONE_RU[a.tone]}`;
  });
}
