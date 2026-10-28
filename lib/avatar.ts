/**
 * Avatars: a picture from the cat or animal sets, or the person's own photo.
 * Kept on the device, per account (no server field yet), and shared with every screen through one small store.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type AvatarSet = 'cats' | 'zveri';

export const AVATAR_SET_SIZE: Record<AvatarSet, number> = { cats: 35, zveri: 20 };
export const AVATAR_SET_TITLE: Record<AvatarSet, string> = { cats: 'Коты', zveri: 'Звери' };
export const AVATAR_BACKGROUNDS = ['#DCE8FF', '#D7F2E4', '#FFE6C4', '#E4DCFF', '#FFF1B3', '#CBEDF7', '#E8EBF1', '#1F2A5C'] as const;

export type AvatarState = {
  kind: 'none' | 'set' | 'photo';
  set: AvatarSet;
  /** 1-based number of the picture inside its set. */
  index: number;
  bg: number;
  /** Own photo as a small data URL. */
  photo: string;
  /** How many times «Подобрать по моей карте» was used. */
  tries: number;
  /** The month (YYYY-MM) in which the extra Plus pick was used. */
  plusMonth: string | null;
};

export const EMPTY_AVATAR: AvatarState = { kind: 'none', set: 'cats', index: 1, bg: 0, photo: '', tries: 0, plusMonth: null };

export function avatarImageUrl(set: AvatarSet, index: number): string {
  return `/assets/avatars/${set}/${String(index).padStart(2, '0')}.webp`;
}

const keyOf = (userId: string) => `nebo.avatar.v1:${userId || 'guest'}`;
const EVENT = 'nebo-avatar-change';
const cache = new Map<string, { raw: string; value: AvatarState }>();

function read(userId: string): AvatarState {
  let raw = '';
  try { raw = localStorage.getItem(keyOf(userId)) || ''; } catch { /* storage may be unavailable */ }
  const cached = cache.get(userId);
  if (cached && cached.raw === raw) return cached.value;
  let value = EMPTY_AVATAR;
  if (raw) {
    try { value = { ...EMPTY_AVATAR, ...(JSON.parse(raw) as Partial<AvatarState>) }; } catch { value = EMPTY_AVATAR; }
  }
  cache.set(userId, { raw, value });
  return value;
}

export function saveAvatar(userId: string, patch: Partial<AvatarState>) {
  const next = { ...read(userId), ...patch };
  try { localStorage.setItem(keyOf(userId), JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function useAvatar(userId: string): [AvatarState, (patch: Partial<AvatarState>) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(EVENT, notify);
    window.addEventListener('storage', notify);
    return () => { window.removeEventListener(EVENT, notify); window.removeEventListener('storage', notify); };
  }, []);
  const state = useSyncExternalStore(subscribe, () => read(userId), () => EMPTY_AVATAR);
  const update = useCallback((patch: Partial<AvatarState>) => saveAvatar(userId, patch), [userId]);
  return [state, update];
}

/** The picture to show in a circle: the photo, or the chosen picture, or nothing (a letter is shown). */
export function avatarSource(state: AvatarState): { url: string; photo: boolean } | null {
  if (state.kind === 'photo' && state.photo) return { url: state.photo, photo: true };
  if (state.kind === 'set') return { url: avatarImageUrl(state.set, state.index), photo: false };
  return null;
}

// ───────────── «Подобрать по моей карте» ─────────────

type Pick = { set: AvatarSet; index: number; bg: number; why: string };

const SIGN_PICKS: Record<string, [Pick, Pick]> = {
  aries: [
    { set: 'cats', index: 6, bg: 2, why: 'Овен смелый и первым берётся за дело. Рыжий кот такой же бойкий и яркий.' },
    { set: 'zveri', index: 13, bg: 2, why: 'Второй вариант: бордер-колли, быстрый, азартный и всегда готовый к игре, как твой знак.' },
  ],
  taurus: [
    { set: 'cats', index: 10, bg: 1, why: 'Телец любит уют, вкусную еду и спокойствие. Кремовый британец именно такой.' },
    { set: 'zveri', index: 5, bg: 1, why: 'Второй вариант: капибара, самый спокойный зверь, с которым все дружат.' },
  ],
  gemini: [
    { set: 'zveri', index: 4, bg: 5, why: 'Близнецы любопытны и общительны. Енот сует нос во всё интересное и со всеми ладит.' },
    { set: 'cats', index: 26, bg: 5, why: 'Второй вариант: ангора с разными глазами, как две стороны характера у Близнецов.' },
  ],
  cancer: [
    { set: 'cats', index: 14, bg: 0, why: 'Рак заботливый и мягкий, а рэгдолл самый ласковый кот и любит тепло дома.' },
    { set: 'zveri', index: 15, bg: 0, why: 'Второй вариант: коала, которая любит обнимать и держаться за своих.' },
  ],
  leo: [
    { set: 'cats', index: 12, bg: 4, why: 'Лев любит быть на виду. Пушистая мейн-кун с кисточками на ушах выглядит по-королевски.' },
    { set: 'zveri', index: 12, bg: 4, why: 'Второй вариант: золотистый ретривер, тёплый, щедрый, всеобщий любимец.' },
  ],
  virgo: [
    { set: 'cats', index: 16, bg: 1, why: 'Дева аккуратная и внимательная. Русская голубая такая же элегантная и сдержанная.' },
    { set: 'zveri', index: 6, bg: 1, why: 'Второй вариант: сова, которая замечает мелочи и ничего не пропускает.' },
  ],
  libra: [
    { set: 'cats', index: 8, bg: 5, why: 'Весы любят гармонию и красоту. Белая кошка с голубыми глазами выглядит как картинка.' },
    { set: 'zveri', index: 9, bg: 5, why: 'Второй вариант: кролик, мягкий и дружелюбный, как твой знак.' },
  ],
  scorpio: [
    { set: 'cats', index: 5, bg: 3, why: 'Скорпион загадочный и сильный. Чёрный кот с жёлтыми глазами смотрит так же глубоко.' },
    { set: 'cats', index: 22, bg: 7, why: 'Второй вариант: дымчатый кот с медными глазами, серьёзный и немного таинственный.' },
  ],
  sagittarius: [
    { set: 'cats', index: 15, bg: 4, why: 'Стрелец любит приключения. Бенгал энергичный, как маленький леопард.' },
    { set: 'zveri', index: 3, bg: 4, why: 'Второй вариант: лисёнок, ловкий и любопытный путешественник.' },
  ],
  capricorn: [
    { set: 'cats', index: 27, bg: 6, why: 'Козерог выдержанный и надёжный. Норвежская лесная кошка спокойно переносит любую погоду.' },
    { set: 'zveri', index: 18, bg: 6, why: 'Второй вариант: медвежонок, основательный и терпеливый.' },
  ],
  aquarius: [
    { set: 'cats', index: 29, bg: 5, why: 'Водолей необычный и независимый. Ориентальная кошка с огромными ушами выделяется из любой толпы.' },
    { set: 'zveri', index: 19, bg: 5, why: 'Второй вариант: фенёк с большими ушами, такой же необычный и оригинальный.' },
  ],
  pisces: [
    { set: 'zveri', index: 11, bg: 5, why: 'Рыбы мягкие и мечтательные, они чувствуют людей. Тюлень спокойный, с добрыми глазами и живёт в воде, как твой знак.' },
    { set: 'zveri', index: 20, bg: 1, why: 'Второй вариант: морская выдра, дружелюбная и любит воду. Она тоже держится за своих.' },
  ],
};

/** Free picks, then one extra pick per month with Plus; otherwise the person is sent to Plus. */
export type MatchAccess = 'free' | 'plus' | 'upgrade' | 'wait';

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function matchAccess(state: AvatarState, plus: boolean, now = new Date()): MatchAccess {
  if (state.tries < 2) return 'free';
  if (!plus) return 'upgrade';
  return state.plusMonth === monthKey(now) ? 'wait' : 'plus';
}

export function matchPick(sign: string | null, tries: number, now = new Date()): Pick {
  const picks = SIGN_PICKS[sign || ''] ?? SIGN_PICKS.pisces;
  if (tries < 2) return picks[tries];
  // The monthly Plus pick: a fresh cat for the month, told in plain words.
  const index = ((now.getMonth() + 1) * 7 + now.getDate()) % AVATAR_SET_SIZE.cats + 1;
  return { set: 'cats', index, bg: (now.getMonth() + 3) % AVATAR_BACKGROUNDS.length, why: 'Новый вариант на этот месяц по твоему знаку. Если не понравился, можно выбрать любую картинку вручную.' };
}

/** Downscales a photo to a small square so it fits into local storage. */
export async function photoToAvatar(file: File, side = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
      node.src = url;
    });
    const crop = Math.min(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CANVAS_UNAVAILABLE');
    context.drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2, crop, crop, 0, 0, side, side);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
