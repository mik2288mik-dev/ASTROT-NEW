import type { UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import { buildPersonalForecastBirthProfileFingerprint, type PersonalForecastPeriod } from '../lib/personalForecastContract';
import { isPersonalMicroForecast, PERSONAL_MICRO_FORECAST_VERSION, type PersonalMicroForecast } from '../lib/personalMicroForecastContract';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

export type PersonalMicroForecastClientError = Error & { code?: string; status?: number };
type Input = { profile: UserProfile; period: PersonalForecastPeriod; periodKey: string };
const inFlight = new Map<string, Promise<PersonalMicroForecast>>();

function responseError(code: string, status: number): PersonalMicroForecastClientError {
  return Object.assign(new Error('Не получилось загрузить прогнозы по темам.'), { code, status });
}

async function request(input: Input): Promise<PersonalMicroForecast> {
  const query = new URLSearchParams({ period: input.period, periodKey: input.periodKey });
  const deadline = Date.now() + 120_000;
  let pending: PersonalMicroForecast = { period: input.period, periodKey: input.periodKey, status: 'generating', topics: [], retryAfterMs: 2500 };
  while (Date.now() < deadline) {
    const response = await apiFetch(`/api/content/forecast/micro?${query}`, {
      method: 'GET', headers: getTelegramInitDataHeaders(), cache: 'no-store',
    }, Math.min(95_000, Math.max(1000, deadline - Date.now())));
    const payload: unknown = await response.json().catch(() => null);
    const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string'
      ? payload.code : 'PERSONAL_MICRO_UNAVAILABLE';
    if (!response.ok) throw responseError(code, response.status);
    if (!isPersonalMicroForecast(payload) || payload.period !== input.period || payload.periodKey !== input.periodKey) {
      throw responseError('PERSONAL_MICRO_RESPONSE_INVALID', response.status);
    }
    if (payload.status !== 'generating') return payload;
    pending = payload;
    const delay = Math.min(5000, Math.max(1500, Number(payload.retryAfterMs) || 2500));
    if (Date.now() + delay >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return pending;
}

/** Ownership comes from the current session; profile is only a client deduplication key. */
export function loadPersonalMicroForecast(input: Input): Promise<PersonalMicroForecast> {
  if (!String(input.profile.id || '').trim()) return Promise.reject(responseError('APP_AUTH_REQUIRED', 401));
  const key = [PERSONAL_MICRO_FORECAST_VERSION, input.profile.id, input.profile.language || 'ru',
    buildPersonalForecastBirthProfileFingerprint(input.profile), hasActivePremium(input.profile) ? 'premium' : 'free',
    input.period, input.periodKey].join('|');
  const current = inFlight.get(key);
  if (current) return current;
  const promise = request(input).finally(() => { if (inFlight.get(key) === promise) inFlight.delete(key); });
  inFlight.set(key, promise);
  return promise;
}
