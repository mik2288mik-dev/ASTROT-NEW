/**
 * Правила размещения — как из тегов стикера вывести, где он уместен и в каких позициях,
 * БЕЗ ручной прописи для каждого файла. Это и даёт расширяемость на сотни стикеров:
 * корректно названный файл получает вменяемое размещение автоматически.
 */
import {
  type Mood,
  type Pose,
  type PositionSlot,
  type StickerType,
  type Surface,
} from './types';

// Какие позиции допустимы на каждом экране/блоке (заранее продуманный набор).
export const SURFACE_POSITIONS: Record<Surface, PositionSlot[]> = {
  // Крупная карточка-герой дня: сцена сверху, стикер выступает снизу/сверху по краям.
  hero: ['bottom-right-peek', 'bottom-left-peek', 'top-right-peek'],
  // Карточка луны: маскот выглядывает справа.
  moon: ['right-center-peek', 'bottom-right-peek'],
  // Мелкие карточки-сферы: один маленький угловой выступ.
  sphere: ['bottom-right-peek'],
  // Лента карточек: скромный угол.
  feed: ['bottom-right-peek', 'top-right-peek'],
};

// Сколько стикеров максимум разумно на одном блоке (общий экранный лимит — отдельно).
export const SURFACE_MAX: Record<Surface, number> = {
  hero: 2,
  moon: 1,
  sphere: 1,
  feed: 1,
};

// Поза «peek» (выглядывает) особенно уместна на герое/луне; «run» — динамика на герое.
// Это лишь ДЕФОЛТ по настроению — оверрайд может уточнить.
const MOOD_SURFACES: Record<Mood, Surface[]> = {
  calm: ['hero', 'moon', 'sphere', 'feed'],
  happy: ['hero', 'moon', 'sphere', 'feed'],
  chill: ['hero', 'moon', 'feed'],
  thinking: ['hero', 'moon', 'feed'],
  hype: ['hero', 'sphere'],
  cheer: ['hero', 'sphere'],
  surprise: ['hero'],
};

/** Дефолтные экраны для стикера по его настроениям (объединение по всем его настроениям). */
export function defaultSurfacesForMoods(moods: Mood[]): Surface[] {
  const set = new Set<Surface>();
  for (const m of moods) for (const s of MOOD_SURFACES[m] || []) set.add(s);
  // Предмет/маскот без распознанного настроения — пусть живёт хотя бы на герое.
  if (set.size === 0) set.add('hero');
  return [...set];
}

// Предметы (palm, slippers, lamp…) настроения в имени не несут — даём спокойный дефолт,
// чтобы новый предмет сразу попадал в ротацию без оверрайда.
export const OBJECT_DEFAULT_MOODS: Mood[] = ['calm', 'happy', 'chill'];

/** Позиции, допустимые для стикера на данном наборе экранов (объединение наборов экранов). */
export function positionsForSurfaces(surfaces: Surface[]): PositionSlot[] {
  const set = new Set<PositionSlot>();
  for (const s of surfaces) for (const p of SURFACE_POSITIONS[s] || []) set.add(p);
  return [...set];
}

/** Тип по «животному»: cat/capy = маскот, всё из objects/ = предмет. */
export function typeFromAnimal(animal: string | null): StickerType {
  return animal === 'cat' || animal === 'capy' ? 'character' : 'object';
}

// Экспорт для тестов/валидации.
export const _internal = { MOOD_SURFACES };
export type { Pose };
