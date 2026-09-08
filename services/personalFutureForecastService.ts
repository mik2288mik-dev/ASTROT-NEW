import type { UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import { buildPersonalForecastBirthProfileFingerprint } from '../lib/personalForecastContract';
import { isPersonalFutureForecast, PERSONAL_FUTURE_FORECAST_VERSION, type PersonalFutureForecast, type PersonalFutureForecastTopic, type PersonalFutureForecastPeriod } from '../lib/personalFutureForecastContract';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

export type PersonalFutureForecastClientError = Error & { code?: string; status?: number; freeUsedTopic?: PersonalFutureForecastTopic };
type Input = { profile: UserProfile; date: string; topic: PersonalFutureForecastTopic; period?: PersonalFutureForecastPeriod; endDate?: string };
const inFlight = new Map<string, Promise<PersonalFutureForecast>>();

function responseError(code: string, status: number, freeUsedTopic?: PersonalFutureForecastTopic): PersonalFutureForecastClientError {
  return Object.assign(new Error('Не получилось загрузить прогноз на эту дату.'), { code, status, freeUsedTopic });
}

async function request(input: Input): Promise<PersonalFutureForecast> {
  const period = input.period || 'day';
  const query = new URLSearchParams({ date: input.date, topic: input.topic, period });
  if (input.endDate !== undefined) query.set('endDate', input.endDate);
  const deadline = Date.now() + 120_000;
  let pending: PersonalFutureForecast = { date: input.date, period, topic: input.topic, status: 'generating', text: '', code: 'PERSONAL_FUTURE_GENERATING',
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
  };
  while (Date.now() < deadline) {
    const response = await apiFetch(`/api/content/forecast/future?${query}`, {
      method: 'GET', headers: getTelegramInitDataHeaders(), cache: 'no-store',
    }, Math.min(95_000, Math.max(1000, deadline - Date.now())));
    const payload: unknown = await response.json().catch(() => null);
    const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string'
      ? payload.code : 'PERSONAL_FUTURE_UNAVAILABLE';
    if (!response.ok) throw responseError(code, response.status, isPersonalFutureForecast(payload) ? payload.freeUsedTopic : undefined);
    if (!isPersonalFutureForecast(payload) || payload.date !== input.date || payload.topic !== input.topic || payload.period !== period || payload.endDate !== input.endDate) {
      throw responseError('PERSONAL_FUTURE_RESPONSE_INVALID', response.status);
    }
    if (payload.status !== 'generating') return payload;
    pending = payload;
    if (Date.now() + 2500 >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return pending;
}

/** Server derives ownership from the session; profile is never sent as authorization. */
export function loadPersonalFutureForecast(input: Input): Promise<PersonalFutureForecast> {
  if (!String(input.profile.id || '').trim()) return Promise.reject(responseError('APP_AUTH_REQUIRED', 401));
  const key = [PERSONAL_FUTURE_FORECAST_VERSION, input.profile.id, input.profile.language || 'ru',
    buildPersonalForecastBirthProfileFingerprint(input.profile), hasActivePremium(input.profile) ? 'premium' : 'free', input.period || 'day', input.date, input.endDate || '', input.topic].join('|');
  const current = inFlight.get(key);
  if (current) return current;
  const promise = request(input).finally(() => { if (inFlight.get(key) === promise) inFlight.delete(key); });
  inFlight.set(key, promise);
  return promise;
}
