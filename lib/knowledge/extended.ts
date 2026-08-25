import { ADVANCED_EXTENDED_TOPICS } from './advancedExtended';
import { BASIC_EXTENDED_TOPICS } from './basicsExtended';
import { CYCLE_EXTENDED_TOPICS } from './cyclesExtended';
import type { KnowledgeTopicSource } from './types';

export const EXTENDED_TOPICS = [
  ...BASIC_EXTENDED_TOPICS,
  ...CYCLE_EXTENDED_TOPICS,
  ...ADVANCED_EXTENDED_TOPICS,
] satisfies readonly KnowledgeTopicSource[];
