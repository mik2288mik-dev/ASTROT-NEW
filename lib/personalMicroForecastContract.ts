import type { PersonalForecastPeriod } from './personalForecastContract';

export const PERSONAL_MICRO_FORECAST_VERSION = 'personal-micro-v7-dated-natal-horoscope';

export const PERSONAL_MICRO_FORECAST_TOPICS = {
  day: ['relationships', 'things', 'yourself'],
  week: ['career', 'relationships', 'wellbeing'],
  month: ['themes'],
} as const;

export type PersonalMicroForecastTopicId = typeof PERSONAL_MICRO_FORECAST_TOPICS[PersonalForecastPeriod][number];

export type PersonalMicroForecast = {
  period: PersonalForecastPeriod;
  periodKey: string;
  topics: Array<{ id: PersonalMicroForecastTopicId; teaser: string; text: string }>;
  status: 'ready' | 'generating' | 'unavailable';
  code?: string;
  retryAfterMs?: number;
};

export function isPersonalMicroForecastQuestion(text: string): boolean {
  const question = text.trim();
  const wordCount = (question.match(/[\p{L}\p{N}]+/gu) || []).length;
  return wordCount >= 4 && wordCount <= 8 && question.length <= 100
    && question.endsWith('?') && question.indexOf('?') === question.length - 1
    && !/[\n<>!]|https?:/iu.test(question);
}

/** Shared wire validation; unavailable packages never carry invented topic copy. */
export function isPersonalMicroForecast(value: unknown): value is PersonalMicroForecast {
  if (!value || typeof value !== 'object') return false;
  const item = value as PersonalMicroForecast;
  if (!Object.prototype.hasOwnProperty.call(PERSONAL_MICRO_FORECAST_TOPICS, item.period)
    || typeof item.periodKey !== 'string' || !item.periodKey
    || !Array.isArray(item.topics)
    || !['ready', 'generating', 'unavailable'].includes(item.status)) return false;
  if (item.status !== 'ready') return item.topics.length === 0;
  const ids = PERSONAL_MICRO_FORECAST_TOPICS[item.period];
  return item.topics.length === ids.length && item.topics.every((topic, index) => (
    topic && topic.id === ids[index] && typeof topic.teaser === 'string'
    && isPersonalMicroForecastQuestion(topic.teaser) && typeof topic.text === 'string'
    && topic.text.trim().length >= 20 && topic.text.length <= 450
  ));
}
