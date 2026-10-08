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
  areas: CompatDimension[];              // сферы, которые показываем и усредняем
  strongest: CompatDimension;
  verdict: string;                       // короткое слово-вердикт
  verdictNote: string;                   // одна фраза: что этот вердикт значит для пары
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

/** Five mood levels, from a sad blue face to a happy yellow one; index 0 is the lowest. */
const VERDICTS: Array<{ min: number; ru: string; en: string; noteRu: string; noteEn: string }> = [
  { min: 82, ru: 'Отлично', en: 'Excellent', noteRu: 'Вам легко вместе почти во всём.', noteEn: 'You find it easy together in almost everything.' },
  { min: 70, ru: 'Хорошо', en: 'Good', noteRu: 'Вам хорошо вместе, а разница только добавляет интереса.', noteEn: 'You feel good together, and your differences add interest.' },
  { min: 58, ru: 'Нормально', en: 'Fine', noteRu: 'Есть притяжение и пара тем, о которых стоит договориться.', noteEn: 'There is a pull and a couple of things worth agreeing on.' },
  { min: 46, ru: 'Не очень', en: 'So-so', noteRu: 'Разный темп и характер. Связь, в которой важно договариваться.', noteEn: 'A different pace and character. A bond that needs talking things through.' },
  { min: 0, ru: 'Ужасно', en: 'Bad', noteRu: 'Вы очень разные, и вместе непросто. Зато есть чему поучиться друг у друга.', noteEn: 'You are very different and it is not easy together, yet you can learn a lot from each other.' },
];

export type CompatLevel = { index: 0 | 1 | 2 | 3 | 4; label: string };

/** The mood level of any score: 0 «Ужасно» … 4 «Отлично». */
export function compatLevel(value: number, language: 'ru' | 'en' = 'ru'): CompatLevel {
  const position = VERDICTS.findIndex((v) => value >= v.min);
  const row = VERDICTS[position < 0 ? VERDICTS.length - 1 : position];
  return { index: (VERDICTS.length - 1 - (position < 0 ? VERDICTS.length - 1 : position)) as CompatLevel['index'], label: language === 'en' ? row.en : row.ru };
}

/** Love and romantic relationship are left out when both people are the same gender. */
export function compatAreas(sameGender = false): CompatDimension[] {
  return sameGender ? ['friendship', 'work'] : ['love', 'relationship', 'friendship', 'work'];
}

export function getCompatScore(signAraw: string, signBraw: string, language: 'ru' | 'en' = 'ru', sameGender = false): CompatResult {
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

  const areas = compatAreas(sameGender);
  const overall = Math.round(areas.reduce((sum, key) => sum + dims[key], 0) / areas.length);
  const strongest = areas.reduce((best, key) => (dims[key] > dims[best] ? key : best), areas[0]);
  const verdictRow = VERDICTS.find((v) => overall >= v.min) || VERDICTS[VERDICTS.length - 1];
  const verdict = verdictRow[language === 'en' ? 'en' : 'ru'];
  const verdictNote = language === 'en' ? verdictRow.noteEn : verdictRow.noteRu;

  return { overall, dims, areas, strongest, verdict, verdictNote };
}

const ELEMENT_RU: Record<Element, { gen: string; gives: string }> = {
  fire: { gen: 'огня', gives: 'страсть и яркие чувства' },
  earth: { gen: 'земли', gives: 'надёжность и заботу делом' },
  air: { gen: 'воздуха', gives: 'лёгкое общение и общие интересы' },
  water: { gen: 'воды', gives: 'тепло и умение чувствовать друг друга' },
};

/** The element each area leans on, in the same order the score above adds its bonus. */
const AREA_ELEMENTS: Record<CompatDimension, Element[]> = {
  love: ['fire'],
  relationship: ['earth', 'water'],
  friendship: ['air'],
  work: ['earth'],
};

/** The way of acting each area also leans on, matching the modality bonus in the score. */
const AREA_MODALITY: Partial<Record<CompatDimension, Modality>> = {
  relationship: 'fixed',
  work: 'cardinal',
};

const MODALITY_RU: Record<Modality, { one: string; both: string }> = {
  cardinal: { one: 'из знаков, которые любят начинать новое и вести за собой, а это сильно помогает в общем деле', both: 'Оба ваших знака любят начинать новое и вести за собой, а это сильно помогает в общем деле' },
  fixed: { one: 'из знаков, которые держатся за своих и доводят начатое до конца', both: 'Оба ваших знака держатся за своих и доводят начатое до конца' },
  mutable: { one: 'из знаков, которые легко подстраиваются под перемены', both: 'Оба ваших знака легко подстраиваются под перемены' },
};

/**
 * Why the strongest area came out on top, told from the same element rules the
 * score uses, so the sentence matches the number. Names are display sign names.
 */
export function strongestAreaReason(
  signAraw: string,
  signBraw: string,
  nameA: string,
  nameB: string,
  language: 'ru' | 'en' = 'ru',
  sameGender = false,
): string {
  const a = SIGN_INFO[String(signAraw).toLowerCase()] || SIGN_INFO.aries;
  const b = SIGN_INFO[String(signBraw).toLowerCase()] || SIGN_INFO.libra;
  const { strongest } = getCompatScore(signAraw, signBraw, language, sameGender);
  const element = AREA_ELEMENTS[strongest].find((el) => a.el === el || b.el === el);
  const owner = element ? (a.el === element ? nameA : nameB) : null;
  const extra = a.el === b.el
    ? (language === 'en' ? ' You also share an element and understand each other easily.' : ' Вдобавок вы из одной стихии и легко понимаете друг друга.')
    : harmonious(a.el, b.el)
      ? (language === 'en' ? ' Your elements also complement each other well.' : ' Вдобавок ваши стихии хорошо дополняют друг друга.')
      : '';
  if (language === 'en') {
    return element && owner
      ? `${owner} belongs to ${element}, and ${element} brings this area its strength.${extra}`
      : `This area scored highest from how your two elements combine.${extra}`;
  }
  if (element && a.el === element && b.el === element) {
    return `Оба ваших знака из стихии ${ELEMENT_RU[element].gen}, а она даёт паре ${ELEMENT_RU[element].gives}.`;
  }
  if (!element && strongest === 'friendship' && a.el === b.el) {
    return `Вы из одной стихии ${ELEMENT_RU[a.el].gen}, поэтому легко понимаете друг друга и вам интересно вместе.`;
  }
  if (!element) {
    // No element bonus: the area won on the sign's way of acting (the same bonus the score adds).
    const modality = AREA_MODALITY[strongest];
    const owners = modality ? [a.mod === modality ? nameA : null, b.mod === modality ? nameB : null].filter(Boolean) : [];
    if (modality && owners.length) {
      return owners.length === 2
        ? `${MODALITY_RU[modality].both}.${extra}`
        : `${owners[0]} ${MODALITY_RU[modality].one}.${extra}`;
    }
  }
  if (element && owner) {
    return `${owner} из стихии ${ELEMENT_RU[element].gen}, а она даёт паре ${ELEMENT_RU[element].gives}.${extra}`;
  }
  if (strongest === 'friendship' && a.el !== 'earth' && b.el !== 'earth') {
    return `Дружба у вас сильнее работы: в паре нет знака земли, а именно земля помогает в общих делах.${extra}`;
  }
  return `Эта сфера получилась сильнее остальных благодаря сочетанию ваших стихий.${extra}`;
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
