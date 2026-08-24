import type { NatalAngleKey, NatalBodyKey } from '../natalChartV2Types';

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
  | 'moon-cycles';

export type KnowledgeArticleSection = {
  title: string;
  paragraphs: readonly string[];
};

export type KnowledgeArticleCopy = {
  title: string;
  summary: string;
  sections: readonly KnowledgeArticleSection[];
  shortAnswer: string;
};

export type KnowledgePlanetQuestionKind = 'sign' | 'relationships' | 'default';
export type KnowledgeAspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export type KnowledgePersonalizationKind =
  | { type: 'planet'; key: NatalBodyKey; questionKind?: KnowledgePlanetQuestionKind }
  | { type: 'angle'; key: NatalAngleKey }
  | { type: 'house'; house: number }
  | { type: 'sign'; sign: string }
  | { type: 'aspects'; aspectType?: KnowledgeAspectType }
  | { type: 'retrogrades' }
  | { type: 'nodes' };

export type KnowledgeTopicSource = {
  id: string;
  category: KnowledgeCategoryId;
  aliases: Readonly<Record<KnowledgeLanguage, readonly string[]>>;
  keywords: Readonly<Record<KnowledgeLanguage, readonly string[]>>;
  copy: Readonly<Record<KnowledgeLanguage, KnowledgeArticleCopy>>;
  relatedTopicIds: readonly string[];
  personalizationKind?: KnowledgePersonalizationKind;
};

export type KnowledgeTopic = KnowledgeArticleCopy & {
  id: string;
  category: KnowledgeCategoryId;
  categoryLabel: string;
  aliases: readonly string[];
  keywords: readonly string[];
  relatedTopicIds: readonly string[];
  personalizationKind?: KnowledgePersonalizationKind;
};

export type KnowledgeCategory = {
  id: KnowledgeCategoryId;
  label: Readonly<Record<KnowledgeLanguage, string>>;
  description: Readonly<Record<KnowledgeLanguage, string>>;
};

export type PersonalKnowledgeStatus = 'ready' | 'requires_exact_birth_time';

export type PersonalKnowledgeResult = {
  status: PersonalKnowledgeStatus;
  facts: readonly string[];
  suggestedQuestion?: string;
};

export type PersonalKnowledgeReliability = {
  quality: 'exact' | 'approximate' | 'unknown';
  anglesIncluded: boolean;
  housesIncluded: boolean;
};
