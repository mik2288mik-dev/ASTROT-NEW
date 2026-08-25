import type {
  KnowledgeCategoryId,
  KnowledgeHubId,
  KnowledgeLanguage,
} from '../../lib/knowledge';

type LocalizedText = Readonly<Record<KnowledgeLanguage, string>>;

export type EncyclopediaHub = {
  id: KnowledgeHubId;
  title: LocalizedText;
  preview: LocalizedText;
  categoryIds: readonly KnowledgeCategoryId[];
  featuredTopicIds?: readonly string[];
};

export const POPULAR_KNOWLEDGE_TOPICS = [
  { topicId: 'ascendant', label: { ru: 'Асцендент', en: 'Ascendant' } },
  { topicId: 'retrograde-mercury', label: { ru: 'Ретроградный Меркурий', en: 'Mercury retrograde' } },
  { topicId: 'full-moon', label: { ru: 'Полнолуние', en: 'Full moon' } },
  { topicId: 'houses-overview', label: { ru: 'Дома', en: 'Houses' } },
  { topicId: 'black-moon-lilith', label: { ru: 'Лилит', en: 'Lilith' } },
] as const;

export const ENCYCLOPEDIA_HUBS: readonly EncyclopediaHub[] = [
  {
    id: 'foundations',
    title: { ru: 'Основы астрологии', en: 'Astrology basics' },
    preview: {
      ru: 'Зодиак · Натальная карта · Гороскоп · Эклиптика',
      en: 'Zodiac · Natal chart · Horoscope · Ecliptic',
    },
    categoryIds: ['start'],
  },
  {
    id: 'planets-signs',
    title: { ru: 'Планеты и знаки', en: 'Planets and signs' },
    preview: {
      ru: 'Солнце · Луна · Меркурий · 12 знаков',
      en: 'Sun · Moon · Mercury · 12 signs',
    },
    categoryIds: ['planets', 'signs'],
  },
  {
    id: 'chart-structure',
    title: { ru: 'Как устроена натальная карта', en: 'How a natal chart works' },
    preview: {
      ru: 'Дома · Асцендент · MC · Аспекты · Стеллиум',
      en: 'Houses · Ascendant · MC · Aspects · Stellium',
    },
    categoryIds: ['houses', 'angles', 'aspects', 'synthesis'],
  },
  {
    id: 'moon-sky',
    title: { ru: 'Луна и явления на небе', en: 'The Moon and sky events' },
    preview: {
      ru: 'Фазы Луны · Новолуние · Полнолуние · Затмения',
      en: 'Moon phases · New moon · Full moon · Eclipses',
    },
    categoryIds: ['moon-cycles'],
  },
  {
    id: 'motion-forecasting',
    title: { ru: 'Движение и прогнозы', en: 'Motion and forecasting' },
    preview: {
      ru: 'Ретроградность · Транзиты · Соляр · Прогрессии',
      en: 'Retrogrades · Transits · Solar return · Progressions',
    },
    categoryIds: ['retrogrades', 'forecasts'],
  },
  {
    id: 'other-concepts',
    title: { ru: 'Другие важные понятия', en: 'Other important concepts' },
    preview: {
      ru: 'Лилит · Лунные узлы · Хирон · Синастрия',
      en: 'Lilith · Lunar nodes · Chiron · Synastry',
    },
    categoryIds: ['nodes-points', 'compatibility', 'branches-tools'],
    featuredTopicIds: ['planet-chiron'],
  },
] as const;

export const HUB_BRANCH_PREVIEW_TOPIC_IDS: Readonly<
  Record<KnowledgeCategoryId, readonly string[]>
> = {
  start: ['astrology-overview', 'natal-chart-basics', 'zodiac-geometry'],
  planets: ['planet-sun', 'planet-moon', 'planet-mercury'],
  signs: ['signs-overview', 'sign-elements', 'sign-modalities'],
  houses: ['houses-overview', 'house-cusp', 'house-systems'],
  angles: ['ascendant', 'midheaven', 'descendant'],
  aspects: ['aspects-overview', 'aspect-square', 'aspect-opposition'],
  synthesis: ['stellium', 'aspect-patterns', 'rulers-dispositors'],
  'moon-cycles': ['moon-phase', 'full-moon', 'lunar-eclipse'],
  retrogrades: ['retrograde-motion', 'retrograde-mercury', 'direct-motion'],
  forecasts: ['transits-current-sky', 'solar-return', 'progressions'],
  'nodes-points': ['black-moon-lilith', 'nodes-overview', 'node-north'],
  compatibility: ['synastry', 'composite-chart', 'two-chart-compatibility'],
  'branches-tools': ['ephemerides', 'astrology-branches', 'astrocartography'],
};

export function getEncyclopediaHub(
  hubId: KnowledgeHubId,
): EncyclopediaHub | undefined {
  return ENCYCLOPEDIA_HUBS.find((hub) => hub.id === hubId);
}
