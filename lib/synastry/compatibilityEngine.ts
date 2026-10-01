import type {
  CompatibilityDimensionKey,
  CompatibilityDimensionResult,
  CompatibilityDirectionalPattern,
  CompatibilityEvidence,
  NatalChartData,
} from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { normalizeZodiacKey } from '../zodiacKeys';
import { getCompatScore } from './compatScore';
import type { CompatibilityPairLevel } from './compatibilityInput';
import type { RelationshipContext } from './relationshipContext';
import {
  answerCompatibilityQuestions,
  compatibilityQuestionsFor,
  type CompatibilityQuestionAnswer,
} from './compatibilityQuestions';
import {
  computeSynastryAspects,
  type SynastryAspect,
  type SynastryAspectKey,
  type SynastryBodyKey,
  longitudeSamples,
} from './synastryAspects';

export const COMPATIBILITY_ENGINE_VERSION = 'compatibility-engine.v2';

type SynastryChart = NatalChartData | NatalChartDataV2;
type Language = 'ru' | 'en';
type DimensionEffect = Partial<Record<CompatibilityDimensionKey, number>>;

export type CompatibilitySectionPlanItem = {
  id: string;
  title: string;
  dimensionIds: CompatibilityDimensionKey[];
  evidenceIds: string[];
};

export type CalculatedCompatibility = {
  engineVersion: typeof COMPATIBILITY_ENGINE_VERSION;
  overallScore: number;
  verdict: string;
  relationshipContext: RelationshipContext;
  calculationLevel: CompatibilityPairLevel;
  dimensions: CompatibilityDimensionResult[];
  strongestDimensions: CompatibilityDimensionResult[];
  challengingDimensions: CompatibilityDimensionResult[];
  evidence: CompatibilityEvidence[];
  directionalPatterns: CompatibilityDirectionalPattern[];
  sectionPlan: CompatibilitySectionPlanItem[];
  /** The questions of the chosen relationship type with engine-owned short answers. */
  questions: CompatibilityQuestionAnswer[];
  limitations: string[];
  aspects: SynastryAspect[];
};

export type CompatibilityEngineInput = {
  subjectChart: SynastryChart | null;
  partnerChart: SynastryChart | null;
  calculationLevel: CompatibilityPairLevel;
  relationshipContext: RelationshipContext;
  subjectName?: string;
  partnerName?: string;
  subjectSign?: string | null;
  partnerSign?: string | null;
  language?: Language;
};

type DimensionDefinition = {
  id: CompatibilityDimensionKey;
  weight: number;
};

const DIMENSION_LABELS: Record<CompatibilityDimensionKey, { ru: string; en: string }> = {
  emotional_closeness: { ru: 'Эмоциональная близость', en: 'Emotional closeness' },
  attraction: { ru: 'Притяжение', en: 'Attraction' },
  communication: { ru: 'Общение', en: 'Communication' },
  conflict_ease: { ru: 'Проживание конфликтов', en: 'Handling conflict' },
  trust_boundaries: { ru: 'Доверие и границы', en: 'Trust and boundaries' },
  stability: { ru: 'Устойчивость', en: 'Stability' },
  everyday_life: { ru: 'Быт и привычки', en: 'Everyday life' },
  autonomy: { ru: 'Личное пространство', en: 'Personal space' },
  authenticity: { ru: 'Свобода быть собой', en: 'Being yourselves' },
  shared_interest: { ru: 'Общий интерес', en: 'Shared interest' },
  mutual_support: { ru: 'Поддержка', en: 'Mutual support' },
  decision_making: { ru: 'Решения', en: 'Decision-making' },
  role_balance: { ru: 'Роли и ожидания', en: 'Roles and expectations' },
  work_rhythm: { ru: 'Темп работы', en: 'Work rhythm' },
  responsibility: { ru: 'Ответственность', en: 'Responsibility' },
  pressure_response: { ru: 'Работа под давлением', en: 'Working under pressure' },
};

type CalculationContext = Exclude<RelationshipContext, 'ex'>;

const calculationContext = (context: RelationshipContext): CalculationContext => context === 'ex' ? 'relationship' : context;

const CONTEXT_DIMENSIONS: Record<CalculationContext, DimensionDefinition[]> = {
  romance: [
    { id: 'emotional_closeness', weight: 1.2 },
    { id: 'attraction', weight: 1.15 },
    { id: 'communication', weight: 1 },
    { id: 'conflict_ease', weight: 0.9 },
    { id: 'trust_boundaries', weight: 0.9 },
    { id: 'stability', weight: 0.85 },
  ],
  relationship: [
    { id: 'emotional_closeness', weight: 1.1 },
    { id: 'communication', weight: 1.05 },
    { id: 'conflict_ease', weight: 1 },
    { id: 'everyday_life', weight: 0.95 },
    { id: 'autonomy', weight: 0.85 },
    { id: 'stability', weight: 1.05 },
  ],
  friendship: [
    { id: 'authenticity', weight: 1.05 },
    { id: 'communication', weight: 1.15 },
    { id: 'shared_interest', weight: 1 },
    { id: 'mutual_support', weight: 1 },
    { id: 'trust_boundaries', weight: 0.9 },
    { id: 'conflict_ease', weight: 0.8 },
  ],
  family: [
    { id: 'emotional_closeness', weight: 1.05 },
    { id: 'mutual_support', weight: 1.1 },
    { id: 'role_balance', weight: 0.95 },
    { id: 'trust_boundaries', weight: 1 },
    { id: 'conflict_ease', weight: 1 },
    { id: 'communication', weight: 0.9 },
  ],
  work: [
    { id: 'decision_making', weight: 1.1 },
    { id: 'communication', weight: 1.1 },
    { id: 'work_rhythm', weight: 1 },
    { id: 'role_balance', weight: 0.95 },
    { id: 'responsibility', weight: 1.05 },
    { id: 'pressure_response', weight: 0.9 },
  ],
};

const PERSONAL = new Set<SynastryBodyKey>(['sun', 'moon', 'mercury', 'venus', 'mars']);
const OUTER = new Set<SynastryBodyKey>(['uranus', 'neptune', 'pluto']);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 0) => Number(value.toFixed(digits));

function mergeEffects(target: DimensionEffect, source: DimensionEffect, multiplier = 1): void {
  for (const [key, value] of Object.entries(source) as Array<[CompatibilityDimensionKey, number]>) {
    target[key] = (target[key] || 0) + value * multiplier;
  }
}

function aspectTone(aspect: SynastryAspectKey): 'flow' | 'tension' | 'merge' {
  if (aspect === 'trine' || aspect === 'sextile') return 'flow';
  if (aspect === 'square' || aspect === 'opposition') return 'tension';
  return 'merge';
}

function pairIncludes(first: SynastryBodyKey, second: SynastryBodyKey, a: SynastryBodyKey, b: SynastryBodyKey): boolean {
  return (first === a && second === b) || (first === b && second === a);
}

function thematicAspectEffects(aspect: SynastryAspect): DimensionEffect {
  const { aKey, bKey } = aspect;
  const tone = aspectTone(aspect.aspectKey);
  const flow = tone === 'flow';
  const tension = tone === 'tension';
  const merge = tone === 'merge';
  const effects: DimensionEffect = {};
  const relational = flow ? 1 : tension ? -0.82 : 0.52;

  if (pairIncludes(aKey, bKey, 'sun', 'moon')) {
    mergeEffects(effects, { emotional_closeness: relational, mutual_support: relational * 0.65, stability: flow ? 0.45 : tension ? -0.25 : 0.3 });
  } else if (aKey === 'moon' && bKey === 'moon') {
    mergeEffects(effects, { emotional_closeness: relational, everyday_life: relational * 0.7, mutual_support: relational * 0.7 });
  } else if (pairIncludes(aKey, bKey, 'moon', 'venus')) {
    mergeEffects(effects, { emotional_closeness: relational * 0.9, attraction: flow || merge ? 0.65 : 0.28, trust_boundaries: relational * 0.45 });
  } else if (pairIncludes(aKey, bKey, 'venus', 'mars')) {
    mergeEffects(effects, { attraction: tension ? 0.78 : 0.95, conflict_ease: tension ? -0.72 : 0.35, trust_boundaries: tension ? -0.28 : 0.22 });
  } else if (aKey === 'venus' && bKey === 'venus') {
    mergeEffects(effects, { attraction: relational * 0.8, shared_interest: relational * 0.75, everyday_life: relational * 0.4 });
  } else if (aKey === 'mars' && bKey === 'mars') {
    mergeEffects(effects, { attraction: tension ? 0.35 : 0.55, conflict_ease: tension ? -0.95 : 0.45, work_rhythm: relational * 0.75, pressure_response: relational * 0.8 });
  } else if (aKey === 'mercury' && bKey === 'mercury') {
    mergeEffects(effects, { communication: relational, decision_making: relational * 0.8, conflict_ease: relational * 0.45 });
  } else if (pairIncludes(aKey, bKey, 'mercury', 'moon')) {
    mergeEffects(effects, { communication: relational * 0.9, emotional_closeness: relational * 0.65, conflict_ease: relational * 0.5 });
  } else if (pairIncludes(aKey, bKey, 'mercury', 'sun')) {
    mergeEffects(effects, { communication: relational * 0.9, decision_making: relational * 0.7, authenticity: relational * 0.45 });
  } else if (pairIncludes(aKey, bKey, 'mercury', 'mars')) {
    mergeEffects(effects, { communication: tension ? -0.9 : 0.65, conflict_ease: tension ? -0.9 : 0.45, pressure_response: tension ? -0.7 : 0.55, decision_making: relational * 0.45 });
  } else if (aKey === 'sun' && bKey === 'sun') {
    mergeEffects(effects, { authenticity: relational * 0.8, shared_interest: relational * 0.65, role_balance: relational * 0.5 });
  }

  const keys = [aKey, bKey];
  const otherThan = (key: SynastryBodyKey) => (aKey === key ? bKey : aKey);

  if (keys.includes('jupiter') && PERSONAL.has(otherThan('jupiter'))) {
    mergeEffects(effects, {
      mutual_support: flow || merge ? 0.9 : 0.35,
      shared_interest: flow || merge ? 0.72 : 0.22,
      decision_making: tension ? -0.2 : 0.4,
      authenticity: 0.35,
    });
  }

  if (keys.includes('saturn') && PERSONAL.has(otherThan('saturn'))) {
    mergeEffects(effects, {
      stability: flow ? 0.92 : merge ? 0.7 : 0.32,
      responsibility: flow ? 0.9 : merge ? 0.72 : 0.38,
      role_balance: flow ? 0.55 : tension ? -0.62 : 0.28,
      trust_boundaries: tension ? -0.72 : 0.48,
      conflict_ease: tension ? -0.62 : 0.25,
      autonomy: tension || merge ? -0.48 : 0.18,
    });
  }

  if (keys.includes('uranus') && PERSONAL.has(otherThan('uranus'))) {
    mergeEffects(effects, {
      authenticity: 0.62,
      autonomy: flow ? 0.72 : tension || merge ? -0.25 : 0.35,
      attraction: 0.32,
      stability: tension || merge ? -0.62 : -0.2,
      work_rhythm: tension ? -0.42 : 0.2,
    });
  }

  if (keys.includes('neptune') && PERSONAL.has(otherThan('neptune'))) {
    mergeEffects(effects, {
      emotional_closeness: flow ? 0.58 : merge ? 0.42 : -0.18,
      attraction: flow || merge ? 0.38 : 0.12,
      shared_interest: flow ? 0.48 : 0.18,
      trust_boundaries: tension || merge ? -0.62 : 0.2,
      decision_making: tension ? -0.4 : 0.08,
    });
  }

  if (keys.includes('pluto') && PERSONAL.has(otherThan('pluto'))) {
    mergeEffects(effects, {
      attraction: 0.4,
      emotional_closeness: flow ? 0.32 : 0.08,
      trust_boundaries: tension || merge ? -0.62 : 0.22,
      autonomy: tension || merge ? -0.48 : 0.1,
      conflict_ease: tension ? -0.48 : 0.12,
    });
  }

  if (!Object.keys(effects).length && PERSONAL.has(aKey) && PERSONAL.has(bKey)) {
    mergeEffects(effects, {
      authenticity: relational * 0.35,
      communication: relational * 0.28,
      conflict_ease: relational * 0.25,
    });
  }

  return effects;
}

function planetPairWeight(a: SynastryBodyKey, b: SynastryBodyKey): number {
  if (OUTER.has(a) && OUTER.has(b)) return 0.18;
  if (OUTER.has(a) || OUTER.has(b)) return 0.56;
  if (PERSONAL.has(a) && PERSONAL.has(b)) return 1;
  return 0.82;
}

const PLANET_LABELS: Record<SynastryBodyKey, { ru: string; en: string }> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
};

const ASPECT_LABELS: Record<SynastryAspectKey, { ru: string; en: string }> = {
  conjunction: { ru: 'соединение', en: 'conjunction' },
  sextile: { ru: 'секстиль', en: 'sextile' },
  square: { ru: 'квадрат', en: 'square' },
  trine: { ru: 'трин', en: 'trine' },
  opposition: { ru: 'оппозиция', en: 'opposition' },
};

function buildAspectEvidence(aspects: SynastryAspect[], language: Language): CompatibilityEvidence[] {
  const labelKey = language === 'en' ? 'en' : 'ru';
  return aspects.flatMap((aspect, index) => {
    const dimensionEffects = thematicAspectEffects(aspect);
    if (!Object.keys(dimensionEffects).length) return [];
    const reliabilityWeight = aspect.reliability === 'stable_in_range' ? 0.82 : 1;
    const weight = aspect.strength * planetPairWeight(aspect.aKey, aspect.bKey) * reliabilityWeight;
    if (weight < 0.07) return [];
    return [{
      id: `aspect:${aspect.aKey}:${aspect.bKey}:${aspect.aspectKey}:${round(aspect.orb, 2)}:${index}`,
      type: 'aspect' as const,
      direction: 'mutual' as const,
      label: `${PLANET_LABELS[aspect.aKey][labelKey]} — ${PLANET_LABELS[aspect.bKey][labelKey]}: ${ASPECT_LABELS[aspect.aspectKey][labelKey]}, ${language === 'ru' ? 'орб' : 'orb'} ${round(aspect.orb, 1)}°`,
      weight: round(weight, 4),
      reliability: aspect.reliability,
      dimensionEffects,
      technical: {
        subjectKey: aspect.aKey,
        partnerKey: aspect.bKey,
        aspect: aspect.aspectKey,
        orb: round(aspect.orb, 2),
      },
    }];
  });
}

function readPosition(chart: SynastryChart, key: SynastryBodyKey): { longitude?: number; reliability?: string } | null {
  const source = chart as NatalChartDataV2;
  return (source.positions?.[key] || (chart as unknown as Record<string, any>)[key] || null) as any;
}

function positionSamples(chart: SynastryChart, key: SynastryBodyKey): number[] | null {
  return longitudeSamples(readPosition(chart, key) as Parameters<typeof longitudeSamples>[0]);
}

function chartQuality(chart: SynastryChart): { anglesReliable: boolean; housesReliable: boolean } {
  const source = chart as any;
  return {
    anglesReliable: Boolean(source.chartQuality?.anglesAvailable ?? source.chartQuality?.ascendantReliable),
    housesReliable: Boolean(source.chartQuality?.housesReliable),
  };
}

function angleData(chart: SynastryChart, key: 'ascendant' | 'mc'): { longitude: number; reliability: 'exact' | 'stable_in_range' } | null {
  if (!chartQuality(chart).anglesReliable) return null;
  const source = chart as any;
  const angle = source.angles?.[key] || (key === 'ascendant' ? source.rising : source.mc);
  if (!angle || angle.reliability === 'variable_in_range') return null;
  if (typeof angle.longitude !== 'number' || !Number.isFinite(angle.longitude)) return null;
  return {
    longitude: ((angle.longitude % 360) + 360) % 360,
    reliability: angle.reliability === 'stable_in_range' ? 'stable_in_range' : 'exact',
  };
}

function closestAngleAspect(first: number, second: number): { aspect: SynastryAspectKey; orb: number; strength: number } | null {
  let distance = Math.abs(first - second) % 360;
  if (distance > 180) distance = 360 - distance;
  const definitions: Array<{ aspect: SynastryAspectKey; angle: number }> = [
    { aspect: 'conjunction', angle: 0 },
    { aspect: 'square', angle: 90 },
    { aspect: 'opposition', angle: 180 },
  ];
  const match = definitions
    .map((definition) => ({ ...definition, orb: Math.abs(distance - definition.angle) }))
    .sort((a, b) => a.orb - b.orb)[0];
  if (!match || match.orb > 4) return null;
  return { aspect: match.aspect, orb: match.orb, strength: 1 - match.orb / 4 };
}

function buildAngleEvidence(
  subjectChart: SynastryChart,
  partnerChart: SynastryChart,
  language: Language,
): CompatibilityEvidence[] {
  const output: CompatibilityEvidence[] = [];
  const labelKey = language === 'en' ? 'en' : 'ru';
  const directions = [
    { source: subjectChart, target: partnerChart, direction: 'subject_to_partner' as const },
    { source: partnerChart, target: subjectChart, direction: 'partner_to_subject' as const },
  ];
  for (const { source, target, direction } of directions) {
    for (const bodyKey of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as SynastryBodyKey[]) {
      const samples = positionSamples(source, bodyKey);
      if (!samples) continue;
      for (const angleKey of ['ascendant', 'mc'] as const) {
        const angle = angleData(target, angleKey);
        if (!angle) continue;
        const contacts = samples.map((body) => closestAngleAspect(body, angle.longitude));
        const contact = contacts.every((item) => item && item.aspect === contacts[0]!.aspect)
          ? contacts.reduce((worst, item) => (item!.orb > worst!.orb ? item : worst), contacts[0])
          : null;
        if (!contact || contact.strength < 0.08) continue;
        const tension = contact.aspect === 'square' || contact.aspect === 'opposition';
        const dimensionEffects: DimensionEffect = angleKey === 'ascendant'
          ? {
              attraction: bodyKey === 'venus' || bodyKey === 'mars' ? (tension ? 0.38 : 0.76) : (tension ? 0.12 : 0.45),
              authenticity: tension ? -0.28 : 0.5,
              conflict_ease: tension ? -0.35 : 0.15,
            }
          : {
              decision_making: tension ? -0.35 : 0.48,
              role_balance: tension ? -0.42 : 0.5,
              responsibility: bodyKey === 'saturn' ? 0.55 : (tension ? -0.15 : 0.32),
            };
        const angleLabel = angleKey === 'ascendant' ? (language === 'ru' ? 'Асцендент' : 'Ascendant') : 'MC';
        output.push({
          id: `angle:${direction}:${bodyKey}:${angleKey}:${contact.aspect}:${round(contact.orb, 2)}`,
          type: 'angle',
          direction,
          label: `${PLANET_LABELS[bodyKey][labelKey]} — ${angleLabel}: ${ASPECT_LABELS[contact.aspect][labelKey]}, ${language === 'ru' ? 'орб' : 'orb'} ${round(contact.orb, 1)}°`,
          weight: round(contact.strength * 0.72, 4),
          reliability: angle.reliability === 'stable_in_range'
            || readPosition(source, bodyKey)?.reliability === 'stable_in_range'
            ? 'stable_in_range'
            : 'exact',
          dimensionEffects,
          technical: { subjectKey: bodyKey, partnerKey: angleKey, aspect: contact.aspect, orb: round(contact.orb, 2) },
        });
      }
    }
  }
  return output;
}

function houseForLongitude(chart: SynastryChart, longitude: number): number | null {
  if (!chartQuality(chart).housesReliable) return null;
  const houses = (chart as any).houses;
  if (!Array.isArray(houses) || houses.length < 12) return null;
  const cusps = houses
    .map((house: any) => ({ house: Number(house.house), longitude: Number(house.longitude), reliability: house.reliability }))
    .filter((house: any) => Number.isInteger(house.house) && Number.isFinite(house.longitude) && house.reliability !== 'variable_in_range')
    .sort((a: any, b: any) => a.house - b.house);
  if (cusps.length !== 12) return null;
  for (let index = 0; index < cusps.length; index += 1) {
    const start = ((cusps[index].longitude % 360) + 360) % 360;
    const end = ((cusps[(index + 1) % cusps.length].longitude % 360) + 360) % 360;
    const span = (end - start + 360) % 360;
    const offset = (longitude - start + 360) % 360;
    if (offset < span || index === cusps.length - 1 && offset === span) return cusps[index].house;
  }
  return null;
}

function houseEffects(house: number): DimensionEffect {
  const mapping: Record<number, DimensionEffect> = {
    1: { authenticity: 0.52, attraction: 0.35 },
    2: { stability: 0.48, responsibility: 0.32 },
    3: { communication: 0.55, shared_interest: 0.28 },
    4: { emotional_closeness: 0.58, mutual_support: 0.42, everyday_life: 0.35 },
    5: { attraction: 0.58, shared_interest: 0.48 },
    6: { everyday_life: 0.52, work_rhythm: 0.48, responsibility: 0.32 },
    7: { stability: 0.55, emotional_closeness: 0.28, role_balance: 0.32 },
    8: { trust_boundaries: 0.34, attraction: 0.38 },
    9: { shared_interest: 0.52, decision_making: 0.25 },
    10: { responsibility: 0.55, role_balance: 0.48, decision_making: 0.32 },
    11: { authenticity: 0.48, shared_interest: 0.55, mutual_support: 0.32 },
    12: { emotional_closeness: 0.25, trust_boundaries: -0.18 },
  };
  return mapping[house] || {};
}

function buildHouseEvidence(
  subjectChart: SynastryChart,
  partnerChart: SynastryChart,
  language: Language,
  names: { subject: string; partner: string },
): CompatibilityEvidence[] {
  const output: CompatibilityEvidence[] = [];
  const labelKey = language === 'en' ? 'en' : 'ru';
  const directions = [
    { source: subjectChart, target: partnerChart, direction: 'subject_to_partner' as const, owner: names.subject, host: names.partner },
    { source: partnerChart, target: subjectChart, direction: 'partner_to_subject' as const, owner: names.partner, host: names.subject },
  ];
  for (const { source, target, direction, owner, host } of directions) {
    for (const bodyKey of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as SynastryBodyKey[]) {
      const samples = positionSamples(source, bodyKey);
      if (!samples) continue;
      const houses = samples.map((longitude) => houseForLongitude(target, longitude));
      const house = houses[0];
      // Without a birth time the body may cross a house cusp during the day — then the house is unknown.
      if (!house || houses.some((item) => item !== house)) continue;
      const timeStable = (source as any).birthTimeQuality === 'approximate'
        || (target as any).birthTimeQuality === 'approximate'
        || readPosition(source, bodyKey)?.reliability === 'stable_in_range';
      output.push({
        id: `house:${direction}:${bodyKey}:${house}`,
        type: 'house_overlay',
        direction,
        label: language === 'ru'
          ? `${PLANET_LABELS[bodyKey][labelKey]} (${owner}) — в ${house}-м доме карты (${host})`
          : `${PLANET_LABELS[bodyKey][labelKey]} (${owner}) — in house ${house} of the chart (${host})`,
        weight: 0.28,
        reliability: timeStable ? 'stable_in_range' : 'exact',
        dimensionEffects: houseEffects(house),
        technical: { subjectKey: bodyKey, house },
      });
    }
  }
  return output;
}

function buildLimitedSignEvidence(input: CompatibilityEngineInput): CompatibilityEvidence[] {
  const subject = normalizeZodiacKey(input.subjectSign);
  const partner = normalizeZodiacKey(input.partnerSign);
  if (!subject || !partner || input.subjectChart && input.partnerChart) return [];
  const language = input.language === 'en' ? 'en' : 'ru';
  const signResult = getCompatScore(subject, partner, language);
  const normalized = (signResult.overall - 50) / 50;
  const romantic = input.relationshipContext === 'romance';
  const established = calculationContext(input.relationshipContext) === 'relationship';
  const dimensionEffects: DimensionEffect = input.relationshipContext === 'work'
    ? { work_rhythm: normalized, decision_making: normalized * 0.7, communication: normalized * 0.55 }
    : input.relationshipContext === 'friendship'
      ? { shared_interest: normalized, authenticity: normalized * 0.6, communication: normalized * 0.55 }
      : input.relationshipContext === 'family'
        ? { emotional_closeness: normalized * 0.65, mutual_support: normalized * 0.7, communication: normalized * 0.45 }
        : {
            emotional_closeness: normalized * 0.7,
            attraction: romantic ? normalized : 0,
            everyday_life: established ? normalized * 0.65 : 0,
            communication: normalized * 0.4,
          };
  return [{
    id: `sign:${subject}:${partner}:${input.relationshipContext}`,
    type: 'sign',
    direction: 'mutual',
    label: language === 'ru'
      ? `Ограниченный общий слой по солнечным знакам: ${subject} + ${partner}`
      : `Limited Sun-sign layer: ${subject} + ${partner}`,
    weight: 0.24,
    reliability: 'limited',
    dimensionEffects,
  }];
}

function calculatedDimensions(
  definitions: DimensionDefinition[],
  evidence: CompatibilityEvidence[],
  language: Language,
): CompatibilityDimensionResult[] {
  return definitions.map(({ id }) => {
    let positiveCore = 0;
    let negativeCore = 0;
    let positiveOuter = 0;
    let negativeOuter = 0;
    const supportiveEvidenceIds: string[] = [];
    const challengingEvidenceIds: string[] = [];
    for (const item of evidence) {
      const effect = item.dimensionEffects[id] || 0;
      const weighted = effect * item.weight;
      const subjectKey = item.technical?.subjectKey as SynastryBodyKey | undefined;
      const partnerKey = item.technical?.partnerKey as SynastryBodyKey | undefined;
      const outerAspect = item.type === 'aspect'
        && Boolean((subjectKey && OUTER.has(subjectKey)) || (partnerKey && OUTER.has(partnerKey)));
      if (weighted > 0) {
        if (outerAspect) positiveOuter += weighted;
        else positiveCore += weighted;
        supportiveEvidenceIds.push(item.id);
      } else if (weighted < 0) {
        if (outerAspect) negativeOuter += Math.abs(weighted);
        else negativeCore += Math.abs(weighted);
        challengingEvidenceIds.push(item.id);
      }
    }
    // Generational outer-planet contacts enrich a theme but cannot outweigh
    // an unlimited number of personal-planet contacts in the same dimension.
    const positive = positiveCore + Math.min(positiveOuter, 0.9);
    const negative = negativeCore + Math.min(negativeOuter, 0.9);
    const total = positive + negative;
    const balance = total ? (positive - negative) / (total + 0.72) : 0;
    const score = clamp(Math.round(50 + 47 * balance), 0, 100);
    const confidence = clamp(Math.round((1 - Math.exp(-total / 1.35)) * 100), 0, 100);
    const byImpact = (first: string, second: string) => {
      const firstEvidence = evidence.find((item) => item.id === first);
      const secondEvidence = evidence.find((item) => item.id === second);
      return Math.abs((secondEvidence?.dimensionEffects[id] || 0) * (secondEvidence?.weight || 0))
        - Math.abs((firstEvidence?.dimensionEffects[id] || 0) * (firstEvidence?.weight || 0));
    };
    return {
      id,
      label: DIMENSION_LABELS[id][language],
      score,
      confidence,
      supportiveEvidenceIds: supportiveEvidenceIds.sort(byImpact).slice(0, 5),
      challengingEvidenceIds: challengingEvidenceIds.sort(byImpact).slice(0, 5),
    };
  });
}

export function compatibilityVerdict(score: number, language: Language = 'ru'): string {
  if (language === 'en') {
    if (score >= 85) return 'Very strong connection';
    if (score >= 70) return 'Strong connection';
    if (score >= 55) return 'A lively, mixed connection';
    if (score >= 40) return 'A demanding connection';
    return 'A complex connection';
  }
  if (score >= 85) return 'Очень сильная связь';
  if (score >= 70) return 'Сильная связь';
  if (score >= 55) return 'Живая, смешанная связь';
  if (score >= 40) return 'Требовательная связь';
  return 'Сложная связь';
}

function buildDirectionalPatterns(
  evidence: CompatibilityEvidence[],
  subjectName: string,
  partnerName: string,
  language: Language,
): CompatibilityDirectionalPattern[] {
  const output: CompatibilityDirectionalPattern[] = [];
  const seen = new Set<string>();
  const candidateAspects = evidence
    .filter((item) => item.type === 'aspect' && item.technical?.subjectKey && item.technical.partnerKey)
    .sort((first, second) => second.weight - first.weight);

  for (const item of candidateAspects) {
    const subjectKey = item.technical?.subjectKey as SynastryBodyKey;
    const partnerKey = item.technical?.partnerKey as SynastryBodyKey;
    const aspect = item.technical?.aspect as SynastryAspectKey;
    const hard = aspect === 'square' || aspect === 'opposition';
    let direction: CompatibilityDirectionalPattern['direction'] | null = null;
    let sourceName = subjectName;
    let targetName = partnerName;
    let agent: SynastryBodyKey | null = null;
    let target: SynastryBodyKey | null = null;

    if (['mars', 'saturn', 'jupiter', 'uranus', 'neptune', 'pluto'].includes(subjectKey) && PERSONAL.has(partnerKey)) {
      direction = 'subject_to_partner';
      agent = subjectKey;
      target = partnerKey;
    } else if (['mars', 'saturn', 'jupiter', 'uranus', 'neptune', 'pluto'].includes(partnerKey) && PERSONAL.has(subjectKey)) {
      direction = 'partner_to_subject';
      sourceName = partnerName;
      targetName = subjectName;
      agent = partnerKey;
      target = subjectKey;
    }
    if (!direction || !agent || !target) continue;
    // One message per «who → whom + planet»: repeating the same idea reads as filler.
    const seenKey = `${direction}:${agent}`;
    if (seen.has(seenKey)) continue;

    let fact = '';
    if (language === 'en') {
      if (agent === 'mars') fact = `${sourceName}'s initiative directly affects ${targetName}'s ${target === 'mercury' ? 'way of explaining decisions' : 'response speed'}${hard ? '; under pressure, pace can turn into friction' : ' and can help the pair move from words to action'}.`;
      if (agent === 'saturn') fact = `${sourceName}'s limits and standards strongly affect how ${targetName} experiences ${target === 'moon' || target === 'venus' ? 'support and closeness' : 'shared responsibility'}${hard ? '; structure can sometimes feel heavier than intended' : ' and can make agreements more dependable'}.`;
      if (agent === 'jupiter') fact = `${sourceName} tends to widen the options available to ${targetName}; this contact supports encouragement without deciding the outcome for the pair.`;
      if (agent === 'uranus') fact = `${sourceName} activates a need for more freedom and a different pace in ${targetName}${hard ? ', which can interrupt predictability' : ', helping the connection stay flexible'}.`;
      if (agent === 'neptune') fact = `${sourceName} makes ${targetName}'s response more sensitive to nuance${hard ? ', so unspoken expectations need especially clear verification' : ', which can deepen mutual understanding'}.`;
      if (agent === 'pluto') fact = `${sourceName} intensifies the impact of ${targetName}'s reactions${hard ? '; pressure and boundaries therefore matter more than usual' : ', giving the interaction unusual depth'}.`;
    } else {
      // Names stay in the nominative case: Russian names cannot be declined reliably.
      if (agent === 'mars') fact = target === 'mercury'
        ? `${sourceName} быстрее переходит к делу, и это влияет на то, как ${targetName} объясняет свои решения. ${hard ? 'Когда времени мало, разная скорость приводит к спорам.' : 'Вместе вам проще перейти от разговоров к делу.'}`
        : `${sourceName} быстрее переходит к делу, и это влияет на то, как быстро ${targetName} отвечает и реагирует. ${hard ? 'Когда времени мало, разная скорость приводит к спорам.' : 'Вместе вам проще перейти от разговоров к делу.'}`;
      if (agent === 'saturn') fact = `${sourceName} приносит в пару правила и порядок. ${targetName} чувствует это ${target === 'moon' || target === 'venus' ? 'в том, как получает поддержку и заботу' : 'в общих обязанностях'}. ${hard ? 'Иногда эти правила кажутся слишком строгими.' : 'Благодаря этому договорённости выполняются.'}`;
      if (agent === 'jupiter') fact = `${sourceName} обычно поддерживает и подбадривает. ${targetName} рядом чувствует больше уверенности и видит больше вариантов.`;
      if (agent === 'uranus') fact = `${sourceName} приносит в пару перемены и неожиданные решения. ${targetName} рядом хочет больше свободы и другого темпа${hard ? ', поэтому планы чаще меняются в последний момент.' : ', и это помогает не застревать в рутине.'}`;
      if (agent === 'neptune') fact = hard
        ? `${sourceName} и ${targetName} часто понимают друг друга без слов, но так же легко понимают неправильно. Ожидания лучше говорить прямо.`
        : `${sourceName} и ${targetName} хорошо чувствуют настроение друг друга даже без слов.`;
      if (agent === 'pluto') fact = hard
        ? `${sourceName} сильно влияет на настроение и решения в паре. ${targetName} остро реагирует на давление, поэтому важно не настаивать и спокойно принимать отказ.`
        : `${sourceName} сильно влияет на настроение и решения в паре, и ${targetName} это ценит: отношения получаются серьёзными.`;
    }
    if (!fact) continue;
    seen.add(seenKey);
    output.push({
      id: `direction:${output.length + 1}:${item.id}`,
      direction,
      title: `${sourceName} → ${targetName}`,
      fact,
      evidenceIds: [item.id],
    });
    if (output.length >= 3) break;
  }

  const hasSubjectPressure = output.some((item) => item.direction === 'subject_to_partner');
  const hasPartnerPressure = output.some((item) => item.direction === 'partner_to_subject');
  if (hasSubjectPressure && hasPartnerPressure) {
    const ids = output.flatMap((item) => item.evidenceIds).slice(0, 2);
    output.push({
      id: 'direction:mutual-loop',
      direction: 'mutual',
      title: language === 'ru' ? 'Один и тот же спор' : 'Repeating loop',
      fact: language === 'ru'
        ? 'Вы влияете друг на друга одинаково сильно, поэтому один и тот же спор легко повторяется. Помогает обсуждать конкретный случай, а не характер друг друга.'
        : 'The influence runs both ways: one response amplifies the other, so the same loop can repeat quickly unless the pair names the concrete issue at hand.',
      evidenceIds: ids,
    });
  }
  return output;
}

function buildLimitations(input: CompatibilityEngineInput): string[] {
  const ru = input.language !== 'en';
  const limitations: string[] = [];
  if (input.calculationLevel === 'reduced') {
    limitations.push(ru
      ? 'Время рождения известно не у обоих. Дома и Асцендент считаем только там, где время есть, а Луну и другие быстрые планеты проверяем на весь день рождения.'
      : 'Exact birth time is not known for both people, so unreliable houses, Ascendant and MC were excluded.');
  }
  if (input.calculationLevel === 'date_only') {
    limitations.push(ru
      ? 'Часть данных ограничена датой рождения: разбор использует только доступные устойчивые факты и не показывает дома или углы карты.'
      : 'Some input is limited to a birth date, so the reading uses only stable available facts and omits houses and chart angles.');
  }
  if (input.calculationLevel === 'hybrid_sign') {
    limitations.push(ru
      ? 'Один человек указан только знаком: это смешанный разбор, без выдуманных положений планет, домов и углов его карты.'
      : 'One person is represented only by a zodiac sign, so this is a mixed reading without invented planets, houses or chart angles.');
  }
  if (
    (input.subjectChart && !chartQuality(input.subjectChart).housesReliable)
    || (input.partnerChart && !chartQuality(input.partnerChart).housesReliable)
  ) {
    if (!limitations.some((item) => item.includes(ru ? 'дома' : 'houses'))) {
      limitations.push(ru
        ? 'Ненадёжные дома и углы сохранённых расчётов исключены из результата.'
        : 'Unreliable houses and angles in saved calculations were excluded.');
    }
  }
  return limitations;
}

function buildSectionPlan(
  context: RelationshipContext,
  evidence: CompatibilityEvidence[],
  language: Language,
): CompatibilitySectionPlanItem[] {
  return compatibilityQuestionsFor(context).map((definition) => {
    const evidenceIds = evidence
      .map((item) => ({
        id: item.id,
        impact: definition.dimensionIds.reduce((sum, dimension) => sum + Math.abs(item.dimensionEffects[dimension] || 0), 0) * item.weight,
      }))
      .filter((item) => item.impact > 0.04)
      .sort((first, second) => second.impact - first.impact)
      .slice(0, 4)
      .map((item) => item.id);
    return {
      id: definition.id,
      title: language === 'ru' ? definition.ru : definition.en,
      dimensionIds: definition.dimensionIds,
      evidenceIds,
    };
  });
}

export function calculateCompatibility(input: CompatibilityEngineInput): CalculatedCompatibility {
  const language: Language = input.language === 'en' ? 'en' : 'ru';
  const subjectName = input.subjectName?.trim() || (language === 'ru' ? 'Первый человек' : 'First person');
  const partnerName = input.partnerName?.trim() || (language === 'ru' ? 'Второй человек' : 'Second person');
  const aspects = computeSynastryAspects(input.subjectChart, input.partnerChart);
  const evidence = [
    ...buildAspectEvidence(aspects, language),
    ...(input.subjectChart && input.partnerChart ? buildAngleEvidence(input.subjectChart, input.partnerChart, language) : []),
    ...(input.subjectChart && input.partnerChart ? buildHouseEvidence(input.subjectChart, input.partnerChart, language, { subject: subjectName, partner: partnerName }) : []),
    ...buildLimitedSignEvidence(input),
  ];
  const definitions = CONTEXT_DIMENSIONS[calculationContext(input.relationshipContext)];
  const dimensions = calculatedDimensions(definitions, evidence, language);
  const totalWeight = definitions.reduce((sum, item) => sum + item.weight, 0);
  const overallScore = clamp(Math.round(definitions.reduce((sum, item) => {
    const dimension = dimensions.find((candidate) => candidate.id === item.id)!;
    return sum + dimension.score * item.weight;
  }, 0) / totalWeight), 0, 100);
  const evidenceBacked = [...dimensions].sort((first, second) => second.confidence - first.confidence);
  const strongestDimensions = evidenceBacked
    .filter((dimension) => dimension.confidence > 0)
    .sort((first, second) => second.score - first.score || second.confidence - first.confidence)
    .slice(0, 2);
  const challengingDimensions = evidenceBacked
    .filter((dimension) => dimension.confidence > 0)
    .sort((first, second) => first.score - second.score || second.confidence - first.confidence)
    .slice(0, 2);

  return {
    engineVersion: COMPATIBILITY_ENGINE_VERSION,
    overallScore,
    verdict: compatibilityVerdict(overallScore, language),
    relationshipContext: input.relationshipContext,
    calculationLevel: input.calculationLevel,
    dimensions,
    strongestDimensions,
    challengingDimensions,
    evidence,
    directionalPatterns: buildDirectionalPatterns(evidence, subjectName, partnerName, language),
    sectionPlan: buildSectionPlan(input.relationshipContext, evidence, language),
    questions: answerCompatibilityQuestions(input.relationshipContext, dimensions, language),
    limitations: buildLimitations(input),
    aspects,
  };
}
