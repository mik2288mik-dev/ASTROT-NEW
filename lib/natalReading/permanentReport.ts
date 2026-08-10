import { createHash } from 'crypto';
import type {
  InterpretationSection,
  NatalChartData,
  NatalInterpretationReport,
  UserProfile,
} from '../../types';
import type {
  NatalAngleKey,
  NatalAspectV2,
  NatalBodyKey,
  NatalChartDataV2,
  NatalPositionV2,
} from '../natalChartV2Types';
import { APP_VOICE_VERSION, withAppVoiceCacheKey, withAppVoiceVersion } from '../appVoice';

export const NATAL_PERMANENT_CONTRACT_VERSION = 'natal-permanent-report-v5';
export const NATAL_PERMANENT_FREE_PROMPT_VERSION = withAppVoiceVersion(
  `${NATAL_PERMANENT_CONTRACT_VERSION}.free.v4`,
);
export const NATAL_PERMANENT_PREMIUM_PROMPT_VERSION = withAppVoiceVersion(
  `${NATAL_PERMANENT_CONTRACT_VERSION}.premium.v4`,
);
export const NATAL_PERMANENT_FREE_CACHE_KEY = withAppVoiceCacheKey(
  'natal.permanent.free.v5',
);
export const NATAL_PERMANENT_PREMIUM_CACHE_KEY = withAppVoiceCacheKey(
  'natal.permanent.premium.v5',
);

export type NatalReadingLanguage = 'ru' | 'en';
export type NatalBirthTimeQuality = 'exact' | 'approximate' | 'unknown';

export function buildPermanentNatalCacheKey(
  baseKey: string,
  language: NatalReadingLanguage,
): string {
  return `${baseKey}.${language}`;
}

export type NatalReadingStatement = {
  text: string;
  evidenceIds: string[];
};

export type NatalPermanentFreeReport = NatalInterpretationReport & {
  schemaVersion: 'natal-permanent-free-v3';
  contractVersion: typeof NATAL_PERMANENT_CONTRACT_VERSION;
  tier: 'free';
  evidenceIds: string[];
  hook: NatalReadingStatement;
};

export type NatalPermanentPremiumSection = {
  id: string;
  title: string;
  paragraphs: NatalReadingStatement[];
};

export type NatalPermanentPremiumReport = {
  schemaVersion: 'natal-permanent-premium-v2';
  contractVersion: typeof NATAL_PERMANENT_CONTRACT_VERSION;
  tier: 'premium';
  headline: string;
  headlineEvidenceIds: string[];
  lead: NatalReadingStatement;
  sections: NatalPermanentPremiumSection[];
  strategies: Array<NatalReadingStatement & { title: string }>;
  pitfalls: NatalReadingStatement[];
  conclusion: NatalReadingStatement;
  evidenceIds: string[];
};

export type NatalEvidenceFact = {
  id: string;
  kind: 'quality' | 'placement' | 'angle' | 'house' | 'aspect';
  object: string;
  data: Record<string, unknown>;
};

export type NatalModelContext = {
  subject: {
    name: string;
    birthData: {
      date: string;
      time: string | null;
      place: string;
      latitude: number | null;
      longitude: number | null;
      timezone: string | null;
    };
  };
  birthTimeQuality: NatalBirthTimeQuality;
  reliability: {
    anglesIncluded: boolean;
    housesIncluded: boolean;
    reliableAngles: NatalAngleKey[];
    reliableHouses: number[];
    rule: string;
  };
  calculationVersion: string;
  chartQuality: Record<string, unknown>;
  chart: {
    schemaVersion: string;
    positions: Record<string, Record<string, unknown>>;
    angles?: Record<string, Record<string, unknown>>;
    houses?: Array<Record<string, unknown>>;
    aspects: Array<Record<string, unknown>>;
    calculationMetadata?: Record<string, unknown>;
  };
  evidence: NatalEvidenceFact[];
};

export type BuiltNatalModelContext = {
  context: NatalModelContext;
  evidenceIds: Set<string>;
  birthTimeQuality: NatalBirthTimeQuality;
  anglesIncluded: boolean;
  housesIncluded: boolean;
  ascendantIncluded: boolean;
  reliableAngleKeys: Set<NatalAngleKey>;
  reliableHouseNumbers: Set<number>;
};

export type RawNatalStatement = {
  text?: unknown;
  evidence_ids?: unknown;
};

export type RawNatalSection = {
  section_key?: unknown;
  title?: unknown;
  free?: unknown;
  content?: unknown;
  evidence_ids?: unknown;
  /** @deprecated legacy response fields retained only for source compatibility. */
  id?: unknown;
  paragraphs?: RawNatalStatement[];
};

export type RawNatalFreePayload = {
  hook?: RawNatalStatement;
  sections?: RawNatalSection[];
  /** @deprecated legacy response fields retained only for source compatibility. */
  headline?: unknown;
  headline_evidence_ids?: unknown;
  core?: {
    sun?: RawNatalStatement;
    moon?: RawNatalStatement;
    ascendant?: RawNatalStatement | null;
  };
  strengths?: RawNatalStatement[];
  conflict?: RawNatalStatement;
  advice?: RawNatalStatement;
};

export type RawNatalPremiumPayload = {
  sections?: RawNatalSection[];
  /** @deprecated legacy response fields retained only for source compatibility. */
  headline?: unknown;
  headline_evidence_ids?: unknown;
  lead?: RawNatalStatement;
  strategies?: Array<RawNatalStatement & { title?: unknown }>;
  pitfalls?: RawNatalStatement[];
  conclusion?: RawNatalStatement;
};

const BODY_KEYS: readonly NatalBodyKey[] = [
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
  'chiron',
  'northNode',
  'southNode',
] as const;

const ANGLE_ALIASES: Record<string, NatalAngleKey> = {
  ascendant: 'ascendant',
  asc: 'ascendant',
  rising: 'ascendant',
  mc: 'mc',
  midheaven: 'mc',
  descendant: 'descendant',
  desc: 'descendant',
  dsc: 'descendant',
  ic: 'ic',
};

function isV2(chart: NatalChartData | NatalChartDataV2): chart is NatalChartDataV2 {
  return chart.schemaVersion === 'natal-chart-data-v2'
    && !!chart.positions
    && !!chart.chartQuality;
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function qualityOf(chart: NatalChartData | NatalChartDataV2): NatalBirthTimeQuality {
  const value = chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality;
  return value === 'exact' || value === 'approximate' ? value : 'unknown';
}

export function getPermanentNatalReliability(chart: NatalChartData | NatalChartDataV2) {
  const quality = qualityOf(chart);
  const rawAngles = isV2(chart) ? chart.angles : { ascendant: chart.rising, mc: chart.mc };
  const chartQualityV2 = chart.chartQuality as unknown as {
    variableAngles?: unknown[];
    variableHouses?: unknown[];
    stableHousePlacements?: unknown[];
  } | undefined;
  const variableAngles = new Set(
    Array.isArray(chartQualityV2?.variableAngles)
      ? chartQualityV2.variableAngles.map(text).filter(Boolean)
      : [],
  );
  const anglesIncluded = quality !== 'unknown' && Object.entries(rawAngles || {}).some(([key, raw]) => {
    if (!raw || typeof raw !== 'object') return false;
    const value = raw as unknown as Record<string, unknown>;
    if (quality === 'exact') return value.reliability !== 'variable_in_range';
    return value.reliability !== 'variable_in_range'
      && value.stableSign === true
      && !variableAngles.has(key);
  });
  const variableHouses = new Set(
    Array.isArray(chartQualityV2?.variableHouses)
      ? chartQualityV2.variableHouses.map(finite).filter((value): value is number => value != null)
      : [],
  );
  const hasReliableCusp = Array.isArray(chart.houses)
    && chart.houses.some((raw, index) => {
      const value = raw as unknown as Record<string, unknown>;
      const number = finite(value.house) || index + 1;
      if (quality === 'exact') return value.reliability !== 'variable_in_range';
      return value.reliability !== 'variable_in_range'
        && value.stableSign === true
        && !variableHouses.has(number);
    });
  const hasStablePlacement = quality === 'approximate'
    && Array.isArray(chartQualityV2?.stableHousePlacements)
    && chartQualityV2.stableHousePlacements.length > 0;
  const housesIncluded = quality !== 'unknown' && (hasReliableCusp || hasStablePlacement);
  return { quality, anglesIncluded, housesIncluded };
}

function normalizeAngleKey(value: unknown): NatalAngleKey | null {
  return ANGLE_ALIASES[text(value).toLocaleLowerCase('en-US')] || null;
}

function angleKeyFromAspectEndpoint(
  aspect: NatalAspectV2 | Record<string, unknown>,
  side: 'from' | 'to',
): NatalAngleKey | null {
  const value = aspect as Record<string, unknown>;
  return normalizeAngleKey(value[`${side}Key`]) || normalizeAngleKey(value[side]);
}

function positionPayload(
  position: Partial<NatalPositionV2> | null | undefined,
  includeHouse: boolean,
): Record<string, unknown> | null {
  if (!position || !text(position.sign)) return null;
  const exactCoordinates = !position.reliability || position.reliability === 'exact';
  const stableSign = exactCoordinates || position.stable?.sign === true;
  const stableRetrograde = exactCoordinates || position.stable?.retrograde === true;
  return {
    object: text(position.object || position.planet || position.key),
    key: text(position.key),
    kind: text(position.kind || 'planet'),
    longitude: exactCoordinates ? finite(position.longitude) : null,
    sign: stableSign ? text(position.sign) : null,
    degree: exactCoordinates ? finite(position.degree) : null,
    retrograde: stableRetrograde && typeof position.retrograde === 'boolean'
      ? position.retrograde
      : null,
    speedLongitude: finite(position.speedLongitude),
    ...(includeHouse ? { house: finite(position.house) } : {}),
    source: text(position.source),
    reliability: text(position.reliability),
    stable: position.stable && typeof position.stable === 'object'
      ? {
          sign: position.stable.sign === true,
          retrograde: position.stable.retrograde === true,
          ...(includeHouse ? { house: position.stable.house === true } : {}),
        }
      : undefined,
    range: position.range && typeof position.range === 'object'
      ? {
          startLongitude: finite(position.range.startLongitude),
          endLongitude: finite(position.range.endLongitude),
          spanDegrees: finite(position.range.spanDegrees),
          signs: Array.isArray(position.range.signs) ? position.range.signs.map(text).filter(Boolean) : [],
        }
      : undefined,
  };
}

function legacyPositionPayload(
  key: string,
  value: unknown,
  includeHouse: boolean,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const position = value as Record<string, unknown>;
  if (!text(position.sign)) return null;
  return {
    object: key,
    key,
    kind: 'planet',
    longitude: finite(position.longitude),
    sign: text(position.sign),
    degree: finite(position.degree),
    retrograde: typeof position.retrograde === 'boolean' ? position.retrograde : null,
    speedLongitude: finite(position.speedLongitude),
    ...(includeHouse ? { house: finite(position.house) } : {}),
  };
}

function anglePayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const angle = value as Record<string, unknown>;
  if (!text(angle.sign)) return null;
  const exactCoordinates = !text(angle.reliability) || text(angle.reliability) === 'exact';
  return {
    key: text(angle.key || angle.object || angle.planet),
    object: text(angle.object || angle.planet || angle.key),
    longitude: exactCoordinates ? finite(angle.longitude) : null,
    sign: text(angle.sign),
    degree: exactCoordinates ? finite(angle.degree) : null,
    source: text(angle.source),
    reliability: text(angle.reliability),
    stableSign: angle.stableSign === true,
    range: angle.range && typeof angle.range === 'object' ? angle.range : undefined,
  };
}

function slug(value: unknown): string {
  return text(value)
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'fact';
}

function uniqueEvidenceId(base: string, used: Set<string>): string {
  let value = base;
  let suffix = 2;
  while (used.has(value)) {
    value = `${base}.${suffix}`;
    suffix += 1;
  }
  used.add(value);
  return value;
}

function aspectPayload(
  aspect: NatalAspectV2 | Record<string, unknown>,
): Record<string, unknown> {
  const value = aspect as Record<string, unknown>;
  return {
    id: text(value.id),
    type: text(value.type),
    from: text(value.from),
    to: text(value.to),
    fromKey: text(value.fromKey),
    toKey: text(value.toKey),
    exactAngle: finite(value.exactAngle),
    angle: finite(value.angle),
    angularDistance: finite(value.angularDistance),
    orb: finite(value.orb),
    orbRange: value.orbRange && typeof value.orbRange === 'object' ? value.orbRange : undefined,
    phase: text(value.phase),
    reliable: value.reliable !== false,
    sampleCoverage: finite(value.sampleCoverage),
  };
}

function aspectUsesAngle(aspect: NatalAspectV2 | Record<string, unknown>): boolean {
  return angleKeyFromAspectEndpoint(aspect, 'from') != null
    || angleKeyFromAspectEndpoint(aspect, 'to') != null;
}

function modelBirthData(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
) {
  const birth = isV2(chart) ? chart.birth : undefined;
  const quality = qualityOf(chart);
  return {
    date: text(birth?.localDate || profile.birthDate),
    time: quality === 'unknown'
      ? null
      : text(birth?.localTime || profile.birthTime) || null,
    place: text(birth?.place || profile.birthPlace),
    latitude: finite(birth?.latitude ?? chart.latitude),
    longitude: finite(birth?.longitude ?? chart.longitude),
    timezone: text(birth?.timezone || chart.timezone) || null,
  };
}

export function buildNatalModelContext(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
): BuiltNatalModelContext {
  const reliability = getPermanentNatalReliability(chart);
  const rawQuality = chart.chartQuality as unknown as Record<string, unknown> | undefined;
  const stableHousePlacements = new Set(
    Array.isArray(rawQuality?.stableHousePlacements)
      ? rawQuality.stableHousePlacements.map(text).filter(Boolean)
      : [],
  );
  const variableAngles = new Set(
    Array.isArray(rawQuality?.variableAngles)
      ? rawQuality.variableAngles.map(text).filter(Boolean)
      : [],
  );
  const variableHouses = new Set(
    Array.isArray(rawQuality?.variableHouses)
      ? rawQuality.variableHouses.map(finite).filter((value): value is number => value != null)
      : [],
  );
  const variableAspectIds = new Set(
    Array.isArray(rawQuality?.variableAspectIds)
      ? rawQuality.variableAspectIds.map(text).filter(Boolean)
      : [],
  );
  const usedEvidenceIds = new Set<string>();
  const evidence: NatalEvidenceFact[] = [];
  const positions: Record<string, Record<string, unknown>> = {};
  const reliableAngleKeys = new Set<NatalAngleKey>();
  const reliableHouseNumbers = new Set<number>();

  const addEvidence = (
    requestedId: string,
    kind: NatalEvidenceFact['kind'],
    object: string,
    data: Record<string, unknown>,
  ) => {
    const id = uniqueEvidenceId(requestedId, usedEvidenceIds);
    evidence.push({ id, kind, object, data });
    return id;
  };

  addEvidence('natal.quality.birth-time', 'quality', 'birthTimeQuality', {
    birthTimeQuality: reliability.quality,
    anglesIncluded: reliability.anglesIncluded,
    housesIncluded: reliability.housesIncluded,
  });

  if (isV2(chart)) {
    for (const key of BODY_KEYS) {
      const position = chart.positions[key];
      const includeHouse = reliability.housesIncluded
        && (
          reliability.quality === 'exact'
          || position?.stable?.house === true
          || stableHousePlacements.has(key)
        );
      const payload = positionPayload(position, includeHouse);
      if (!payload) continue;
      const reliableHouse = finite(payload.house);
      if (reliableHouse != null) reliableHouseNumbers.add(reliableHouse);
      const evidenceId = addEvidence(`natal.position.${key}`, 'placement', key, payload);
      positions[key] = { ...payload, evidenceId };
    }
  } else {
    for (const key of BODY_KEYS) {
      const payload = legacyPositionPayload(
        key,
        chart[key as keyof NatalChartData],
        reliability.housesIncluded && reliability.quality === 'exact',
      );
      if (!payload) continue;
      const reliableHouse = finite(payload.house);
      if (reliableHouse != null) reliableHouseNumbers.add(reliableHouse);
      const evidenceId = addEvidence(`natal.position.${key}`, 'placement', key, payload);
      positions[key] = { ...payload, evidenceId };
    }
  }

  const angles: Record<string, Record<string, unknown>> = {};
  if (reliability.anglesIncluded) {
    const rawAngles = isV2(chart)
      ? chart.angles
      : { ascendant: chart.rising, mc: chart.mc };
    for (const [key, value] of Object.entries(rawAngles || {})) {
      const payload = anglePayload(value);
      if (!payload) continue;
      const angleKey = normalizeAngleKey(key) || normalizeAngleKey(payload.key) || normalizeAngleKey(payload.object);
      if (!angleKey) continue;
      if (
        reliability.quality === 'approximate'
        && (
          payload.reliability === 'variable_in_range'
          || payload.stableSign !== true
          || variableAngles.has(angleKey)
        )
      ) continue;
      if (payload.reliability === 'variable_in_range') continue;
      const evidenceId = addEvidence(`natal.angle.${slug(angleKey)}`, 'angle', angleKey, payload);
      angles[angleKey] = { ...payload, evidenceId };
      reliableAngleKeys.add(angleKey);
    }
  }

  const houses = reliability.housesIncluded
    ? (chart.houses || []).flatMap((house, index) => {
        const value = house as unknown as Record<string, unknown>;
        const number = finite(value.house) || index + 1;
        const individuallyReliable = reliability.quality === 'exact'
          ? value.reliability !== 'variable_in_range'
          : value.reliability !== 'variable_in_range'
            && value.stableSign === true
            && !variableHouses.has(number);
        if (!individuallyReliable) return [];
        const exactCoordinates = !text(value.reliability) || text(value.reliability) === 'exact';
        const payload = {
          house: number,
          longitude: exactCoordinates ? finite(value.longitude) : null,
          sign: text(value.sign),
          degree: exactCoordinates ? finite(value.degree) : null,
          reliability: text(value.reliability),
          stableSign: value.stableSign === true,
          range: value.range && typeof value.range === 'object' ? value.range : undefined,
        };
        const evidenceId = addEvidence(`natal.house.${number}`, 'house', `house-${number}`, payload);
        reliableHouseNumbers.add(number);
        return [{ ...payload, evidenceId }];
      })
    : [];

  const aspects = (chart.aspects || [])
    .filter((aspect) => {
      const raw = aspect as unknown as Record<string, unknown>;
      if (raw.reliable === false || variableAspectIds.has(text(raw.id))) return false;
      if (!aspectUsesAngle(aspect as any)) return true;
      const fromAngle = angleKeyFromAspectEndpoint(aspect as any, 'from');
      const toAngle = angleKeyFromAspectEndpoint(aspect as any, 'to');
      return (!fromAngle || reliableAngleKeys.has(fromAngle))
        && (!toAngle || reliableAngleKeys.has(toAngle));
    })
    .map((aspect, index) => {
      const payload = aspectPayload(aspect as any);
      const from = slug(payload.fromKey || payload.from);
      const to = slug(payload.toKey || payload.to);
      const type = slug(payload.type);
      const rawId = slug(payload.id);
      const evidenceId = addEvidence(
        `natal.aspect.${rawId === 'fact' ? `${from}-${type}-${to}-${index + 1}` : rawId}`,
        'aspect',
        `${from}-${type}-${to}`,
        payload,
      );
      return { ...payload, evidenceId };
    });

  const calculationMetadata = chart.calculationMetadata && typeof chart.calculationMetadata === 'object'
    ? Object.fromEntries(
        Object.entries(chart.calculationMetadata as unknown as Record<string, unknown>)
          .filter(([key]) => (
            key !== 'calculatedAt'
            && (
              reliability.quality !== 'unknown'
              || !['houseSystem', 'houseFallbackUsed', 'housesComputedFrom'].includes(key)
            )
          )),
      )
    : undefined;
  const chartQuality: Record<string, unknown> = reliability.quality === 'unknown'
    ? {
        birthTimeMode: text(rawQuality?.birthTimeMode),
        birthTimeQuality: 'unknown',
        exactTime: false,
      }
    : {
        birthTimeMode: text(rawQuality?.birthTimeMode),
        birthTimeQuality: reliability.quality,
        exactTime: rawQuality?.exactTime === true,
        anglesAvailable: rawQuality?.anglesAvailable === true,
        housesAvailable: rawQuality?.housesAvailable === true,
        ascendantReliable: rawQuality?.ascendantReliable === true,
        housesReliable: rawQuality?.housesReliable === true,
        houseBasedPersonalization: rawQuality?.houseBasedPersonalization === true,
        stableHousePlacements: Array.isArray(rawQuality?.stableHousePlacements)
          ? rawQuality.stableHousePlacements.map(text).filter(Boolean)
          : [],
      };

  const anglesIncluded = reliableAngleKeys.size > 0;
  const housesIncluded = reliableHouseNumbers.size > 0;
  const qualityEvidence = evidence.find((item) => item.id === 'natal.quality.birth-time');
  if (qualityEvidence) {
    qualityEvidence.data = {
      birthTimeQuality: reliability.quality,
      anglesIncluded,
      housesIncluded,
      reliableAngles: [...reliableAngleKeys],
      reliableHouses: [...reliableHouseNumbers].sort((a, b) => a - b),
    };
  }

  const context: NatalModelContext = {
    subject: {
      name: text(profile.name),
      birthData: modelBirthData(profile, chart),
    },
    birthTimeQuality: reliability.quality,
    reliability: {
      anglesIncluded,
      housesIncluded,
      reliableAngles: [...reliableAngleKeys],
      reliableHouses: [...reliableHouseNumbers].sort((a, b) => a - b),
      rule: anglesIncluded || housesIncluded
        ? `Only explicitly reliable time-dependent structures are included. Birth-time quality: ${reliability.quality}.`
        : 'Angles, MC, houses, cusps, and house rulers are excluded from interpretation.',
    },
    calculationVersion: text(chart.calculationVersion || calculationMetadata?.calculationVersion || 'unknown'),
    chartQuality,
    chart: {
      schemaVersion: text(chart.schemaVersion || 'legacy-natal-chart-data'),
      positions,
      ...(Object.keys(angles).length > 0 ? { angles } : {}),
      ...(houses.length > 0 ? { houses } : {}),
      aspects,
      ...(calculationMetadata ? { calculationMetadata } : {}),
    },
    evidence,
  };

  return {
    context,
    evidenceIds: usedEvidenceIds,
    birthTimeQuality: reliability.quality,
    anglesIncluded,
    housesIncluded,
    ascendantIncluded: reliableAngleKeys.has('ascendant'),
    reliableAngleKeys,
    reliableHouseNumbers,
  };
}

function stableContextForHash(context: NatalModelContext): unknown {
  return {
    birthTimeQuality: context.birthTimeQuality,
    reliability: context.reliability,
    calculationVersion: context.calculationVersion,
    chart: context.chart,
    evidence: context.evidence,
  };
}

export function buildPermanentNatalInputHash(input: {
  profile: UserProfile;
  chartData: NatalChartData | NatalChartDataV2;
  tier: 'free' | 'premium';
  promptVersion: string;
}): string {
  const built = buildNatalModelContext(input.profile, input.chartData);
  return createHash('sha256').update(JSON.stringify({
    chart: stableContextForHash(built.context),
    language: text(input.profile.language || 'ru').toLocaleLowerCase('en-US'),
    birthTimeQuality: built.birthTimeQuality,
    calculationVersion: built.context.calculationVersion,
    tier: input.tier,
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    promptVersion: input.promptVersion,
    voiceVersion: APP_VOICE_VERSION,
  })).digest('hex');
}

export function buildNatalReportScopeKey(
  userId: string,
  chartId?: number,
  language?: NatalReadingLanguage,
): string {
  const owner = String(userId || '').trim();
  const chart = chartId != null ? String(chartId) : 'primary';
  return `${owner}:${chart}:${language || 'default'}`;
}

function normalizedEvidenceIds(value: unknown, allowed: Set<string>): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map(text).filter(Boolean))];
  if (ids.length === 0 || ids.some((id) => !allowed.has(id))) return null;
  return ids;
}

const TIME_DEPENDENT_READING_EN = /\b(?:today|tomorrow|tonight|this week|next week|this month|next month|coming (?:day|week|month)|transits?|timing|future events?)\b/iu;
// JavaScript word boundaries are ASCII-oriented, so Cyrillic rules must not be
// wrapped in \b: otherwise Russian timing phrases silently pass validation.
const TIME_DEPENDENT_READING_RU = /(?:сегодня|завтра|вечером|на этой неделе|на следующей неделе|в этом месяце|в следующем месяце|ближайш(?:ий|ие|ая|ее) (?:день|дни|недел\w*|месяц\w*)|транзит\w*|тайминг\w*|будущ(?:ее|ие) событ\w*)/iu;
const CALENDAR_YEAR = /\b20\d{2}\b/u;
const DATED_FUTURE_READING_EN = /(?:\b(?:in|within)\s+\d+\s+(?:days?|weeks?|months?|years?)\b|\b(?:will|shall|expect|happen|occur|arrive|begin|meet|receive)\b[^.!?\n]{0,60}\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b)/iu;
const DATED_FUTURE_READING_RU = /(?:(?:через|в\s+течение)\s+\d+\s+(?:дн(?:я|ей)?|недел(?:ю|и|ь)?|месяц(?:а|ев)?|лет|год(?:а|ов)?)|(?:случится|произойд[её]т|ожидай|наступит|встретишь|получишь)[^.!?\n]{0,60}(?:январ[ея]|феврал[ея]|март[ае]?|апрел[ея]|ма[ей]|июн[ея]|июл[ея]|август[ае]?|сентябр[ея]|октябр[ея]|ноябр[ея]|декабр[ея]))/iu;
const ANGLE_TEXT_PATTERNS: ReadonlyArray<readonly [NatalAngleKey, RegExp]> = [
  ['ascendant', /(?:\b(?:ascendant|asc|rising sign)\b|асцендент\w*|восходящ\w+\s+знак\w*)/iu],
  ['mc', /(?:\b(?:midheaven|mc)\b|середин\w+\s+неба|\bмс\b)/iu],
  ['descendant', /(?:\b(?:descendant|desc|dsc)\b|десцендент\w*)/iu],
  ['ic', /(?:\b(?:imum coeli|ic)\b|имум\s+цели|надир\w*)/iu],
];
const GENERIC_HOUSE_REFERENCE_EN = /\b(?:house cusp|house ruler|ruler of (?:the )?\d{1,2}(?:st|nd|rd|th)? house|astrological houses?|houses? in (?:the )?(?:birth )?chart|your natal houses?)\b/iu;
const GENERIC_HOUSE_REFERENCE_RU = /(?:куспид\w*\s+дом\w*|управител[ья]\s+(?:\d{1,2}[- ](?:го|й|я|е)\s+)?дом\w*|астрологическ\w+\s+дом\w*|дом\w*\s+натальн\w+\s+карт\w*)/iu;
const NUMBERED_HOUSE_EN = /(?:\b(\d{1,2})(?:st|nd|rd|th)?\s+house\b|\bhouse\s+(\d{1,2})\b)/giu;
const NUMBERED_HOUSE_RU = /\b(\d{1,2})(?:[- ](?:й|я|е|го))?\s+дом\w*/giu;
const WORDED_HOUSE_PATTERNS: ReadonlyArray<readonly [number, RegExp]> = [
  [1, /(?:\bfirst house\b|перв\w*\s+дом\w*)/iu],
  [2, /(?:\bsecond house\b|втор\w*\s+дом\w*)/iu],
  [3, /(?:\bthird house\b|трет\w*\s+дом\w*)/iu],
  [4, /(?:\bfourth house\b|четв[её]рт\w*\s+дом\w*)/iu],
  [5, /(?:\bfifth house\b|пят\w*\s+дом\w*)/iu],
  [6, /(?:\bsixth house\b|шест\w*\s+дом\w*)/iu],
  [7, /(?:\bseventh house\b|седьм\w*\s+дом\w*)/iu],
  [8, /(?:\beighth house\b|восьм\w*\s+дом\w*)/iu],
  [9, /(?:\bninth house\b|девят\w*\s+дом\w*)/iu],
  [10, /(?:\btenth house\b|десят\w*\s+дом\w*)/iu],
  [11, /(?:\beleventh house\b|одиннадцат\w*\s+дом\w*)/iu],
  [12, /(?:\btwelfth house\b|двенадцат\w*\s+дом\w*)/iu],
];

function containsChangingTimeReference(value: string): boolean {
  return TIME_DEPENDENT_READING_EN.test(value)
    || TIME_DEPENDENT_READING_RU.test(value)
    || CALENDAR_YEAR.test(value)
    || DATED_FUTURE_READING_EN.test(value)
    || DATED_FUTURE_READING_RU.test(value);
}

function mentionedHouseNumbers(value: string): number[] {
  const result: number[] = [];
  for (const pattern of [NUMBERED_HOUSE_EN, NUMBERED_HOUSE_RU]) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
      const number = finite(match[1] || match[2]);
      if (number != null && number >= 1 && number <= 12) result.push(number);
    }
  }
  for (const [number, pattern] of WORDED_HOUSE_PATTERNS) {
    if (pattern.test(value)) result.push(number);
  }
  return [...new Set(result)];
}

export function isNatalReliabilityTextAllowed(
  value: string,
  policy: Pick<
    BuiltNatalModelContext,
    'anglesIncluded' | 'housesIncluded' | 'reliableAngleKeys' | 'reliableHouseNumbers'
  >,
): boolean {
  for (const [key, pattern] of ANGLE_TEXT_PATTERNS) {
    if (pattern.test(value) && !policy.reliableAngleKeys.has(key)) return false;
  }
  const houses = mentionedHouseNumbers(value);
  if (houses.some((number) => !policy.reliableHouseNumbers.has(number))) return false;
  if (
    !policy.housesIncluded
    && (GENERIC_HOUSE_REFERENCE_EN.test(value) || GENERIC_HOUSE_REFERENCE_RU.test(value))
  ) return false;
  return true;
}

function parseStatement(
  raw: RawNatalStatement | null | undefined,
  allowed: Set<string>,
  reliability: BuiltNatalModelContext,
): NatalReadingStatement | null {
  const value = text(raw?.text);
  if (!value) return null;
  const evidenceIds = normalizedEvidenceIds(raw?.evidence_ids, allowed);
  return evidenceIds ? { text: value, evidenceIds } : null;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function section(
  key: InterpretationSection['key'],
  title: string,
  statements: NatalReadingStatement[],
): InterpretationSection {
  return {
    key,
    title,
    access: 'free',
    isLocked: false,
    content: statements.map((item) => item.text).join('\n\n'),
    bullets: [],
    evidenceIds: uniqueStrings(statements.flatMap((item) => item.evidenceIds)),
  };
}

const FREE_NATAL_SECTION_KEYS = [
  'personality',
  'thinking',
  'relationships',
  'vulnerabilities',
] as const;

const PREMIUM_NATAL_SECTION_KEYS = [
  'vocation_money',
  'career',
  'health',
  'shadow',
  'life_path',
  'year_advice',
] as const;

const FREE_SECTION_KEY_MAP: Record<
  typeof FREE_NATAL_SECTION_KEYS[number],
  InterpretationSection['key']
> = {
  personality: 'base_portrait',
  thinking: 'thinking',
  relationships: 'relationships_deep',
  vulnerabilities: 'difficulties',
};

type ParsedNatalSection = {
  key: string;
  title: string;
  free: boolean;
  statement: NatalReadingStatement;
};

function parseNatalSections(
  rawSections: RawNatalSection[] | undefined,
  expectedKeys: readonly string[],
  expectedFree: boolean,
  built: BuiltNatalModelContext,
  maxWords: number,
): ParsedNatalSection[] | null {
  if (!Array.isArray(rawSections) || rawSections.length !== expectedKeys.length) return null;
  const parsed: ParsedNatalSection[] = [];
  for (const [index, rawSection] of rawSections.entries()) {
    const key = text(rawSection?.section_key);
    const title = text(rawSection?.title);
    const content = text(rawSection?.content);
    if (
      key !== expectedKeys[index]
      || rawSection?.free !== expectedFree
      || !title
      || !content
      || content.split(/\s+/u).filter(Boolean).length > maxWords
      || containsChangingTimeReference(title)
      || containsChangingTimeReference(content)
      || !isNatalReliabilityTextAllowed(title, built)
      || !isNatalReliabilityTextAllowed(content, built)
    ) return null;
    const statement = parseStatement(
      { text: content, evidence_ids: rawSection.evidence_ids },
      built.evidenceIds,
      built,
    );
    if (!statement) return null;
    parsed.push({ key, title, free: expectedFree, statement });
  }
  return parsed;
}

export function materializePermanentFreeReport(input: {
  raw: RawNatalFreePayload;
  profile: UserProfile;
  built: BuiltNatalModelContext;
}): NatalPermanentFreeReport | null {
  const { raw, profile, built } = input;
  const hook = parseStatement(raw.hook, built.evidenceIds, built);
  if (
    !hook
    || hook.text.split(/\s+/u).filter(Boolean).length > 32
    || containsChangingTimeReference(hook.text)
    || !isNatalReliabilityTextAllowed(hook.text, built)
  ) return null;
  const parsed = parseNatalSections(raw.sections, FREE_NATAL_SECTION_KEYS, true, built, 90);
  if (!parsed) return null;
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const freeSections = parsed.map((item) => section(
    FREE_SECTION_KEY_MAP[item.key as typeof FREE_NATAL_SECTION_KEYS[number]],
    item.title,
    [item.statement],
  ));
  const evidenceIds = uniqueStrings(parsed.flatMap((item) => item.statement.evidenceIds));
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  return {
    schemaVersion: 'natal-permanent-free-v3',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'free',
    evidenceIds: uniqueStrings([...hook.evidenceIds, ...evidenceIds]),
    hook,
    userName: profile.name || (language === 'ru' ? 'Ты' : 'You'),
    birthData: {
      birthDate: profile.birthDate || built.context.subject.birthData.date,
      birthTime: built.birthTimeQuality === 'unknown'
        ? null
        : profile.birthTime || built.context.subject.birthData.time,
      birthPlace: profile.birthPlace || built.context.subject.birthData.place,
    },
    calculatedAt: new Date().toISOString(),
    freeSections,
    paidSections: [],
    premiumSections: [],
    shortCard: {
      title: first.title,
      keywords: [],
      text: first.statement.text,
      advice: last.statement.text,
      evidenceIds: uniqueStrings([
        ...first.statement.evidenceIds,
        ...last.statement.evidenceIds,
      ]),
    },
  };
}

export function isNatalPermanentFreeReport(
  value: NatalInterpretationReport | null | undefined,
): value is NatalPermanentFreeReport {
  return !!value
    && (value as Partial<NatalPermanentFreeReport>).schemaVersion === 'natal-permanent-free-v3'
    && (value as Partial<NatalPermanentFreeReport>).contractVersion === NATAL_PERMANENT_CONTRACT_VERSION;
}

export function materializePermanentPremiumReport(input: {
  raw: RawNatalPremiumPayload;
  built: BuiltNatalModelContext;
}): NatalPermanentPremiumReport | null {
  const parsed = parseNatalSections(
    input.raw.sections,
    PREMIUM_NATAL_SECTION_KEYS,
    false,
    input.built,
    105,
  );
  if (!parsed) return null;
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  const sections: NatalPermanentPremiumSection[] = parsed.map((item) => ({
    id: item.key,
    title: item.title,
    paragraphs: [item.statement],
  }));
  return {
    schemaVersion: 'natal-permanent-premium-v2',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'premium',
    headline: first.title,
    headlineEvidenceIds: first.statement.evidenceIds,
    lead: first.statement,
    sections,
    strategies: [],
    pitfalls: [],
    conclusion: last.statement,
    evidenceIds: uniqueStrings(parsed.flatMap((item) => item.statement.evidenceIds)),
  };
}

export function buildPermanentFreeFallback(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
): NatalPermanentFreeReport {
  const built = buildNatalModelContext(profile, chart);
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const firstEvidence = built.context.evidence.find((item) => item.kind === 'placement')?.id
    || 'natal.quality.birth-time';
  const content = language === 'ru'
    ? 'Расчёт карты сохранён. Постоянный текстовый разбор временно недоступен.'
    : 'The chart calculation is saved. The permanent written reading is temporarily unavailable.';
  return {
    schemaVersion: 'natal-permanent-free-v3',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'free',
    evidenceIds: [firstEvidence],
    hook: { text: content, evidenceIds: [firstEvidence] },
    userName: profile.name || (language === 'ru' ? 'Ты' : 'You'),
    birthData: {
      birthDate: profile.birthDate || built.context.subject.birthData.date,
      birthTime: built.birthTimeQuality === 'unknown'
        ? null
        : profile.birthTime || built.context.subject.birthData.time,
      birthPlace: profile.birthPlace || built.context.subject.birthData.place,
    },
    calculatedAt: new Date().toISOString(),
    freeSections: [],
    paidSections: [],
    premiumSections: [],
    shortCard: {
      title: language === 'ru' ? 'Твоя карта рассчитана' : 'Your chart is calculated',
      keywords: [],
      text: content,
      advice: '',
      evidenceIds: [firstEvidence],
    },
  };
}

export function buildPermanentPremiumFallback(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
): NatalPermanentPremiumReport {
  const built = buildNatalModelContext(profile, chart);
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const evidenceId = built.context.evidence.find((item) => item.kind === 'placement')?.id
    || 'natal.quality.birth-time';
  const unavailable = language === 'ru'
    ? 'Подробный постоянный разбор временно недоступен. Расчёт карты сохранён и не изменён.'
    : 'The detailed permanent reading is temporarily unavailable. The chart calculation is saved and unchanged.';
  return {
    schemaVersion: 'natal-permanent-premium-v2',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'premium',
    headline: language === 'ru' ? 'Разбор скоро вернётся' : 'The reading will return',
    headlineEvidenceIds: [evidenceId],
    lead: { text: unavailable, evidenceIds: [evidenceId] },
    sections: [],
    strategies: [],
    pitfalls: [],
    conclusion: { text: unavailable, evidenceIds: [evidenceId] },
    evidenceIds: [evidenceId],
  };
}
