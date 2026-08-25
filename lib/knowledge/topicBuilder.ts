import type {
  KnowledgeArticleSection,
  KnowledgeCategoryId,
  KnowledgeDiagramId,
  KnowledgeTopicSource,
} from './types';

type LocalizedTerms = { ru: readonly string[]; en: readonly string[] };

type TopicInput = {
  id: string;
  category: KnowledgeCategoryId;
  title: { ru: string; en: string };
  summary: { ru: string; en: string };
  shortAnswer: { ru: string; en: string };
  aliases: LocalizedTerms;
  keywords?: LocalizedTerms;
  ruSections: readonly KnowledgeArticleSection[];
  enSections?: readonly KnowledgeArticleSection[];
  relatedTopicIds: readonly string[];
  diagram?: KnowledgeDiagramId;
  sourceIds?: readonly string[];
};

/** Keeps concise secondary-language entries typed while Russian remains the editorial master. */
export function defineKnowledgeTopic(input: TopicInput): KnowledgeTopicSource {
  const enSections = input.enSections || [
    { title: 'What it is', paragraphs: [input.summary.en] },
    { title: 'Why the term is used', paragraphs: [input.shortAnswer.en] },
  ];
  return {
    id: input.id,
    category: input.category,
    aliases: input.aliases,
    keywords: input.keywords || input.aliases,
    copy: {
      ru: {
        title: input.title.ru,
        summary: input.summary.ru,
        sections: input.ruSections,
        shortAnswer: input.shortAnswer.ru,
      },
      en: {
        title: input.title.en,
        summary: input.summary.en,
        sections: enSections,
        shortAnswer: input.shortAnswer.en,
      },
    },
    relatedTopicIds: input.relatedTopicIds,
    diagram: input.diagram,
    sourceIds: input.sourceIds,
  };
}
