import type {
  ContentAccessTier,
  ContentInterpretation,
  InterpretationSection,
  InterpretationSectionKey,
  UserProfile,
  NatalAnchorReading,
  NatalFullReading,
  NatalLivingReading,
  AstroEvidenceItem,
} from '../../types';
import {
  buildNatalInterpretation,
  type NatalInterpretation,
  type NatalMeaningTopic,
} from '../natalInterpretation';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import {
  HUMAN_PAID_SECTION_META,
  type HumanPaidSectionKey,
} from '../natalHumanShared';
import {
  NATAL_PERMANENT_CONTRACT_VERSION,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
  type NatalPermanentPremiumSection,
  type NatalReadingStatement,
} from './permanentReport';
import {
  getNatalReportAnswer,
  getNatalReportCategory,
  localizeNatalReportList,
  localizeNatalReportText,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
  type NatalReportStatement,
} from './reportCatalog';
import {
  projectNatalUnifiedReadingForTier,
  type NatalUnifiedReading,
  type NatalUnifiedStoryBlock,
} from './unifiedReading';

type Language = 'ru' | 'en';

const FREE_SECTION_KEYS: readonly InterpretationSectionKey[] = [
  'base_portrait',
  'thinking',
  'reactions',
  'strengths',
  'summary',
];

const CATEGORY_TOPICS: Record<NatalReportCategoryKey, readonly NatalMeaningTopic[]> = {
  main: ['character', 'emotions', 'communication', 'relationships', 'work', 'money', 'general'],
  character: ['character', 'emotions', 'general'],
  love: ['relationships', 'home', 'emotions', 'general'],
  communication: ['communication', 'learning', 'general'],
  work: ['work', 'learning', 'general'],
  money: ['money', 'work', 'general'],
};

const HUMAN_SECTION_TOPICS: Record<HumanPaidSectionKey, readonly NatalMeaningTopic[]> = {
  inner_reactions: ['emotions', 'character', 'rest'],
  communication: ['communication', 'learning'],
  relationships_deep: ['relationships', 'home', 'emotions'],
  conflicts: ['communication', 'character', 'general'],
  work: ['work', 'learning'],
  money: ['money', 'work'],
  abilities: ['learning', 'work', 'general'],
  central_contradictions: ['character', 'general', 'emotions'],
  important_aspects: ['general', 'character', 'communication', 'relationships', 'work'],
};

const PREMIUM_CHAPTERS: ReadonlyArray<{
  id: string;
  title: Record<Language, string>;
  topics: readonly NatalMeaningTopic[];
}> = [
  { id: 'inner_world', title: { ru: 'Что ты чувствуешь', en: 'How you feel' }, topics: ['emotions', 'rest'] },
  { id: 'new_people', title: { ru: 'Как ты ведёшь себя с новыми людьми', en: 'How you act around new people' }, topics: ['character'] },
  { id: 'decisions', title: { ru: 'Как ты принимаешь решения', en: 'How you make decisions' }, topics: ['money'] },
  { id: 'communication', title: { ru: 'Как ты общаешься', en: 'How you communicate' }, topics: ['communication'] },
  { id: 'strengths', title: { ru: 'Как ты учишься новому', en: 'How you learn' }, topics: ['learning'] },
  { id: 'relationships', title: { ru: 'Отношения и семья', en: 'Relationships and family' }, topics: ['relationships', 'home', 'emotions'] },
  { id: 'work', title: { ru: 'Работа и своё дело', en: 'Work and your own business' }, topics: ['work', 'money', 'learning'] },
  { id: 'challenges', title: { ru: 'Когда всё идёт не по плану', en: 'When things do not go to plan' }, topics: ['character', 'communication', 'general'] },
];

function languageOf(profile: UserProfile): Language {
  return profile.language === 'en' ? 'en' : 'ru';
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function slug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'fact';
}

export function legacyEvidenceAlias(id: string): string | null {
  let match = /^position:([^:]+):(?:sign|house|retrograde)$/.exec(id);
  if (match) return `natal.position.${match[1]}`;
  match = /^angle:([^:]+):sign$/.exec(id);
  if (match) return `natal.angle.${match[1]}`;
  match = /^house:(\d+):cusp$/.exec(id);
  if (match) return `natal.house.${match[1]}`;
  match = /^aspect:(.+)$/.exec(id);
  if (match) return `natal.aspect.${slug(match[1])}`;
  return id.startsWith('natal.') ? id : null;
}

export function withLegacyNatalEvidenceAliases(ids: readonly string[]): string[] {
  return unique(ids.flatMap((id) => {
    const alias = legacyEvidenceAlias(id);
    return alias && alias !== id ? [id, alias] : [id];
  }));
}

function legacyOnlyEvidenceIds(ids: readonly string[]): string[] {
  return unique(ids.map(legacyEvidenceAlias).filter((id): id is string => !!id));
}

function interpretationFor(
  chart: NatalChartDataV2,
  language: Language,
): NatalInterpretation {
  return buildNatalInterpretation(chart, language);
}

function evidenceForMeaningIds(
  meaningIds: readonly string[],
  interpretation: NatalInterpretation,
): string[] {
  const byId = new Map(
    interpretation.meanings.map((meaning) => [meaning.id, meaning.evidenceIds]),
  );
  const reliable = new Set(interpretation.evidence.map(fact => fact.id));
  return unique(meaningIds.flatMap(id => byId.get(id) || (reliable.has(id.replace(/^meaning:/, '')) ? [id.replace(/^meaning:/, '')] : [])));
}

function legacyEvidenceForBlocks(
  blocks: readonly NatalUnifiedStoryBlock[],
  interpretation: NatalInterpretation,
): string[] {
  return legacyOnlyEvidenceIds(
    evidenceForMeaningIds(
      blocks.flatMap((block) => block.meaningIds),
      interpretation,
    ),
  );
}

function statementForBlock(
  block: NatalUnifiedStoryBlock,
  interpretation: NatalInterpretation,
): NatalReadingStatement {
  return {
    text: block.text.trim(),
    evidenceIds: legacyEvidenceForBlocks([block], interpretation),
  };
}

function blocksForTopics(
  reading: NatalUnifiedReading,
  topics: readonly NatalMeaningTopic[],
): NatalUnifiedStoryBlock[] {
  const wanted = new Set<NatalMeaningTopic>(topics);
  const seen = new Set<string>();
  const out: NatalUnifiedStoryBlock[] = [];
  for (const topic of reading.topics) {
    if (!wanted.has(topic.key)) continue;
    for (const block of topic.blocks) {
      const key = block.text.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(block);
    }
  }
  return out;
}

function blocksForCategory(
  reading: NatalUnifiedReading,
  categoryKey: NatalReportCategoryKey,
): NatalUnifiedStoryBlock[] {
  if (categoryKey === 'main') {
    return projectNatalUnifiedReadingForTier(reading, 'free').story;
  }
  const selected = blocksForTopics(reading, CATEGORY_TOPICS[categoryKey]);
  if (selected.length >= 3) return selected;
  const seen = new Set(selected.map((block) => block.text.trim()));
  return [
    ...selected,
    ...reading.story.filter((block) => {
      const text = block.text.trim();
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    }),
  ];
}

function ensureBlocks(
  preferred: readonly NatalUnifiedStoryBlock[],
  fallback: readonly NatalUnifiedStoryBlock[],
): NatalUnifiedStoryBlock[] {
  return preferred.length ? [...preferred] : [...fallback];
}

function legacyCatalogSummary(input: {
  blocks: readonly NatalUnifiedStoryBlock[];
  interpretation: NatalInterpretation;
  categoryKey: NatalReportCategoryKey;
  language: Language;
}): NatalReportStatement[] {
  return input.blocks.slice(0, 8).map(block => statementForBlock(block, input.interpretation));
}
function answerParagraphs(blocks: readonly NatalUnifiedStoryBlock[], interpretation: NatalInterpretation): NatalReportStatement[] {
  return blocks.slice(0, 5).map(block => statementForBlock(block, interpretation));
}

export function adaptUnifiedToLegacyFreeReport(input: {
  reading: NatalUnifiedReading;
  chart: NatalChartDataV2;
  profile: UserProfile;
}): NatalPermanentFreeReport {
  const language = languageOf(input.profile);
  const interpretation = interpretationFor(input.chart, language);
  const free = projectNatalUnifiedReadingForTier(input.reading, 'free');
  const blocks = ensureBlocks(free.story, input.reading.story);
  const freeSections: InterpretationSection[] = blocks.map((block, index) => ({
    key: FREE_SECTION_KEYS[index] || 'summary',
    title: language === 'ru' ? `О тебе · ${index + 1}` : `About you · ${index + 1}`,
    access: 'free',
    content: block.text.trim(),
    evidenceIds: legacyEvidenceForBlocks([block], interpretation),
  }));
  const first = freeSections[0];
  const hookBlocks = blocks.slice(0, Math.min(2, blocks.length));
  const hookText = hookBlocks.map((block) => block.text.trim()).join(' ');
  const hookEvidenceIds = legacyEvidenceForBlocks(hookBlocks, interpretation);
  const allEvidenceIds = legacyEvidenceForBlocks(blocks, interpretation);

  return {
    schemaVersion: 'natal-permanent-free-v3',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'free',
    evidenceIds: allEvidenceIds,
    hook: {
      text: hookText.length >= 40 ? hookText : first.content,
      evidenceIds: hookEvidenceIds.length ? hookEvidenceIds : first.evidenceIds || allEvidenceIds,
    },
    userName: input.profile.name || (language === 'ru' ? 'Ты' : 'You'),
    birthData: {
      birthDate: input.profile.birthDate || input.chart.birth.localDate,
      birthTime: input.chart.chartQuality.birthTimeQuality === 'unknown'
        ? null
        : input.profile.birthTime || input.chart.birth.localTime,
      birthPlace: input.profile.birthPlace || input.chart.birth.place,
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
      evidenceIds: first.evidenceIds || allEvidenceIds,
    },
  };
}

export function adaptUnifiedToLegacyPremiumReport(input: {
  reading: NatalUnifiedReading;
  chart: NatalChartDataV2;
  profile: UserProfile;
}): NatalPermanentPremiumReport {
  const language = languageOf(input.profile);
  const interpretation = interpretationFor(input.chart, language);
  const seen = new Set<string>();
  const sections: NatalPermanentPremiumSection[] = PREMIUM_CHAPTERS.flatMap((chapter) => {
    const blocks = blocksForTopics(input.reading, chapter.topics).filter(block => {
      const text = block.text.trim();
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    });
    if (!blocks.length) return [];
    return [{
      id: chapter.id,
      title: chapter.title[language],
      paragraphs: blocks.slice(0, Math.max(1, Math.min(4, blocks.length))).map(
        (block) => statementForBlock(block, interpretation),
      ),
    }];
  });
  if (!sections.length) throw new Error('NATAL_LEGACY_SECTION_UNAVAILABLE');
  const firstSection = sections[0];
  const lead = firstSection.paragraphs[0];
  const lastSection = sections[sections.length - 1];
  const conclusion = lastSection.paragraphs[lastSection.paragraphs.length - 1];
  const evidenceIds = unique(sections.flatMap(
    (section) => section.paragraphs.flatMap((paragraph) => paragraph.evidenceIds),
  ));

  return {
    schemaVersion: 'natal-permanent-premium-v2',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'premium',
    headline: firstSection.title,
    headlineEvidenceIds: lead.evidenceIds,
    lead,
    sections,
    strategies: [],
    pitfalls: [],
    conclusion,
    evidenceIds,
  };
}

export function adaptUnifiedToLegacyHumanSection(input: {
  reading: NatalUnifiedReading;
  chart: NatalChartDataV2;
  profile: UserProfile;
  sectionKey: HumanPaidSectionKey;
}): InterpretationSection {
  const interpretation = interpretationFor(input.chart, languageOf(input.profile));
  const meta = HUMAN_PAID_SECTION_META[input.sectionKey];
  const blocks = ensureBlocks(
    blocksForTopics(input.reading, HUMAN_SECTION_TOPICS[input.sectionKey]),
    input.reading.story,
  );
  return {
    key: input.sectionKey,
    title: meta.title,
    subtitle: meta.subtitle,
    access: 'paid',
    content: blocks.slice(0, 4).map((block) => block.text.trim()).join('\n\n'),
    evidenceIds: legacyEvidenceForBlocks(blocks.slice(0, 4), interpretation),
  };
}

export function adaptUnifiedToLegacyCatalogCategory(input: {
  reading: NatalUnifiedReading;
  chart: NatalChartDataV2;
  profile: UserProfile;
  categoryKey: NatalReportCategoryKey;
}): NatalReportCategoryPack {
  const language = languageOf(input.profile);
  const interpretation = interpretationFor(input.chart, language);
  const category = getNatalReportCategory(input.categoryKey);
  if (!category) throw new Error(`Unknown legacy natal category: ${input.categoryKey}`);
  const blocks = blocksForCategory(input.reading, input.categoryKey);
  const summary = legacyCatalogSummary({
    blocks,
    interpretation,
    categoryKey: input.categoryKey,
    language,
  });
  const storyBlocks = blocks.slice(0, 2);
  const story: NatalReportStatement = {
    text: storyBlocks.map((block) => block.text.trim()).join(' '),
    evidenceIds: legacyEvidenceForBlocks(storyBlocks, interpretation),
  };

  return {
    schemaVersion: 'natal-report-category-v1',
    contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
    categoryKey: input.categoryKey,
    title: localizeNatalReportText(category.title, language),
    summary,
    story,
    observations: [],
    previews: [],
    freeAnswers: [],
  };
}

export function adaptUnifiedToLegacyCatalogAnswer(input: {
  reading: NatalUnifiedReading;
  chart: NatalChartDataV2;
  profile: UserProfile;
  answerKey: NatalReportAnswerKey;
}): NatalReportAnswer {
  const language = languageOf(input.profile);
  const interpretation = interpretationFor(input.chart, language);
  const definition = getNatalReportAnswer(input.answerKey);
  if (!definition) throw new Error(`Unknown legacy natal answer: ${input.answerKey}`);
  const blocks = blocksForCategory(input.reading, definition.categoryKey);
  const paragraphs = answerParagraphs(blocks, interpretation);
  return {
    schemaVersion: 'natal-report-answer-v1',
    contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
    answerKey: input.answerKey,
    categoryKey: definition.categoryKey,
    title: localizeNatalReportText(definition.title, language),
    access: definition.access,
    paragraphs,
    evidenceIds: unique(paragraphs.flatMap((paragraph) => paragraph.evidenceIds)),
    related: definition.related,
    fullAnswerIncludes: localizeNatalReportList(definition.fullAnswerIncludes, language),
  };
}

export function legacyInterpretationEnvelope<T>(
  source: ContentInterpretation<NatalUnifiedReading>,
  content: T,
  accessTier: Extract<ContentAccessTier, 'free' | 'premium'>,
): ContentInterpretation<T> {
  return {
    ...source,
    accessTier,
    modelTier: accessTier === 'free' ? 'base' : 'premium',
    content,
    legacySource: 'natal_unified_compat_v1',
  };
}

/** Used by tests and compatibility diagnostics to prove no second writer exists. */
export const NATAL_LEGACY_COMPATIBILITY_SOURCE = 'natal-unified-compat-v1';

function legacyTechnicalEvidence(chart: NatalChartDataV2, language: Language): AstroEvidenceItem[] {
  const interpretation = interpretationFor(chart, language);
  return interpretation.meanings.map(meaning => {
    const fact = interpretation.evidence.find(item => item.id === meaning.evidenceIds[0])!;
    return { id: fact.id, type: fact.kind === 'aspect' ? 'aspect' : fact.kind === 'house_cusp' ? 'house' : 'placement',
      label: meaning.technicalText, detail: meaning.technicalText, humanMeaning: meaning.text };
  });
}

export function adaptUnifiedToLegacyAnchor(reading: NatalUnifiedReading, language: Language, chart: NatalChartDataV2): NatalAnchorReading {
  const story = projectNatalUnifiedReadingForTier(reading, 'free').story;
  const lead = story[0].text;
  const sections = story.slice(1).map(block => ({
    id: block.id, title: '', subtitle: '', body: block.text, examples: [], astroSource: '',
    evidenceIds: evidenceForMeaningIds(block.meaningIds, interpretationFor(chart, language)),
  }));
  return { headline: language === 'ru' ? 'О тебе' : 'About you', lead, sections,
    dictionaryTerms: [], astroEvidence: legacyTechnicalEvidence(chart, language), summary: lead, reading: story.map(block => block.text).join('\n\n') };
}

export function adaptUnifiedToLegacyFull(reading: NatalUnifiedReading, language: Language, chart: NatalChartDataV2): NatalFullReading {
  const sections = reading.topics.map(topic => ({ id: topic.key, title: topic.title, subtitle: '',
    body: topic.blocks.map(block => block.text).join('\n\n'), examples: [], astroSource: '',
    evidenceIds: evidenceForMeaningIds(topic.blocks.flatMap(block => block.meaningIds), interpretationFor(chart, language)),
  }));
  return { headline: language === 'ru' ? 'Разбор карты' : 'Your reading', lead: reading.story[0].text,
    sections, synthesis: reading.story.slice(1).map(block => block.text).join('\n\n'), astroEvidence: legacyTechnicalEvidence(chart, language) };
}

export function adaptUnifiedToLegacyLiving(reading: NatalUnifiedReading, language: Language, periodKey: string, chart: NatalChartDataV2): NatalLivingReading {
  const topicText = (keys: NatalMeaningTopic[]) => blocksForTopics(reading, keys).map(block => block.text).join('\n\n');
  return { periodKey, headline: language === 'ru' ? 'О тебе' : 'About you', summary: reading.story[0].text,
    whyToday: '', situations: reading.story.slice(1).map(block => ({ title: '', body: block.text })),
    relationships: topicText(['relationships', 'home']), workMoney: topicText(['work', 'money']),
    evening: '', questionOfDay: '', astroEvidence: legacyTechnicalEvidence(chart, language) };
}
