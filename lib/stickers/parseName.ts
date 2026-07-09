/**
 * Разбор имени файла стикера в теги и сборка записи каталога.
 * Схема имени — из реестров: маскот `животное_образ_поза_настроение`, предмет `предмет[_вариант]`.
 */
import {
  MOODS,
  POSES,
  type Mood,
  type Pose,
  type StickerEntry,
  type StickerOverride,
} from './types';
import {
  OBJECT_DEFAULT_MOODS,
  defaultSurfacesForMoods,
  positionsForSurfaces,
  typeFromAnimal,
} from './rules';

const MOOD_SET = new Set<string>(MOODS);
const POSE_SET = new Set<string>(POSES);

export type ParsedName = {
  animal: string | null; // "cat" | "capy" | null (предмет)
  object: string | null; // образ/предмет
  pose: Pose | null;
  mood: Mood | null;
};

/** Разбирает базовое имя файла (без расширения) в теги. Устойчив к нестрогим именам. */
export function parseStickerName(base: string): ParsedName {
  const parts = base.split('_').filter(Boolean);
  const first = parts[0] || '';

  if (first === 'cat' || first === 'capy') {
    // Маскот: последний токен — настроение, предпоследний — поза (если валидны).
    const last = parts[parts.length - 1];
    const prev = parts[parts.length - 2];
    const mood = MOOD_SET.has(last) ? (last as Mood) : null;
    const pose = POSE_SET.has(prev) ? (prev as Pose) : null;
    // Образ — то, что между животным и позой/настроением.
    const tailLen = (pose ? 1 : 0) + (mood ? 1 : 0);
    const object = parts.slice(1, parts.length - tailLen).join('_') || null;
    return { animal: first, object, pose, mood };
  }

  // Предмет: всё имя (с вариантом) — это образ, поз/настроений нет.
  return { animal: null, object: base || null, pose: null, mood: null };
}

/**
 * Собирает запись каталога из имени + правил, затем накладывает оверрайд (если есть).
 * overrideKey ищется по id и по образу — чтобы можно было задать оверрайд на все «palm_*» одним ключом.
 */
export function buildStickerEntry(
  base: string,
  src: string,
  overrides: Record<string, StickerOverride> = {},
): StickerEntry | null {
  const parsed = parseStickerName(base);
  const type = typeFromAnimal(parsed.animal);

  // Настроения: у маскота — из имени (одно); у предмета — спокойный дефолт.
  const baseMoods: Mood[] = parsed.mood ? [parsed.mood] : type === 'object' ? [...OBJECT_DEFAULT_MOODS] : [];

  const override = overrides[base] || (parsed.object ? overrides[parsed.object] : undefined) || {};
  if (override.exclude) return null;

  const moods = override.moods && override.moods.length ? override.moods : baseMoods;
  const surfaces = override.surfaces && override.surfaces.length ? override.surfaces : defaultSurfacesForMoods(moods);
  const positions =
    override.positions && override.positions.length ? override.positions : positionsForSurfaces(surfaces);

  return {
    id: base,
    src,
    type: override.type || type,
    object: parsed.object,
    pose: parsed.pose,
    moods,
    surfaces,
    positions,
  };
}
