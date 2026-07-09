/**
 * Выбор стикеров для экрана по правилам пользователя:
 *  - на ВСЮ страницу максимум ОДИН маскот (kind: 'maskot');
 *  - плюс одна КОМПОЗИЦИЯ из 2–3 предметов на нижней карточке (kind: 'composition');
 *  - одиночных предметов нет; тексто-безопасные позиции; фильтр по настроению И теме;
 *  - детерминированно по временно́му ключу (2 раза в сутки), не Math.random.
 *
 * Пустая карточка (нет подходящего стикера) — норма.
 */
import { SURFACE_POSITIONS } from './rules';
import {
  COMPOSITION_SLOTS,
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
 * Временно́й ключ для смены раскладки 2 раза в сутки: московская дата + половина суток (am/pm).
 * Все открытия в одном 12-часовом окне → один ключ → одна раскладка.
 */
export function getStickerTimeKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const hour = Number(get('hour')) % 24;
  return `${get('year')}-${get('month')}-${get('day')}:${hour < 12 ? 'am' : 'pm'}`;
}

export type SurfaceRequest = {
  surface: Surface;
  kind?: 'maskot' | 'composition'; // по умолчанию 'maskot'
  moods?: Mood[]; // допустимые настроения (rule 5)
  themes?: Theme[]; // допустимая тематика (rule 5)
  count?: number; // для композиции: сколько предметов (2–3), по умолчанию 2
};

export type ScreenSelectOptions = {
  seed: number;
  requests: SurfaceRequest[];
  maxMaskots?: number; // максимум маскотов на ВСЮ страницу (по умолчанию 1)
};

const hit = <T,>(list: readonly T[], allowed?: readonly T[]) =>
  !allowed || !allowed.length || list.some((x) => allowed.includes(x));

function eligible(entry: StickerEntry, req: SurfaceRequest, type: 'character' | 'object'): boolean {
  return (
    entry.type === type &&
    entry.surfaces.includes(req.surface) &&
    hit(entry.moods, req.moods) &&
    hit(entry.themes, req.themes)
  );
}

/**
 * Возвращает размещения по блокам. Блоки идут в переданном порядке. Один и тот же стикер не
 * повторяется. Маскотов на страницу — не больше maxMaskots (по умолчанию 1).
 */
export function selectScreenStickers(
  catalog: StickerCatalog,
  { seed, requests, maxMaskots = 1 }: ScreenSelectOptions,
): Record<Surface, StickerPlacement[]> {
  const rng = makeRng(seed);
  const result = {} as Record<Surface, StickerPlacement[]>;
  const usedIds = new Set<string>();
  let maskotBudget = Math.max(0, maxMaskots);

  for (const req of requests) {
    const kind = req.kind ?? 'maskot';

    if (kind === 'composition') {
      const count = Math.min(COMPOSITION_SLOTS.length, Math.max(2, req.count ?? 2));
      const pool = shuffled(
        catalog.entries.filter((e) => !usedIds.has(e.id) && eligible(e, req, 'object')),
        rng,
      );
      // Композиция имеет смысл только если набралось хотя бы 2 предмета (не одиночка).
      if (pool.length < 2) {
        result[req.surface] = [];
        continue;
      }
      const picks = pool.slice(0, count);
      result[req.surface] = picks.map((entry, i) => {
        usedIds.add(entry.id);
        return { entry, position: COMPOSITION_SLOTS[i] };
      });
      continue;
    }

    // kind === 'maskot'
    const positions = SURFACE_POSITIONS[req.surface] || [];
    if (maskotBudget <= 0 || positions.length === 0) {
      result[req.surface] = [];
      continue;
    }
    const entry = shuffled(
      catalog.entries.filter((e) => !usedIds.has(e.id) && eligible(e, req, 'character')),
      rng,
    )[0];
    if (!entry) {
      result[req.surface] = [];
      continue;
    }
    result[req.surface] = [{ entry, position: shuffled(positions, rng)[0] }];
    usedIds.add(entry.id);
    maskotBudget -= 1;
  }

  return result;
}
