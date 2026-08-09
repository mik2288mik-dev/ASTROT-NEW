import { formatInTimeZone } from 'date-fns-tz';
import type { NatalChartData, UserProfile } from '../types';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { isNatalChartDataV2 } from './natal/canonicalReport';
import type { AstrologyHistoryContext } from './astrologyHistoryStore';
import {
  APP_VOICE_VERSION,
  getPersonalForecastSystemVoice,
  hasAppVoiceViolation,
} from './appVoice';
import { buildOpenAIChatParams } from './openaiChat';
import { getContentAiClient } from './contentAiClient';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  formatPersonalForecastDateLabel,
  getPersonalForecastPackageValidationError,
  isSimpleDynamicTitle,
  isPersonalForecastPackage,
  selectTodayFreeSections,
  stableHash,
  validateForecastSectionRepetition,
  type CrossPeriodLink,
  type ExplanationAnchor,
  type ForecastContentBlock,
  type ForecastContentBlockRole,
  type ForecastEvidenceView,
  type ForecastSection,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
} from './personalForecastContract';
import {
  calculatePersonalForecastEvidence,
  type EvidenceCalculationResult,
} from './personalForecastEvidence';
import {
  PERSONAL_FORECAST_SEMANTICS_VERSION,
  type ForecastSemanticFact,
} from './personalForecastSemantics';
import {
  forecastAtomText,
  forecastSemanticTitle,
  forecastSemanticVisualTag,
  type ForecastWriterLanguage,
} from './personalForecastSemanticLanguage';


export const PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS = 2;
const MAX_SEMANTIC_SECTIONS = 4;

export function getPersonalForecastSystemPrompt(
  language: ForecastWriterLanguage,
): string {
  return getPersonalForecastSystemVoice(language);
}

type PlannedBlock = {
  id: string;
  role: ForecastContentBlockRole;
  semanticFactId: string;
  atomId: string;
  writerBrief: string;
  astroEvidence: string | null;
};

export type ForecastSectionPlan = {
  id: string;
  title?: string;
  importance: number;
  visualTag: string;
  semanticFactIds: string[];
  semanticFingerprint: string;
  facts: ForecastSemanticFact[];
  blocks: PlannedBlock[];
};

type GeneratedBlockPayload = {
  id?: unknown;
  role?: unknown;
  semantic_fact_id?: unknown;
  atom_id?: unknown;
  text?: unknown;
  astro_evidence?: unknown;
};

type GeneratedSectionPayload = {
  id?: unknown;
  title?: unknown;
  evidence_ids?: unknown;
  blocks?: unknown;
};

type GeneratedFeedPayload = {
  sections?: unknown;
};

type ValidatedWriterResult = {
  blocksBySectionId: Map<string, ForecastContentBlock[]>;
  errors: string[];
};

type FreeGeneratedBlock = {
  text: string;
};

type FreeGeneratedSection = {
  title: string | null;
  evidenceIds: string[];
  blocks: FreeGeneratedBlock[];
};

type ValidatedFreeWriterResult = {
  sections: FreeGeneratedSection[];
  errors: string[];
};

type GenerationResult = {
  overview: ForecastSection;
  sections: ForecastSection[];
  generationAttempts: 0 | 1 | 2;
  validationStatus: 'valid' | 'deterministic_fallback';
};

type EvidenceCalculatedHookResult = {
  calculationSnapshotId?: number | null;
} | void;

const FORBIDDEN_GENERATED_PATTERNS = [
  /\b(?:ты\s+(?:всегда|никогда|по\s+натуре|склонен|склонна|не\s+терпишь)|твой\s+характер)\b/iu,
  /\b(?:you\s+(?:always|never|are\s+naturally|tend\s+to)|your\s+character)\b/iu,
  /\b(?:гарантированно|обязательно\s+произойд[её]т|точно\s+случится|неизбежно)\b/iu,
  /\b(?:guaranteed|will\s+definitely\s+happen|inevitable)\b/iu,
  /\b(?:диагноз|травм[аы]|беременн\w*|увольнен\w*|расставан\w*|переезд\w*)\b/iu,
  /\b(?:diagnos\w*|trauma\w*|pregnan\w*|fired|dismissal|breakup|relocation)\b/iu,
  /\b(?:солнце|луна|меркурий|венера|марс|юпитер|сатурн|уран|нептун|плутон|аспект|транзит)\b|\b(?:\d{1,2}[-–—]?(?:й|ый)?\s+дом|астрологическ\w*\s+дом)\b/iu,
  /\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|aspect|transit)\b|\b(?:house\s+\d{1,2}|astrological\s+house)\b/iu,
  /\b(?:you\s+are\s+(?:impulsive|stubborn|impatient|emotional|sensitive|controlling|jealous|anxious|indecisive)|your\s+personality)\b/iu,
  /\b(?:С‚С‹\s+(?:РёРјРїСѓР»СЊСЃРёРІРЅ\w*|СѓРїСЂСЏРј\w*|РЅРµС‚РµСЂРїРµР»РёРІ\w*|СЌРјРѕС†РёРѕРЅР°Р»СЊРЅ\w*|С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅ\w*|СЂРµРІРЅРёРІ\w*|С‚СЂРµРІРѕР¶РЅ\w*)|С‚РІРѕСЏ\s+Р»РёС‡РЅРѕСЃС‚СЊ)\b/iu,
];

const SAFE_HISTORY_FACT_VALUES: Readonly<Record<string, readonly string[]>> = {
  preferred_pace: [
    'fast', 'quick', 'measured', 'slow', 'slower pace', 'flexible', 'structured',
    'one step at a time', 'step by step',
    'Р±С‹СЃС‚СЂС‹Р№', 'Р±С‹СЃС‚СЂРѕ', 'СЂР°Р·РјРµСЂРµРЅРЅС‹Р№', 'РјРµРґР»РµРЅРЅС‹Р№', 'РіРёР±РєРёР№',
    'СЃС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅС‹Р№', 'РїРѕ С€Р°РіР°Рј',
  ],
  preferred_decision_style: [
    'direct', 'analytical', 'intuitive', 'collaborative', 'needs time',
    'one step at a time', 'step by step',
    'РїСЂСЏРјРѕР№', 'Р°РЅР°Р»РёС‚РёС‡РµСЃРєРёР№', 'РёРЅС‚СѓРёС‚РёРІРЅС‹Р№', 'СЃРѕРІРјРµСЃС‚РЅС‹Р№',
    'РЅСѓР¶РЅРѕ РІСЂРµРјСЏ', 'РїРѕ С€Р°РіР°Рј',
  ],
  preferred_communication_style: [
    'direct', 'concise', 'detailed', 'gentle',
    'РїСЂСЏРјРѕР№', 'РєСЂР°С‚РєРёР№', 'РїРѕРґСЂРѕР±РЅС‹Р№', 'РјСЏРіРєРёР№',
  ],
  preferred_explanation_depth: [
    'concise', 'balanced', 'detailed',
    'РєСЂР°С‚РєРѕ', 'СЃР±Р°Р»Р°РЅСЃРёСЂРѕРІР°РЅРЅРѕ', 'РїРѕРґСЂРѕР±РЅРѕ',
  ],
  preferred_forecast_focus: [
    'risk', 'action', 'timing', 'overview',
    'СЂРёСЃРє', 'РґРµР№СЃС‚РІРёРµ', 'СЃСЂРѕРєРё', 'РѕР±С‰РёР№ РІС‹РІРѕРґ',
  ],
};

const COPY_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'between', 'but', 'by',
  'can', 'for', 'from', 'in', 'is', 'it', 'more', 'not', 'of', 'on', 'one',
  'or', 'right', 'than', 'that', 'the', 'this', 'to', 'under', 'with', 'you',
  'your', 'now', 'currently', 'may',
  'Р°', 'Р±РµР·', 'Р±РѕР»СЊС€Рµ', 'РІ', 'РґР»СЏ', 'РґРѕ', 'Рё', 'РёР»Рё', 'РјРµР¶РґСѓ', 'РЅР°',
  'РЅРµ', 'РЅРѕ', 'РѕС‚', 'РїРѕ', 'РїСЂРё', 'СЃ', 'СЃРµР№С‡Р°СЃ', 'С‡РµРј', 'С‡С‚Рѕ', 'СЌС‚Рѕ',
  'С‚С‹', 'С‚РІРѕР№', 'С‚РІРѕСЏ', 'С‚РІРѕРё', 'РјРѕР¶РµС‚', 'РѕСЃРѕР±РµРЅРЅРѕ',
]);

const LIFE_AREA_GATES: ReadonlyArray<{
  pattern: RegExp;
  contexts: readonly ForecastSemanticFact['lifeContext'][];
}> = [
  {
    pattern: /\b(?:love|romance|relationship|partner|boyfriend|girlfriend|husband|wife|Р»СЋР±РѕРІ\w*|СЂРѕРјР°РЅ\w*|РѕС‚РЅРѕС€РµРЅ\w*|РїР°СЂС‚РЅ[С‘Рµ]СЂ\w*|РјСѓР¶|Р¶РµРЅР°)\b/iu,
    contexts: ['partnerships'],
  },
  {
    pattern: /\b(?:money|income|salary|profit|purchase|property|rent|loan|debt|wealth|РґРµРЅСЊРі\w*|РґРѕС…РѕРґ\w*|Р·Р°СЂРїР»Р°С‚\w*|РїСЂРёР±С‹Р»\w*|РїРѕРєСѓРї\w*|РёРјСѓС‰РµСЃС‚РІ\w*|РєСЂРµРґРёС‚\w*|РґРѕР»Рі\w*)\b/iu,
    contexts: ['personal_resources', 'shared_resources'],
  },
  {
    pattern: /\b(?:job|career|boss|workplace|colleague|РєР°СЂСЊРµСЂ\w*|СЂР°Р±РѕС‚РѕРґР°С‚РµР»\w*|РЅР°С‡Р°Р»СЊРЅРёРє\w*|РєРѕР»Р»РµРі\w*)\b/iu,
    contexts: ['work_routines', 'career_public_role'],
  },
  {
    pattern: /\b(?:home|family|parent|child|РґРѕРј|СЃРµРјСЊ\w*|СЂРѕРґРёС‚РµР»\w*|СЂРµР±[С‘Рµ]РЅ\w*)\b/iu,
    contexts: ['home_foundation'],
  },
  {
    pattern: /\b(?:friend|team|community|group|РґСЂСѓРі\w*|РєРѕРјР°РЅРґ\w*|СЃРѕРѕР±С‰РµСЃС‚РІ\w*|РіСЂСѓРїРї\w*)\b/iu,
    contexts: ['groups_networks'],
  },
  {
    pattern: /\b(?:travel|trip|flight|journey|С‚СѓСЂРёР·Рј\w*|РїРѕРµР·Рґ\w*|РїРµСЂРµР»С‘С‚\w*|РїСѓС‚РµС€РµСЃС‚РІ\w*)\b/iu,
    contexts: ['communication_learning', 'study_travel'],
  },
  {
    pattern: /\b(?:health|illness|treatment|body|Р·РґРѕСЂРѕРІ\w*|Р±РѕР»РµР·РЅ\w*|Р»РµС‡РµРЅ\w*|С‚РµР»Рѕ)\b/iu,
    contexts: [],
  },
];

function confidenceRank(value: ForecastSemanticFact['confidence']): number {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

function sortFacts(facts: ForecastSemanticFact[]): ForecastSemanticFact[] {
  return [...facts].sort((left, right) => (
    right.strength - left.strength
    || confidenceRank(right.confidence) - confidenceRank(left.confidence)
    || left.semanticFingerprint.localeCompare(right.semanticFingerprint)
  ));
}

function normalizedHistoryValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  return normalized || null;
}

function safeHistoryFactValue(key: string, value: unknown): string | null {
  const allowed = SAFE_HISTORY_FACT_VALUES[key];
  const normalized = normalizedHistoryValue(value);
  if (!allowed || !normalized) return null;
  return allowed.includes(normalized) ? normalized : null;
}

function tokenStem(token: string): string {
  let value = token.toLocaleLowerCase();
  if (/^[a-z]+$/u.test(value) && value.length > 4) {
    value = value
      .replace(/(?:ingly|edly|ing|ed|es|s)$/u, '')
      .replace(/(?:tion|ment)$/u, '');
  }
  if (value.length <= 5) return value;
  return value.slice(0, 6);
}

function contentStems(value: string): Set<string> {
  const tokens = value.toLocaleLowerCase().match(/\p{L}+/gu) || [];
  return new Set(
    tokens
      .filter((token) => token.length >= 3 && !COPY_STOP_WORDS.has(token))
      .map(tokenStem)
      .filter((token) => token.length >= 3),
  );
}

function hasUnsupportedLifeArea(
  text: string,
  fact: ForecastSemanticFact,
): boolean {
  return LIFE_AREA_GATES.some((gate) => (
    gate.pattern.test(text)
    && !gate.contexts.includes(fact.lifeContext)
  ));
}

function copyMeaningIsGrounded(input: {
  text: string;
  exactMeaning: string;
  fact: ForecastSemanticFact;
}): boolean {
  if (hasUnsupportedLifeArea(input.text, input.fact)) return false;
  const approved = contentStems(input.exactMeaning);
  const candidate = contentStems(input.text);
  if (!approved.size || !candidate.size) return false;
  const overlap = [...candidate].filter((token) => approved.has(token)).length;
  return overlap >= Math.min(2, approved.size);
}

function roleMeanings(
  role: Exclude<ForecastContentBlockRole, 'insight'>,
  fact: ForecastSemanticFact,
  language: ForecastWriterLanguage,
): string[] {
  const atomIds = role === 'lead'
    ? fact.allowedClaimAtoms
    : role === 'detail'
      ? fact.allowedManifestationAtoms
      : role === 'risk'
        ? fact.allowedRiskAtoms
        : fact.allowedActionAtoms;
  return [...new Set(
    atomIds
      .map((atomId) => forecastAtomText(role, atomId, language).trim())
      .filter(Boolean),
  )];
}

function block(
  planId: string,
  role: ForecastContentBlockRole,
  fact: ForecastSemanticFact,
  language: ForecastWriterLanguage,
  index: number,
  options?: { overview?: boolean },
): PlannedBlock | null {
  const meanings = role === 'insight'
    ? [
        ...roleMeanings('lead', fact, language),
        ...roleMeanings('detail', fact, language).slice(0, 1),
        ...roleMeanings('risk', fact, language).slice(0, 1),
      ]
    : roleMeanings(role, fact, language);
  if (options?.overview && role === 'lead') {
    meanings.push(...roleMeanings('detail', fact, language).slice(0, 1));
  }
  const writerBrief = meanings.join(' ').trim();
  if (!writerBrief) return null;
  return {
    id: `${planId}:${role}:${index + 1}`,
    role,
    semanticFactId: fact.id,
    atomId: `approved:${role}:${fact.id}`,
    writerBrief: options?.overview
      ? `${language === 'ru' ? 'Главный вывод периода' : 'Main period conclusion'}: ${writerBrief}`
      : writerBrief,
    astroEvidence: [
      fact.transitPlanet,
      fact.aspect,
      fact.natalPoint,
      fact.house ? `house ${fact.house}` : null,
    ].filter(Boolean).join(' ') || null,
  };
}

function factBlocks(
  planId: string,
  fact: ForecastSemanticFact,
  language: ForecastWriterLanguage,
): PlannedBlock[] {
  const roles: ForecastContentBlockRole[] = ['insight'];
  return roles
    .map((role, index) => block(planId, role, fact, language, index))
    .filter((value): value is PlannedBlock => !!value)
    .slice(0, 4);
}

export function buildPersonalForecastSectionPlans(input: {
  facts: ForecastSemanticFact[];
  period: PersonalForecastPeriod;
  language: ForecastWriterLanguage;
}): { overview: ForecastSectionPlan; sections: ForecastSectionPlan[] } {
  void input.period;
  const selected: ForecastSemanticFact[] = [];
  const selectedTopics = new Set<string>();
  for (const fact of sortFacts(input.facts)) {
    const topic = fact.sourceKind === 'transit_to_natal'
      ? (fact.natalPoint === 'mc' ? 'mc' : fact.domain)
      : fact.lifeContext || fact.domain;
    if (selectedTopics.has(topic)) continue;
    selectedTopics.add(topic);
    selected.push(fact);
    if (selected.length >= MAX_SEMANTIC_SECTIONS) break;
  }
  if (!selected.length) throw new Error('PERSONAL_FORECAST_SEMANTICS_EMPTY');

  const overviewFacts = selected.slice(0, 3);
  const overviewBlocks = overviewFacts
    .map((fact, index) => block(
      'overview',
      'lead',
      fact,
      input.language,
      index,
      { overview: true },
    ))
    .filter((value): value is PlannedBlock => !!value);
  if (!overviewBlocks.length) throw new Error('PERSONAL_FORECAST_OVERVIEW_EMPTY');

  const overviewFingerprint = `overview:${stableHash(
    overviewFacts.map((fact) => fact.semanticFingerprint).join('|'),
  ).toString(36)}`;
  const overview: ForecastSectionPlan = {
    id: 'overview',
    importance: overviewFacts[0]?.strength || 0,
    visualTag: forecastSemanticVisualTag(overviewFacts[0]),
    semanticFactIds: overviewFacts.map((fact) => fact.id),
    semanticFingerprint: overviewFingerprint,
    facts: overviewFacts,
    blocks: overviewBlocks,
  };

  const sections = selected.map((fact): ForecastSectionPlan => {
    const id = `semantic:${fact.semanticFingerprint.slice(0, 28)}`;
    const blocks = factBlocks(id, fact, input.language);
    if (!blocks.length) throw new Error('PERSONAL_FORECAST_SECTION_ATOMS_EMPTY');
    return {
      id,
      title: forecastSemanticTitle(fact, input.language),
      importance: Math.max(0, Math.min(100, Math.round(fact.strength))),
      visualTag: forecastSemanticVisualTag(fact),
      semanticFactIds: [fact.id],
      semanticFingerprint: fact.semanticFingerprint,
      facts: [fact],
      blocks,
    };
  });

  return { overview, sections };
}

function safeHistoryContext(history?: AstrologyHistoryContext | null) {
  if (!history) return { explicit_facts: [], previous_semantic_fingerprints: [] };
  const explicitFacts = history.explicitFacts
    .filter((fact) => fact.operation === 'assert')
    .map((fact) => ({
      key: fact.factKey.trim(),
      value: safeHistoryFactValue(fact.factKey.trim(), fact.factValue),
    }))
    .filter((fact): fact is { key: string; value: string } => fact.value !== null)
    .slice(0, 8)
    .map((fact) => ({ key: fact.key, value: fact.value }));
  return {
    explicit_facts: explicitFacts,
    previous_semantic_fingerprints: history.artifactContinuity
      .flatMap((artifact) => artifact.semanticFingerprints)
      .filter(Boolean)
      .slice(0, 20),
  };
}

function localForecastTimestamp(value: string | null, timezone: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm');
}

export function buildPersonalForecastFeedPrompt(input: {
  language: ForecastWriterLanguage;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  calculatedEvidence: EvidenceCalculationResult['evidence'];
  natalContext?: Record<string, unknown>;
  /** @deprecated accepted for source compatibility; never included in the prompt. */
  canonicalNatalReport?: unknown;
  repairErrors?: string[];
}): string {
  const periodInstruction: Record<PersonalForecastPeriod, string> = {
    day: 'Interpret the calculated facts inside this day. Use intraday timing only when it exists in the supplied facts.',
    week: 'Interpret the calculated facts across this week as a connected period. Use only the supplied timing.',
    month: 'Interpret the calculated facts at the scale of this month. Do not invent day-level detail.',
  };
  const factTime = (item: EvidenceCalculationResult['evidence'][number]): number => {
    const raw = item.exactAt || item.startsAt || item.endsAt;
    const parsed = raw ? Date.parse(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  const evidence = [...input.calculatedEvidence]
    .sort((a, b) => (
      factTime(a) - factTime(b)
      || (a.orb ?? Number.MAX_SAFE_INTEGER) - (b.orb ?? Number.MAX_SAFE_INTEGER)
      || a.id.localeCompare(b.id)
    ))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      transit_planet: item.transitPlanet || null,
      natal_point: item.natalPoint || null,
      aspect: item.aspect || null,
      house: item.house ?? null,
      orb: item.orb ?? null,
      status: item.status,
      starts_at_local: localForecastTimestamp(item.startsAt || null, input.window.timezone),
      exact_at_local: localForecastTimestamp(item.exactAt || null, input.window.timezone),
      ends_at_local: localForecastTimestamp(item.endsAt || null, input.window.timezone),
      motion: item.motion || null,
      ingress: item.ingress || null,
    }));
  const repair = input.repairErrors?.length
    ? `\nPREVIOUS RESPONSE ERRORS (fix these only):\n${input.repairErrors.join('\n')}`
    : '';
  return `Create a personal forecast directly from the supplied calculated facts.

Write in ${input.language === 'ru' ? 'Russian, addressing the reader as "ты"' : 'English, addressing the reader as "you"'}.
Period: ${input.period}. Window: ${input.window.periodStart} — ${input.window.periodEnd}. Timezone: ${input.window.timezone}.
Period instruction: ${periodInstruction[input.period]}

Output contract:
- Return JSON only: {"sections":[{"title":"optional natural heading or null","evidence_ids":["existing evidence id"],"blocks":[{"text":"plain prose"}]}]}.
- Decide how many sections are genuinely useful, their order, context, headings, and whether advice is warranted.
- Every section must cite only existing ids from calculated_evidence in evidence_ids. Every statement in that section must be supported by those cited facts.
- Do not invent facts, events, personality traits, timing, or calculations.
- Do not add a problem, warning, prohibition, or recommendation unless the supplied facts actually support that interpretation.
- Keep the reading concise, concrete, and non-repetitive. Use plain prose without markdown or embedded headings.
- A title is optional. If used, make it natural and concise; do not follow a title template.
- Treat the natal context only as factual background. Do not infer Ascendant, MC, houses, or cusps when they are absent.

Factual natal context:
${JSON.stringify(input.natalContext ?? {}, null, 2)}

Calculated evidence:
${JSON.stringify(evidence, null, 2)}${repair}`;
}

function generatedTextValid(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length >= 15
    && trimmed.length <= 6_000
    && !/[#*_`]/.test(trimmed)
    && !hasAppVoiceViolation(trimmed)
    && FORBIDDEN_GENERATED_PATTERNS.every((pattern) => !pattern.test(trimmed))
  );
}

function planMap(overviewPlan: ForecastSectionPlan, sectionPlans: ForecastSectionPlan[]) {
  return new Map(
    [overviewPlan, ...sectionPlans].map((plan) => [plan.id, plan]),
  );
}

export function validateGeneratedForecastFeed(input: {
  raw: GeneratedFeedPayload;
  overviewPlan: ForecastSectionPlan;
  sectionPlans: ForecastSectionPlan[];
}): ValidatedWriterResult {
  const errors: string[] = [];
  const expectedPlans = planMap(input.overviewPlan, input.sectionPlans);
  const rawSections = Array.isArray(input.raw?.sections)
    ? input.raw.sections as GeneratedSectionPayload[]
    : [];
  if (rawSections.length !== expectedPlans.size) {
    errors.push(`expected ${expectedPlans.size} sections, received ${rawSections.length}`);
  }

  const blocksBySectionId = new Map<string, ForecastContentBlock[]>();
  const seenSectionIds = new Set<string>();
  for (const rawSection of rawSections) {
    const id = typeof rawSection?.id === 'string' ? rawSection.id.trim() : '';
    const plan = expectedPlans.get(id);
    if (!id || !plan || seenSectionIds.has(id)) {
      errors.push(`unexpected or duplicate section id: ${id || '<empty>'}`);
      continue;
    }
    seenSectionIds.add(id);
    const rawBlocks = Array.isArray(rawSection.blocks)
      ? rawSection.blocks as GeneratedBlockPayload[]
      : [];
    if (rawBlocks.length !== plan.blocks.length) {
      errors.push(`${id}: expected ${plan.blocks.length} blocks, received ${rawBlocks.length}`);
      continue;
    }
    const validated: ForecastContentBlock[] = [];
    for (let index = 0; index < plan.blocks.length; index += 1) {
      const expected = plan.blocks[index];
      const rawBlock = rawBlocks[index];
      const text = typeof rawBlock?.text === 'string' ? rawBlock.text.trim() : '';
      const expectedFact = plan.facts.find(
        (fact) => fact.id === expected.semanticFactId,
      );
      if (
        rawBlock?.id !== expected.id
        || rawBlock?.role !== expected.role
        || rawBlock?.semantic_fact_id !== expected.semanticFactId
        || rawBlock?.atom_id !== expected.atomId
        || rawBlock?.astro_evidence !== expected.astroEvidence
      ) {
        errors.push(`${id}: block ${index + 1} changed the approved semantic identity`);
        continue;
      }
      if (!generatedTextValid(text)) {
        errors.push(`${id}: block ${expected.id} failed independent copy validation`);
        continue;
      }
      if (!expectedFact || !copyMeaningIsGrounded({
        text,
        exactMeaning: expected.writerBrief,
        fact: expectedFact,
      })) {
        errors.push(`${id}: block ${expected.id} is not grounded in its approved meaning`);
        continue;
      }
      validated.push({
        id: expected.id,
        role: expected.role,
        text,
        semanticFactId: expected.semanticFactId,
        atomId: expected.atomId,
        astro_evidence: expected.astroEvidence,
        explanationAnchorId: index === 0 ? `anchor:${id}` : null,
      });
    }
    if (validated.length === plan.blocks.length) blocksBySectionId.set(id, validated);
  }
  for (const id of expectedPlans.keys()) {
    if (!seenSectionIds.has(id)) errors.push(`missing section: ${id}`);
  }
  return { blocksBySectionId, errors };
}

function generatedTitleValid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const title = value.trim();
  return title.length > 0 && title.length <= 120 && !/[#*_`]/.test(title);
}

/**
 * The writer is free to choose its section and block identifiers.  The package
 * keeps stable identifiers during materialization; they are not part of the
 * model's authoring contract.
 */
export function validateFreeGeneratedForecastFeed(
  raw: GeneratedFeedPayload,
  availableEvidenceIds: ReadonlySet<string> = new Set(),
): ValidatedFreeWriterResult {
  const errors: string[] = [];
  const rawSections = Array.isArray(raw?.sections)
    ? raw.sections as GeneratedSectionPayload[]
    : [];
  if (rawSections.length < 1 || rawSections.length > 8) {
    errors.push(`expected 1-8 sections, received ${rawSections.length}`);
  }

  const sections: FreeGeneratedSection[] = [];
  for (const [sectionIndex, rawSection] of rawSections.entries()) {
    const rawBlocks = Array.isArray(rawSection?.blocks)
      ? rawSection.blocks as GeneratedBlockPayload[]
      : [];
    if (rawBlocks.length < 1 || rawBlocks.length > 6) {
      errors.push(`section ${sectionIndex + 1}: expected 1-6 blocks, received ${rawBlocks.length}`);
      continue;
    }
    const title = typeof rawSection?.title === 'string' && rawSection.title.trim()
      ? rawSection.title.trim()
      : null;
    if (title !== null && !generatedTitleValid(title)) {
      errors.push(`section ${sectionIndex + 1}: title is invalid`);
      continue;
    }
    const evidenceIds = Array.isArray(rawSection?.evidence_ids)
      ? rawSection.evidence_ids
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
    if (
      evidenceIds.length < 1
      || evidenceIds.length > 12
      || new Set(evidenceIds).size !== evidenceIds.length
      || evidenceIds.some((id) => !availableEvidenceIds.has(id))
    ) {
      errors.push(`section ${sectionIndex + 1}: evidence_ids are missing, duplicated, or unknown`);
      continue;
    }
    const blocks: FreeGeneratedBlock[] = [];
    for (const [blockIndex, rawBlock] of rawBlocks.entries()) {
      const text = typeof rawBlock?.text === 'string' ? rawBlock.text.trim() : '';
      if (!generatedTextValid(text)) {
        errors.push(`section ${sectionIndex + 1}, block ${blockIndex + 1}: invalid text`);
        continue;
      }
      blocks.push({ text });
    }
    if (blocks.length === rawBlocks.length) {
      sections.push({
        title,
        evidenceIds,
        blocks,
      });
    }
  }
  return { sections, errors };
}

export function parseGeneratedFeedPayload(content: string): GeneratedFeedPayload | null {
  const unwrapped = content
    .trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
  const candidates = [unwrapped];
  const firstObject = unwrapped.indexOf('{');
  const lastObject = unwrapped.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    candidates.push(unwrapped.slice(firstObject, lastObject + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const payload = Array.isArray(parsed)
        ? { sections: parsed }
        : parsed && typeof parsed === 'object'
          ? parsed as Record<string, unknown>
          : null;
      if (!payload) continue;
      const nested = [payload, payload.data, payload.result, payload.output, payload.response]
        .find((value) => value && typeof value === 'object' && (
          Array.isArray(value) || Array.isArray((value as { sections?: unknown }).sections)
        ));
      if (Array.isArray(nested)) return { sections: nested };
      if (nested && typeof nested === 'object') return nested as GeneratedFeedPayload;
    } catch {
      // Try the next safe JSON representation.
    }
  }
  return null;
}

function evidenceForPlan(
  plan: ForecastSectionPlan,
  evidenceViews: Record<string, ForecastEvidenceView>,
): ForecastEvidenceView[] {
  const ids = new Set(plan.facts.flatMap((fact) => fact.evidenceIds));
  return [...ids]
    .map((id) => evidenceViews[id])
    .filter((item): item is ForecastEvidenceView => !!item)
    .slice(0, 8);
}

function buildAnchor(
  plan: ForecastSectionPlan,
  blocks: ForecastContentBlock[],
  evidenceViews: Record<string, ForecastEvidenceView>,
): ExplanationAnchor[] {
  const evidence = evidenceForPlan(plan, evidenceViews);
  if (!evidence.length || !blocks.length) return [];
  const explanation = evidence
    .map((item) => `${item.factor}. ${item.meaning}`)
    .join(' ')
    .slice(0, 1_200)
    .trim();
  if (explanation.length < 40) return [];
  return [{
    id: `anchor:${plan.id}`,
    conclusion: blocks[0].text.slice(0, 600),
    explanation,
    evidenceIds: evidence.map((item) => item.id),
  }];
}

function premiumTeaser(plan: ForecastSectionPlan, language: ForecastWriterLanguage): string {
  const title = plan.title || (language === 'ru' ? 'главного вывода' : 'the main conclusion');
  return language === 'ru'
    ? `В полном разборе «${title}» — конкретное проявление, главный риск и рабочий следующий шаг.`
    : `The full “${title}” reading gives the concrete manifestation, main risk, and practical next step.`;
}

function _materializeSection(input: {
  plan: ForecastSectionPlan;
  blocks: ForecastContentBlock[];
  evidenceViews: Record<string, ForecastEvidenceView>;
  language: ForecastWriterLanguage;
  overview: boolean;
}): ForecastSection {
  const anchors = buildAnchor(input.plan, input.blocks, input.evidenceViews);
  const anchorIds = new Set(anchors.map((anchor) => anchor.id));
  const blocks = input.blocks.map((item) => ({
    ...item,
    explanationAnchorId: item.explanationAnchorId && anchorIds.has(item.explanationAnchorId)
      ? item.explanationAnchorId
      : null,
    astro_evidence: item.astro_evidence || evidenceForPlan(input.plan, input.evidenceViews)[0]?.factor || null,
  }));
  const text = blocks.map((item) => item.text.trim()).join('\n\n');
  const teaser = premiumTeaser(input.plan, input.language);
  return {
    id: input.plan.id,
    kind: input.overview ? 'overview' : 'dynamic',
    status: 'ready',
    diagnosticCode: null,
    title: input.overview ? undefined : input.plan.title,
    sourceTopicKey: input.overview ? 'overview' : undefined,
    text,
    contentBlocks: blocks,
    semanticFactIds: input.plan.semanticFactIds,
    semanticFingerprint: input.plan.semanticFingerprint,
    importance: input.plan.importance,
    visualTag: input.plan.visualTag,
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(text, teaser),
    explanationAnchors: anchors,
    inlineAstroAccent: null,
  };
}

function evidenceForIds(
  evidenceIds: readonly string[],
  evidenceViews: Record<string, ForecastEvidenceView>,
): ForecastEvidenceView[] {
  return evidenceIds
    .map((id) => evidenceViews[id])
    .filter((item): item is ForecastEvidenceView => !!item);
}

function materializeDirectSection(input: {
  section: FreeGeneratedSection;
  evidenceViews: Record<string, ForecastEvidenceView>;
  language: ForecastWriterLanguage;
  overview: boolean;
  sectionIndex: number;
}): ForecastSection {
  const evidence = evidenceForIds(input.section.evidenceIds, input.evidenceViews);
  const title = input.section.title || undefined;
  const sectionId = input.overview
    ? 'overview'
    : `semantic:direct-${input.sectionIndex}-${stableHash(`${title || ''}:${input.section.evidenceIds.join(':')}`).toString(36)}`;
  const evidenceLabel = evidence.map((item) => item.factor).join(' · ').slice(0, 240) || null;
  const blocks: ForecastContentBlock[] = input.section.blocks.map((block, index) => ({
    id: `${sectionId}:generated:${index + 1}`,
    role: input.overview && index === 0 ? 'lead' : 'insight',
    text: block.text,
    semanticFactId: input.section.evidenceIds[0],
    atomId: `generated:${sectionId}:${index + 1}`,
    astro_evidence: evidenceLabel,
    explanationAnchorId: index === 0 ? `anchor:${sectionId}` : null,
  }));
  const text = blocks.map((block) => block.text).join('\n\n');
  const teaser = input.language === 'ru'
    ? 'В полном разборе этого периода раскрыты конкретные проявления рассчитанных факторов.'
    : 'The full reading of this period explains the concrete manifestations of its calculated factors.';
  const factualAnchorPrefix = input.language === 'ru'
    ? 'Расчётные факты этой секции: '
    : 'Calculated facts cited by this section: ';
  const anchorExplanation = `${factualAnchorPrefix}${evidence
    .map((item) => `${item.factor}: ${item.meaning}`)
    .join(' ')}`
    .slice(0, 1_200)
    .trim();
  const anchors: ExplanationAnchor[] = evidence.length && blocks.length && anchorExplanation.length >= 40
    ? [{
        id: `anchor:${sectionId}`,
        conclusion: blocks[0].text.slice(0, 600),
        explanation: anchorExplanation,
        evidenceIds: evidence.map((item) => item.id),
      }]
    : [];
  return {
    id: sectionId,
    kind: input.overview ? 'overview' : 'dynamic',
    status: 'ready', diagnosticCode: null,
    title,
    sourceTopicKey: input.overview ? 'overview' : undefined,
    text, contentBlocks: blocks,
    semanticFactIds: input.section.evidenceIds,
    semanticFingerprint: `direct:${stableHash(`${input.section.evidenceIds.join(':')}:${input.sectionIndex}`).toString(36)}`,
    importance: Math.max(1, 100 - input.sectionIndex),
    visualTag: 'calculated',
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(text, teaser),
    explanationAnchors: anchors,
    inlineAstroAccent: null,
  };
}

async function requestGeneratedFeed(input: {
  language: ForecastWriterLanguage;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  calculatedEvidence: EvidenceCalculationResult['evidence'];
  evidenceViews: Record<string, ForecastEvidenceView>;
  natalContext: Record<string, unknown>;
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
}): Promise<GenerationResult> {
  const availableEvidenceIds = new Set(input.calculatedEvidence.map((item) => item.id));
  if (!availableEvidenceIds.size) throw new Error('PERSONAL_FORECAST_EVIDENCE_EMPTY');
  const openai = getContentAiClient(input.model);
  if (!openai) throw new Error('PERSONAL_FORECAST_MODEL_UNAVAILABLE');

  let errors: string[] = [];
  for (
    let attempt = 1;
    attempt <= PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS;
    attempt += 1
  ) {
    let content = '';
    const startedAt = Date.now();
    let usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const response = await openai.chat.completions.create(buildOpenAIChatParams(input.model, {
        messages: [
          { role: 'system', content: getPersonalForecastSystemPrompt(input.language) },
          {
            role: 'user',
            content: buildPersonalForecastFeedPrompt({
              language: input.language,
              period: input.period,
              window: input.window,
              calculatedEvidence: input.calculatedEvidence,
              natalContext: input.natalContext,
              repairErrors: attempt === 2 ? errors : undefined,
            }),
          },
        ],
        maxTokens: ({ day: 3_000, week: 3_400, month: 3_800 } as const)[input.period],
        temperature: 0.35,
        jsonMode: true,
      }));
      content = response.choices[0]?.message?.content?.trim() || '';
      usage = { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 };
    } catch (error) {
      errors = [`writer request failed: ${error instanceof Error ? error.message : String(error)}`];
      continue;
    }
    const raw = parseGeneratedFeedPayload(content);
    if (!raw) {
      errors = ['response is not valid JSON'];
      continue;
    }
    const validation = validateFreeGeneratedForecastFeed(raw, availableEvidenceIds);
    if (!validation.errors.length) {
      const [rawOverview, ...rawSections] = validation.sections;
      if (!rawOverview) {
        errors = ['overview section is missing after validation'];
        continue;
      }
      const overview = materializeDirectSection({
        section: rawOverview,
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: true,
        sectionIndex: 0,
      });
      const sections = rawSections.map((section, index) => materializeDirectSection({
        section,
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: false,
        sectionIndex: index + 1,
      }));
      const repetitionErrors = validateForecastSectionRepetition([overview, ...sections]);
      if (repetitionErrors.length) {
        errors = repetitionErrors;
        continue;
      }
      input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: true });
      return {
        overview,
        sections,
        generationAttempts: attempt as 1 | 2,
        validationStatus: 'valid',
      };
    }
    input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: false });
    errors = validation.errors;
  }

  throw new Error(`PERSONAL_FORECAST_GENERATION_INVALID:${errors.join(' | ')}`);
}

export function buildCrossPeriodLinks(_input?: unknown): CrossPeriodLink[] {
  return [];
}

function buildFactualNatalContext(chart: NatalChartData): Record<string, unknown> {
  if (isNatalChartDataV2(chart)) {
    const v2 = chart as unknown as NatalChartDataV2;
    const housesReliable = v2.chartQuality.housesReliable;
    const ascendantReliable = v2.chartQuality.ascendantReliable;
    const positions = Object.values(v2.positions).map((position) => ({
      key: position.key,
      object: position.object,
      kind: position.kind,
      sign: position.sign,
      degree: position.degree,
      longitude: position.longitude,
      retrograde: position.retrograde,
      speed_longitude: position.speedLongitude,
      house: housesReliable && position.stable.house ? position.house : null,
      reliability: position.reliability,
    }));
    const angles = [
      ascendantReliable ? v2.angles.ascendant : null,
      v2.chartQuality.anglesAvailable ? v2.angles.mc : null,
    ].filter((angle): angle is NonNullable<typeof angle> => !!angle)
      .map((angle) => ({
        key: angle.key,
        sign: angle.sign,
        degree: angle.degree,
        longitude: angle.longitude,
        reliability: angle.reliability,
      }));
    return {
      schema_version: v2.schemaVersion,
      birth_time_quality: v2.birthTimeQuality,
      positions,
      angles,
      houses: housesReliable
        ? v2.houses.map((house) => ({
            house: house.house,
            sign: house.sign,
            degree: house.degree,
            longitude: house.longitude,
            reliability: house.reliability,
          }))
        : [],
      aspects: v2.aspects
        .filter((aspect) => aspect.reliable)
        .map((aspect) => ({
          id: aspect.id,
          type: aspect.type,
          from: aspect.fromKey,
          to: aspect.toKey,
          angle: aspect.angle,
          exact_angle: aspect.exactAngle,
          orb: aspect.orb,
          phase: aspect.phase,
        })),
    };
  }

  const quality = chart.chartQuality;
  const birthTimeQuality = chart.birthTimeQuality || quality?.birthTimeQuality || 'unknown';
  const housesReliable = birthTimeQuality === 'exact' && quality?.housesReliable !== false;
  const ascendantReliable = birthTimeQuality === 'exact' && quality?.ascendantReliable !== false;
  const rawPositions = [
    ['sun', chart.sun], ['moon', chart.moon], ['mercury', chart.mercury],
    ['venus', chart.venus], ['mars', chart.mars], ['jupiter', chart.jupiter],
    ['saturn', chart.saturn], ['uranus', chart.uranus], ['neptune', chart.neptune],
    ['pluto', chart.pluto], ['chiron', chart.chiron],
  ] as const;
  return {
    schema_version: 'legacy',
    birth_time_quality: birthTimeQuality,
    positions: rawPositions.flatMap(([key, position]) => position ? [{
      key,
      sign: position.sign,
      degree: position.degree ?? null,
      longitude: position.longitude ?? null,
      retrograde: position.retrograde ?? null,
      speed_longitude: position.speedLongitude ?? null,
      house: housesReliable ? position.house ?? null : null,
    }] : []),
    angles: ascendantReliable && chart.rising ? [{
      key: 'ascendant',
      sign: chart.rising.sign,
      degree: chart.rising.degree ?? null,
      longitude: chart.rising.longitude ?? null,
    }] : [],
    houses: housesReliable ? chart.houses || [] : [],
    aspects: (chart.aspects || []).map((aspect) => ({
      type: aspect.type,
      from: aspect.from,
      to: aspect.to,
      angle: aspect.angle,
      orb: aspect.orb,
    })),
  };
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  previousForecast?: PersonalForecastPackage | null;
  historyContext?: AstrologyHistoryContext | null;
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
  onEvidenceCalculated?: (payload: {
    calculated: EvidenceCalculationResult;
    /** Semantic compiler is intentionally bypassed; snapshots receive no derived facts. */
    semanticFacts: [];
  }) => Promise<EvidenceCalculatedHookResult>;
}): Promise<PersonalForecastPackage> {
  const language: ForecastWriterLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const natalContext = buildFactualNatalContext(input.chartData);
  const calculated = await calculatePersonalForecastEvidence({
    chartData: input.chartData,
    period: input.period,
    window: input.window,
    language,
  });
  if (input.onEvidenceCalculated) {
    await input.onEvidenceCalculated({ calculated, semanticFacts: [] });
  }
  const generated = await requestGeneratedFeed({
    language,
    model: input.model,
    period: input.period,
    window: input.window,
    calculatedEvidence: calculated.evidence,
    evidenceViews: calculated.evidenceViews,
    natalContext,
    onMetrics: input.onMetrics,
  });
  const materializePackage = (
    result: GenerationResult,
    diagnosticCode: string | null,
  ): PersonalForecastPackage => {
    const referencedEvidenceIds = new Set(
      [result.overview, ...result.sections]
        .flatMap((section) => section.explanationAnchors)
        .flatMap((anchor) => anchor.evidenceIds),
    );
    const evidence = Object.fromEntries(
      [...referencedEvidenceIds]
        .map((id) => [id, calculated.evidenceViews[id]] as const)
        .filter((entry): entry is readonly [string, ForecastEvidenceView] => !!entry[1]),
    );
    const freeSelection = input.period === 'day'
      ? selectTodayFreeSections({
          sections: result.sections,
          userId: String(input.profile.id || 'guest'),
          periodKey: input.window.periodKey,
          previousSectionIds: input.previousForecast?.meta.freeSelection.sectionIds,
        })
      : {
          strongestSectionId: null,
          rotatedSectionId: null,
          sectionIds: [],
        };
    return {
      period: input.period,
      periodKey: input.window.periodKey,
      periodStart: input.window.periodStart,
      periodEnd: input.window.periodEnd,
      dateLabel: formatPersonalForecastDateLabel(input.window, language),
      timezone: input.window.timezone,
      overview: result.overview,
      sections: result.sections,
      suggestedCrossPeriodLinks: [],
      evidence,
      visual: {
        sectionAssetIds: Object.fromEntries(
          [result.overview, ...result.sections].map((section) => [section.id, null]),
        ),
      },
      meta: {
        model: input.model,
        promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
        voiceVersion: APP_VOICE_VERSION,
        calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
        semanticVersion: PERSONAL_FORECAST_SEMANTICS_VERSION,
        contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
        generationAttempts: result.generationAttempts,
        validationStatus: result.validationStatus,
        generatedAt: new Date().toISOString(),
        status: 'ready',
        diagnosticCode,
        freeSelection,
      },
    };
  };

  const primary = materializePackage(generated, null);
  if (isPersonalForecastPackage(primary)) return primary;
  const primaryValidationError = getPersonalForecastPackageValidationError(primary)
    || 'PACKAGE_UNKNOWN_INVALID';
  throw new Error(`PERSONAL_FORECAST_PACKAGE_INVALID:${primaryValidationError}`);
}
