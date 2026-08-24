import type { KnowledgeCategoryId, KnowledgeLanguage, KnowledgeTopic } from './types';

export type KnowledgeArticlePresentation = {
  tag: string;
};

const CATEGORY_TAGS: Readonly<Record<KnowledgeCategoryId, Readonly<Record<KnowledgeLanguage, string>>>> = {
  start: { ru: 'Натальная карта', en: 'Natal chart' },
  signs: { ru: 'Зодиак', en: 'Zodiac' },
  planets: { ru: 'Натальная карта', en: 'Natal chart' },
  houses: { ru: 'Время рождения', en: 'Birth time' },
  angles: { ru: 'Точное время', en: 'Exact time' },
  aspects: { ru: 'Связи в карте', en: 'Chart connections' },
  retrogrades: { ru: 'Движение планет', en: 'Planet motion' },
  'nodes-points': { ru: 'Расчётные точки', en: 'Calculated points' },
  synthesis: { ru: 'Чтение карты', en: 'Reading a chart' },
  compatibility: { ru: 'Сравнение карт', en: 'Chart comparison' },
  forecasts: { ru: 'Текущий период', en: 'Current period' },
  'moon-cycles': { ru: 'Лунный цикл', en: 'Lunar cycle' },
};

export function getKnowledgeArticlePresentation(
  topic: KnowledgeTopic,
  language: KnowledgeLanguage,
): KnowledgeArticlePresentation {
  return {
    tag: CATEGORY_TAGS[topic.category][language],
  };
}
