/**
 * Выбор стикеров для экрана. Чистая функция: одинаковый seed → одинаковый результат
 * (стабильно в пределах одного открытия приложения), разный seed → другой набор/позиции
 * (при каждом заходе — новые стикеры). Соблюдает лимит на экран и на блок, не повторяет
 * стикер и позицию.
 */
import { SURFACE_MAX, SURFACE_POSITIONS } from './rules';
import {
  type Mood,
  type StickerCatalog,
  type StickerEntry,
  type StickerPlacement,
  type Surface,
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

export type SurfaceRequest = {
  surface: Surface;
  mood?: Mood; // тег настроения этого блока/экрана; без него — по всем настроениям
  max?: number; // потолок для блока (по умолчанию SURFACE_MAX)
};

export type ScreenSelectOptions = {
  seed: number;
  requests: SurfaceRequest[];
  totalMax?: number; // максимум стикеров на весь экран (по умолчанию 3)
};

function eligibleFor(entry: StickerEntry, surface: Surface, mood?: Mood): boolean {
  if (!entry.surfaces.includes(surface)) return false;
  if (mood && !entry.moods.includes(mood)) return false;
  // Должна существовать хотя бы одна общая позиция блока и стикера.
  const allowed = SURFACE_POSITIONS[surface] || [];
  return entry.positions.some((p) => allowed.includes(p));
}

/**
 * Возвращает размещения по блокам. Блоки обрабатываются в переданном порядке (приоритет),
 * общий лимит totalMax режет хвост. Один и тот же стикер не появляется дважды на экране.
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
    const placements: StickerPlacement[] = [];
    if (budget <= 0) {
      result[req.surface] = placements;
      continue;
    }
    const surfaceMax = Math.max(0, req.max ?? SURFACE_MAX[req.surface] ?? 1);
    const allowedPositions = SURFACE_POSITIONS[req.surface] || [];
    const usedPositions = new Set<string>();

    const pool = shuffled(
      catalog.entries.filter((e) => !usedIds.has(e.id) && eligibleFor(e, req.surface, req.mood)),
      rng,
    );

    for (const entry of pool) {
      if (placements.length >= surfaceMax || budget <= 0) break;
      // Позиции, допустимые и для блока, и для стикера, ещё не занятые в этом блоке.
      const positions = shuffled(
        entry.positions.filter((p) => allowedPositions.includes(p) && !usedPositions.has(p)),
        rng,
      );
      const position = positions[0];
      if (!position) continue;
      placements.push({ entry, position });
      usedIds.add(entry.id);
      usedPositions.add(position);
      budget -= 1;
    }

    result[req.surface] = placements;
  }

  return result;
}
