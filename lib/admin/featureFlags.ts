/**
 * Feature flags (Admin v2 Фаза 6). Чтение значений из таблицы feature_flags с кэшем.
 * Управляются из админки (раздел «Настройки»). Никогда не бросают — при ошибке
 * возвращают переданный дефолт (рантайм не падает из-за флагов).
 */
import { getPool } from '../db';

const TTL_MS = 30_000;
let cache: { at: number; map: Record<string, any> } | null = null;

async function loadFlags(): Promise<Record<string, any>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  try {
    const res = await getPool().query(`SELECT key, value FROM feature_flags`);
    const map: Record<string, any> = {};
    for (const r of res.rows) map[r.key] = r.value;
    cache = { at: Date.now(), map };
    return map;
  } catch {
    cache = { at: Date.now(), map: cache?.map || {} };
    return cache.map;
  }
}

export async function getFlag<T = any>(key: string, fallback: T): Promise<T> {
  const map = await loadFlags();
  return (key in map ? (map[key] as T) : fallback);
}

export async function getFlagBool(key: string, fallback: boolean): Promise<boolean> {
  const v = await getFlag<any>(key, fallback);
  return typeof v === 'boolean' ? v : fallback;
}

export function invalidateFlagCache(): void {
  cache = null;
}
