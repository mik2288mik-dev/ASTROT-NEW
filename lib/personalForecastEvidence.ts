import type { NatalChartData, NatalHouseData, PlanetPosition } from '../types';
import { detectTransitAspects, type TransitAspect } from './transitAspects';
import {
  getCurrentTransits,
  type CurrentTransits,
  type PlanetTransit,
} from './transits-calculator';
import {
  DYNAMIC_FORECAST_TOPIC_KEYS,
  FIXED_FORECAST_SECTION_KEYS,
  PERSONAL_FORECAST_CALCULATION_VERSION,
  type CalculatedAstroEvidence,
  type DynamicForecastTopicKey,
  type ForecastEvidenceView,
  type ForecastTopicKey,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
  type TopicEvidence,
} from './personalForecastContract';

export type EvidenceCalculationResult = {
  evidence: CalculatedAstroEvidence[];
  continuationEvidence: CalculatedAstroEvidence[];
  topicEvidence: Record<ForecastTopicKey, TopicEvidence>;
  dynamicTopicKeys: DynamicForecastTopicKey[];
  evidenceViews: Record<string, ForecastEvidenceView>;
};

const VALID_FORECAST_TOPIC_KEYS = new Set<string>([
  'overview',
  ...FIXED_FORECAST_SECTION_KEYS,
  ...DYNAMIC_FORECAST_TOPIC_KEYS,
]);

export function validatePersonalForecastEvidenceTopicKeys(
  evidence: readonly CalculatedAstroEvidence[],
): string[] {
  return [...new Set(
    evidence.flatMap((item) => item.topicKeys)
      .filter((key) => !VALID_FORECAST_TOPIC_KEYS.has(key)),
  )];
}

export type PersonalForecastAspectObservation = TransitAspect & {
  at: Date;
  sampleIndex: number;
};

const PLANET_LABELS: Record<'ru' | 'en', Record<string, string>> = {
  ru: {
    sun: 'Солнце',
    moon: 'Луна',
    mercury: 'Меркурий',
    venus: 'Венера',
    mars: 'Марс',
    jupiter: 'Юпитер',
    saturn: 'Сатурн',
    uranus: 'Уран',
    neptune: 'Нептун',
    pluto: 'Плутон',
    rising: 'Асцендент',
  },
  en: {
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
    rising: 'Ascendant',
  },
};

const ASPECT_LABELS: Record<'ru' | 'en', Record<string, string>> = {
  ru: {
    conjunction: 'соединение',
    sextile: 'секстиль',
    square: 'квадрат',
    trine: 'трин',
    opposition: 'оппозиция',
  },
  en: {
    conjunction: 'conjunction',
    sextile: 'sextile',
    square: 'square',
    trine: 'trine',
    opposition: 'opposition',
  },
};

const PLANET_WEIGHTS: Record<string, number> = {
  moon: 12,
  sun: 28,
  mercury: 34,
  venus: 38,
  mars: 42,
  jupiter: 56,
  saturn: 60,
  uranus: 68,
  neptune: 66,
  pluto: 72,
};

const PLANET_TOPIC_KEYS: Record<string, ForecastTopicKey[]> = {
  sun: ['overview', 'work_money', 'mood', 'professional_path', 'self_confidence', 'creativity', 'future_direction'],
  moon: ['overview', 'love', 'mood', 'home_family', 'rest_recovery'],
  mercury: [
    'work_money',
    'study',
    'it_direction',
    'documents_agreements',
    'friends',
    'professional_path',
  ],
  venus: ['love', 'work_money', 'income_growth', 'creativity', 'home_family', 'property_decision'],
  mars: ['work_money', 'business', 'physical_activity', 'important_decision', 'work_change'],
  jupiter: [
    'work_money',
    'income_growth',
    'professional_path',
    'business',
    'study',
    'relocation',
    'future_direction',
  ],
  saturn: [
    'work_money',
    'business',
    'documents_agreements',
    'property_decision',
    'important_decision',
    'professional_path',
  ],
  uranus: ['work_money', 'it_direction', 'relocation', 'important_decision', 'work_change', 'future_direction'],
  neptune: ['mood', 'creativity', 'rest_recovery', 'self_confidence', 'future_direction'],
  pluto: ['work_money', 'income_growth', 'important_decision', 'self_confidence', 'work_change'],
};

const HOUSE_TOPIC_KEYS: Record<number, ForecastTopicKey[]> = {
  1: ['overview', 'mood', 'physical_activity', 'self_confidence'],
  2: ['work_money', 'income_growth', 'business', 'property_decision'],
  3: ['friends', 'study', 'it_direction', 'documents_agreements'],
  4: ['home_family', 'relocation', 'property_decision', 'rest_recovery'],
  5: ['love', 'creativity', 'self_confidence'],
  6: ['work_money', 'work_change', 'physical_activity', 'rest_recovery'],
  7: ['love', 'friends', 'documents_agreements'],
  8: ['work_money', 'income_growth', 'love', 'property_decision', 'important_decision'],
  9: ['study', 'relocation', 'future_direction'],
  10: ['work_money', 'business', 'professional_path', 'work_change'],
  11: ['friends', 'it_direction', 'future_direction'],
  12: ['mood', 'rest_recovery', 'creativity', 'self_confidence'],
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeDegree(value: number): number {
  const result = value % 360;
  return result < 0 ? result + 360 : result;
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return diff > 180 ? 360 - diff : diff;
}

function transitLongitude(transit?: PlanetTransit | null): number | null {
  if (!transit) return null;
  if (Number.isFinite(transit.longitude)) return normalizeDegree(Number(transit.longitude));
  if (!Number.isFinite(transit.degree)) return null;
  const signs = [
    'aries',
    'taurus',
    'gemini',
    'cancer',
    'leo',
    'virgo',
    'libra',
    'scorpio',
    'sagittarius',
    'capricorn',
    'aquarius',
    'pisces',
  ];
  const index = signs.indexOf(String(transit.sign || '').toLowerCase());
  return index < 0 ? null : normalizeDegree(index * 30 + Number(transit.degree));
}

function natalPosition(chart: NatalChartData, point: string): PlanetPosition | null {
  return ((chart as unknown as Record<string, PlanetPosition | null>)[point] || null);
}

export function resolvePersonalForecastChartReliability(chart: NatalChartData): {
  birthTimeQuality: 'exact' | 'approximate' | 'unknown';
  ascendantReliable: boolean;
  housesReliable: boolean;
  houseBasedPersonalization: boolean;
} {
  const quality = chart.chartQuality;
  const birthTimeQuality =
    chart.birthTimeQuality || quality?.birthTimeQuality || 'unknown';
  const timed = birthTimeQuality === 'exact';
  const ascendantReliable = timed && quality?.ascendantReliable !== false;
  const housesReliable = (
    timed
    && quality?.housesReliable !== false
    && Array.isArray(chart.houses)
    && chart.houses.length >= 12
  );
  return {
    birthTimeQuality,
    ascendantReliable,
    housesReliable,
    houseBasedPersonalization: (
      housesReliable
      && quality?.houseBasedPersonalization !== false
    ),
  };
}

function hasReliableHousePersonalization(chart: NatalChartData): boolean {
  return resolvePersonalForecastChartReliability(chart).houseBasedPersonalization;
}

function natalHouse(chart: NatalChartData, point: string): number | null {
  if (!hasReliableHousePersonalization(chart)) return null;
  const raw = natalPosition(chart, point)?.house;
  const house = Number.parseInt(String(raw || ''), 10);
  return house >= 1 && house <= 12 ? house : null;
}

function houseForLongitude(longitude: number, houses?: NatalHouseData[]): number | null {
  if (!Array.isArray(houses) || houses.length < 12) return null;
  const sorted = [...houses].sort((a, b) => a.house - b.house);
  for (let index = 0; index < sorted.length; index += 1) {
    const current = normalizeDegree(sorted[index].longitude);
    const next = normalizeDegree(sorted[(index + 1) % sorted.length].longitude);
    const inside = current <= next
      ? longitude >= current && longitude < next
      : longitude >= current || longitude < next;
    if (inside) return sorted[index].house;
  }
  return null;
}

function topicsFor(
  transitPlanet?: string | null,
  natalPoint?: string | null,
  house?: number | null,
): ForecastTopicKey[] {
  const topics: ForecastTopicKey[] = ['overview', 'wishes'];
  if (transitPlanet) topics.push(...(PLANET_TOPIC_KEYS[transitPlanet] || []));
  if (natalPoint) topics.push(...(PLANET_TOPIC_KEYS[natalPoint] || []));
  if (house) topics.push(...(HOUSE_TOPIC_KEYS[house] || []));
  return unique(topics);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function periodLabel(
  evidence: CalculatedAstroEvidence,
  language: 'ru' | 'en',
): string | null {
  const start = evidence.startsAt?.slice(0, 10);
  const end = evidence.endsAt?.slice(0, 10);
  const exact = evidence.exactAt?.slice(0, 10);
  if (exact) return language === 'ru' ? `точно ${exact}` : `exact ${exact}`;
  if (start && end) return start === end ? start : `${start} — ${end}`;
  return start || end || null;
}

function evidenceView(
  evidence: CalculatedAstroEvidence,
  language: 'ru' | 'en',
): ForecastEvidenceView {
  const planets = PLANET_LABELS[language];
  const aspects = ASPECT_LABELS[language];
  let factor = '';
  if (evidence.kind === 'transit_to_natal') {
    factor = language === 'ru'
      ? `${planets[evidence.transitPlanet || ''] || evidence.transitPlanet} — ${aspects[evidence.aspect || ''] || evidence.aspect} к ${planets[evidence.natalPoint || ''] || evidence.natalPoint}`
      : `${planets[evidence.transitPlanet || ''] || evidence.transitPlanet} ${aspects[evidence.aspect || ''] || evidence.aspect} ${planets[evidence.natalPoint || ''] || evidence.natalPoint}`;
  } else if (evidence.kind === 'transit_house') {
    factor = language === 'ru'
      ? `${planets[evidence.transitPlanet || ''] || evidence.transitPlanet} в ${evidence.house} доме`
      : `${planets[evidence.transitPlanet || ''] || evidence.transitPlanet} in house ${evidence.house}`;
  } else if (evidence.kind === 'lunation') {
    factor = evidence.aspect === 'opposition'
      ? (language === 'ru' ? 'Полнолуние' : 'Full Moon')
      : (language === 'ru' ? 'Новолуние' : 'New Moon');
  } else if (evidence.kind === 'ingress') {
    factor = language === 'ru'
      ? `${planets[evidence.transitPlanet || ''] || evidence.transitPlanet}: смена знака`
      : `${planets[evidence.transitPlanet || ''] || evidence.transitPlanet}: sign ingress`;
  } else if (evidence.kind === 'station') {
    factor = language === 'ru'
      ? `${planets[evidence.transitPlanet || ''] || evidence.transitPlanet}: станция`
      : `${planets[evidence.transitPlanet || ''] || evidence.transitPlanet}: station`;
  } else {
    factor = language === 'ru' ? 'Совокупность факторов периода' : 'Period factor aggregate';
  }
  const polarityMeaning: Record<CalculatedAstroEvidence['polarity'], Record<'ru' | 'en', string>> = {
    supporting: { ru: 'Расчёт делает эту тему заметнее и даёт ей больше опоры.', en: 'The calculation makes this topic more noticeable and better supported.' },
    challenging: { ru: 'Здесь особенно важны точность и проверка решений.', en: 'Precision and a careful check of decisions matter especially here.' },
    mixed: { ru: 'Здесь есть и рабочий ресурс, и условия, которые нельзя игнорировать.', en: 'There is usable momentum here, along with conditions that should not be ignored.' },
    neutral: { ru: 'Расчёт выделяет тему, но не задаёт ей однозначный знак.', en: 'The calculation highlights the topic without assigning it one clear direction.' },
  };
  return {
    id: evidence.id,
    factor,
    orb: evidence.orb ?? null,
    status: evidence.status,
    period: periodLabel(evidence, language),
    meaning: polarityMeaning[evidence.polarity][language],
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await worker(items[index]);
      }
    },
  );
  await Promise.all(runners);
  return output;
}

export function buildPersonalForecastSampleDates(
  period: PersonalForecastPeriod,
  window: PersonalForecastWindow,
): Date[] {
  const start = window.startsAt.getTime();
  const end = window.endsAt.getTime();
  const stepHours = period === 'day' ? 3 : period === 'week' ? 24 : period === 'month' ? 24 : 120;
  const step = stepHours * 60 * 60 * 1000;
  const values: Date[] = [];
  for (let timestamp = start; timestamp <= end; timestamp += step) {
    values.push(new Date(timestamp));
  }
  if (!values.length || values[values.length - 1].getTime() !== end) {
    values.push(new Date(end));
  }
  return values;
}

export function buildPersonalForecastContinuationSampleDates(
  period: PersonalForecastPeriod,
  window: PersonalForecastWindow,
): Date[] {
  if (period === 'year') return [];
  const lookaheadDays = period === 'day' ? 7 : period === 'week' ? 31 : 90;
  const stepHours = period === 'day' ? 6 : period === 'week' ? 24 : 120;
  const step = stepHours * 60 * 60 * 1000;
  const start = window.endsAt.getTime() + step;
  const end = window.endsAt.getTime() + lookaheadDays * 24 * 60 * 60 * 1000;
  const values: Date[] = [];
  for (let timestamp = start; timestamp <= end; timestamp += step) {
    values.push(new Date(timestamp));
  }
  if (!values.length || values[values.length - 1].getTime() !== end) {
    values.push(new Date(end));
  }
  return values;
}

function shouldKeepAspect(
  period: PersonalForecastPeriod,
  observations: PersonalForecastAspectObservation[],
): boolean {
  const transit = observations[0]?.transitPlanet;
  const minOrb = Math.min(...observations.map((item) => item.orb));
  if (period === 'year' && (transit === 'moon' || transit === 'sun' || transit === 'mercury' || transit === 'venus')) {
    return false;
  }
  if (period === 'month' && transit === 'moon') return false;
  if (period === 'week' && transit === 'moon') {
    return observations.length >= 2 || minOrb <= 0.5;
  }
  return true;
}

function groupAspectEvidence(
  chart: NatalChartData,
  period: PersonalForecastPeriod,
  periodKey: string,
  observations: PersonalForecastAspectObservation[],
): CalculatedAstroEvidence | null {
  if (!observations.length || !shouldKeepAspect(period, observations)) return null;
  const sorted = [...observations].sort((a, b) => a.at.getTime() - b.at.getTime());
  const exact = [...sorted].sort((a, b) => a.orb - b.orb)[0];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const status: CalculatedAstroEvidence['status'] = exact.orb <= 0.3
    ? 'exact'
    : last.orb < first.orb
      ? 'applying'
      : 'separating';
  const planetWeight = PLANET_WEIGHTS[first.transitPlanet] || 30;
  const durationBoost = Math.min(18, Math.max(0, sorted.length - 1) * 2);
  const exactness = Math.max(0, 28 - exact.orb * 4);
  const strength = Math.max(1, Math.min(100, Math.round(planetWeight + durationBoost + exactness)));
  const polarity: CalculatedAstroEvidence['polarity'] =
    first.tone === 'support' ? 'supporting' : first.tone === 'pressure' ? 'challenging' : 'mixed';
  const house = natalHouse(chart, first.natalPlanet);
  return {
    id: `pf:${period}:${periodKey}:aspect:${first.transitPlanet}:${first.type}:${first.natalPlanet}:${first.at.toISOString()}`,
    kind: 'transit_to_natal',
    transitPlanet: first.transitPlanet,
    natalPoint: first.natalPlanet,
    aspect: first.type,
    house,
    orb: exact.orb,
    status,
    exactAt: status === 'exact' ? iso(exact.at) : null,
    startsAt: iso(first.at),
    endsAt: iso(last.at),
    strength,
    polarity,
    topicKeys: topicsFor(first.transitPlanet, first.natalPlanet, house),
    calculationSource: `${PERSONAL_FORECAST_CALCULATION_VERSION}:swisseph`,
  };
}

export function segmentPersonalForecastAspectEpisodes(
  observations: PersonalForecastAspectObservation[],
): PersonalForecastAspectObservation[][] {
  const sorted = [...observations].sort((a, b) => (
    a.sampleIndex - b.sampleIndex || a.at.getTime() - b.at.getTime()
  ));
  const episodes: PersonalForecastAspectObservation[][] = [];
  for (const observation of sorted) {
    const episode = episodes[episodes.length - 1];
    const previous = episode?.[episode.length - 1];
    if (!episode || observation.sampleIndex !== previous.sampleIndex + 1) {
      episodes.push([observation]);
    } else {
      episode.push(observation);
    }
  }
  return episodes;
}

function collectAspectObservationGroups(
  chart: NatalChartData,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
): Map<string, PersonalForecastAspectObservation[]> {
  const groups = new Map<string, PersonalForecastAspectObservation[]>();
  for (const [sampleIndex, snapshot] of snapshots.entries()) {
    const aspects = detectTransitAspects(chart, snapshot.transits, { limit: 120 });
    for (const aspect of aspects) {
      const key = `${aspect.transitPlanet}:${aspect.type}:${aspect.natalPlanet}`;
      const items = groups.get(key) || [];
      items.push({
        ...aspect,
        at: snapshot.at,
        sampleIndex,
      });
      groups.set(key, items);
    }
  }
  return groups;
}

export function buildPersonalForecastAspectEvidence(
  chart: NatalChartData,
  period: PersonalForecastPeriod,
  periodKey: string,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
): CalculatedAstroEvidence[] {
  return [...collectAspectObservationGroups(chart, snapshots).values()]
    .flatMap((group) => segmentPersonalForecastAspectEpisodes(group))
    .map((episode) => groupAspectEvidence(chart, period, periodKey, episode))
    .filter((item): item is CalculatedAstroEvidence => !!item);
}

function buildContinuationAspectEvidence(
  chart: NatalChartData,
  period: PersonalForecastPeriod,
  periodKey: string,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
  boundary: Date,
): CalculatedAstroEvidence[] {
  if (period === 'year') return [];
  const boundaryTime = boundary.getTime();
  const maxBridgeHours = period === 'day' ? 6 : period === 'week' ? 24 : 120;
  const maxBridgeMs = maxBridgeHours * 60 * 60 * 1000;
  return [...collectAspectObservationGroups(chart, snapshots).values()]
    .flatMap((group) => segmentPersonalForecastAspectEpisodes(group))
    .filter((episode) => {
      const before = episode
        .filter((item) => item.at.getTime() <= boundaryTime)
        .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
      const after = episode
        .filter((item) => item.at.getTime() > boundaryTime)
        .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
      return (
        !!before
        && !!after
        && boundaryTime - before.at.getTime() <= maxBridgeMs
        && after.at.getTime() - boundaryTime <= maxBridgeMs
      );
    })
    .map((episode) => groupAspectEvidence(chart, period, periodKey, episode))
    .filter((item): item is CalculatedAstroEvidence => (
      !!item
      && !!item.endsAt
      && new Date(item.endsAt).getTime() > boundaryTime
    ));
}

const TRANSIT_KEYS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const;

function shouldIncludeLongPeriodTransit(
  period: PersonalForecastPeriod,
  planet: typeof TRANSIT_KEYS[number],
): boolean {
  if (
    period === 'year'
    && ['moon', 'sun', 'mercury', 'venus'].includes(planet)
  ) {
    return false;
  }
  return period !== 'month' || planet !== 'moon';
}

export function buildPersonalForecastIngressAndStationEvidence(
  chart: NatalChartData,
  period: PersonalForecastPeriod,
  periodKey: string,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
): CalculatedAstroEvidence[] {
  const result: CalculatedAstroEvidence[] = [];
  const useHouses = hasReliableHousePersonalization(chart);
  for (const planet of TRANSIT_KEYS) {
    if (!shouldIncludeLongPeriodTransit(period, planet)) continue;
    for (let index = 1; index < snapshots.length; index += 1) {
      const previous = snapshots[index - 1].transits[planet] as PlanetTransit | undefined;
      const current = snapshots[index].transits[planet] as PlanetTransit | undefined;
      if (!previous || !current) continue;
      const longitude = transitLongitude(current);
      const house = useHouses && longitude != null
        ? houseForLongitude(longitude, chart.houses)
        : null;
      if (previous.sign !== current.sign) {
        result.push({
          id: `pf:${period}:${periodKey}:ingress:${planet}:${current.sign}:${snapshots[index].at.toISOString()}`,
          kind: 'ingress',
          transitPlanet: planet,
          house,
          orb: null,
          status: 'active',
          exactAt: null,
          startsAt: iso(snapshots[index - 1].at),
          endsAt: iso(snapshots[index].at),
          strength: Math.min(90, (PLANET_WEIGHTS[planet] || 30) + 12),
          polarity: 'neutral',
          topicKeys: topicsFor(planet, null, house),
          calculationSource: `${PERSONAL_FORECAST_CALCULATION_VERSION}:swisseph`,
        });
      }
      const changedDirection = previous.retrograde !== current.retrograde;
      const nearStation = Math.abs(current.speedLongitude || 0) < 0.08
        && Math.abs(previous.speedLongitude || 0) >= 0.08;
      if (changedDirection || nearStation) {
        result.push({
          id: `pf:${period}:${periodKey}:station:${planet}:${snapshots[index].at.toISOString()}`,
          kind: 'station',
          transitPlanet: planet,
          house,
          orb: null,
          status: 'active',
          exactAt: null,
          startsAt: iso(snapshots[index - 1].at),
          endsAt: iso(snapshots[index].at),
          strength: Math.min(96, (PLANET_WEIGHTS[planet] || 30) + 20),
          polarity: 'mixed',
          topicKeys: topicsFor(planet, null, house),
          calculationSource: `${PERSONAL_FORECAST_CALCULATION_VERSION}:swisseph`,
        });
      }
    }
  }
  return result;
}

function buildLunationEvidence(
  period: PersonalForecastPeriod,
  periodKey: string,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
): CalculatedAstroEvidence[] {
  if (period === 'year') return [];
  const candidates = snapshots.flatMap((snapshot) => {
    const sun = transitLongitude(snapshot.transits.sun);
    const moon = transitLongitude(snapshot.transits.moon);
    if (sun == null || moon == null) return [];
    const distance = angularDistance(sun, moon);
    const newOrb = distance;
    const fullOrb = Math.abs(180 - distance);
    if (Math.min(newOrb, fullOrb) > 8) return [];
    return [{
      at: snapshot.at,
      aspect: newOrb <= fullOrb ? 'conjunction' : 'opposition',
      orb: Math.min(newOrb, fullOrb),
    }];
  });
  const groups: Array<typeof candidates> = [];
  const maxGapMs = (period === 'day' ? 6 : 48) * 60 * 60 * 1000;
  for (const candidate of candidates.sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    if (
      !current
      || previous.aspect !== candidate.aspect
      || candidate.at.getTime() - previous.at.getTime() > maxGapMs
    ) {
      groups.push([candidate]);
    } else {
      current.push(candidate);
    }
  }
  return groups.map((items) => {
    const exact = [...items].sort((a, b) => a.orb - b.orb)[0];
    return {
      id: `pf:${period}:${periodKey}:lunation:${exact.aspect}:${exact.at.toISOString().slice(0, 10)}`,
      kind: 'lunation' as const,
      transitPlanet: 'moon',
      natalPoint: null,
      aspect: exact.aspect,
      house: null,
      orb: Number(exact.orb.toFixed(1)),
      status: exact.orb <= 1 ? 'exact' as const : 'active' as const,
      exactAt: exact.orb <= 1 ? iso(exact.at) : null,
      startsAt: iso(items[0].at),
      endsAt: iso(items[items.length - 1].at),
      strength: Math.max(35, Math.round(65 - exact.orb * 3)),
      polarity: 'mixed' as const,
      topicKeys: [
        'overview',
        'mood',
        'love',
        'home_family',
        'important_decision',
      ],
      calculationSource: `${PERSONAL_FORECAST_CALCULATION_VERSION}:swisseph`,
    };
  });
}

type HouseObservation = {
  at: Date;
  sampleIndex: number;
  house: number;
};

function segmentHouseEpisodes(observations: HouseObservation[]): HouseObservation[][] {
  const episodes: HouseObservation[][] = [];
  for (const observation of observations) {
    const episode = episodes[episodes.length - 1];
    const previous = episode?.[episode.length - 1];
    if (
      !episode
      || observation.sampleIndex !== previous.sampleIndex + 1
      || observation.house !== previous.house
    ) {
      episodes.push([observation]);
    } else {
      episode.push(observation);
    }
  }
  return episodes;
}

export function buildPersonalForecastHouseEvidence(
  chart: NatalChartData,
  period: PersonalForecastPeriod,
  periodKey: string,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
): CalculatedAstroEvidence[] {
  if (!hasReliableHousePersonalization(chart)) return [];
  const result: CalculatedAstroEvidence[] = [];
  for (const planet of TRANSIT_KEYS) {
    if (!shouldIncludeLongPeriodTransit(period, planet)) continue;
    const observations = snapshots.flatMap((snapshot, sampleIndex) => {
      const transit = snapshot.transits[planet] as PlanetTransit | undefined;
      const longitude = transitLongitude(transit);
      const house = longitude == null
        ? null
        : houseForLongitude(longitude, chart.houses);
      return house ? [{ at: snapshot.at, sampleIndex, house }] : [];
    });
    for (const episode of segmentHouseEpisodes(observations)) {
      const first = episode[0];
      const last = episode[episode.length - 1];
      result.push({
        id: `pf:${period}:${periodKey}:house:${planet}:${first.house}:${first.at.toISOString()}`,
        kind: 'transit_house',
        transitPlanet: planet,
        house: first.house,
        orb: null,
        status: 'active',
        startsAt: iso(first.at),
        endsAt: iso(last.at),
        strength: Math.min(82, (PLANET_WEIGHTS[planet] || 30) + 8),
        polarity: 'neutral',
        topicKeys: topicsFor(planet, null, first.house),
        calculationSource: `${PERSONAL_FORECAST_CALCULATION_VERSION}:swisseph`,
      });
    }
  }
  return result;
}

function dedupeEvidence(values: CalculatedAstroEvidence[]): CalculatedAstroEvidence[] {
  const byId = new Map<string, CalculatedAstroEvidence>();
  for (const value of values) {
    const current = byId.get(value.id);
    if (!current || value.strength > current.strength) byId.set(value.id, value);
  }
  return [...byId.values()].sort((a, b) => b.strength - a.strength);
}

export function selectPersonalForecastDynamicTopics(
  evidence: CalculatedAstroEvidence[],
  previousDynamicKeys: DynamicForecastTopicKey[] = [],
): DynamicForecastTopicKey[] {
  const previous = new Set(previousDynamicKeys);
  const scores = DYNAMIC_FORECAST_TOPIC_KEYS.map((key) => {
    const relevant = evidence
      .filter((item) => item.topicKeys.includes(key))
      .sort((a, b) => b.strength - a.strength);
    const raw = relevant.reduce((sum, item) => sum + item.strength, 0);
    const strongest = relevant[0]?.strength || 0;
    const noveltyTieBreaker = previous.has(key) ? -0.01 : 0;
    return { key, score: raw + strongest * 0.35 + noveltyTieBreaker, strongest };
  }).sort((a, b) => b.score - a.score);

  const eligible = scores.filter((item) => item.strongest > 0 && item.score > 0);
  if (eligible.length < 2) return eligible.map((item) => item.key);
  const selected = eligible.slice(0, 2);
  const third = eligible[2];
  if (third && third.score >= selected[1].score * 0.82 && third.strongest >= 38) {
    selected.push(third);
  }
  const fourth = eligible[3];
  if (
    fourth
    && selected.length === 3
    && fourth.score >= selected[2].score * 0.9
    && fourth.strongest >= 48
  ) {
    selected.push(fourth);
  }
  return selected.map((item) => item.key);
}

export function assignPersonalForecastPrimaryEvidence(
  topics: ForecastTopicKey[],
  evidence: CalculatedAstroEvidence[],
): Map<ForecastTopicKey, CalculatedAstroEvidence> {
  const topicOrder = new Map(topics.map((topic, index) => [topic, index]));
  const candidates = new Map(topics.map((topic) => [
    topic,
    evidence
      .filter((item) => item.topicKeys.includes(topic))
      .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id)),
  ]));
  const orderedTopics = [...topics].sort((a, b) => (
    (candidates.get(a)?.length || 0) - (candidates.get(b)?.length || 0)
    || (topicOrder.get(a) || 0) - (topicOrder.get(b) || 0)
  ));
  const assignedByTopic = new Map<ForecastTopicKey, CalculatedAstroEvidence>();
  const ownerByEvidenceId = new Map<string, ForecastTopicKey>();

  const assign = (
    topic: ForecastTopicKey,
    visitedEvidenceIds: Set<string>,
    visitedTopics: Set<ForecastTopicKey>,
  ): boolean => {
    if (visitedTopics.has(topic)) return false;
    visitedTopics.add(topic);
    for (const candidate of candidates.get(topic) || []) {
      if (visitedEvidenceIds.has(candidate.id)) continue;
      visitedEvidenceIds.add(candidate.id);
      const owner = ownerByEvidenceId.get(candidate.id);
      if (
        !owner
        || assign(owner, visitedEvidenceIds, visitedTopics)
      ) {
        assignedByTopic.set(topic, candidate);
        ownerByEvidenceId.set(candidate.id, topic);
        return true;
      }
    }
    return false;
  };

  for (const topic of orderedTopics) {
    assign(topic, new Set<string>(), new Set<ForecastTopicKey>());
  }
  return assignedByTopic;
}

function classifyTopicEvidence(
  topic: ForecastTopicKey,
  evidence: CalculatedAstroEvidence[],
  primaryCandidate: CalculatedAstroEvidence | undefined,
  assignedPrimaryIds: Set<string>,
): TopicEvidence {
  const candidates = evidence
    .filter((item) => item.topicKeys.includes(topic))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  const remaining = candidates.filter((item) => (
    item.id !== primaryCandidate?.id && !assignedPrimaryIds.has(item.id)
  ));
  const supporting = remaining
    .filter((item) => item.polarity !== 'challenging')
    .slice(0, 3);
  const conflicting = remaining
    .filter((item) => item.polarity === 'challenging')
    .slice(0, 2);
  const totalStrength = (primaryCandidate?.strength || 0)
    + supporting.reduce((sum, item) => sum + item.strength * 0.4, 0);
  return {
    primary: primaryCandidate ? [primaryCandidate] : [],
    supporting,
    conflicting,
    confidence: totalStrength >= 105 ? 'high' : totalStrength >= 60 ? 'medium' : 'low',
  };
}

export async function calculatePersonalForecastEvidence(input: {
  chartData: NatalChartData;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  language: 'ru' | 'en';
  previousDynamicKeys?: DynamicForecastTopicKey[];
}): Promise<EvidenceCalculationResult> {
  const periodDates = buildPersonalForecastSampleDates(input.period, input.window);
  const continuationDates = buildPersonalForecastContinuationSampleDates(
    input.period,
    input.window,
  );
  const dates = [...new Map(
    [...periodDates, ...continuationDates].map((date) => [date.getTime(), date]),
  ).values()].sort((a, b) => a.getTime() - b.getTime());
  const snapshots = await mapWithConcurrency(dates, 4, async (at) => ({
    at,
    transits: await getCurrentTransits(at),
  }));
  if (snapshots.some((snapshot) => snapshot.transits.source !== 'swisseph')) {
    throw new Error('PERSONAL_FORECAST_REQUIRES_SWISSEPH');
  }
  const periodEnd = input.window.endsAt.getTime();
  const periodSnapshots = snapshots.filter(
    (snapshot) => snapshot.at.getTime() <= periodEnd,
  );

  const evidence = dedupeEvidence([
    ...buildPersonalForecastAspectEvidence(input.chartData, input.period, input.window.periodKey, periodSnapshots),
    ...buildPersonalForecastIngressAndStationEvidence(input.chartData, input.period, input.window.periodKey, periodSnapshots),
    ...buildLunationEvidence(input.period, input.window.periodKey, periodSnapshots),
    ...buildPersonalForecastHouseEvidence(input.chartData, input.period, input.window.periodKey, periodSnapshots),
  ]);
  const continuationEvidence = dedupeEvidence(buildContinuationAspectEvidence(
    input.chartData,
    input.period,
    input.window.periodKey,
    snapshots,
    input.window.endsAt,
  ));
  const unknownTopicKeys = validatePersonalForecastEvidenceTopicKeys([
    ...evidence,
    ...continuationEvidence,
  ]);
  if (unknownTopicKeys.length) {
    throw new Error(
      `PERSONAL_FORECAST_EVIDENCE_TOPIC_INVALID:${unknownTopicKeys.join(',')}`,
    );
  }
  const dynamicTopicKeys = selectPersonalForecastDynamicTopics(
    evidence,
    input.previousDynamicKeys,
  );
  if (dynamicTopicKeys.length < 2) {
    throw new Error('PERSONAL_FORECAST_DYNAMIC_EVIDENCE_INSUFFICIENT');
  }

  const selectedTopics = [
    'overview',
    ...FIXED_FORECAST_SECTION_KEYS,
    ...dynamicTopicKeys,
  ] as ForecastTopicKey[];
  const primaryByTopic = assignPersonalForecastPrimaryEvidence(
    selectedTopics,
    evidence,
  );
  const assignedPrimaryIds = new Set(
    [...primaryByTopic.values()].map((item) => item.id),
  );
  const topicEvidence = {} as Record<ForecastTopicKey, TopicEvidence>;
  for (const topic of selectedTopics) {
    topicEvidence[topic] = classifyTopicEvidence(
      topic,
      evidence,
      primaryByTopic.get(topic),
      assignedPrimaryIds,
    );
    if (!topicEvidence[topic].primary.length) {
      throw new Error(`PERSONAL_FORECAST_TOPIC_EVIDENCE_MISSING:${topic}`);
    }
  }
  for (const topic of DYNAMIC_FORECAST_TOPIC_KEYS) {
    if (!topicEvidence[topic]) {
      topicEvidence[topic] = { primary: [], supporting: [], conflicting: [], confidence: 'low' };
    }
  }

  return {
    evidence,
    continuationEvidence,
    topicEvidence,
    dynamicTopicKeys,
    evidenceViews: Object.fromEntries(
      evidence.map((item) => [item.id, evidenceView(item, input.language)]),
    ),
  };
}
