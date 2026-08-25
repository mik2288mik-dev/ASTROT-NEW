import type {
  KnowledgeCategoryId,
  KnowledgeHubId,
  KnowledgeLanguage,
  KnowledgeTopic,
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

export type EncyclopediaCategoryGroup = {
  id: string;
  title: LocalizedText;
  topicIds: readonly string[];
};

export const ENCYCLOPEDIA_CATEGORY_GROUPS: Readonly<
  Partial<Record<KnowledgeCategoryId, readonly EncyclopediaCategoryGroup[]>>
> = {
  start: [
    {
      id: 'foundation',
      title: { ru: 'Понять основу', en: 'Understand the basics' },
      topicIds: ['astrology-overview', 'what-is-horoscope', 'natal-chart-basics', 'zodiac-geometry'],
    },
    {
      id: 'calculation',
      title: { ru: 'Как строят карту', en: 'How a chart is built' },
      topicIds: [
        'what-chart-calculates', 'birth-date-in-chart', 'birth-place-in-chart',
        'birth-time-in-chart', 'unknown-birth-time',
      ],
    },
    {
      id: 'reading',
      title: { ru: 'Как читать карту', en: 'How to read a chart' },
      topicIds: ['how-to-read-natal-chart', 'why-one-sign-is-not-enough'],
    },
  ],
  signs: [
    {
      id: 'system',
      title: { ru: 'Как устроена система', en: 'How the system works' },
      topicIds: [
        'signs-overview', 'planet-in-sign', 'zodiac-signs-vs-constellations',
        'tropical-sidereal-zodiac', 'sign-polarity', 'sign-rulership',
      ],
    },
    {
      id: 'twelve-signs',
      title: { ru: '12 знаков', en: 'The 12 signs' },
      topicIds: [
        'sign-aries', 'sign-taurus', 'sign-gemini', 'sign-cancer', 'sign-leo', 'sign-virgo',
        'sign-libra', 'sign-scorpio', 'sign-sagittarius', 'sign-capricorn',
        'sign-aquarius', 'sign-pisces',
      ],
    },
    {
      id: 'elements',
      title: { ru: 'Стихии', en: 'Elements' },
      topicIds: ['sign-elements', 'fire-element', 'earth-element', 'air-element', 'water-element'],
    },
    {
      id: 'modalities',
      title: { ru: 'Модальности', en: 'Modalities' },
      topicIds: ['sign-modalities', 'cardinal-modality', 'fixed-modality', 'mutable-modality'],
    },
  ],
  planets: [
    {
      id: 'overview',
      title: { ru: 'Как читать планеты', en: 'How to read planets' },
      topicIds: ['planets-overview'],
    },
    {
      id: 'personal',
      title: { ru: 'Светила и личные планеты', en: 'Luminaries and personal planets' },
      topicIds: ['planet-sun', 'planet-moon', 'planet-mercury', 'planet-venus', 'planet-mars'],
    },
    {
      id: 'outer',
      title: { ru: 'Социальные и дальние объекты', en: 'Social and distant objects' },
      topicIds: [
        'planet-jupiter', 'planet-saturn', 'planet-uranus',
        'planet-neptune', 'planet-pluto', 'planet-chiron',
      ],
    },
  ],
  houses: [
    {
      id: 'overview',
      title: { ru: 'Как устроены дома', en: 'How houses work' },
      topicIds: ['houses-overview', 'sign-vs-house', 'birth-time-and-houses'],
    },
    {
      id: 'twelve-houses',
      title: { ru: '12 домов', en: 'The 12 houses' },
      topicIds: Array.from({ length: 12 }, (_, index) => `house-${index + 1}`),
    },
    {
      id: 'systems',
      title: { ru: 'Границы и системы домов', en: 'House boundaries and systems' },
      topicIds: ['house-cusp', 'house-systems', 'house-placidus', 'house-whole-sign', 'house-equal'],
    },
  ],
  aspects: [
    {
      id: 'reading',
      title: { ru: 'Как читать аспект', en: 'How to read an aspect' },
      topicIds: ['aspects-overview', 'aspect-orb', 'aspect-exact', 'aspect-applying-separating'],
    },
    {
      id: 'major',
      title: { ru: 'Главные аспекты', en: 'Major aspects' },
      topicIds: [
        'aspect-conjunction', 'aspect-sextile', 'aspect-square', 'aspect-trine', 'aspect-opposition',
      ],
    },
  ],
  retrogrades: [
    {
      id: 'motion',
      title: { ru: 'Как движутся планеты', en: 'How planets appear to move' },
      topicIds: [
        'retrograde-motion', 'direct-motion', 'retrograde-station-direct',
        'planetary-ingress', 'planetary-cycle-return',
      ],
    },
    {
      id: 'interpretation',
      title: { ru: 'Как читают ретроградность', en: 'How retrogrades are read' },
      topicIds: ['retrograde-natal', 'retrograde-transit', 'retrograde-mercury'],
    },
  ],
  synthesis: [
    {
      id: 'reading',
      title: { ru: 'Как собирать карту', en: 'How to combine a chart' },
      topicIds: [
        'combine-planet-sign', 'planet-in-house', 'planet-aspects', 'repeated-chart-themes',
        'no-single-indicator', 'same-sign-different-people',
      ],
    },
    {
      id: 'patterns',
      title: { ru: 'Конфигурации', en: 'Patterns' },
      topicIds: ['stellium', 'aspect-patterns', 'grand-trine', 't-square', 'grand-cross'],
    },
    {
      id: 'rulers',
      title: { ru: 'Управители и достоинства', en: 'Rulers and dignities' },
      topicIds: ['rulers-dispositors', 'planetary-dignities'],
    },
  ],
  compatibility: [
    {
      id: 'methods',
      title: { ru: 'Способы сравнения', en: 'Comparison methods' },
      topicIds: [
        'sign-compatibility', 'two-chart-compatibility', 'synastry',
        'composite-chart', 'compatibility-not-fate',
      ],
    },
    {
      id: 'factors',
      title: { ru: 'Что сравнивают', en: 'What is compared' },
      topicIds: [
        'moon-in-relationships', 'venus-in-relationships', 'mars-in-relationships',
        'mercury-in-relationships', 'interchart-aspects',
      ],
    },
  ],
  forecasts: [
    {
      id: 'current-sky',
      title: { ru: 'Текущее небо', en: 'The current sky' },
      topicIds: [
        'natal-vs-current-period', 'transits-current-sky',
        'forecast-day-week-month', 'forecast-not-guarantee',
      ],
    },
    {
      id: 'secondary',
      title: { ru: 'Вторичные методы', en: 'Secondary methods' },
      topicIds: ['progressions', 'directions'],
    },
    {
      id: 'returns',
      title: { ru: 'Возвращения', en: 'Returns' },
      topicIds: ['solar-return', 'lunar-return', 'saturn-return'],
    },
  ],
  'moon-cycles': [
    {
      id: 'moon-context',
      title: { ru: 'Луна в карте и сейчас', en: 'The Moon in a chart and now' },
      topicIds: ['natal-moon', 'current-moon'],
    },
    {
      id: 'cycle',
      title: { ru: 'Лунный цикл', en: 'The lunar cycle' },
      topicIds: [
        'moon-phase', 'lunar-cycle', 'lunar-cycle-calendar', 'new-moon', 'full-moon',
        'waxing-moon', 'waning-moon', 'moon-first-quarter', 'moon-last-quarter',
      ],
    },
    {
      id: 'eclipses',
      title: { ru: 'Затмения', en: 'Eclipses' },
      topicIds: ['solar-eclipse', 'lunar-eclipse'],
    },
  ],
};

export type ResolvedEncyclopediaCategoryGroup = {
  id: string;
  title: string | null;
  topics: readonly KnowledgeTopic[];
};

export function getEncyclopediaCategoryGroups(
  categoryId: KnowledgeCategoryId,
  topics: readonly KnowledgeTopic[],
  language: KnowledgeLanguage,
): ResolvedEncyclopediaCategoryGroup[] {
  const definitions = ENCYCLOPEDIA_CATEGORY_GROUPS[categoryId];
  if (!definitions) return [{ id: 'all', title: null, topics }];

  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const groupedTopicIds = new Set(definitions.flatMap((definition) => definition.topicIds));
  const groups = definitions.map((definition) => ({
    id: definition.id,
    title: definition.title[language],
    topics: definition.topicIds.flatMap((topicId) => {
      const topic = topicById.get(topicId);
      return topic ? [topic] : [];
    }),
  }));
  const ungroupedTopics = topics.filter((topic) => !groupedTopicIds.has(topic.id));
  return ungroupedTopics.length
    ? [...groups, {
      id: 'other',
      title: language === 'ru' ? 'Другие материалы' : 'Other articles',
      topics: ungroupedTopics,
    }]
    : groups;
}

export function shouldShowKnowledgeContents(topic: KnowledgeTopic): boolean {
  const coreSections = topic.sections.filter((section) => section.depth !== 'deep');
  const articleLength = [topic.summary, ...coreSections.flatMap((section) => section.paragraphs)]
    .join(' ')
    .length;
  return coreSections.length >= 6 && articleLength >= 1_400;
}

export function getEncyclopediaHub(
  hubId: KnowledgeHubId,
): EncyclopediaHub | undefined {
  return ENCYCLOPEDIA_HUBS.find((hub) => hub.id === hubId);
}
