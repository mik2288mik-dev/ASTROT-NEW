import type { KnowledgeTopic } from './types';

export type KnowledgeInlineLinkDefinition = {
  topicId: string;
  targetTopicIds: readonly string[];
};

/**
 * Curated semantic links for the reference articles. The prose stays in the
 * article files; this registry only decides which stable knowledge IDs may be
 * linked when their terms actually occur in that prose.
 */
export const KNOWLEDGE_INLINE_LINKS: readonly KnowledgeInlineLinkDefinition[] = [
  {
    topicId: 'ascendant',
    targetTopicIds: [
      'zodiac-geometry', 'birth-time-in-chart', 'house-systems', 'angles-overview',
      'midheaven', 'imum-coeli', 'planet-sun',
    ],
  },
  {
    topicId: 'planet-moon',
    targetTopicIds: ['planet-sun', 'ephemerides', 'new-moon', 'full-moon', 'natal-moon'],
  },
  {
    topicId: 'houses-overview',
    targetTopicIds: [
      'house-placidus', 'house-whole-sign', 'house-equal', 'house-1', 'house-cusp',
      'house-systems', 'birth-time-and-houses', 'ascendant',
    ],
  },
  {
    topicId: 'aspects-overview',
    targetTopicIds: [
      'aspect-conjunction', 'aspect-opposition', 'aspect-square', 'aspect-orb', 'aspect-exact',
    ],
  },
  {
    topicId: 'retrograde-motion',
    targetTopicIds: [
      'degree-and-position', 'direct-motion', 'retrograde-station-direct', 'retrograde-mercury',
    ],
  },
  {
    topicId: 'retrograde-mercury',
    targetTopicIds: [
      'planet-mercury', 'retrograde-motion', 'direct-motion',
      'retrograde-station-direct', 'transits-current-sky',
    ],
  },
  {
    topicId: 'full-moon',
    targetTopicIds: [
      'planet-moon', 'planet-sun', 'lunar-eclipse', 'new-moon',
      'aspect-opposition', 'lunar-cycle',
    ],
  },
  {
    topicId: 'black-moon-lilith',
    targetTopicIds: ['planet-moon', 'chart-point-object', 'ephemerides', 'degree-and-position'],
  },
  {
    topicId: 'nodes-overview',
    targetTopicIds: [
      'planet-moon', 'new-moon', 'full-moon', 'planet-sun', 'node-north', 'node-south',
      'lunar-eclipse', 'solar-eclipse', 'zodiac-geometry',
    ],
  },
  {
    topicId: 'planet-chiron',
    targetTopicIds: [
      'chart-point-object', 'black-moon-lilith', 'aspects-overview',
      'planet-saturn', 'planet-uranus',
    ],
  },
  {
    topicId: 'stellium',
    targetTopicIds: [
      'planet-sun', 'planet-moon', 'rulers-dispositors', 'aspect-conjunction',
      'aspect-orb', 'planet-in-house', 'repeated-chart-themes',
    ],
  },
  {
    topicId: 'solar-return',
    targetTopicIds: [
      'planet-sun', 'birth-place-in-chart', 'planetary-cycle-return',
      'natal-chart-basics', 'transits-current-sky',
    ],
  },
  {
    topicId: 'synastry',
    targetTopicIds: [
      'interchart-aspects', 'composite-chart', 'aspect-square',
      'two-chart-compatibility', 'aspects-overview',
    ],
  },
  {
    topicId: 'progressions',
    targetTopicIds: [
      'planet-moon', 'directions', 'transits-current-sky',
      'ephemerides', 'natal-vs-current-period',
    ],
  },
  ...Array.from({ length: 12 }, (_, index) => ({
    topicId: `house-${index + 1}`,
    targetTopicIds: [
      'houses-overview', 'planet-in-house', 'aspects-overview', 'ascendant', 'descendant',
    ],
  })),
];

const INLINE_LINKS_BY_TOPIC = new Map(
  KNOWLEDGE_INLINE_LINKS.map((definition) => [definition.topicId, definition.targetTopicIds]),
);

export function getKnowledgeInlineTargetIds(
  topic: Pick<KnowledgeTopic, 'id' | 'relatedTopicIds'>,
): readonly string[] {
  return INLINE_LINKS_BY_TOPIC.get(topic.id) || topic.relatedTopicIds;
}
