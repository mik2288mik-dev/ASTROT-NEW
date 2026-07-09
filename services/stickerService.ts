/**
 * Клиентская загрузка каталога стикеров: один сетевой запрос за сессию (+ мгновенная
 * отрисовка из localStorage-кэша, фоновая ревалидация). Стикеры декоративны, поэтому
 * недоступность каталога = просто нет стикеров, экран не ломается.
 */
import type { StickerCatalog } from '../lib/stickers/types';

const LS_KEY = 'lumia.stickers.catalog.v1';
let inflight: Promise<StickerCatalog> | null = null;
let memory: StickerCatalog | null = null;

function readLocal(): StickerCatalog | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StickerCatalog;
    return parsed && Array.isArray(parsed.entries) ? parsed : null;
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
