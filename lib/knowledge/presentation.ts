import type { KnowledgeCategoryId, KnowledgeLanguage, KnowledgeTopic } from './types';

export type KnowledgeArticlePresentation = {
  symbol: string;
  tag: string;
};

const TOPIC_SYMBOLS: Readonly<Record<string, string>> = {
  'sign-aries': '♈︎',
  'sign-taurus': '♉︎',
  'sign-gemini': '♊︎',
  'sign-cancer': '♋︎',
  'sign-leo': '♌︎',
  'sign-virgo': '♍︎',
  'sign-libra': '♎︎',
  'sign-scorpio': '♏︎',
  'sign-sagittarius': '♐︎',
  'sign-capricorn': '♑︎',
  'sign-aquarius': '♒︎',
  'sign-pisces': '♓︎',
  'planet-sun': '☉',
  'planet-moon': '☽',
  'planet-mercury': '☿',
  'planet-venus': '♀',
  'planet-mars': '♂',
  'planet-jupiter': '♃',
  'planet-saturn': '♄',
  'planet-uranus': '♅',
  'planet-neptune': '♆',
  'planet-pluto': '♇',
  'planet-chiron': '⚷',
  ascendant: 'ASC',
  descendant: 'DSC',
  midheaven: 'MC',
  'imum-coeli': 'IC',
  'aspect-conjunction': '☌',
  'aspect-sextile': '⚹',
  'aspect-square': '□',
  'aspect-trine': '△',
  'aspect-opposition': '☍',
  'node-north': '☊',
  'node-south': '☋',
  'new-moon': '●',
  'full-moon': '○',
  'waxing-moon': '◐',
  'waning-moon': '◑',
};

const CATEGORY_SYMBOLS: Readonly<Record<KnowledgeCategoryId, string>> = {
  start: '○',
  signs: '♈︎',
  planets: '☉',
  houses: '⌂',
  angles: 'ASC',
  aspects: '∠',
  retrogrades: '℞',
  'nodes-points': '☊',
  synthesis: '⊕',
  compatibility: '↔',
  forecasts: '→',
  'moon-cycles': '☾',
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
    symbol: TOPIC_SYMBOLS[topic.id] || CATEGORY_SYMBOLS[topic.category],
    tag: CATEGORY_TAGS[topic.category][language],
  };
}
