/**
 * Клиентская загрузка каталога стикеров: один сетевой запрос за сессию (+ мгновенная
 * отрисовка из localStorage-кэша, фоновая ревалидация). Стикеры декоративны, поэтому
 * недоступность каталога = просто нет стикеров, экран не ломается.
 */
import type { StickerCatalog } from '../lib/stickers/types';

// v2: у записей появилось поле themes. Ключ поднят, чтобы старый кэш (без themes) НЕ читался
// и не ронял выбор (entry.themes был undefined). Плюс валидируем схему на всякий случай.
const LS_KEY = 'lumia.stickers.catalog.v2';
let inflight: Promise<StickerCatalog> | null = null;
let memory: StickerCatalog | null = null;

function isValidCatalog(value: unknown): value is StickerCatalog {
  const c = value as StickerCatalog | null;
  if (!c || !Array.isArray(c.entries)) return false;
  // Каждая запись должна нести массивы-теги новой схемы (иначе кэш устарел).
  return c.entries.every(
    (e) => e && Array.isArray(e.moods) && Array.isArray(e.themes) && Array.isArray(e.surfaces),
  );
}

function readLocal(): StickerCatalog | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidCatalog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(catalog: StickerCatalog): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(catalog));
  } catch {
    /* quota/private mode — не критично */
  }
}

/** Синхронный доступ к уже загруженному каталогу (из памяти или localStorage), если есть. */
export function peekStickerCatalog(): StickerCatalog | null {
  if (memory) return memory;
  const local = readLocal();
  if (local) memory = local;
  return memory;
}

/** Загружает каталог (кэшируется на сессию). Никогда не бросает — при сбое отдаёт пустой. */
export function fetchStickerCatalog(): Promise<StickerCatalog> {
  if (memory) return Promise.resolve(memory);
  if (inflight) return inflight;
  inflight = fetch('/api/stickers/catalog', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((catalog: StickerCatalog) => {
      memory = catalog;
      writeLocal(catalog);
      return catalog;
    })
    .catch(() => {
      const fallback = peekStickerCatalog() || { version: 'empty', entries: [] };
      memory = fallback;
      return fallback;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
