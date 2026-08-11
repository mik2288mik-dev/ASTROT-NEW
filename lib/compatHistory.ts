/**
 * История проверок совместимости — локальное хранилище (per-device).
 * Реальное сохранение: пользователь видит, что уже проверял, может открыть снова и удалить.
 * Без бэкенда специально: это лёгкий журнал недавних проверок, не карты в БД.
 */
import type { RelationshipContext } from './synastry/relationshipContext';
import type { CompatibilityPairLevel, CompatibilityPersonSource } from './synastry/compatibilityInput';

export type CompatHistoryEntry = {
  /** Стабильный ключ для дедупликации: sign:<sign> или person:<name>:<date> */
  id: string;
  kind: 'sign' | 'person';
  sign?: string;
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  chartId?: number;
  subjectChartId?: number;
  subjectName?: string;
  subjectDate?: string;
  subjectTime?: string;
  subjectPlace?: string;
  subjectSource?: CompatibilityPersonSource;
  partnerSource?: CompatibilityPersonSource;
  subjectSign?: string;
  partnerSign?: string;
  calculationLevel?: CompatibilityPairLevel;
  yourSun: string;
  theirSun: string;
  /** Пол сторон (для гендерного текста). Необязательны — старые записи без них валидны. */
  yourGender?: 'male' | 'female' | null;
  theirGender?: 'male' | 'female' | null;
  relationshipContext?: RelationshipContext;
  overall: number;
  ts: number;
};

const KEY = 'lumia.compatHistory.v1';
const MAX = 30;

function storageKey(userId?: string | number | null): string {
  const normalized = String(userId ?? '').trim();
  return normalized ? `${KEY}:${normalized}` : KEY;
}

function read(userId?: string | number | null): CompatHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CompatHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function write(list: CompatHistoryEntry[], userId?: string | number | null) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* приватный режим/переполнение — тихо игнорируем */
  }
}

export function loadCompatHistory(userId?: string | number | null): CompatHistoryEntry[] {
  return read(userId);
}

/** Добавляет проверку наверх списка; повтор той же пары обновляет запись (без дублей). */
export function addCompatHistory(entry: CompatHistoryEntry, userId?: string | number | null): CompatHistoryEntry[] {
  const list = read(userId).filter((e) => e.id !== entry.id);
  list.unshift(entry);
  const next = list.slice(0, MAX);
  write(next, userId);
  return next;
}

export function removeCompatHistory(id: string, userId?: string | number | null): CompatHistoryEntry[] {
  const next = read(userId).filter((e) => e.id !== id);
  write(next, userId);
  return next;
}

export function clearCompatHistory(userId?: string | number | null): CompatHistoryEntry[] {
  write([], userId);
  return [];
}

export function buildCompatHistoryId(
  kind: 'sign' | 'person',
  sign?: string,
  name?: string,
  date?: string,
  relationshipContext?: RelationshipContext,
  subjectChartId?: number,
  counterpartChartId?: number,
): string {
  const contextSuffix = relationshipContext ? `:${relationshipContext}` : '';
  return kind === 'sign'
    ? `sign:${String(sign || '').toLowerCase()}${contextSuffix}`
    : `person:${subjectChartId || 'self'}:${counterpartChartId || String(name || '').trim().toLowerCase()}:${String(date || '')}${contextSuffix}`;
}
