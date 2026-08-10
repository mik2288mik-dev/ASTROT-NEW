import { createHash } from 'crypto';
import type {
  InterpretationSection,
  NatalChartData,
  NatalInterpretationReport,
  UserProfile,
} from '../types';
import { llmJson } from './anthropic';
import { APP_VOICE_VERSION, getAppSystemVoice } from './appVoice';
import {
  HUMAN_PAID_SECTION_META,
  buildLockedPaidSections,
  type HumanPaidSectionKey,
} from './natalHumanShared';
import {
  NATAL_SEMANTIC_VERSION,
  buildNatalSectionFallbackContent,
  compileNatalSemantics,
  deterministicNatalBlocks,
  natalPromptPayload,
  validateGeneratedNatalPayload,
  type GeneratedNatalPayload,
  type NatalSemanticCompilation,
  type NatalSemanticSectionPlan,
  type ValidatedNatalBlock,
} from './natalSemanticCompiler';
import { buildPersonalForecastChartFingerprint } from './personalForecastContract';

type Locale = 'ru' | 'en';

// Rendering adapter only: the model chooses its own sections, while the legacy
// report contract still needs stable client keys.
const MATERIALIZED_NATAL_KEYS: InterpretationSection['key'][] = [
  'base_portrait', 'thinking', 'reactions', 'love_relationships', 'work_money', 'strengths', 'difficulties',
];

type DirectNatalPayload = {
  sections?: Array<{
    id?: unknown;
    title?: unknown;
    blocks?: Array<{ text?: unknown; evidence_ids?: unknown }>;
  }>;
};

function directBaseFallback(profile: UserProfile, chart: NatalChartData): NatalInterpretationReport {
  const language: Locale = profile.language === 'en' ? 'en' : 'ru';
  const emptySection: InterpretationSection = ({
    key: 'base_portrait',
    title: language === 'ru' ? 'Твоя карта' : 'Your chart',
    subtitle: '', access: 'free', isLocked: false, teaser: '',
    content: language === 'ru' ? 'Расчёт карты готов; текстовый разбор временно недоступен.' : 'The chart calculation is ready; the written reading is temporarily unavailable.',
    bullets: [], evidenceIds: [], ctaLabel: '',
  });
  const freeSections = [emptySection];
  return {
    userName: profile.name || (language === 'en' ? 'friend' : 'друг'),
    birthData: { birthDate: profile.birthDate || '', birthTime: profile.birthTime || null, birthPlace: profile.birthPlace || '' },
    calculatedAt: new Date().toISOString(),
    freeSections,
    paidSections: buildLockedPaidSections(), premiumSections: [],
    shortCard: { title: language === 'en' ? 'Your chart' : 'Твоя карта', keywords: [], text: freeSections[0].content, advice: '', evidenceIds: [] },
  };
}

function directBasePrompt(language: Locale, chart: NatalChartData): string {
  const languageRule = language === 'ru' ? 'Write in Russian and address the reader as «ты».' : 'Write in English and address the reader as "you".';
  return `You are an astrologer writing a natal reading from calculated chart data. ${languageRule}

Return JSON only: {"sections":[{"id":"...","title":"...","blocks":[{"text":"...","evidence_ids":["..."]}]}]}.
Return 2 to 7 sections, with one to three concise blocks each. You choose the section count, titles, order, and important links yourself from the supplied calculation. Do not invent placements, events, biography, diagnoses, or promises. Keep technical astrology out of prose. evidence_ids must refer only to existing calculated data paths or point names.

DIRECT CALCULATED NATAL CHART (authoritative; do not recalculate):
${JSON.stringify(chart, null, 2)}`;
}

function materializeDirectBaseReport(
  raw: DirectNatalPayload,
  fallback: NatalInterpretationReport,
): { report: NatalInterpretationReport; valid: boolean } {
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  if (sections.length < 2 || sections.length > 7) return { report: fallback, valid: false };
  const freeSections: InterpretationSection[] = [];
  for (const [index, source] of sections.entries()) {
    const blocks = Array.isArray(source?.blocks) ? source.blocks : [];
    const text = blocks.map((block) => typeof block?.text === 'string' ? block.text.trim() : '').filter((value) => value.length >= 15).join('\n\n');
    if (!text) return { report: fallback, valid: false };
    const evidenceIds = blocks.flatMap((block) => Array.isArray(block?.evidence_ids) ? block.evidence_ids : [])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    freeSections.push({
      key: MATERIALIZED_NATAL_KEYS[index] || 'base_portrait',
      title: typeof source?.title === 'string' && source.title.trim() ? source.title.trim().slice(0, 120) : '',
      subtitle: '', access: 'free', isLocked: false, teaser: '', content: text, bullets: [], evidenceIds: [...new Set(evidenceIds)], ctaLabel: '',
    });
  }
  return {
    valid: true,
    report: {
      ...fallback,
      freeSections,
      shortCard: { title: freeSections[0].title, keywords: [], text: freeSections[0].content.split(/\n\n+/u)[0], advice: freeSections.at(-1)?.content.split(/\n\n+/u)[0] || '', evidenceIds: freeSections[0].evidenceIds },
    },
  };
}

export function buildHumanInputHash(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  sectionKey?: string;
  dateKey?: string;
  promptVersion: string;
  locale?: Locale;
}): string {
  return createHash('sha256').update(JSON.stringify({
    userId: input.profile.id || null,
    language: input.profile.language === 'en' ? 'en' : 'ru',
    chartFingerprint: buildPersonalForecastChartFingerprint(input.chartData),
    chartCalculationVersion: input.chartData.calculationVersion || null,
    semanticVersion: NATAL_SEMANTIC_VERSION,
    sectionKey: input.sectionKey || 'base',
    dateKey: input.dateKey || null,
    promptVersion: input.promptVersion,
    voiceVersion: APP_VOICE_VERSION,
  })).digest('hex');
}

function sectionFromPlan(
  plan: NatalSemanticSectionPlan,
  access: 'free' | 'paid',
  blocks: ValidatedNatalBlock[] = deterministicNatalBlocks(plan),
): InterpretationSection {
  return {
    key: plan.key,
    title: plan.title,
    subtitle: plan.facts.map((fact) => fact.label).slice(0, 2).join(' · '),
    access,
    isLocked: false,
    teaser: access === 'paid' ? HUMAN_PAID_SECTION_META[plan.key as HumanPaidSectionKey]?.teaser || '' : '',
    content: blocks.map((block) => block.text).join('\n\n') || buildNatalSectionFallbackContent(plan),
    bullets: [],
    evidenceIds: [...new Set(blocks.map((block) => block.evidenceId))],
    ctaLabel: '',
  };
}

function deterministicShortCard(
  language: Locale,
  sections: InterpretationSection[],
  compilation: NatalSemanticCompilation,
): NatalInterpretationReport['shortCard'] {
  const portrait = sections.find((section) => section.key === 'base_portrait') || sections[0];
  const difficulty = sections.find((section) => section.key === 'difficulties') || sections.at(-1)!;
  const portraitPlan = compilation.sections.find((section) => section.key === 'base_portrait') || compilation.sections[0];
  return {
    title: language === 'en' ? 'The main point' : 'Коротко о главном',
    keywords: portraitPlan.facts.map((fact) => fact.label).slice(0, 4),
    text: portrait?.content.split(/\n\n+/u)[0] || '',
    advice: difficulty?.content.split(/\n\n+/u)[0] || '',
    evidenceIds: portrait?.evidenceIds || portraitPlan.evidenceIds,
  };
}

export function buildHumanBaseFallback(
  profile: UserProfile,
  chart: NatalChartData,
): NatalInterpretationReport {
  return directBaseFallback(profile, chart);
  /*
  const language: Locale = profile.language === 'en' ? 'en' : 'ru';
  const compilation = compileNatalSemantics(chart, 'free', language);
  const freeSections = compilation.sections.map((plan) => sectionFromPlan(plan, 'free'));
  return {
    userName: profile.name || (language === 'en' ? 'friend' : 'друг'),
    birthData: {
      birthDate: profile.birthDate || '',
      birthTime: profile.birthTime || null,
      birthPlace: profile.birthPlace || '',
    },
    calculatedAt: new Date().toISOString(),
    freeSections,
    paidSections: buildLockedPaidSections(),
    premiumSections: [],
    shortCard: deterministicShortCard(language, freeSections, compilation),
  };
  */
}

export function buildHumanPaidFallback(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanPaidSectionKey,
): InterpretationSection {
  const language: Locale = profile.language === 'en' ? 'en' : 'ru';
  const compilation = compileNatalSemantics(chart, 'premium', language);
  const plan = compilation.sections.find((section) => section.key === key);
  if (!plan) throw new Error(`Natal semantic plan is missing section: ${key}`);
  return sectionFromPlan(plan, 'paid');
}

function materializeBaseReport(
  raw: GeneratedNatalPayload,
  fallback: NatalInterpretationReport,
  compilation: NatalSemanticCompilation,
): NatalInterpretationReport {
  const validation = validateGeneratedNatalPayload({
    raw,
    plans: compilation.sections,
    reliability: compilation.reliability,
  });
  if (validation.errors.length > 0) return fallback;
  const freeSections = compilation.sections.map((plan) => {
    const blocks = validation.blocksBySectionId.get(plan.key);
    return blocks ? sectionFromPlan(plan, 'free', blocks) : sectionFromPlan(plan, 'free');
  });
  return {
    ...fallback,
    freeSections,
    shortCard: deterministicShortCard(compilation.language, freeSections, compilation),
    paidSections: buildLockedPaidSections(),
    premiumSections: [],
  };
}

function writerPrompt(
  compilation: NatalSemanticCompilation,
  plans: NatalSemanticSectionPlan[],
): string {
  const language = compilation.language;
  const productRule = compilation.tier === 'free'
    ? language === 'ru'
      ? 'Это законченный базовый натальный разбор из семи разных разделов, а не тизер.'
      : 'This is a complete seven-section base natal reading, not a teaser.'
    : language === 'ru'
      ? 'Это отдельная глубокая глава Premium. Не повторяй базовый раздел и не увеличивай объём повтором.'
      : 'This is a separate deep Premium chapter. Do not repeat or pad the base reading.';
  const languageRule = language === 'ru'
    ? 'Пиши по-русски, обращайся на «ты».'
    : 'Write in English and address the reader as “you”.';
  return `You are the final copy editor, not the astrologer or calculator.

${languageRule}
${productRule}

Hard rules:
- Return JSON only: {"sections":[{"id":"...","blocks":[{"id":"...","role":"...","semantic_fact_id":"...","evidence_id":"...","text":"..."}]}]}.
- Return every supplied section and block exactly once and in the supplied order.
- Echo every section id, block id, role, semantic_fact_id, and evidence_id exactly.
- Rephrase only exactMeaningToRephrase. Do not add another fact, life sphere, biography, trauma, profession, event, diagnosis, relationship history, or promised outcome.
- The same semantic_fact_id may support several relevant chapters. Follow each block's section-specific meaning and never reuse the same sentence or paragraph in another chapter.
- Preserve the concrete meaning: at least 45% of the content words in each block must come from its approved meaning.
- Keep each block to one or two short sentences, 25-520 characters. Plain text only; no markdown, headings, bullets, slogans, or filler.
- Technical basis stays outside the main prose. Do not name planets, signs, aspects, houses, Ascendant, or MC in text.
- Never manufacture a block for a section that has no supplied strong fact. Empty block plans stay empty.

AUTHORITATIVE SEMANTIC WRITING PLAN:
${JSON.stringify(natalPromptPayload({ ...compilation, sections: plans }), null, 2)}`;
}

export async function generateHumanBaseReport(
  profile: UserProfile,
  chart: NatalChartData,
  options?: {
    onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number }) => void;
    onValidation?: (passed: boolean) => void;
  },
): Promise<NatalInterpretationReport> {
  const language: Locale = profile.language === 'en' ? 'en' : 'ru';
  const fallback = directBaseFallback(profile, chart);
  const raw = await llmJson<DirectNatalPayload>({
    system: getAppSystemVoice(language),
    user: directBasePrompt(language, chart),
    model: {
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'brief',
    },
    maxTokens: 2400,
    temperature: 0.25,
    onMetrics: options?.onMetrics,
  });
  const materialized = materializeDirectBaseReport(raw, fallback);
  options?.onValidation?.(materialized.valid);
  return materialized.report;
}

export async function generateHumanPaidSection(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanPaidSectionKey,
): Promise<InterpretationSection> {
  const language: Locale = profile.language === 'en' ? 'en' : 'ru';
  const compilation = compileNatalSemantics(chart, 'premium', language);
  const plan = compilation.sections.find((section) => section.key === key);
  if (!plan) throw new Error(`Natal semantic plan is missing section: ${key}`);
  const fallback = sectionFromPlan(plan, 'paid');
  const raw = await llmJson<GeneratedNatalPayload>({
    system: getAppSystemVoice(language),
    user: writerPrompt(compilation, [plan]),
    model: {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'full',
    },
    maxTokens: 1100,
    temperature: 0.25,
  });
  const validation = validateGeneratedNatalPayload({
    raw,
    plans: [plan],
    reliability: compilation.reliability,
  });
  const blocks = validation.errors.length === 0
    ? validation.blocksBySectionId.get(plan.key)
    : null;
  return blocks ? sectionFromPlan(plan, 'paid', blocks) : fallback;
}
