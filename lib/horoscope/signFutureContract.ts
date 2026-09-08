import { normalizeZodiacKey, type ZodiacKey } from '../zodiacKeys';
import { getPersonalFutureTimelineStops, type PersonalFutureTimelineStop } from '../personalFutureForecastContract';

export const SIGN_FUTURE_VERSION = 'zodiac-future-v2-premium-plain-deepseek';
export const SIGN_FUTURE_TOPICS = ['general', 'luck', 'work', 'love', 'money', 'family', 'communication'] as const;
export type SignFutureTopic = typeof SIGN_FUTURE_TOPICS[number];
export type SignFutureSelection = PersonalFutureTimelineStop & { sign: ZodiacKey; topic: SignFutureTopic; language: 'ru' | 'en' };
export type SignFutureGrant = { day: string; sign: ZodiacKey; topic: SignFutureTopic };
export type SignFutureReading = SignFutureSelection & { status: 'ready' | 'generating'; headline: string; text: string; freeChoice?: SignFutureGrant };
export const signFutureStops = getPersonalFutureTimelineStops;
export const SIGN_FUTURE_LABELS: Record<SignFutureTopic, [string, string]> = {
  general: ['Общий прогноз', 'General forecast'], luck: ['Удача', 'Luck'], work: ['Работа', 'Work'],
  love: ['Любовь', 'Love'], money: ['Деньги', 'Money'], family: ['Семья', 'Family'], communication: ['Общение', 'Conversations'],
};
export function isSignFutureReading(value: unknown): value is SignFutureReading {
  if (!value || typeof value !== 'object') return false;
  const v = value as SignFutureReading;
  return normalizeZodiacKey(v.sign) === v.sign && SIGN_FUTURE_TOPICS.includes(v.topic)
    && ['day', 'week', 'month'].includes(v.period) && ['ru', 'en'].includes(v.language)
    && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(v.date)
    && (v.period === 'week' ? typeof v.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(v.endDate) : v.endDate === undefined)
    && typeof v.headline === 'string' && typeof v.text === 'string'
    && (v.status === 'ready' ? v.headline.length > 0 && v.headline.length <= 180 && v.text.length >= 30 && v.text.length <= 1500 : v.status === 'generating' && v.text === '');
}
