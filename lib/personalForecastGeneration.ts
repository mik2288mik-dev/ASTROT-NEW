import OpenAI from 'openai';
import type { NatalChartData, UserProfile } from '../types';
import type { AstrologyHistoryContext } from './astrologyHistoryStore';
import {
  APP_VOICE_VERSION,
  getAppSystemVoice,
  hasAppVoiceViolation,
} from './appVoice';
import { buildOpenAIChatParams } from './openaiChat';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  formatPersonalForecastDateLabel,
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
  compilePersonalForecastSemanticFacts,
  type ForecastClaimAtom,
  type ForecastSemanticFact,
} from './personalForecastSemantics';
import {
  forecastAtomText,
  forecastSemanticTitle,
  forecastSemanticVisualTag,
  type ForecastWriterLanguage,
} from './personalForecastSemanticLanguage';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS = 2;
const MAX_SEMANTIC_SECTIONS = 4;

type PlannedBlock = {
  id: string;
  role: ForecastContentBlockRole;
  semanticFactId: string;
  atomId: string;
  writerBrief: string;
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
};

type GeneratedSectionPayload = {
  id?: unknown;
  blocks?: unknown;
};

type GeneratedFeedPayload = {
  sections?: unknown;
};

type ValidatedWriterResult = {
  blocksBySectionId: Map<string, ForecastContentBlock[]>;
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
  /\b(?:солнце|луна|меркурий|венера|марс|юпитер|сатурн|уран|нептун|плутон|аспект|транзит|дом)\b/iu,
  /\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|aspect|transit|house)\b/iu,
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
  return overlap >= 1 && overlap / candidate.size >= 0.45;
}

function block(
  planId: string,
  role: ForecastContentBlockRole,
  fact: ForecastSemanticFact,
  atomId: string,
  language: ForecastWriterLanguage,
  index: number,
): PlannedBlock | null {
  const writerBrief = forecastAtomText(role, atomId, language).trim();
  if (!writerBrief) return null;
  return {
    id: `${planId}:${role}:${index + 1}`,
    role,
    semanticFactId: fact.id,
    atomId,
    writerBrief,
  };
}

function factBlocks(
  planId: string,
  fact: ForecastSemanticFact,
  language: ForecastWriterLanguage,
): PlannedBlock[] {
  const primaryManifestation = fact.allowedManifestationAtoms[0];
  const contextualManifestation = fact.lifeContext
    ? fact.allowedManifestationAtoms.at(-1)
    : undefined;
  const dynamicClaimByMechanism: Partial<Record<
    ForecastSemanticFact['mechanism']['dynamic'],
    ForecastClaimAtom
  >> = {
    concentration: 'temporary_focus_is_concentrated',
    opening: 'temporary_support_is_available',
    flow: 'temporary_support_is_available',
    friction: 'temporary_friction_requires_precision',
    polarization: 'two_sides_temporarily_require_balance',
    ongoing_activation: 'house_context_is_temporarily_active',
    sign_transition: 'context_is_entering_a_new_phase',
    station_turn_direct: 'process_is_turning_direct',
    station_turn_retrograde: 'process_is_turning_retrograde',
    station_pause: 'process_is_near_a_station',
    new_cycle: 'attention_cycle_is_beginning',
    culmination: 'attention_cycle_is_culminating',
    low_signal: 'ordinary_priorities_can_remain_in_place',
  };
  const expectedDynamicClaim = dynamicClaimByMechanism[fact.mechanism.dynamic];
  const dynamicClaim = expectedDynamicClaim
    && fact.allowedClaimAtoms.includes(expectedDynamicClaim)
    ? expectedDynamicClaim
    : undefined;
  const candidates: Array<[ForecastContentBlockRole, string | undefined]> = [
    ['lead', dynamicClaim],
    ['detail', contextualManifestation || primaryManifestation],
    ['risk', fact.allowedRiskAtoms[0]],
    ['action', fact.allowedActionAtoms[0]],
  ];
  if (fact.mechanism.dynamic === 'low_signal') {
    return candidates
      .filter(([role]) => role === 'lead' || role === 'action')
      .map(([role, atomId], index) => (
        atomId ? block(planId, role, fact, atomId, language, index) : null
      ))
      .filter((value): value is PlannedBlock => !!value);
  }
  return candidates
    .map(([role, atomId], index) => (
      atomId ? block(planId, role, fact, atomId, language, index) : null
    ))
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

  const usedOverviewAtoms = new Set<string>();
  const overviewEntries: Array<{ fact: ForecastSemanticFact; atomId: string }> = [];
  for (const fact of selected.slice(0, Math.min(2, selected.length))) {
    const atomId = fact.allowedClaimAtoms.find((candidate) => (
      !usedOverviewAtoms.has(candidate)
    ));
    if (!atomId) continue;
    usedOverviewAtoms.add(atomId);
    overviewEntries.push({ fact, atomId });
  }
  const overviewFacts = overviewEntries.map((entry) => entry.fact);
  const overviewBlocks = overviewEntries
    .map(({ fact, atomId }, index) => block(
      'overview',
      'lead',
      fact,
      atomId,
      input.language,
      index,
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

export function buildPersonalForecastFeedPrompt(input: {
  language: ForecastWriterLanguage;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  overviewPlan: ForecastSectionPlan;
  sectionPlans: ForecastSectionPlan[];
  historyContext?: AstrologyHistoryContext | null;
  repairErrors?: string[];
}): string {
  const plans = [input.overviewPlan, ...input.sectionPlans].map((plan) => ({
    id: plan.id,
    title: plan.title || null,
    semantic_facts: plan.facts.map((fact) => ({
      id: fact.id,
      domain: fact.domain,
      life_context: fact.lifeContext,
      timing: fact.timing,
      confidence: fact.confidence,
      forbidden_claim_classes: fact.forbiddenClaimClasses,
    })),
    required_blocks: plan.blocks.map((item) => ({
      id: item.id,
      role: item.role,
      semantic_fact_id: item.semanticFactId,
      atom_id: item.atomId,
      exact_meaning_to_rephrase: item.writerBrief,
    })),
  }));
  const repair = input.repairErrors?.length
    ? `\nPREVIOUS RESPONSE ERRORS (fix these only):\n${input.repairErrors.join('\n')}`
    : '';
  return `You are the final copy editor, not the astrologer and not the calculator.

Write in ${input.language === 'ru' ? 'Russian, addressing the reader as "ты"' : 'English, addressing the reader as "you"'}.
Period: ${input.period}. Window: ${input.window.periodStart} — ${input.window.periodEnd}.

Hard rules:
- Return JSON only: {"sections":[{"id":"...","blocks":[{"id":"...","role":"...","semantic_fact_id":"...","atom_id":"...","text":"..."}]}]}.
- Return every supplied section and block exactly once. Echo every id, role, semantic_fact_id, and atom_id exactly.
- Rephrase only exact_meaning_to_rephrase. Do not add a fact, life area, event, motive, biography, or prediction.
- Keep the concrete nouns and verbs from exact_meaning_to_rephrase; at least half of the content words in your block must come from that supplied meaning.
- A forecast is temporary. Never turn it into personality: no "you always", "you never", "you are the kind of person" or equivalents.
- Do not name planets, aspects, houses, transits, degrees, or calculation terms in the main text.
- Do not predict a relocation, breakup, dismissal, pregnancy, diagnosis, income, purchase, or any other specific event.
- Keep each block to one or two short sentences, 25–240 characters. Plain text only; no markdown, lists, headings, slogans, or filler.
- Explicit history may only sharpen wording inside the supplied semantic domain. It cannot create a new domain or fact.

Approved semantic writing plan:
${JSON.stringify(plans, null, 2)}

Bounded non-generative history context:
${JSON.stringify(safeHistoryContext(input.historyContext), null, 2)}${repair}`;
}

function generatedTextValid(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length >= 25
    && trimmed.length <= 240
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

function deterministicBlocks(plan: ForecastSectionPlan): ForecastContentBlock[] {
  return plan.blocks.map((item, index) => ({
    id: item.id,
    role: item.role,
    text: item.writerBrief,
    semanticFactId: item.semanticFactId,
    atomId: item.atomId,
    explanationAnchorId: index === 0 ? `anchor:${plan.id}` : null,
  }));
}

function evidenceForPlan(
  plan: ForecastSectionPlan,
  evidenceViews: Record<string, ForecastEvidenceView>,
): ForecastEvidenceView[] {
  const ids = new Set(plan.facts.flatMap((fact) => fact.evidenceIds));
  return [...ids]
    .map((id) => evidenceViews[id])
    .filter((item): item is ForecastEvidenceView => !!item)
    .slice(0, 4);
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
    .slice(0, 220)
    .trim();
  if (explanation.length < 40) return [];
  return [{
    id: `anchor:${plan.id}`,
    conclusion: blocks[0].text.slice(0, 220),
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

function materializeSection(input: {
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

async function requestGeneratedFeed(input: {
  language: ForecastWriterLanguage;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  overviewPlan: ForecastSectionPlan;
  sectionPlans: ForecastSectionPlan[];
  evidenceViews: Record<string, ForecastEvidenceView>;
  historyContext?: AstrologyHistoryContext | null;
}): Promise<GenerationResult> {
  if (!openai) {
    const overviewBlocks = deterministicBlocks(input.overviewPlan);
    return {
      overview: materializeSection({
        plan: input.overviewPlan,
        blocks: overviewBlocks,
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: true,
      }),
      sections: input.sectionPlans.map((plan) => materializeSection({
        plan,
        blocks: deterministicBlocks(plan),
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: false,
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
    try {
      const response = await openai.chat.completions.create(buildOpenAIChatParams(input.model, {
        messages: [
          { role: 'system', content: getAppSystemVoice(input.language) },
          {
            role: 'user',
            content: buildPersonalForecastFeedPrompt({
              language: input.language,
              period: input.period,
              window: input.window,
              overviewPlan: input.overviewPlan,
              sectionPlans: input.sectionPlans,
              historyContext: input.historyContext,
              repairErrors: attempt === 2 ? errors : undefined,
            }),
          },
        ],
        maxTokens: 2600,
        temperature: 0.35,
        jsonMode: true,
      }));
      content = response.choices[0]?.message?.content?.trim() || '';
    } catch {
      errors = ['writer request failed'];
      continue;
    }
    let raw: GeneratedFeedPayload;
    try {
      raw = JSON.parse(content) as GeneratedFeedPayload;
    } catch {
      errors = ['response is not valid JSON'];
      continue;
    }
    const validation = validateGeneratedForecastFeed({
      raw,
      overviewPlan: input.overviewPlan,
      sectionPlans: input.sectionPlans,
    });
    if (!validation.errors.length) {
      const overviewBlocks = validation.blocksBySectionId.get(input.overviewPlan.id);
      if (!overviewBlocks) {
        errors = ['overview blocks are missing after validation'];
        continue;
      }
      const sections = input.sectionPlans.map((plan) => {
        const blocks = validation.blocksBySectionId.get(plan.id);
        if (!blocks) throw new Error(`PERSONAL_FORECAST_VALIDATED_SECTION_MISSING:${plan.id}`);
        return materializeSection({
          plan,
          blocks,
          evidenceViews: input.evidenceViews,
          language: input.language,
          overview: false,
        });
      });
      const overview = materializeSection({
        plan: input.overviewPlan,
        blocks: overviewBlocks,
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: true,
      });
      const repetitionErrors = validateForecastSectionRepetition([overview, ...sections]);
      if (repetitionErrors.length) {
        errors = repetitionErrors;
        continue;
      }
      return {
        overview,
        sections,
        generationAttempts: attempt as 1 | 2,
        validationStatus: 'valid',
      };
    }
    errors = validation.errors;
  }

  const overview = materializeSection({
    plan: input.overviewPlan,
    blocks: deterministicBlocks(input.overviewPlan),
    evidenceViews: input.evidenceViews,
    language: input.language,
    overview: true,
  });
  const sections = input.sectionPlans.map((plan) => materializeSection({
    plan,
    blocks: deterministicBlocks(plan),
    evidenceViews: input.evidenceViews,
    language: input.language,
    overview: false,
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
  onEvidenceCalculated?: (payload: {
    calculated: EvidenceCalculationResult;
    semanticFacts: ForecastSemanticFact[];
  }) => Promise<EvidenceCalculatedHookResult>;
}): Promise<PersonalForecastPackage> {
  const language: ForecastWriterLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const calculated = await calculatePersonalForecastEvidence({
    chartData: input.chartData,
    period: input.period,
    window: input.window,
    language,
  });
  const semanticFacts = compilePersonalForecastSemanticFacts({
    evidence: calculated.evidence,
    period: input.period,
    chartData: input.chartData,
    language,
  });
  if (input.onEvidenceCalculated) {
    await input.onEvidenceCalculated({ calculated, semanticFacts });
  }
  const plans = buildPersonalForecastSectionPlans({
    facts: semanticFacts,
    period: input.period,
    language,
  });
  const generated = await requestGeneratedFeed({
    language,
    model: input.model,
    period: input.period,
    window: input.window,
    overviewPlan: plans.overview,
    sectionPlans: plans.sections,
    evidenceViews: calculated.evidenceViews,
    historyContext: input.historyContext,
  });
  const freeSelection = input.period === 'day'
    ? selectTodayFreeSections({
        sections: generated.sections,
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
    overview: generated.overview,
    sections: generated.sections,
    suggestedCrossPeriodLinks: [],
    evidence: calculated.evidenceViews,
    visual: {
      sectionAssetIds: Object.fromEntries(
        [generated.overview, ...generated.sections].map((section) => [section.id, null]),
      ),
    },
    meta: {
      model: input.model,
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      semanticVersion: PERSONAL_FORECAST_SEMANTICS_VERSION,
      contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      generationAttempts: generated.generationAttempts,
      validationStatus: generated.validationStatus,
      generatedAt: new Date().toISOString(),
      status: 'ready',
      diagnosticCode: null,
      freeSelection,
    },
  };
}
