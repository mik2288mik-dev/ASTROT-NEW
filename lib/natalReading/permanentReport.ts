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
import {
  APP_VOICE_VERSION,
  hasAppVoiceViolation,
  withAppVoiceCacheKey,
  withAppVoiceVersion,
} from '../appVoice';
import {
  selectNatalTopicEvidence,
  type NatalEvidenceTopicKey,
} from './topicSelector';

export const NATAL_PERMANENT_CONTRACT_VERSION = 'natal-permanent-v9';
export const NATAL_PERMANENT_FREE_PROMPT_VERSION = withAppVoiceVersion(
  `${NATAL_PERMANENT_CONTRACT_VERSION}.free.v9.topic-selector-v1`,
);
export const NATAL_PERMANENT_PREMIUM_PROMPT_VERSION = withAppVoiceVersion(
  `${NATAL_PERMANENT_CONTRACT_VERSION}.premium.v9.topic-selector-v1`,
);
export const NATAL_PERMANENT_FREE_CACHE_KEY = withAppVoiceCacheKey(
  'natal.permanent.free.v9',
);
export const NATAL_PERMANENT_PREMIUM_CACHE_KEY = withAppVoiceCacheKey(
  'natal.permanent.premium.v9',
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

export type NatalPersonalityDomain =
  | 'base_portrait'
  | 'first_impression'
  | 'close_relationship'
  | 'thinking'
  | 'communication'
  | 'emotional_world'
  | 'relationships_deep'
  | 'conflict'
  | 'control_freedom_trust'
  | 'work_ambition'
  | 'strengths'
  | 'central_contradictions'
  | 'misunderstood';

export type NatalReaderChapterKey =
  | 'inner_world'
  | 'new_people'
  | 'decisions'
  | 'communication'
  | 'strengths'
  | 'relationships'
  | 'work'
  | 'challenges';

export type NatalReaderChapterPlanItem = {
  key: NatalReaderChapterKey;
  title: string;
  focus: string;
  domainKeys: NatalPersonalityDomain[];
};

export type NatalReaderChapterDefinition = {
  key: NatalReaderChapterKey;
  title: Record<NatalReadingLanguage, string>;
  focus: Record<NatalReadingLanguage, string>;
  domainKeys: readonly NatalPersonalityDomain[];
};

export const NATAL_READER_CHAPTERS: readonly NatalReaderChapterDefinition[] = [
  {
    key: 'inner_world',
    title: { ru: 'Что у тебя внутри', en: 'What is going on inside you' },
    focus: {
      ru: 'Свяжи характер и чувства: что человеку обычно нравится, что его задевает и как это проявляется в обычных реакциях. Не придумывай скрытую внутреннюю жизнь.',
      en: 'Connect character and feelings: what the person tends to enjoy, what can bother them, and how this appears in ordinary reactions. Do not invent a hidden inner life.',
    },
    domainKeys: ['base_portrait', 'emotional_world'],
  },
  {
    key: 'new_people',
    title: { ru: 'Как ты ведёшь себя с новыми людьми', en: 'How you act around new people' },
    focus: {
      ru: 'Опиши первый контакт: как человек знакомится, что замечает и как постепенно становится понятнее другим.',
      en: 'Describe first contact: how the person meets someone new, what they notice, and how they gradually become clearer to others.',
    },
    domainKeys: ['first_impression'],
  },
  {
    key: 'decisions',
    title: { ru: 'Как ты принимаешь решения', en: 'How you make decisions' },
    focus: {
      ru: 'Покажи, как человек выбирает между вариантами, что помогает ему решить и из-за чего выбор может затянуться.',
      en: 'Show how the person chooses between options, what helps them decide, and what can delay a choice.',
    },
    domainKeys: ['thinking'],
  },
  {
    key: 'communication',
    title: { ru: 'Как ты общаешься', en: 'How you communicate' },
    focus: {
      ru: 'Разбери разговоры и переписку: как человек объясняет свою позицию, слушает, задаёт вопросы и поддерживает контакт. Спор упоминай только если его прямо поддерживают выбранные факты.',
      en: 'Cover conversations and messages: how the person explains a position, listens, asks questions, and keeps contact. Mention disagreement only when the selected evidence directly supports it.',
    },
    domainKeys: ['communication'],
  },
  {
    key: 'strengths',
    title: { ru: 'Где у тебя получается лучше всего', en: 'Where you do your best' },
    focus: {
      ru: 'Назови задачи и ситуации, где сильные качества человека дают заметный результат, без похвалы ради похвалы.',
      en: 'Name the tasks and situations where the person\'s strengths produce a visible result, without empty praise.',
    },
    domainKeys: ['strengths'],
  },
  {
    key: 'relationships',
    title: { ru: 'Отношения и семья', en: 'Relationships and family' },
    focus: {
      ru: 'Свяжи симпатию, сближение, нежность, совместное время и договорённости. Покажи, как человек проявляет интерес и что делает близость приятной. Трудности добавляй только при прямом основании. Не выдумывай детство, отношения с родителями или семейные события.',
      en: 'Connect attraction, closeness, affection, shared time, and agreements. Show how the person expresses interest and what makes closeness enjoyable. Add difficulty only when directly supported. Do not invent childhood, parental relationships, or family events.',
    },
    domainKeys: ['close_relationship', 'relationships_deep'],
  },
  {
    key: 'work',
    title: { ru: 'Работа и своё дело', en: 'Work and your own business' },
    focus: {
      ru: 'Опиши, какие задачи захватывают внимание, какой темп удобен, как человек начинает, доводит дела и взаимодействует с другими. Начальство, дедлайны и конфликты не делай обязательными темами. Не делай выводов о конкретной профессии, доходе или успехе бизнеса.',
      en: 'Describe which tasks hold attention, what pace fits, how the person starts and finishes work, and how they work with others. Do not make managers, deadlines, or conflict mandatory topics. Do not infer a specific profession, income, or business success.',
    },
    domainKeys: ['work_ambition'],
  },
  {
    key: 'challenges',
    title: { ru: 'Когда планы меняются', en: 'When plans change' },
    focus: {
      ru: 'Разбери, как человек перестраивается, когда договорённость или план меняются. Давление, непонимание или спор добавляй только если соответствующий выбранный домен действительно присутствует; не объединяй их в обязательный набор.',
      en: 'Describe how the person adjusts when an agreement or plan changes. Add pressure, misunderstanding, or disagreement only when the corresponding selected domain is actually present; never bundle them as a mandatory set.',
    },
    domainKeys: ['conflict', 'central_contradictions', 'misunderstood'],
  },
];

const REQUIRED_PREMIUM_READER_CHAPTERS = [
  'relationships',
  'work',
] as const satisfies readonly NatalReaderChapterKey[];

export function buildNatalReaderChapterPlan(
  reportPlan: readonly NatalReportPlanItem[],
  access: 'free' | 'premium',
  language: NatalReadingLanguage,
): NatalReaderChapterPlanItem[] {
  const requested = new Set(
    reportPlan.filter((item) => item.access === access).map((item) => item.key),
  );
  return NATAL_READER_CHAPTERS.flatMap((chapter) => {
    const domainKeys = chapter.domainKeys.filter((key) => requested.has(key));
    return domainKeys.length > 0
      ? [{
          key: chapter.key,
          title: chapter.title[language],
          focus: chapter.focus[language],
          domainKeys,
        }]
      : [];
  });
}

export type NatalReportPlanItem = {
  key: NatalPersonalityDomain;
  access: 'free' | 'premium';
  evidenceIds: string[];
  /** Facts that must all be cited together for a claim to be grounded. */
  requiredEvidenceIds: string[];
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
  reportPlan: NatalReportPlanItem[];
};

export type BuiltNatalModelContext = {
  context: NatalModelContext;
  language: NatalReadingLanguage;
  evidenceIds: Set<string>;
  birthTimeQuality: NatalBirthTimeQuality;
  anglesIncluded: boolean;
  housesIncluded: boolean;
  ascendantIncluded: boolean;
  reliableAngleKeys: Set<NatalAngleKey>;
  reliableHouseNumbers: Set<number>;
  reportPlanByKey: ReadonlyMap<NatalPersonalityDomain, NatalReportPlanItem>;
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
  const value = isV2(chart)
    ? chart.chartQuality.birthTimeQuality
    : chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality;
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

const HARD_ASPECT_TYPES = new Set(['square', 'opposition']);
const HARMONIOUS_ASPECT_TYPES = new Set(['trine', 'sextile']);

function buildReportPlan(input: {
  evidence: NatalEvidenceFact[];
  ascendantIncluded: boolean;
}): NatalReportPlanItem[] {
  const byId = new Map(input.evidence.map((fact) => [fact.id, fact]));
  const placement = (key: NatalBodyKey) => {
    const id = `natal.position.${key}`;
    const fact = byId.get(id);
    return fact?.kind === 'placement' && text(fact.data.sign) ? id : null;
  };
  const endpointEvidence = (key: string) => {
    const positionId = `natal.position.${key}`;
    const positionFact = byId.get(positionId);
    if (positionFact?.kind === 'placement' && text(positionFact.data.sign)) return positionId;
    const angleId = `natal.angle.${key}`;
    const angleFact = byId.get(angleId);
    return angleFact?.kind === 'angle' && text(angleFact.data.sign) ? angleId : null;
  };
  const ids = (...values: Array<string | null | undefined>) => (
    [...new Set(values.filter((value): value is string => !!value && byId.has(value)))]
  );
  const plan: NatalReportPlanItem[] = [];
  const add = (
    key: NatalPersonalityDomain,
    access: 'free' | 'premium',
    evidenceIds: string[],
    requiredEvidenceIds: string[] = [],
    minimumEvidence = 1,
  ) => {
    const supported = ids(...evidenceIds);
    const required = ids(...requiredEvidenceIds);
    if (supported.length < minimumEvidence || required.some((id) => !supported.includes(id))) return;
    plan.push({ key, access, evidenceIds: supported, requiredEvidenceIds: required });
  };
  const topicFacts = (topic: NatalEvidenceTopicKey, limit = 5) => (
    selectNatalTopicEvidence(input.evidence, topic, { limit, min: 1 })
  );
  const topicIds = (topic: NatalEvidenceTopicKey, limit = 5) => (
    topicFacts(topic, limit).map((fact) => fact.id)
  );
  const topAspectBundle = (topic: NatalEvidenceTopicKey) => {
    const aspect = topicFacts(topic, 5).find((fact) => fact.kind === 'aspect');
    if (!aspect) return [];
    const from = text(aspect.data.fromKey || aspect.data.from).toLocaleLowerCase('en-US');
    const to = text(aspect.data.toKey || aspect.data.to).toLocaleLowerCase('en-US');
    return ids(aspect.id, endpointEvidence(from), endpointEvidence(to));
  };

  const basePortraitCore = ids(placement('sun'), placement('moon'));
  add('base_portrait', 'free', ids(
    ...basePortraitCore, ...topicIds('main', 4),
  ), basePortraitCore, 2);

  if (input.ascendantIncluded) {
    add('first_impression', 'free', ids(
      'natal.angle.ascendant', ...topicIds('first_impression', 4),
    ), ['natal.angle.ascendant'], 1);
  }

  const thinkingCore = ids(placement('mercury'), placement('sun'));
  add('thinking', 'free', ids(
    ...thinkingCore, ...topicIds('decisions', 4),
  ), thinkingCore, 2);

  const communicationCore = ids(placement('mercury'));
  add('communication', 'free', ids(
    ...communicationCore, ...topicIds('communication', 5),
  ), communicationCore, 1);

  const emotionalCore = ids(placement('moon'), placement('venus'));
  add('emotional_world', 'free', ids(
    ...emotionalCore, ...topicIds('inner', 4),
  ), emotionalCore, 2);

  const strengthEvidence = topicIds('strengths', 5);
  add(
    'strengths',
    'free',
    strengthEvidence,
    strengthEvidence.slice(0, Math.min(2, strengthEvidence.length)),
    2,
  );

  const closeEvidence = ids(
    ...emotionalCore,
    ...topicIds('closeness', 5),
  );
  add('close_relationship', 'premium', closeEvidence, emotionalCore, 2);

  const relationshipCore = ids(placement('venus'), placement('mars'));
  const relationshipEvidence = ids(
    ...relationshipCore,
    placement('moon'),
    ...topicIds('love', 6),
  );
  add('relationships_deep', 'premium', relationshipEvidence, relationshipCore, 2);

  const conflictBundle = topAspectBundle('conflict');
  if (conflictBundle.length >= 3) {
    add('conflict', 'premium', conflictBundle, conflictBundle, 3);
  }

  const autonomyBundle = topAspectBundle('autonomy');
  if (autonomyBundle.length >= 3) {
    add('control_freedom_trust', 'premium', autonomyBundle, autonomyBundle, 3);
  }

  const workCore = ids(placement('mars'), placement('saturn'), placement('jupiter'));
  const workEvidence = ids(
    ...workCore,
    ...topicIds('work', 6),
    'natal.angle.mc',
  );
  add(
    'work_ambition',
    'premium',
    workEvidence,
    workCore.length >= 2 ? workCore.slice(0, 2) : workEvidence.slice(0, 2),
    2,
  );

  const personalBodies = new Set(['sun', 'moon', 'mercury', 'venus', 'mars']);
  const hardAspect = input.evidence
    .filter((fact) => {
      if (fact.kind !== 'aspect') return false;
      const type = text(fact.data.type).toLocaleLowerCase('en-US');
      if (!HARD_ASPECT_TYPES.has(type)) return false;
      const from = text(fact.data.fromKey || fact.data.from).toLocaleLowerCase('en-US');
      const to = text(fact.data.toKey || fact.data.to).toLocaleLowerCase('en-US');
      return personalBodies.has(from) || personalBodies.has(to);
    })
    .sort((left, right) => {
      const leftOrb = finite(left.data.orb) ?? 99;
      const rightOrb = finite(right.data.orb) ?? 99;
      return leftOrb - rightOrb || left.id.localeCompare(right.id);
    })[0];
  if (hardAspect) {
    const from = text(hardAspect.data.fromKey || hardAspect.data.from).toLocaleLowerCase('en-US');
    const to = text(hardAspect.data.toKey || hardAspect.data.to).toLocaleLowerCase('en-US');
    const contradictionBundle = ids(
      hardAspect.id,
      endpointEvidence(from),
      endpointEvidence(to),
    );
    if (contradictionBundle.length >= 3) {
      add(
        'central_contradictions',
        'premium',
        contradictionBundle,
        contradictionBundle,
        3,
      );
    }
  }

  const misunderstoodBundle = topAspectBundle('misunderstood');
  if (misunderstoodBundle.length >= 3) {
    add('misunderstood', 'premium', misunderstoodBundle, misunderstoodBundle, 3);
  }

  return plan;
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
  const ascendantIncluded = reliableAngleKeys.has('ascendant');
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

  const reportPlan = buildReportPlan({ evidence, ascendantIncluded });
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
    reportPlan,
  };

  return {
    context,
    language: profile.language === 'en' ? 'en' : 'ru',
    evidenceIds: usedEvidenceIds,
    birthTimeQuality: reliability.quality,
    anglesIncluded,
    housesIncluded,
    ascendantIncluded,
    reliableAngleKeys,
    reliableHouseNumbers,
    reportPlanByKey: new Map(reportPlan.map((item) => [item.key, item])),
  };
}

/**
 * Model-visible context intentionally omits raw birth input and coordinates.
 * Luna receives only deterministic calculation output, reliability, evidence,
 * and the evidence-driven report plan; it never gets inputs it could recalculate.
 */
export function buildNatalPromptContext(built: BuiltNatalModelContext) {
  const modelChart = {
    schemaVersion: built.context.chart.schemaVersion,
    positions: built.context.chart.positions,
    ...(built.context.chart.angles ? { angles: built.context.chart.angles } : {}),
    ...(built.context.chart.houses ? { houses: built.context.chart.houses } : {}),
    aspects: built.context.chart.aspects,
  };
  return {
    birthTimeQuality: built.context.birthTimeQuality,
    reliability: built.context.reliability,
    calculationVersion: built.context.calculationVersion,
    chartQuality: built.context.chartQuality,
    chart: modelChart,
    evidence: built.context.evidence,
    reportPlan: built.context.reportPlan,
  };
}

/** Facts safe enough to ground user-facing prose for this reliability policy. */
export function getNatalNarrativeEvidenceIds(built: BuiltNatalModelContext): Set<string> {
  return new Set(
    built.context.evidence
      .filter((fact) => {
        if (fact.kind === 'quality') return false;
        if (fact.kind === 'placement' || fact.kind === 'angle') {
          return Boolean(text(fact.data.sign));
        }
        if (fact.kind === 'house') {
          return finite(fact.data.house) != null && Boolean(text(fact.data.sign));
        }
        if (fact.kind === 'aspect') {
          const from = text(fact.data.fromKey || fact.data.from).toLocaleLowerCase('en-US');
          const to = text(fact.data.toKey || fact.data.to).toLocaleLowerCase('en-US');
          const hasEndpoint = (key: string) => {
            const placement = built.context.evidence.find((candidate) => (
              candidate.id === `natal.position.${key}`
              && candidate.kind === 'placement'
              && Boolean(text(candidate.data.sign))
            ));
            if (placement) return true;
            return built.context.evidence.some((candidate) => (
              candidate.id === `natal.angle.${key}`
              && candidate.kind === 'angle'
              && Boolean(text(candidate.data.sign))
            ));
          };
          return fact.data.reliable !== false && hasEndpoint(from) && hasEndpoint(to);
        }
        return false;
      })
      .map((fact) => fact.id),
  );
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

export function buildPermanentNatalReaderAnchor(report: NatalPermanentFreeReport) {
  return {
    contractVersion: report.contractVersion,
    hook: {
      text: report.hook.text,
      evidenceIds: report.hook.evidenceIds,
    },
    chapters: report.freeSections.map((section) => ({
      key: section.key,
      title: section.title,
      content: section.content,
      evidenceIds: section.evidenceIds || [],
    })),
  };
}

export function buildPermanentNatalInputHash(input: {
  profile: UserProfile;
  chartData: NatalChartData | NatalChartDataV2;
  tier: 'free' | 'premium';
  promptVersion: string;
  readerAnchor?: NatalPermanentFreeReport | null;
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
    ...(input.readerAnchor
      ? { readerAnchor: buildPermanentNatalReaderAnchor(input.readerAnchor) }
      : {}),
  })).digest('hex');
}

/**
 * Full client cache identity for a permanent natal report. It mirrors the
 * server input hash instead of the forecast fingerprint, which intentionally
 * truncates aspects and is therefore not strong enough for this surface.
 */
export function buildPermanentNatalChartFingerprint(
  profile: UserProfile,
  chartData: NatalChartData | NatalChartDataV2,
): string {
  const built = buildNatalModelContext(profile, chartData);
  const value = JSON.stringify({
    chart: stableContextForHash(built.context),
    reportPlan: built.context.reportPlan,
  });
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildNatalReportScopeKey(
  userId: string,
  chartId?: number,
  language?: NatalReadingLanguage,
  cacheIdentity?: {
    chartFingerprint: string;
    reportVersion: string;
  },
): string {
  const owner = String(userId || '').trim();
  const chart = chartId != null ? String(chartId) : 'primary';
  const fingerprint = text(cacheIdentity?.chartFingerprint || 'chart-unresolved');
  const reportVersion = text(cacheIdentity?.reportVersion || NATAL_PERMANENT_CONTRACT_VERSION);
  return `${owner}:${chart}:${language || 'default'}:${fingerprint}:${reportVersion}`;
}

function normalizedEvidenceIds(value: unknown, allowed: Set<string>): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map(text).filter(Boolean))];
  if (ids.length === 0 || ids.some((id) => !allowed.has(id))) return null;
  return ids;
}

const VISIBLE_ASTRO_PLACEMENT = /(?:(?:солнц\w*|лун\w*|меркур\w*|венер\w*|марс\w*|юпитер\w*|сатурн\w*|уран\w*|нептун\w*|плутон\w*|хирон\w*|узел\w*)\s+(?:в|во)\s+(?:овн\w*|тельц\w*|близнец\w*|рак\w*|льв\w*|дев\w*|вес\w*|скорпион\w*|стрельц\w*|козерог\w*|водоле\w*|рыб\w*)|\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|node)\s+in\s+(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b)/iu;
const VISIBLE_ASTRO_ASPECT = /(?:(?:соединени\w*|секстил\w*|квадрат\w*|трин\w*|оппозиц\w*)[^.!?\n]{0,80}(?:солнц\w*|лун\w*|меркур\w*|венер\w*|марс\w*|юпитер\w*|сатурн\w*|уран\w*|нептун\w*|плутон\w*|хирон\w*|узл\w*)|\b(?:conjunction|sextile|square|trine|opposition)\b[^.!?\n]{0,80}\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|node)\b)/iu;
const VISIBLE_ASTRO_TECHNICAL = /(?:(?:^|[^\p{L}])(?:асцендент|ретроград[а-яё]*|куспид[а-яё]*|орб[а-яё]*|(?:мс|mc)(?![\p{L}]))|(?:^|[^\p{L}])(?:солнц[а-яё]*|лун[а-яё]*|меркур[а-яё]*|венер[а-яё]*|марс[а-яё]*|юпитер[а-яё]*|сатурн[а-яё]*|уран[а-яё]*|нептун[а-яё]*|плутон[а-яё]*|хирон[а-яё]*|узел[а-яё]*)\s+(?:в|во)\s+\d{1,2}(?:-м|м|ом)?\s+дом[а-яё]*|\b(?:ascendant|midheaven|retrograde|cusp\w*|orb\w*)\b|\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|node)\s+in\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+house\b)/iu;
const VISIBLE_ASTRO_OBJECT = /(?:(?:^|[^\p{L}])(?:солнц[а-яё]*|лун[а-яё]*|меркур[а-яё]*|венер[а-яё]*|марс[а-яё]*|юпитер[а-яё]*|сатурн[а-яё]*|уран[а-яё]*|нептун[а-яё]*|плутон[а-яё]*|хирон[а-яё]*|(?:северн[а-яё]*|южн[а-яё]*)\s+узел[а-яё]*)(?=$|[^\p{L}])|\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|north node|south node)\b)/iu;
const VISIBLE_ZODIAC_SIGN = /(?:(?:^|[^\p{L}])(?:овен|овна|овну|овном|овне|телец|тельца|тельцу|тельцом|тельце|близнецы|близнецов|близнецам|близнецами|близнецах|рак|рака|раку|раком|раке|лев|льва|льву|львом|льве|дева|девы|деве|деву|девой|девою|весы|весов|весам|весами|весах|скорпион|скорпиона|скорпиону|скорпионом|скорпионе|стрелец|стрельца|стрельцу|стрельцом|стрельце|козерог|козерога|козерогу|козерогом|козероге|водолей|водолея|водолею|водолеем|водолее|рыбы|рыб|рыбам|рыбами|рыбах)(?=$|[^\p{L}])|\b(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b)/iu;
const VISIBLE_WORDED_HOUSE = /(?:(?:перв|втор|трет|четв[её]рт|пят|шест|седьм|восьм|девят|десят|одиннадцат|двенадцат)[а-яё]*\s+дом[а-яё]*|\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+house\b)/iu;
const NATAL_FORBIDDEN_COPY = /(?:зв[её]зд[а-яё]*\s+говор[а-яё]*|вселенн[а-яё]*\s+приглаша[а-яё]*|уникальн[а-яё]*\s+энерги[а-яё]*|важно\s+прислуша[а-яё]*\s+к\s+себе|облада[а-яё]*\s+глубок[а-яё]*\s+внутренн[а-яё]*\s+мир[а-яё]*|чувству[а-яё]*\s+глубже[^.!?\n]{0,35}(?:чем|но)\s+показыва[а-яё]*|тебя\s+не\s+всегда\s+понима[а-яё]*|сильн[а-яё]*[^.!?\n]{0,20}(?:но|и)\s+раним[а-яё]*|в\s+тебе\s+сочета[а-яё]*|цениш[а-яё]*\s+свобод[а-яё]*\s+и\s+честност[а-яё]*|тво[йя]\s+главн[а-яё]*\s+урок[а-яё]*|(?:^|[^\p{L}])(?:энерги[а-яё]*|предназначени[а-яё]*|карм(?:а|ы|е|у|ой|ою|ею|ам|ами|ах|ическ[а-яё]*|ичн[а-яё]*)|вибрац[а-яё]*|вселенн[а-яё]*|мисси[а-яё]*|ресурс[а-яё]*|опор[а-яё]*|проработк[а-яё]*|паттерн[а-яё]*|триггер[а-яё]*|потенциал[а-яё]*|самореализац[а-яё]*|внутренн[а-яё]*\s+мир[а-яё]*|считыва[а-яё]*)(?=$|[^\p{L}])|\b(?:the stars say|the universe invites|your unique energy|listen to yourself|deep inner world|life purpose|karmic|vibration|inner resource|support point|pattern|trigger|potential|self-realization)\b)/iu;
const NATAL_COACHING_COPY = /(?:тебе\s+(?:важно|нужно|стоит)\s+(?:научиться|помнить|попробовать|делать|понять)|(?:позволь|разреши)\s+себе|раскро[йи]\s+(?:себя|свой|свою)|ты\s+создан[а-яё]*\s+для|(?:^|[^\p{L}])(?:попробуй|старайся|практикуй|рекомендую)(?=$|[^\p{L}])|\b(?:you (?:need|have|ought) to learn|allow yourself|unlock your|you were made to|try to|practice|we recommend)\b)/iu;
const NATAL_DIAGNOSIS_OR_GUARANTEE = /(?:диагноз\w*|диагностир\w*|расстройств\w*|травм\w*|гарантир\w*|обязательно\s+(?:случ\w*|произойд\w*|стан\w*|добь\w*)|\b(?:diagnos\w*|disorder\w*|trauma\w*|guaranteed?|definitely will)\b)/iu;
export function hasNatalPersonalityCopyViolation(value: string): boolean {
  return hasAppVoiceViolation(value)
    || NATAL_FORBIDDEN_COPY.test(value)
    || NATAL_COACHING_COPY.test(value)
    || NATAL_DIAGNOSIS_OR_GUARANTEE.test(value)
    || VISIBLE_ASTRO_PLACEMENT.test(value)
    || VISIBLE_ASTRO_ASPECT.test(value)
    || VISIBLE_ASTRO_TECHNICAL.test(value)
    || VISIBLE_ASTRO_OBJECT.test(value)
    || VISIBLE_ZODIAC_SIGN.test(value)
    || VISIBLE_WORDED_HOUSE.test(value);
}

function hasReadableNarrativeShape(value: string): boolean {
  const normalized = text(value);
  if (normalized.length < 80 || normalized.length > 1400) return false;
  return normalized.split(/\n\s*\n/u).filter(Boolean).length <= 2;
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
): NatalReadingStatement | null {
  const value = text(raw?.text);
  if (!value || hasNatalPersonalityCopyViolation(value)) return null;
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

// Legacy consumers require a closed InterpretationSection key union. These are
// compatibility slots only; reader-facing chapter keys and titles are assigned
// by the server and are never owned by model output.
const FREE_SECTION_SLOT_KEYS: readonly InterpretationSection['key'][] = [
  'base_portrait',
  'thinking',
  'relationships_deep',
  'difficulties',
  'abilities',
  'central_contradictions',
  'emotional_world',
  'self_relationship',
  'communication',
  'summary',
  'strengths',
  'potential_purpose',
];

type ParsedNatalSection = {
  key: string;
  free: boolean;
  statement: NatalReadingStatement;
};

function parseNatalSections(
  rawSections: RawNatalSection[] | undefined,
  built: BuiltNatalModelContext,
  options: {
    expectedFree: boolean;
  },
): ParsedNatalSection[] | null {
  if (
    !Array.isArray(rawSections)
    || rawSections.length < 1
    || rawSections.length > FREE_SECTION_SLOT_KEYS.length
  ) return null;
  const parsed: ParsedNatalSection[] = [];
  const seenKeys = new Set<string>();
  for (const rawSection of rawSections) {
    const key = text(rawSection?.section_key);
    const legacyTitle = text(rawSection?.title);
    const content = text(rawSection?.content);
    const planned = built.reportPlanByKey.get(key as NatalPersonalityDomain);
    if (
      !key
      || seenKeys.has(key)
      || rawSection?.free !== options.expectedFree
      || !planned
      || planned.access !== (options.expectedFree ? 'free' : 'premium')
      || !content
      || (legacyTitle.length > 0 && (legacyTitle.length < 3 || legacyTitle.length > 90))
      || !hasReadableNarrativeShape(content)
      || (legacyTitle.length > 0 && hasNatalPersonalityCopyViolation(legacyTitle))
      || hasNatalPersonalityCopyViolation(content)
      || (legacyTitle.length > 0 && containsChangingTimeReference(legacyTitle))
      || containsChangingTimeReference(content)
      || (legacyTitle.length > 0 && !isNatalReliabilityTextAllowed(legacyTitle, built))
      || !isNatalReliabilityTextAllowed(content, built)
    ) return null;
    const statement = parseStatement(
      { text: content, evidence_ids: rawSection.evidence_ids },
      built.evidenceIds,
    );
    if (!statement) return null;
    if (statement.evidenceIds.some((id) => !planned.evidenceIds.includes(id))) return null;
    if (planned.requiredEvidenceIds.some((id) => !statement.evidenceIds.includes(id))) return null;
    seenKeys.add(key);
    parsed.push({ key, free: options.expectedFree, statement });
  }
  return parsed;
}

function completeSectionsInPlanOrder(
  parsed: ParsedNatalSection[],
  requestedKeys: NatalPersonalityDomain[],
  requireComplete: boolean | undefined,
): ParsedNatalSection[] | null {
  if (!requireComplete) return parsed;
  if (
    parsed.length !== requestedKeys.length
    || requestedKeys.some((key) => !parsed.some((item) => item.key === key))
  ) return null;
  return requestedKeys.map((key) => parsed.find((item) => item.key === key)!);
}

type GroupedNatalChapter = {
  key: NatalReaderChapterKey;
  title: string;
  statements: NatalReadingStatement[];
};

function groupSectionsByReaderChapter(
  parsed: ParsedNatalSection[],
  built: BuiltNatalModelContext,
  access: 'free' | 'premium',
): GroupedNatalChapter[] {
  const parsedByDomain = new Map(
    parsed.map((item) => [item.key as NatalPersonalityDomain, item]),
  );
  return buildNatalReaderChapterPlan(
    built.context.reportPlan,
    access,
    built.language,
  ).flatMap((chapter) => {
    const statements = chapter.domainKeys
      .map((key) => parsedByDomain.get(key)?.statement)
      .filter((statement): statement is NatalReadingStatement => statement != null);
    return statements.length > 0
      ? [{ key: chapter.key, title: chapter.title, statements }]
      : [];
  });
}

const FREE_CHAPTER_SECTION_KEYS: Partial<Record<NatalReaderChapterKey, InterpretationSection['key']>> = {
  inner_world: 'base_portrait',
  new_people: 'how_others_see_you',
  decisions: 'thinking',
  communication: 'communication',
  strengths: 'strengths',
};

export function materializePermanentFreeReport(input: {
  raw: RawNatalFreePayload;
  profile: UserProfile;
  built: BuiltNatalModelContext;
  requireComplete?: boolean;
}): NatalPermanentFreeReport | null {
  const { raw, profile, built } = input;
  const hook = parseStatement(raw.hook, built.evidenceIds);
  const freeEvidenceIds = new Set(
    built.context.reportPlan
      .filter((item) => item.access === 'free')
      .flatMap((item) => item.evidenceIds),
  );
  if (
    !hook
    || hook.text.length < 40
    || hook.text.length > 500
    || hook.text.split(/\n\s*\n/u).filter(Boolean).length > 1
    || hook.evidenceIds.some((id) => !freeEvidenceIds.has(id))
    || containsChangingTimeReference(hook.text)
    || !isNatalReliabilityTextAllowed(hook.text, built)
  ) return null;
  const parsed = parseNatalSections(raw.sections, built, {
    expectedFree: true,
  });
  if (!parsed) return null;
  const requestedKeys = built.context.reportPlan
    .filter((item) => item.access === 'free')
    .map((item) => item.key);
  const ordered = completeSectionsInPlanOrder(parsed, requestedKeys, input.requireComplete);
  if (!ordered?.length) return null;
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const chapters = groupSectionsByReaderChapter(ordered, built, 'free');
  if (!chapters.length) return null;
  const freeSections = chapters.map((chapter, index) => section(
    FREE_CHAPTER_SECTION_KEYS[chapter.key]
      || FREE_SECTION_SLOT_KEYS[index]
      || 'summary',
    chapter.title,
    chapter.statements,
  ));
  const evidenceIds = uniqueStrings(ordered.flatMap((item) => item.statement.evidenceIds));
  const first = freeSections[0];
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
      text: first.content,
      advice: '',
      evidenceIds: first.evidenceIds || [],
    },
  };
}

export function isNatalPermanentFreeReport(
  value: NatalInterpretationReport | null | undefined,
): value is NatalPermanentFreeReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<NatalPermanentFreeReport>;
  return report.schemaVersion === 'natal-permanent-free-v3'
    && report.contractVersion === NATAL_PERMANENT_CONTRACT_VERSION
    && report.tier === 'free'
    && Array.isArray(report.evidenceIds)
    && report.evidenceIds.every((id) => typeof id === 'string' && id.length > 0)
    && !!report.hook
    && typeof report.hook.text === 'string'
    && report.hook.text.length >= 40
    && Array.isArray(report.hook.evidenceIds)
    && report.hook.evidenceIds.length > 0
    && Array.isArray(report.freeSections)
    && report.freeSections.length > 0
    && report.freeSections.every((item) => (
      !!item
      && typeof item.title === 'string'
      && typeof item.content === 'string'
      && item.content.length > 0
      && Array.isArray(item.evidenceIds)
      && item.evidenceIds.length > 0
    ));
}

export function isNatalPermanentPremiumReport(
  value: NatalPermanentPremiumReport | null | undefined,
): value is NatalPermanentPremiumReport {
  if (!value || typeof value !== 'object') return false;
  const isStatement = (statement: NatalReadingStatement | null | undefined): boolean => (
    !!statement
    && typeof statement.text === 'string'
    && statement.text.length > 0
    && Array.isArray(statement.evidenceIds)
    && statement.evidenceIds.length > 0
    && statement.evidenceIds.every((id) => typeof id === 'string' && id.length > 0)
  );
  const sectionIds = Array.isArray(value.sections)
    ? value.sections.map((section) => section?.id)
    : [];
  const knownChapterIds = new Set(NATAL_READER_CHAPTERS.map((chapter) => chapter.key));
  return value.schemaVersion === 'natal-permanent-premium-v2'
    && value.contractVersion === NATAL_PERMANENT_CONTRACT_VERSION
    && value.tier === 'premium'
    && typeof value.headline === 'string'
    && value.headline.length > 0
    && Array.isArray(value.headlineEvidenceIds)
    && value.headlineEvidenceIds.length > 0
    && value.headlineEvidenceIds.every((id) => typeof id === 'string' && id.length > 0)
    && isStatement(value.lead)
    && isStatement(value.conclusion)
    && Array.isArray(value.evidenceIds)
    && value.evidenceIds.length > 0
    && value.evidenceIds.every((id) => typeof id === 'string' && id.length > 0)
    && Array.isArray(value.sections)
    && value.sections.length > 0
    && new Set(sectionIds).size === sectionIds.length
    && sectionIds.every((id) => typeof id === 'string' && knownChapterIds.has(id as NatalReaderChapterKey))
    && REQUIRED_PREMIUM_READER_CHAPTERS.every((id) => sectionIds.includes(id))
    && value.sections.every((section) => (
      !!section
      && typeof section.id === 'string'
      && section.id.length > 0
      && typeof section.title === 'string'
      && section.title.length > 0
      && Array.isArray(section.paragraphs)
      && section.paragraphs.length > 0
      && section.paragraphs.every(isStatement)
    ));
}

export function materializePermanentPremiumReport(input: {
  raw: RawNatalPremiumPayload;
  built: BuiltNatalModelContext;
  requireComplete?: boolean;
}): NatalPermanentPremiumReport | null {
  const parsed = parseNatalSections(
    input.raw.sections,
    input.built,
    {
      expectedFree: false,
    },
  );
  if (!parsed) return null;
  const requestedKeys = input.built.context.reportPlan
    .filter((item) => item.access === 'premium')
    .map((item) => item.key);
  const ordered = completeSectionsInPlanOrder(parsed, requestedKeys, input.requireComplete);
  if (!ordered?.length) return null;
  const chapters = groupSectionsByReaderChapter(ordered, input.built, 'premium');
  if (!chapters.length) return null;
  const sections: NatalPermanentPremiumSection[] = chapters.map((chapter) => ({
    id: chapter.key,
    title: chapter.title,
    paragraphs: chapter.statements,
  }));
  const first = sections[0];
  const firstStatement = first.paragraphs[0];
  const last = sections[sections.length - 1];
  const lastStatement = last.paragraphs[last.paragraphs.length - 1];
  return {
    schemaVersion: 'natal-permanent-premium-v2',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'premium',
    headline: first.title,
    headlineEvidenceIds: firstStatement.evidenceIds,
    lead: firstStatement,
    sections,
    strategies: [],
    pitfalls: [],
    conclusion: lastStatement,
    evidenceIds: uniqueStrings(ordered.flatMap((item) => item.statement.evidenceIds)),
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
