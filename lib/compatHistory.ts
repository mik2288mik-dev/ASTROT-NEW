/**
 * История проверок совместимости — локальное хранилище (per-device).
 * Реальное сохранение: пользователь видит, что уже проверял, может открыть снова и удалить.
 * Без бэкенда специально: это лёгкий журнал недавних проверок, не карты в БД.
 */
import type { RelationshipContext } from './synastry/relationshipContext';

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

function read(): CompatHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CompatHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function write(list: CompatHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* приватный режим/переполнение — тихо игнорируем */
  }
}

export function loadCompatHistory(): CompatHistoryEntry[] {
  return read();
}

/** Добавляет проверку наверх списка; повтор той же пары обновляет запись (без дублей). */
export function addCompatHistory(entry: CompatHistoryEntry): CompatHistoryEntry[] {
  const list = read().filter((e) => e.id !== entry.id);
  list.unshift(entry);
  const next = list.slice(0, MAX);
  write(next);
  return next;
}

export function removeCompatHistory(id: string): CompatHistoryEntry[] {
  const next = read().filter((e) => e.id !== id);
  write(next);
  return next;
}

export function clearCompatHistory(): CompatHistoryEntry[] {
  write([]);
  return [];
}

export function buildCompatHistoryId(
  kind: 'sign' | 'person',
  sign?: string,
  name?: string,
  date?: string,
  relationshipContext?: RelationshipContext,
): string {
  const contextSuffix = relationshipContext ? `:${relationshipContext}` : '';
  return kind === 'sign'
    ? `sign:${String(sign || '').toLowerCase()}${contextSuffix}`
    : `person:${String(name || '').trim().toLowerCase()}:${String(date || '')}${contextSuffix}`;
}
