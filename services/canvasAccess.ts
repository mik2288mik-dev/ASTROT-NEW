import type { UserProfile } from '../types';
import { apiFetch } from './apiClient';
import { getMobileBuildIdentity } from './mobileBuildIdentity';
import { getOrCalculateChart } from './chartService';
import { saveProfile } from './storageService';
import { clearNatalUnifiedReadingCache } from './natalUnifiedReadingService';
import { writeLocalNatalChart } from '../lib/localNatalChartCache';

/**
 * What the first form of the new interface needs from the server: consents,
 * the birth city and the first chart. Same steps and same order as the old form.
 */

const REQUIRED_DOCUMENTS = ['terms', 'personal_data'] as const;

export type BirthCity = { label: string; name: string; lat: number; lon: number; timezone: string | null };

export async function searchBirthCities(query: string, signal?: AbortSignal): Promise<BirthCity[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=5&language=ru&format=json`;
  const response = await fetch(url, { signal });
  const data = await response.json() as { results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string }> };
  return (data.results ?? []).map((city) => ({
    label: [city.name, city.admin1, city.country].filter(Boolean).join(', '),
    name: city.name,
    lat: city.latitude,
    lon: city.longitude,
    timezone: city.timezone ?? null,
  }));
}

export async function acceptRequiredDocuments(language: string): Promise<void> {
  const read = await apiFetch('/api/users/legal-acknowledgements', { method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
  const summary = await read.json().catch(() => null) as { documents?: Array<{ documentType: string; accepted: boolean }> } | null;
  if (!read.ok || !Array.isArray(summary?.documents)) throw new Error('Не удалось сохранить согласие. Проверь интернет и попробуй ещё раз.');
  const identity = await getMobileBuildIdentity();
  const metadata = {
    source: 'onboarding_legal',
    language,
    ...(identity.appVersion ? { appVersionName: identity.appVersion } : {}),
    ...(identity.versionCode ? { appVersionCode: identity.versionCode } : {}),
    ...(identity.distributionChannel ? { distributionChannel: identity.distributionChannel } : {}),
  };
  for (const documentType of REQUIRED_DOCUMENTS) {
    if (summary?.documents?.some((document) => document.documentType === documentType && document.accepted)) continue;
    const response = await apiFetch('/api/users/legal-acknowledgements', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ documentType, action: 'accepted', ...metadata }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(payload?.message || 'Не удалось сохранить согласие. Попробуй ещё раз.');
    }
  }
}

export type EntryDraft = {
  name: string;
  gender: 'male' | 'female' | null;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  city: BirthCity | null;
};

/** Saves the birth data, calculates the chart, and marks the account as set up. */
export async function completeEntry(profile: UserProfile, draft: EntryDraft): Promise<void> {
  await acceptRequiredDocuments(profile.language || 'ru');
  const pending: UserProfile = {
    ...profile,
    name: draft.name || profile.name,
    gender: draft.gender ?? profile.gender,
    birthDate: draft.birthDate,
    birthTime: draft.birthTime,
    birthTimeMode: draft.birthTime ? 'exact' : 'unknown',
    birthTimeUncertaintyMinutes: null,
    birthTimeRangeStart: null,
    birthTimeRangeEnd: null,
    birthPlace: draft.city?.label || draft.birthPlace,
    birthLatitude: draft.city?.lat ?? null,
    birthLongitude: draft.city?.lon ?? null,
    birthTimezone: draft.city?.timezone ?? null,
    isSetup: false,
  };
  await saveProfile(pending);
  const chart = await getOrCalculateChart(pending);
  const birth = chart.birth;
  const latitude = birth?.latitude ?? chart.latitude;
  const longitude = birth?.longitude ?? chart.longitude;
  const finished: UserProfile = {
    ...pending,
    isSetup: true,
    birthTime: birth?.time?.localTime ?? pending.birthTime,
    birthTimeMode: birth?.time?.mode ?? pending.birthTimeMode,
    birthPlace: birth?.place || pending.birthPlace,
    birthTimezone: birth?.timezone || chart.timezone || pending.birthTimezone || null,
    birthLatitude: Number.isFinite(latitude) ? latitude : pending.birthLatitude,
    birthLongitude: Number.isFinite(longitude) ? longitude : pending.birthLongitude,
  };
  clearNatalUnifiedReadingCache(String(finished.id));
  await saveProfile(finished);
  writeLocalNatalChart(finished, chart);
}

export function readableEntryError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (lower.includes('location') || lower.includes('coordinates') || lower.includes('not found') || lower.includes('geocod')) return 'Не получилось найти этот город. Выбери его из списка под полем.';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) return 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.';
  if (/[а-яё]/iu.test(message)) return message;
  return 'Не получилось посчитать карту. Попробуй ещё раз.';
}
