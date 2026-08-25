export type KnowledgeLanguage = 'ru' | 'en';

export type KnowledgeCategoryId =
  | 'start'
  | 'signs'
  | 'planets'
  | 'houses'
  | 'angles'
  | 'aspects'
  | 'retrogrades'
  | 'nodes-points'
  | 'synthesis'
  | 'compatibility'
  | 'forecasts'
  | 'moon-cycles'
  | 'branches-tools';

export type KnowledgeArticleSectionKind =
  | 'definition'
  | 'fact'
  | 'mechanism'
  | 'calculation'
  | 'astrology'
  | 'history'
  | 'confusion'
  | 'detail';

export type KnowledgeDiagramId =
  | 'ascendant'
  | 'aspects'
  | 'houses'
  | 'lunar-nodes'
  | 'moon-phases'
  | 'retrograde-motion';

export type KnowledgeArticleSection = {
  title: string;
  paragraphs: readonly string[];
  kind?: KnowledgeArticleSectionKind;
  depth?: 'core' | 'deep';
};

export type KnowledgeArticleCopy = {
  title: string;
  summary: string;
  sections: readonly KnowledgeArticleSection[];
  shortAnswer: string;
};

export type KnowledgeTopicSource = {
  id: string;
  category: KnowledgeCategoryId;
  aliases: Readonly<Record<KnowledgeLanguage, readonly string[]>>;
  keywords: Readonly<Record<KnowledgeLanguage, readonly string[]>>;
  copy: Readonly<Record<KnowledgeLanguage, KnowledgeArticleCopy>>;
  relatedTopicIds: readonly string[];
  diagram?: KnowledgeDiagramId;
  sourceIds?: readonly string[];
};

export type KnowledgeTopic = KnowledgeArticleCopy & {
  id: string;
  category: KnowledgeCategoryId;
  categoryLabel: string;
  aliases: readonly string[];
  keywords: readonly string[];
  relatedTopicIds: readonly string[];
  diagram?: KnowledgeDiagramId;
  sourceIds: readonly string[];
};

export type KnowledgeCategory = {
  id: KnowledgeCategoryId;
  label: Readonly<Record<KnowledgeLanguage, string>>;
  description: Readonly<Record<KnowledgeLanguage, string>>;
};

export type KnowledgeSource = {
  id: string;
  title: Readonly<Record<KnowledgeLanguage, string>>;
  publisher: string;
  url: string;
  kind: 'astronomy' | 'astrology-reference' | 'history';
};
