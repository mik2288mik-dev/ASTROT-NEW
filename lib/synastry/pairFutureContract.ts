import type { PersonalFutureTimelineStop } from '../personalFutureForecastContract';
import type { RelationshipContext } from './relationshipContext';
import type { ZodiacKey } from '../zodiacKeys';

export const PAIR_FUTURE_VERSION = 'pair-future-v4-age-aware-plain';
export const PAIR_FUTURE_TOPICS = {
  general: ['Общий прогноз', 'Overview'], communication: ['Общение', 'Communication'],
  closeness: ['Близость', 'Closeness'], plans: ['Общие планы', 'Shared plans'],
  disagreements: ['Разногласия', 'Disagreements'], support: ['Поддержка', 'Support'],
  everyday: ['Быт', 'Everyday life'], teamwork: ['Общие дела', 'Teamwork'], agreements: ['Договорённости', 'Agreements'],
} as const;
export type PairFutureTopic = keyof typeof PAIR_FUTURE_TOPICS;
export function pairFutureTopics(relation: RelationshipContext): PairFutureTopic[] {
  const common: PairFutureTopic[] = ['general', 'communication'];
  return [...common, ...(relation === 'work' ? ['teamwork', 'agreements', 'disagreements'] as const
    : relation === 'family' ? ['support', 'everyday', 'disagreements'] as const
    : relation === 'friendship' || relation === 'ex' ? ['support', 'plans', 'disagreements'] as const
    : ['closeness', 'plans', 'everyday', 'disagreements'] as const)];
}
export type PairFutureRequest = PersonalFutureTimelineStop & {
  kind: 'future' | 'question';
  mode: 'sign' | 'birth'; signA: ZodiacKey; signB: ZodiacKey; relation: RelationshipContext;
  topic: PairFutureTopic; language: 'ru' | 'en'; chartId?: number; partnerChartId?: number; partnerDate?: string;
};
export const PAIR_QUESTIONS: Partial<Record<PairFutureTopic, readonly [string, string]>> = {
  communication: ['Как нам проще договориться?', 'How can we understand each other?'],
  disagreements: ['Из-за чего мы можем спорить?', 'What might we disagree about?'],
  support: ['Как поддерживать друг друга?', 'How can we support each other?'],
  closeness: ['Что помогает нам стать ближе?', 'What helps us feel closer?'],
  teamwork: ['Как нам легче делать что-то вместе?', 'How can we work together better?'],
};
export type PairFutureReading = { status: 'ready' | 'generating'; headline: string; text: string; basis: 'signs' | 'charts' | 'birth-dates' };
export function isPairFutureReading(value: unknown): value is PairFutureReading {
  if (!value || typeof value !== 'object') return false;
  const v = value as PairFutureReading;
  return ['ready', 'generating'].includes(v.status) && ['signs', 'charts', 'birth-dates'].includes(v.basis)
    && typeof v.headline === 'string' && typeof v.text === 'string'
    && (v.status === 'generating' || (v.headline.length > 0 && v.headline.length <= 100 && v.text.length >= 25 && v.text.length <= 900));
}
