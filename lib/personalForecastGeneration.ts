import { formatInTimeZone } from 'date-fns-tz';
import type { NatalChartData, UserProfile } from '../types';
import {
  buildCanonicalNatalReport,
  isNatalChartDataV2,
  type CanonicalNatalReport,
} from './natal/canonicalReport';
import type { AstrologyHistoryContext } from './astrologyHistoryStore';
import {
  APP_VOICE_VERSION,
  getAppSystemVoice,
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
  const task = language === 'ru'
    ? `Ты — живой, прямой и дерзкий астро-аналитик и сильный журнальный редактор. Разбирай только переданные расчётные данные: транзиты, аспекты, дома и сроки. Пиши о реальной жизни — деньгах, делах, контактах, чувствах и сбоях. Никакой эзотерики, «опор», «точек напряжения», коучинга или канцелярита. Выбирай только действительно важные выводы, формулируй их плотно и не повторяй одну мысль разными словами. Дерзость — в точном наблюдении, не в грубости и не в сленге.`
    : `You are a lively, direct, bold astro analyst and a sharp magazine editor. Read only the supplied calculations: transits, aspects, houses, and timing. Write about real life: money, work, contacts, feelings, and disruptions. No esoteric language, coaching, corporate filler, or slang. Select only the conclusions that matter, keep them dense, and never repeat one idea in different words. Bold means precise, never rude.`;
  return `${getAppSystemVoice(language)}\n\nFORECAST-SPECIFIC SYSTEM INSTRUCTION:\n${task}`;
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
  astroEvidence: string | null;
};

type FreeGeneratedSection = {
  title: string | null;
  blocks: FreeGeneratedBlock[];
};

type ValidatedFreeWriterResult = {
  sections: FreeGeneratedSection[];
  errors: string[];
};

type DirectSectionBasis = {
  id: string;
  evidenceIds: string[];
  importance: number;
  visualTag: string;
  semanticFingerprint: string;
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
  canonicalNatalReport?: CanonicalNatalReport;
  historyContext?: AstrologyHistoryContext | null;
  repairErrors?: string[];
}): string {
  const periodInstruction: Record<PersonalForecastPeriod, string> = {
    day: 'Give a short slice of this day: its central pressure or opening, the clearest manifestation, and what to avoid. Mention a part of the day only when the calculation gives a real timing change.',
    week: 'Give the week\'s main vector and two or three real focal points. Show how the pressure develops across the supplied window without inventing daily bustle.',
    month: 'Give a strategic reading of the month: the large movements in the relevant spheres and the genuinely important timing windows. Do not turn it into a daily diary.',
  };
  const evidence = input.calculatedEvidence
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      transit_planet: item.transitPlanet || null,
      natal_point: item.natalPoint || null,
      aspect: item.aspect || null,
      house: item.house || null,
      orb: item.orb || null,
      status: item.status,
      strength: item.strength,
      polarity: item.polarity,
      starts_at_local: localForecastTimestamp(item.startsAt || null, input.window.timezone),
      exact_at_local: localForecastTimestamp(item.exactAt || null, input.window.timezone),
      ends_at_local: localForecastTimestamp(item.endsAt || null, input.window.timezone),
      motion: item.motion || null,
      ingress: item.ingress || null,
    }));
  const repair = input.repairErrors?.length
    ? `\nPREVIOUS RESPONSE ERRORS (fix these only):\n${input.repairErrors.join('\n')}`
    : '';
  return `You write a concise editorial personal forecast from supplied calculations.

Write in ${input.language === 'ru' ? 'Russian, addressing the reader as "ты"' : 'English, addressing the reader as "you"'}.
Period: ${input.period}. Window: ${input.window.periodStart} — ${input.window.periodEnd}. Timezone: ${input.window.timezone}.
Period instruction: ${periodInstruction[input.period]}

Hard rules:
- Return JSON only: {"sections":[{"title":"...","blocks":[{"text":"...","astro_evidence":"..."}]}]}.
- Return 3-5 sections total: the first is the hero overview, followed by 2-4 thematic sections chosen from the strongest supplied facts.
- Every section title is required. Make it a specific human headline of 2-7 words. The first title is the screen headline: short, bold, and exact. Never use a generic domain or technical label.
- The hero overview has exactly one block: a lead of 1-2 short sentences and no more than 36 words.
- Each following section has 1-2 compact blocks. Each block is one paragraph of at most 3 sentences and 70 words. Remove any sentence that repeats an earlier conclusion.
- Each block needs a short, exact astro_evidence that names the supplied calculation behind it (for example, "Mars in the 2nd house"). It is UI metadata; never name it in text.
- Build the sections freely from the calculated evidence. Do not use canned labels such as "Reactions", "First step", "Actions and boundaries", or "Conversations and decisions".
- Never use titles equivalent to "Overview", "General background", "Main point", "What is happening", "What to do", "Energy of the day", "Evening", "Work", "Money", "Relationships", or "Inner state". Name the actual conclusion instead.
- Start each block with one precise, living image and immediately show a concrete ordinary-life manifestation. The image must clarify, never decorate.
- Prefer concrete spheres only when the calculation supports them: work and money, relationships and communication, inner state. Do not manufacture a sphere, event, motive, biography, or prediction.
- No filler, coaching language, or cheap slang. Never use "background processes", "put things in order", "resources", "do not force events", or close paraphrases. Write a sharp, compact, psychologically literate analysis in ordinary language.
- For day, mention morning, daytime or evening only when the supplied local timing changes inside that day. For week and month, name only the supplied dates or intervals that actually stand out.
- A forecast is temporary. Never turn it into personality: no "you always", "you never", "you are the kind of person" or equivalents.
- Do not name planets, aspects, houses, transits, degrees, or calculation terms in the main text.
- Do not predict a relocation, breakup, dismissal, pregnancy, diagnosis, income, purchase, or any other specific event.
- Inside text fields use plain prose only: no markdown, embedded headings, slogans, section numbering, coaching language, cheap slang, or filler. Titles belong only in the title fields.
- Explicit history may only sharpen wording inside the supplied semantic domain. It cannot create a new domain or fact.
- The canonical natal report is factual background only. The dated calculation evidence determines this ${input.period} forecast; do not reuse a generic natal template.
- If the canonical natal report has no HousePlacements, do not infer or mention the Ascendant, houses, rulers, cusps, or other time-dependent placements.

Canonical natal report (V2 facts when available):
${JSON.stringify(input.canonicalNatalReport ?? null, null, 2)}

Direct Swiss Ephemeris calculation evidence:
${JSON.stringify(evidence, null, 2)}

Bounded non-generative history context:
${JSON.stringify(safeHistoryContext(input.historyContext), null, 2)}${repair}`;
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

const FORBIDDEN_GENERATED_TITLES = new Set([
  'общее', 'общий фон', 'главное', 'что происходит', 'где шанс где риск',
  'что делать', 'энергия дня', 'вечер', 'работа', 'деньги', 'отношения',
  'общение', 'внутреннее состояние', 'личный гороскоп на сегодня',
  'личный гороскоп на неделю', 'личный гороскоп на месяц',
  'overview', 'general background', 'main point', 'what is happening',
  'what to do', 'energy of the day', 'evening', 'work', 'money',
  'relationships', 'communication', 'inner state',
]);

function generatedTitleValid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const title = value.trim();
  const normalized = title
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = normalized.split(' ').filter(Boolean);
  return (
    isSimpleDynamicTitle(title)
    && words.length >= 2
    && !FORBIDDEN_GENERATED_TITLES.has(normalized)
  );
}

/**
 * The writer is free to choose its section and block identifiers.  The package
 * keeps stable identifiers during materialization; they are not part of the
 * model's authoring contract.
 */
export function validateFreeGeneratedForecastFeed(raw: GeneratedFeedPayload): ValidatedFreeWriterResult {
  const errors: string[] = [];
  const rawSections = Array.isArray(raw?.sections)
    ? raw.sections as GeneratedSectionPayload[]
    : [];
  if (rawSections.length < 3 || rawSections.length > MAX_SEMANTIC_SECTIONS + 1) {
    errors.push(`expected 3-${MAX_SEMANTIC_SECTIONS + 1} sections, received ${rawSections.length}`);
  }

  const sections: FreeGeneratedSection[] = [];
  for (const [sectionIndex, rawSection] of rawSections.entries()) {
    const rawBlocks = Array.isArray(rawSection?.blocks)
      ? rawSection.blocks as GeneratedBlockPayload[]
      : [];
    const expectedMaximum = sectionIndex === 0 ? 1 : 2;
    if (rawBlocks.length < 1 || rawBlocks.length > expectedMaximum) {
      errors.push(`section ${sectionIndex + 1}: expected 1-${expectedMaximum} blocks, received ${rawBlocks.length}`);
      continue;
    }
    const title = typeof rawSection?.title === 'string' ? rawSection.title.trim() : '';
    if (!generatedTitleValid(title)) {
      errors.push(`section ${sectionIndex + 1}: title is missing, generic, or invalid`);
      continue;
    }
    const blocks: FreeGeneratedBlock[] = [];
    for (const [blockIndex, rawBlock] of rawBlocks.entries()) {
      const text = typeof rawBlock?.text === 'string' ? rawBlock.text.trim() : '';
      const astroEvidence = typeof rawBlock?.astro_evidence === 'string'
        ? rawBlock.astro_evidence.trim().slice(0, 240) || null
        : null;
      if (!generatedTextValid(text)) {
        errors.push(`section ${sectionIndex + 1}, block ${blockIndex + 1}: invalid text`);
        continue;
      }
      if (!astroEvidence || astroEvidence.length < 3) {
        errors.push(`section ${sectionIndex + 1}, block ${blockIndex + 1}: astro_evidence is missing`);
        continue;
      }
      blocks.push({ text, astroEvidence });
    }
    if (blocks.length === rawBlocks.length) {
      sections.push({
        title,
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

function buildDirectSectionBases(
  evidence: EvidenceCalculationResult['evidence'],
): DirectSectionBasis[] {
  const evidenceIds = evidence.map((item) => item.id).filter(Boolean);
  return evidenceIds.length ? [{
    id: 'direct:calculated-evidence', evidenceIds, importance: 100,
    visualTag: 'calculated', semanticFingerprint: `direct:${stableHash(evidenceIds.join(':')).toString(36)}`,
  }] : [];
}

function evidenceForBasis(
  basis: DirectSectionBasis,
  evidenceViews: Record<string, ForecastEvidenceView>,
): ForecastEvidenceView[] {
  return basis.evidenceIds
    .map((id) => evidenceViews[id])
    .filter((item): item is ForecastEvidenceView => !!item);
}

function materializeDirectSection(input: {
  section: FreeGeneratedSection;
  basis: DirectSectionBasis;
  evidenceViews: Record<string, ForecastEvidenceView>;
  language: ForecastWriterLanguage;
  overview: boolean;
  sectionIndex: number;
}): ForecastSection {
  const evidence = evidenceForBasis(input.basis, input.evidenceViews);
  const title = input.section.title || (input.language === 'ru' ? 'Точный поворот' : 'A precise turn');
  const sectionId = input.overview
    ? 'overview'
    : `semantic:direct-${input.sectionIndex}-${stableHash(title).toString(36)}`;
  const blocks: ForecastContentBlock[] = input.section.blocks.map((block, index) => ({
    id: `${sectionId}:generated:${index + 1}`,
    role: input.overview && index === 0 ? 'lead' : 'insight',
    text: block.text,
    semanticFactId: input.basis.id,
    atomId: `generated:${sectionId}:${index + 1}`,
    astro_evidence: block.astroEvidence || evidence[0]?.factor || null,
    explanationAnchorId: index === 0 ? `anchor:${sectionId}` : null,
  }));
  const text = blocks.map((block) => block.text).join('\n\n');
  const teaser = input.language === 'ru'
    ? `В полном разборе «${title}» — конкретные проявления и важные условия периода.`
    : `The full “${title}” reading gives the concrete manifestations and important conditions of the period.`;
  const anchorEvidence = evidence.slice(0, 8);
  const anchorExplanation = anchorEvidence
    .map((item) => `${item.factor}. ${item.meaning}`)
    .join(' ')
    .slice(0, 1_200)
    .trim();
  const anchors: ExplanationAnchor[] = anchorEvidence.length && blocks.length && anchorExplanation.length >= 40
    ? [{
        id: `anchor:${sectionId}`,
        conclusion: blocks[0].text.slice(0, 600),
        explanation: anchorExplanation,
        evidenceIds: anchorEvidence.map((item) => item.id),
      }]
    : [];
  return {
    id: sectionId,
    kind: input.overview ? 'overview' : 'dynamic',
    status: 'ready', diagnosticCode: null,
    title,
    sourceTopicKey: input.overview ? 'overview' : undefined,
    text, contentBlocks: blocks,
    semanticFactIds: [input.basis.id],
    semanticFingerprint: `${input.basis.semanticFingerprint}:${input.overview ? 'overview' : input.sectionIndex}`,
    importance: input.overview ? input.basis.importance : Math.max(1, input.basis.importance - input.sectionIndex),
    visualTag: input.basis.visualTag,
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(text, teaser),
    explanationAnchors: anchors,
    inlineAstroAccent: null,
  };
}

function buildDirectFallbackSections(input: {
  language: ForecastWriterLanguage;
  basis: DirectSectionBasis;
  evidenceViews: Record<string, ForecastEvidenceView>;
}): FreeGeneratedSection[] {
  const evidence = evidenceForBasis(input.basis, input.evidenceViews);
  const first = evidence[0];
  const second = evidence[1];
  const fallbackText = input.language === 'ru'
    ? 'Сейчас важнее выбрать один ясный шаг и не распылять внимание на всё сразу.'
    : 'The useful move now is to choose one clear step instead of scattering your attention.';
  const secondFallbackText = input.language === 'ru'
    ? 'Проверь факты перед ответом: спокойная пауза сейчас полезнее автоматической реакции.'
    : 'Check the facts before replying: a calm pause is more useful now than an automatic reaction.';
  return [
    {
      title: input.language === 'ru' ? 'Выбери точный ход' : 'Choose the precise move',
      blocks: [{ text: first?.meaning || fallbackText, astroEvidence: first?.factor || 'Calculated period evidence' }],
    },
    {
      title: input.language === 'ru' ? 'Не распыляй импульс' : 'Do not scatter momentum',
      blocks: [{ text: second?.meaning || secondFallbackText, astroEvidence: second?.factor || first?.factor || 'Calculated period evidence' }],
    },
    {
      title: input.language === 'ru' ? 'Закрепи результат делом' : 'Make the result concrete',
      blocks: [{ text: fallbackText, astroEvidence: first?.factor || 'Calculated period evidence' }],
    },
  ];
}

async function requestGeneratedFeed(input: {
  language: ForecastWriterLanguage;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  calculatedEvidence: EvidenceCalculationResult['evidence'];
  evidenceViews: Record<string, ForecastEvidenceView>;
  canonicalNatalReport?: CanonicalNatalReport;
  historyContext?: AstrologyHistoryContext | null;
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
}): Promise<GenerationResult> {
  const bases = buildDirectSectionBases(input.calculatedEvidence);
  if (!bases.length) throw new Error('PERSONAL_FORECAST_EVIDENCE_EMPTY');
  const openai = getContentAiClient(input.model);
  if (!openai) {
    const fallbackSections = buildDirectFallbackSections({
      language: input.language,
      basis: bases[0],
      evidenceViews: input.evidenceViews,
    });
    return {
      overview: materializeDirectSection({
        section: fallbackSections[0], basis: bases[0],
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: true,
        sectionIndex: 0,
      }),
      sections: fallbackSections.slice(1).map((section, index) => materializeDirectSection({
        section, basis: bases[0],
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: false,
        sectionIndex: index + 1,
      })),
      generationAttempts: 0,
      validationStatus: 'deterministic_fallback',
    };
  }

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
              canonicalNatalReport: input.canonicalNatalReport,
              historyContext: input.historyContext,
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
    const validation = validateFreeGeneratedForecastFeed(raw);
    if (!validation.errors.length) {
      const [rawOverview, ...rawSections] = validation.sections;
      if (!rawOverview) {
        errors = ['overview section is missing after validation'];
        continue;
      }
      const overview = materializeDirectSection({
        section: rawOverview,
        basis: bases[0],
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: true,
        sectionIndex: 0,
      });
      const sections = rawSections.map((section, index) => materializeDirectSection({
        section,
        basis: bases[index + 1] || bases[bases.length - 1],
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

  const fallbackSections = buildDirectFallbackSections({
    language: input.language,
    basis: bases[0],
    evidenceViews: input.evidenceViews,
  });
  const overview = materializeDirectSection({
    section: fallbackSections[0], basis: bases[0],
    evidenceViews: input.evidenceViews,
    language: input.language,
    overview: true,
    sectionIndex: 0,
  });
  const sections = fallbackSections.slice(1).map((section, index) => materializeDirectSection({
    section, basis: bases[0],
    evidenceViews: input.evidenceViews,
    language: input.language,
    overview: false,
    sectionIndex: index + 1,
  }));
  return {
    overview,
    sections,
    generationAttempts: 2,
    validationStatus: 'deterministic_fallback',
  };
}

export function buildCrossPeriodLinks(_input?: unknown): CrossPeriodLink[] {
  return [];
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
  const canonicalNatalReport = isNatalChartDataV2(input.chartData)
    ? buildCanonicalNatalReport(input.chartData)
    : undefined;
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
    canonicalNatalReport,
    historyContext: input.historyContext,
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

  // The model is optional. If its final materialization violates the display
  // contract, rebuild from the strongest calculated evidence only.
  const fallbackBases = buildDirectSectionBases(calculated.evidence);
  const fallbackBasis = fallbackBases[0];
  if (!fallbackBasis) throw new Error('PERSONAL_FORECAST_EVIDENCE_EMPTY');
  const fallbackSections = buildDirectFallbackSections({
    language,
    basis: fallbackBasis,
    evidenceViews: calculated.evidenceViews,
  });
  const fallbackResult: GenerationResult = {
    overview: materializeDirectSection({
      section: fallbackSections[0],
      basis: fallbackBasis,
      evidenceViews: calculated.evidenceViews,
      language,
      overview: true,
      sectionIndex: 0,
    }),
    sections: fallbackSections.slice(1).map((section, index) => materializeDirectSection({
      section,
      basis: fallbackBasis,
      evidenceViews: calculated.evidenceViews,
      language,
      overview: false,
      sectionIndex: index + 1,
    })),
    generationAttempts: generated.generationAttempts,
    validationStatus: 'deterministic_fallback',
  };
  const fallback = materializePackage(
    fallbackResult,
    `PERSONAL_FORECAST_CONTRACT_FALLBACK:${primaryValidationError}`,
  );
  const fallbackValidationError = getPersonalForecastPackageValidationError(fallback);
  if (fallbackValidationError) {
    throw new Error(
      `PERSONAL_FORECAST_DETERMINISTIC_FALLBACK_INVALID:${fallbackValidationError}`,
    );
  }
  return fallback;
}
