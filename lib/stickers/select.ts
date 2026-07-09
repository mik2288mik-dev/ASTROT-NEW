/**
 * Выбор стикеров для экрана по жёстким правилам:
 *  - rule 1: общий лимит на ВЕСЬ экран (totalMax, дефолт 3), один счётчик на все карточки;
 *  - rule 2: не больше ОДНОГО маскота на карточку (здесь — ровно один маскот на блок или ноль);
 *  - rule 3: одиночные предметы не ставим (берём только маскотов — у них предмет уже в кадре);
 *  - rule 5: фильтр и по настроению, и по ТЕМЕ блока;
 *  - rule 6: детерминированный выбор по временно́му ключу (2 раза в сутки), не Math.random.
 *
 * Пустая карточка (без подходящего маскота) — норма и предпочтительнее случайного стикера.
 */
import { SURFACE_POSITIONS } from './rules';
import {
  type Mood,
  type StickerCatalog,
  type StickerEntry,
  type StickerPlacement,
  type Surface,
  type Theme,
} from './types';

/** mulberry32 — маленький детерминированный ГПСЧ. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** FNV-1a хэш строки → seed. Одинаковый временно́й ключ → один seed → одна раскладка. */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Временно́й ключ для смены раскладки 2 раза в сутки (rule 6): московская дата + половина
 * суток (am/pm). Все открытия в одном 12-часовом окне → один ключ → одна раскладка стикеров.
 */
export function getStickerTimeKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const hour = Number(get('hour')) % 24;
  const half = hour < 12 ? 'am' : 'pm';
  return `${get('year')}-${get('month')}-${get('day')}:${half}`;
}

export type SurfaceRequest = {
  surface: Surface;
  moods?: Mood[]; // допустимые настроения блока (rule 5)
  themes?: Theme[]; // допустимая тематика блока (rule 5)
};

export type ScreenSelectOptions = {
  seed: number;
  requests: SurfaceRequest[];
  totalMax?: number; // максимум стикеров на весь экран (rule 1), по умолчанию 3
};

const has = <T,>(list: readonly T[], allowed?: readonly T[]) =>
  !allowed || !allowed.length || list.some((x) => allowed.includes(x));

/** Подходит ли МАСКОТ блоку: тип character + экран + настроение + тема. */
function eligibleMaskot(entry: StickerEntry, req: SurfaceRequest): boolean {
  return (
    entry.type === 'character' &&
    entry.surfaces.includes(req.surface) &&
    has(entry.moods, req.moods) &&
    has(entry.themes, req.themes)
  );
}

/**
 * По одному маскоту на блок (или ноль), общий лимит на экран. Возвращает размещения по блокам.
 * Блоки идут в переданном порядке (приоритет); лимит totalMax режет хвост. Один и тот же маскот
 * не появляется дважды.
 */
export function selectScreenStickers(
  catalog: StickerCatalog,
  { seed, requests, totalMax = 3 }: ScreenSelectOptions,
): Record<Surface, StickerPlacement[]> {
  const rng = makeRng(seed);
  const result = {} as Record<Surface, StickerPlacement[]>;
  const usedIds = new Set<string>();
  let budget = Math.max(0, totalMax);

  for (const req of requests) {
    const positions = SURFACE_POSITIONS[req.surface] || [];
    if (budget <= 0 || positions.length === 0) {
      result[req.surface] = [];
      continue;
    }
    const pool = shuffled(
      catalog.entries.filter((e) => !usedIds.has(e.id) && eligibleMaskot(e, req)),
      rng,
    );
    const entry = pool[0];
    if (!entry) {
      result[req.surface] = []; // нет подходящего маскота → карточка без стикера (rule 3в)
      continue;
    }
    const position = shuffled(positions, rng)[0];
    result[req.surface] = [{ entry, position }];
    usedIds.add(entry.id);
    budget -= 1;
  }

  return result;
}
