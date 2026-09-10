import type { InterpretationSection } from '../../types';
import type {
  NatalPermanentFreeReport,
  NatalPermanentPremiumReport,
  NatalPermanentPremiumSection,
  NatalReaderChapterKey,
  NatalReadingStatement,
} from './permanentReport';
import { NATAL_READER_CHAPTERS } from './permanentReport';

export type NatalTopicKey = NatalReaderChapterKey;

export type NatalTopicAccessState = 'open' | 'locked' | 'premium';

type LocalizedText = {
  ru: string;
  en: string;
};

type NatalTopicDefinition = {
  key: NatalTopicKey;
  title: LocalizedText;
  description: LocalizedText;
  freeSectionKey?: InterpretationSection['key'];
  related: readonly NatalTopicKey[];
};

const TOPIC_DEFINITIONS: readonly NatalTopicDefinition[] = [
  {
    key: 'inner_world',
    title: { ru: 'Что у тебя внутри', en: 'What is going on inside you' },
    description: {
      ru: 'Что ты переживаешь глубже, чем показываешь, и как это видно в обычных реакциях.',
      en: 'What runs deeper than you show and how it appears in everyday reactions.',
    },
    freeSectionKey: 'base_portrait',
    related: ['new_people', 'communication', 'relationships', 'strengths'],
  },
  {
    key: 'new_people',
    title: { ru: 'Как тебя видят', en: 'How people see you' },
    description: {
      ru: 'Как тебя считывают при знакомстве и почему первое впечатление бывает неточным.',
      en: 'How people read you at first and why their first impression can be incomplete.',
    },
    freeSectionKey: 'how_others_see_you',
    related: ['communication', 'relationships', 'challenges', 'inner_world'],
  },
  {
    key: 'decisions',
    title: { ru: 'Как ты принимаешь решения', en: 'How you make decisions' },
    description: {
      ru: 'Как ты выбираешь между вариантами и почему решение иногда затягивается.',
      en: 'How you choose between options and why a decision can sometimes take longer.',
    },
    freeSectionKey: 'thinking',
    related: ['inner_world', 'work', 'challenges', 'strengths'],
  },
  {
    key: 'communication',
    title: { ru: 'Как ты общаешься', en: 'How you communicate' },
    description: {
      ru: 'Как ты объясняешь свою позицию, слушаешь и отвечаешь в споре.',
      en: 'How you explain your position, listen, and respond in a disagreement.',
    },
    freeSectionKey: 'communication',
    related: ['new_people', 'relationships', 'challenges', 'decisions'],
  },
  {
    key: 'strengths',
    title: { ru: 'Сильные стороны', en: 'Your strengths' },
    description: {
      ru: 'В каких задачах твои сильные качества дают заметный результат.',
      en: 'The tasks where your strongest qualities produce a visible result.',
    },
    freeSectionKey: 'strengths',
    related: ['work', 'decisions', 'challenges', 'inner_world'],
  },
  {
    key: 'relationships',
    title: { ru: 'Отношения и семья', en: 'Relationships and family' },
    description: {
      ru: 'Как ты сближаешься, доверяешь и чего ждёшь от близких.',
      en: 'How you grow close, build trust, and what you expect from people close to you.',
    },
    related: ['new_people', 'communication', 'challenges', 'inner_world'],
  },
  {
    key: 'work',
    title: { ru: 'Работа и своё дело', en: 'Work and your own business' },
    description: {
      ru: 'Какой темп, ответственность и степень свободы подходят тебе в работе.',
      en: 'The pace, responsibility, and degree of freedom that suit you at work.',
    },
    related: ['strengths', 'decisions', 'challenges', 'inner_world'],
  },
  {
    key: 'challenges',
    title: { ru: 'Когда всё идёт не по плану', en: 'When things do not go to plan' },
    description: {
      ru: 'Как ты реагируешь, когда планы меняются, на тебя давят или понимают не так.',
      en: 'How you respond when plans change, pressure rises, or people misunderstand you.',
    },
    related: ['inner_world', 'communication', 'decisions', 'relationships'],
  },
] as const;

const TOPIC_DEFINITION_COMPLETENESS = {
  inner_world: true,
  new_people: true,
  decisions: true,
  communication: true,
  strengths: true,
  relationships: true,
  work: true,
  challenges: true,
} as const satisfies Record<NatalTopicKey, true>;

export const NATAL_TOPIC_KEYS = NATAL_READER_CHAPTERS.map((chapter) => chapter.key);
export const NATAL_TOPIC_DEFINITION_KEYS = TOPIC_DEFINITIONS.map((topic) => topic.key);
const TOPIC_KEYS = new Set<NatalTopicKey>(
  NATAL_TOPIC_KEYS.filter((key) => TOPIC_DEFINITION_COMPLETENESS[key]),
);
const PREFERRED_FREE_TOPICS: readonly NatalTopicKey[] = ['new_people', 'strengths'];

export function isNatalTopicKey(value: unknown): value is NatalTopicKey {
  return typeof value === 'string' && TOPIC_KEYS.has(value as NatalTopicKey);
}

export type NatalTopicContent = {
  key: NatalTopicKey;
  title: string;
  description: string;
  accessState: NatalTopicAccessState;
  paragraphs: NatalReadingStatement[];
  evidenceIds: string[];
  related: readonly NatalTopicKey[];
};

function freeSectionStatements(section: InterpretationSection | undefined): NatalReadingStatement[] {
  if (!section?.content) return [];
  return [{ text: section.content, evidenceIds: section.evidenceIds || [] }];
}

function premiumSectionStatements(section: NatalPermanentPremiumSection | undefined): NatalReadingStatement[] {
  return section?.paragraphs || [];
}

function resolveFeaturedFreeTopicKeys(
  freeSectionsByKey: ReadonlyMap<InterpretationSection['key'], InterpretationSection>,
): Set<NatalTopicKey> {
  const available = TOPIC_DEFINITIONS.filter((topic) => (
    topic.freeSectionKey && freeSectionsByKey.has(topic.freeSectionKey)
  ));
  const selected: NatalTopicKey[] = [];
  for (const key of PREFERRED_FREE_TOPICS) {
    if (available.some((topic) => topic.key === key)) selected.push(key);
  }
  for (const topic of available) {
    if (selected.length >= 2) break;
    if (!selected.includes(topic.key)) selected.push(topic.key);
  }
  return new Set(selected);
}

export function buildNatalReportTopics(input: {
  language: 'ru' | 'en';
  report: NatalPermanentFreeReport;
  premiumReport: NatalPermanentPremiumReport | null;
  isPremium: boolean;
}): NatalTopicContent[] {
  const freeSectionsByKey = new Map(input.report.freeSections.map((section) => [section.key, section]));
  const premiumSectionsByKey = new Map(
    (input.isPremium ? input.premiumReport?.sections || [] : [])
      .filter((section) => isNatalTopicKey(section.id))
      .map((section) => [section.id as NatalTopicKey, section]),
  );
  const featuredFreeTopics = resolveFeaturedFreeTopicKeys(freeSectionsByKey);

  return TOPIC_DEFINITIONS.flatMap((definition) => {
    const freeSection = definition.freeSectionKey
      ? freeSectionsByKey.get(definition.freeSectionKey)
      : undefined;
    const premiumSection = premiumSectionsByKey.get(definition.key);
    const hasFreeContent = !!freeSection;
    const hasPremiumContent = !!premiumSection;
    if (!hasFreeContent && !hasPremiumContent && definition.freeSectionKey) return [];

    const isFeaturedFree = featuredFreeTopics.has(definition.key);
    const accessState: NatalTopicAccessState = isFeaturedFree
      ? 'open'
      : input.isPremium
        ? 'premium'
        : 'locked';
    const paragraphs = hasPremiumContent
      ? premiumSectionStatements(premiumSection)
      : freeSectionStatements(freeSection);

    return [{
      key: definition.key,
      title: definition.title[input.language],
      description: definition.description[input.language],
      accessState,
      paragraphs,
      evidenceIds: [...new Set(paragraphs.flatMap((paragraph) => paragraph.evidenceIds))],
      related: definition.related,
    }];
  });
}
