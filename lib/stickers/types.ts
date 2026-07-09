/**
 * Динамическая система стикеров — типы каталога.
 *
 * Каталог — это ДАННЫЕ, не код. Базовые теги (тип/образ/поза/настроение) берутся из
 * ИМЕНИ ФАЙЛА по схеме реестра (`животное_образ_поза_настроение.webp` для маскотов,
 * `предмет[_вариант].webp` для предметов). Размещение (где уместен + допустимые позиции)
 * выводится из правил по настроению/позе (lib/stickers/rules.ts), а точечно уточняется
 * необязательным оверрайдом (public/stickers/catalog.overrides.json). Поэтому добавить
 * сотни стикеров = разложить корректно названные файлы; строка-оверрайд нужна лишь там,
 * где хочется отойти от дефолта.
 */

// Настроения и позы — строгие словари из реестра (public/stickers/STICKERS_REGISTRY.md).
export const MOODS = ['happy', 'calm', 'hype', 'thinking', 'cheer', 'chill', 'surprise'] as const;
export type Mood = (typeof MOODS)[number];

export const POSES = ['pawup', 'pawdown', 'wave', 'sit', 'run', 'peek', 'stand', 'point'] as const;
export type Pose = (typeof POSES)[number];

export type StickerType = 'character' | 'object';

// Экраны/блоки, где может стоять стикер. Расширяется добавлением значения + правил.
export const SURFACES = ['hero', 'moon', 'sphere', 'feed'] as const;
export type Surface = (typeof SURFACES)[number];

// Заранее продуманный набор позиций (не произвольные координаты). «-peek» = выступает
// за край карточки (требует overflow-visible на хосте — см. styles/stickers.css).
export const POSITION_SLOTS = [
  'bottom-right-peek',
  'bottom-left-peek',
  'top-right-peek',
  'top-left',
  'bottom-center',
  'right-center-peek',
  'left-bottom',
] as const;
export type PositionSlot = (typeof POSITION_SLOTS)[number];

/** Одна запись каталога (собирается из имени файла + правил + оверрайда). */
export type StickerEntry = {
  id: string; // имя файла без расширения, напр. "capy_coffee_sit_calm"
  src: string; // публичный путь, напр. "/stickers/capy_coffee_sit_calm.webp"
  type: StickerType;
  object: string | null; // образ/предмет из имени ("coffee", "notebook", "palm"…)
  pose: Pose | null; // только у маскотов
  moods: Mood[]; // настроения, к которым подходит стикер
  surfaces: Surface[]; // где уместен
  positions: PositionSlot[]; // допустимые позиции
};

export type StickerCatalog = {
  version: string; // хэш состава — меняется при добавлении/удалении файлов
  entries: StickerEntry[];
};

/** Необязательный оверрайд на конкретный стикер (по id ИЛИ по образу для предметов). */
export type StickerOverride = Partial<Pick<StickerEntry, 'type' | 'moods' | 'surfaces' | 'positions'>> & {
  exclude?: boolean; // полностью убрать стикер из ротации
};

export type StickerOverrides = Record<string, StickerOverride>;

/** Выбранное размещение: какой стикер и в какой позиции его рисовать. */
export type StickerPlacement = {
  entry: StickerEntry;
  position: PositionSlot;
};
