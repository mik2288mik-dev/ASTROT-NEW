import type { NatalChartData, NatalHouseData, PlanetPosition } from '../types';
import { detectTransitAspects, type TransitAspect } from './transitAspects';
import {
  getCurrentTransits,
  type CurrentTransits,
  type PlanetTransit,
} from './transits-calculator';
import {
  DYNAMIC_FORECAST_TOPIC_KEYS,
  FIXED_FORECAST_TOPIC_KEYS,
  PERSONAL_FORECAST_CALCULATION_VERSION,
  type CalculatedAstroEvidence,
  type DynamicForecastTopicKey,
  type ForecastEvidenceView,
  type ForecastTopicKey,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
  type TopicEvidence,
} from './personalForecastContract';

type EvidenceCalculationResult = {
  evidence: CalculatedAstroEvidence[];
  topicEvidence: Record<ForecastTopicKey, TopicEvidence>;
  dynamicTopicKeys: DynamicForecastTopicKey[];
  evidenceViews: Record<string, ForecastEvidenceView>;
};

type AspectObservation = TransitAspect & {
  at: Date;
  natalHouse: number | null;
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
  sun: ['overview', 'work', 'mood_energy', 'luck', 'public_visibility', 'creativity'],
  moon: ['overview', 'love', 'mood_energy', 'home_family', 'rest_recovery'],
  mercury: [
    'communication',
    'work',
    'study',
    'travel_movement',
    'documents_deals',
    'friends_social',
  ],
  venus: ['love', 'money', 'luck', 'creativity', 'home_family', 'purchases_property'],
  mars: ['work', 'mood_energy', 'business', 'physical_activity', 'important_choice'],
  jupiter: [
    'luck',
    'money',
    'work',
    'business',
    'study',
    'travel_movement',
    'public_visibility',
  ],
  saturn: [
    'work',
    'money',
    'business',
    'documents_deals',
    'purchases_property',
    'important_choice',
  ],
  uranus: ['work', 'communication', 'travel_movement', 'important_choice', 'public_visibility'],
  neptune: ['mood_energy', 'creativity', 'rest_recovery', 'important_choice'],
  pluto: ['work', 'money', 'important_choice', 'public_visibility'],
};

const HOUSE_TOPIC_KEYS: Record<number, ForecastTopicKey[]> = {
  1: ['overview', 'mood_energy', 'physical_activity', 'public_visibility'],
  2: ['money', 'business', 'purchases_property'],
  3: ['communication', 'study', 'travel_movement', 'documents_deals'],
  4: ['home_family', 'purchases_property', 'rest_recovery'],
  5: ['love', 'creativity', 'luck'],
  6: ['work', 'mood_energy', 'physical_activity', 'rest_recovery'],
  7: ['love', 'communication', 'documents_deals'],
  8: ['money', 'love', 'purchases_property', 'important_choice'],
  9: ['study', 'travel_movement', 'public_visibility'],
  10: ['work', 'business', 'public_visibility'],
  11: ['friends_social', 'communication', 'luck'],
  12: ['mood_energy', 'rest_recovery', 'creativity'],
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

function natalHouse(chart: NatalChartData, point: string): number | null {
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
  const topics: ForecastTopicKey[] = ['overview'];
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
    supporting: { ru: 'Фактор поддерживает тему и делает её заметнее.', en: 'This factor supports and strengthens the topic.' },
    challenging: { ru: 'Фактор показывает напряжение или необходимость точного решения.', en: 'This factor shows pressure or a need for a precise decision.' },
    mixed: { ru: 'Фактор одновременно даёт возможность и создаёт напряжение.', en: 'This factor combines an opening with pressure.' },
    neutral: { ru: 'Фактор отмечает тему без однозначной оценки.', en: 'This factor marks the topic without a single polarity.' },
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

function shouldKeepAspect(period: PersonalForecastPeriod, observations: AspectObservation[]): boolean {
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
  observations: AspectObservation[],
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
    id: `pf:${period}:${periodKey}:aspect:${first.transitPlanet}:${first.type}:${first.natalPlanet}`,
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

function buildAspectEvidence(
  chart: NatalChartData,
  period: PersonalForecastPeriod,
  periodKey: string,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
): CalculatedAstroEvidence[] {
  const groups = new Map<string, AspectObservation[]>();
  for (const snapshot of snapshots) {
    const aspects = detectTransitAspects(chart, snapshot.transits, { limit: 120 });
    for (const aspect of aspects) {
      const key = `${aspect.transitPlanet}:${aspect.type}:${aspect.natalPlanet}`;
      const items = groups.get(key) || [];
      items.push({
        ...aspect,
        at: snapshot.at,
        natalHouse: natalHouse(chart, aspect.natalPlanet),
      });
      groups.set(key, items);
    }
  }
  return [...groups.values()]
    .map((group) => groupAspectEvidence(chart, period, periodKey, group))
    .filter((item): item is CalculatedAstroEvidence => !!item);
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

function buildIngressAndStationEvidence(
  chart: NatalChartData,
  period: PersonalForecastPeriod,
  periodKey: string,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
): CalculatedAstroEvidence[] {
  const result: CalculatedAstroEvidence[] = [];
  for (const planet of TRANSIT_KEYS) {
    for (let index = 1; index < snapshots.length; index += 1) {
      const previous = snapshots[index - 1].transits[planet] as PlanetTransit | undefined;
      const current = snapshots[index].transits[planet] as PlanetTransit | undefined;
      if (!previous || !current) continue;
      const longitude = transitLongitude(current);
      const house = longitude == null ? null : houseForLongitude(longitude, chart.houses);
      if (previous.sign !== current.sign) {
        result.push({
          id: `pf:${period}:${periodKey}:ingress:${planet}:${current.sign}:${snapshots[index].at.toISOString().slice(0, 10)}`,
          kind: 'ingress',
          transitPlanet: planet,
          house,
          orb: null,
          status: 'active',
          startsAt: iso(snapshots[index].at),
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
          id: `pf:${period}:${periodKey}:station:${planet}:${snapshots[index].at.toISOString().slice(0, 10)}`,
          kind: 'station',
          transitPlanet: planet,
          house,
          orb: null,
          status: 'exact',
          exactAt: iso(snapshots[index].at),
          startsAt: iso(snapshots[index].at),
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
      exactAt: iso(exact.at),
      startsAt: iso(items[0].at),
      endsAt: iso(items[items.length - 1].at),
      strength: Math.max(35, Math.round(65 - exact.orb * 3)),
      polarity: 'mixed' as const,
      topicKeys: ['overview', 'mood_energy', 'love', 'home_family', 'important_choice'] as ForecastTopicKey[],
      calculationSource: `${PERSONAL_FORECAST_CALCULATION_VERSION}:swisseph`,
    };
  });
}

function buildHouseEvidence(
  chart: NatalChartData,
  period: PersonalForecastPeriod,
  periodKey: string,
  snapshots: Array<{ at: Date; transits: CurrentTransits }>,
): CalculatedAstroEvidence[] {
  if (!Array.isArray(chart.houses) || chart.houses.length < 12) return [];
  const result: CalculatedAstroEvidence[] = [];
  const mid = snapshots[Math.floor(snapshots.length / 2)];
  if (!mid) return result;
  for (const planet of TRANSIT_KEYS) {
    if (period === 'year' && ['sun', 'moon', 'mercury', 'venus'].includes(planet)) continue;
    if (period === 'month' && planet === 'moon') continue;
    const transit = mid.transits[planet] as PlanetTransit | undefined;
    const longitude = transitLongitude(transit);
    const house = longitude == null ? null : houseForLongitude(longitude, chart.houses);
    if (!house) continue;
    result.push({
      id: `pf:${period}:${periodKey}:house:${planet}:${house}`,
      kind: 'transit_house',
      transitPlanet: planet,
      house,
      orb: null,
      status: 'active',
      startsAt: iso(snapshots[0]?.at),
      endsAt: iso(snapshots[snapshots.length - 1]?.at),
      strength: Math.min(82, (PLANET_WEIGHTS[planet] || 30) + 8),
      polarity: 'neutral',
      topicKeys: topicsFor(planet, null, house),
      calculationSource: `${PERSONAL_FORECAST_CALCULATION_VERSION}:swisseph`,
    });
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

  const eligible = scores.filter((item) => item.strongest >= 28 && item.score >= 45);
  if (eligible.length < 2) return [];
  const selected = eligible.slice(0, 2);
  const third = eligible[2];
  if (third && third.score >= selected[1].score * 0.82 && third.strongest >= 38) {
    selected.push(third);
  }
  return selected.map((item) => item.key);
}

function classifyTopicEvidence(
  topic: ForecastTopicKey,
  evidence: CalculatedAstroEvidence[],
  claimedPrimaryIds: Set<string>,
): TopicEvidence {
  const candidates = evidence
    .filter((item) => item.topicKeys.includes(topic))
    .sort((a, b) => b.strength - a.strength);
  const primaryCandidate = candidates.find((item) => !claimedPrimaryIds.has(item.id)) || candidates[0];
  if (primaryCandidate) claimedPrimaryIds.add(primaryCandidate.id);
  const remaining = candidates.filter((item) => item.id !== primaryCandidate?.id);
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
  const dates = buildPersonalForecastSampleDates(input.period, input.window);
  const snapshots = await mapWithConcurrency(dates, 4, async (at) => ({
    at,
    transits: await getCurrentTransits(at),
  }));
  if (snapshots.some((snapshot) => snapshot.transits.source !== 'swisseph')) {
    throw new Error('PERSONAL_FORECAST_REQUIRES_SWISSEPH');
  }

  const evidence = dedupeEvidence([
    ...buildAspectEvidence(input.chartData, input.period, input.window.periodKey, snapshots),
    ...buildIngressAndStationEvidence(input.chartData, input.period, input.window.periodKey, snapshots),
    ...buildLunationEvidence(input.period, input.window.periodKey, snapshots),
    ...buildHouseEvidence(input.chartData, input.period, input.window.periodKey, snapshots),
  ]);
  const dynamicTopicKeys = selectPersonalForecastDynamicTopics(
    evidence,
    input.previousDynamicKeys,
  );
  if (dynamicTopicKeys.length < 2) {
    throw new Error('PERSONAL_FORECAST_DYNAMIC_EVIDENCE_INSUFFICIENT');
  }

  const claimedPrimaryIds = new Set<string>();
  const topicEvidence = {} as Record<ForecastTopicKey, TopicEvidence>;
  for (const topic of [...FIXED_FORECAST_TOPIC_KEYS, ...dynamicTopicKeys]) {
    topicEvidence[topic] = classifyTopicEvidence(topic, evidence, claimedPrimaryIds);
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
    topicEvidence,
    dynamicTopicKeys,
    evidenceViews: Object.fromEntries(
      evidence.map((item) => [item.id, evidenceView(item, input.language)]),
    ),
  };
}
