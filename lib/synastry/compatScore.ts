/**
 * Лёгкая детерминированная оценка совместимости по солнечным знакам.
 * Числа (общий score, сферы, вердикт) считаются мгновенно на клиенте — без ИИ
 * и без бэкенда; глубокий текст приходит отдельно из существующих эндпоинтов.
 * Полностью стабильна для одной и той же пары (без рандома).
 */

export type CompatDimension = 'love' | 'relationship' | 'friendship' | 'work';

export type CompatResult = {
  overall: number;                       // 0..100
  dims: Record<CompatDimension, number>; // 0..100 каждая
  strongest: CompatDimension;
  verdict: string;                       // короткое слово-вердикт
};

type Element = 'fire' | 'earth' | 'air' | 'water';
type Modality = 'cardinal' | 'fixed' | 'mutable';

const SIGN_INFO: Record<string, { el: Element; mod: Modality }> = {
  aries: { el: 'fire', mod: 'cardinal' },
  taurus: { el: 'earth', mod: 'fixed' },
  gemini: { el: 'air', mod: 'mutable' },
  cancer: { el: 'water', mod: 'cardinal' },
  leo: { el: 'fire', mod: 'fixed' },
  virgo: { el: 'earth', mod: 'mutable' },
  libra: { el: 'air', mod: 'cardinal' },
  scorpio: { el: 'water', mod: 'fixed' },
  sagittarius: { el: 'fire', mod: 'mutable' },
  capricorn: { el: 'earth', mod: 'cardinal' },
  aquarius: { el: 'air', mod: 'fixed' },
  pisces: { el: 'water', mod: 'mutable' },
};

export const DIMENSION_LABELS: Record<CompatDimension, { ru: string; en: string }> = {
  love: { ru: 'Любовь', en: 'Love' },
  relationship: { ru: 'Отношения', en: 'Relationship' },
  friendship: { ru: 'Дружба', en: 'Friendship' },
  work: { ru: 'Работа', en: 'Work' },
};

const clamp = (n: number) => Math.max(35, Math.min(96, Math.round(n)));

function harmonious(a: Element, b: Element): boolean {
  return (
    (a === 'fire' && b === 'air') || (a === 'air' && b === 'fire') ||
    (a === 'earth' && b === 'water') || (a === 'water' && b === 'earth')
  );
}

function tense(a: Element, b: Element): boolean {
  return (
    (a === 'fire' && b === 'water') || (a === 'water' && b === 'fire') ||
    (a === 'air' && b === 'earth') || (a === 'earth' && b === 'air')
  );
}

function elementPairBase(a: Element, b: Element): number {
  if (a === b) return 78;
  if (harmonious(a, b)) return 84;
  if (tense(a, b)) return 50;
  return 62; // fire↔earth, air↔water
}

const VERDICTS: Array<{ min: number; ru: string; en: string }> = [
  { min: 82, ru: 'Сильная связь', en: 'Strong bond' },
  { min: 70, ru: 'Тёплая связь', en: 'Warm bond' },
  { min: 58, ru: 'С искрой', en: 'A spark' },
  { min: 46, ru: 'Непростая', en: 'Complex' },
  { min: 0, ru: 'Вызов', en: 'Challenging' },
];

export function getCompatScore(signAraw: string, signBraw: string, language: 'ru' | 'en' = 'ru'): CompatResult {
  const a = SIGN_INFO[String(signAraw).toLowerCase()] || SIGN_INFO.aries;
  const b = SIGN_INFO[String(signBraw).toLowerCase()] || SIGN_INFO.libra;

  const base = elementPairBase(a.el, b.el) + (a.mod === b.mod ? -2 : 3);
  const harm = harmonious(a.el, b.el);
  const has = (el: Element) => a.el === el || b.el === el;
  const sameEl = a.el === b.el;
  const anyFixed = a.mod === 'fixed' || b.mod === 'fixed';
  const anyCardinal = a.mod === 'cardinal' || b.mod === 'cardinal';

  const dims: Record<CompatDimension, number> = {
    love: clamp(base + (has('fire') ? 8 : -2) + (harm ? 4 : 0)),
    relationship: clamp(base + ((has('earth') || has('water')) ? 6 : -2) + (anyFixed ? 4 : 0)),
    friendship: clamp(base + (has('air') ? 8 : 0) + (sameEl ? 6 : 0)),
    work: clamp(base + (has('earth') ? 8 : -2) + (anyCardinal ? 4 : 0)),
  };

  const overall = Math.round((dims.love + dims.relationship + dims.friendship + dims.work) / 4);
  const strongest = (Object.keys(dims) as CompatDimension[]).reduce((best, key) =>
    dims[key] > dims[best] ? key : best, 'love' as CompatDimension);
  const verdict = (VERDICTS.find((v) => overall >= v.min) || VERDICTS[VERDICTS.length - 1])[language === 'en' ? 'en' : 'ru'];

  return { overall, dims, strongest, verdict };
}

/** Солнечный знак по дате рождения 'YYYY-MM-DD' (тропический, стандартные границы) */
export function sunSignFromDate(date?: string | null): string | null {
  if (!date) return null;
  const parts = String(date).split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return null;
  // Знак, который НАЧИНАЕТСЯ в этом месяце на день cutDay
  const cut: Array<[number, number, string]> = [
    [1, 20, 'aquarius'], [2, 19, 'pisces'], [3, 21, 'aries'], [4, 20, 'taurus'],
    [5, 21, 'gemini'], [6, 21, 'cancer'], [7, 23, 'leo'], [8, 23, 'virgo'],
    [9, 23, 'libra'], [10, 23, 'scorpio'], [11, 22, 'sagittarius'], [12, 22, 'capricorn'],
  ];
  // до граничного дня — знак, начавшийся в предыдущем месяце
  const [, cutDay, sign] = cut[m - 1];
  if (d < cutDay) {
    const prev = cut[(m + 10) % 12];
    return prev[2];
  }
  return sign;
}
