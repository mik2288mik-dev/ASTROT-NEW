/**
 * Правила размещения — как из тегов стикера вывести тему, где он уместен и в какой
 * ТЕКСТО-БЕЗОПАСНОЙ позиции. Расширяемость: корректно названный файл получает вменяемое
 * размещение автоматически.
 */
import {
  type Mood,
  type PositionSlot,
  type StickerType,
  type Surface,
  type Theme,
} from './types';

// Позиция на каждом экране/блоке — ОДНА заранее выверенная зона, где нет текста (rule 4).
export const SURFACE_POSITIONS: Record<Surface, PositionSlot[]> = {
  hero: ['hero-scene'], // верхняя «сцена» карточки-героя: над copy и do/dont
  moon: ['moon-gutter'], // правый отступ карточки луны (там зарезервировано место)
  sphere: ['corner-peek'],
  feed: ['corner-peek'],
};

// Тематика по образу (rule 5). Ключ — образ/предмет из имени; значение — темы.
const OBJECT_THEME: Record<string, Theme[]> = {
  // напитки / уют за чашкой
  coffee: ['drink', 'cozy'], cocoa: ['drink', 'cozy'], mug: ['drink', 'cozy'],
  bubbletea: ['drink'], thermos: ['drink'], flask: ['drink'], bottle: ['drink'], cookie: ['cozy'],
  // чтение / заметки
  book: ['read', 'cozy'], notebook: ['read'], planner: ['read'], letter: ['read'],
  clipboard: ['read', 'study'], calendar: ['read'], glasses: ['read'],
  // уют / дом / тепло
  candle: ['cozy'], plant: ['cozy'], flowers: ['cozy'], lantern: ['cozy'], lights: ['cozy'],
  key: ['cozy'], hoodie: ['cozy'], beanie: ['cozy'], heart: ['cozy', 'gift'],
  // подарки
  gift: ['gift'], giftbox: ['gift'], present: ['gift'],
  // техника / гаджеты (для «ночной» темы НЕ подходят — исключаем на луне)
  laptop: ['tech'], phone: ['tech'], keyboard: ['tech'], camera: ['tech'],
  gamepad: ['tech', 'active'], console: ['tech', 'active'], gameboy: ['tech', 'active'],
  headphones: ['tech'], tablet: ['tech', 'read'],
  // активность / улица
  basketball: ['active'], skate: ['active'], stopwatch: ['active'], compass: ['active'],
  duck: ['active'], umbrella: ['active'], sneakers: ['active'], sunglasses: ['active'],
  // фокус / рабочее
  flashlight: ['study'], palette: ['study'], pen: ['study'],
};

/** Темы стикера по его образу (учёт варианта: `thermos_green` → `thermos`). */
export function themesForObject(object: string | null): Theme[] {
  if (!object) return [];
  return OBJECT_THEME[object] || OBJECT_THEME[object.split('_')[0]] || [];
}

// Дефолтные экраны по настроению (базовый допуск; тематику режет уже запрос блока).
const MOOD_SURFACES: Record<Mood, Surface[]> = {
  calm: ['hero', 'moon', 'sphere', 'feed'],
  happy: ['hero', 'sphere', 'feed'],
  chill: ['hero', 'moon', 'feed'],
  thinking: ['hero', 'moon', 'feed'],
  hype: ['hero', 'sphere'],
  cheer: ['hero', 'sphere'],
  surprise: ['hero'],
};

export function defaultSurfacesForMoods(moods: Mood[]): Surface[] {
  const set = new Set<Surface>();
  for (const m of moods) for (const s of MOOD_SURFACES[m] || []) set.add(s);
  if (set.size === 0) set.add('hero');
  return [...set];
}

/** Позиции, допустимые для стикера на данном наборе экранов. */
export function positionsForSurfaces(surfaces: Surface[]): PositionSlot[] {
  const set = new Set<PositionSlot>();
  for (const s of surfaces) for (const p of SURFACE_POSITIONS[s] || []) set.add(p);
  return [...set];
}

/** Тип по «животному»: cat/capy = маскот, всё из objects/ = предмет. */
export function typeFromAnimal(animal: string | null): StickerType {
  return animal === 'cat' || animal === 'capy' ? 'character' : 'object';
}
