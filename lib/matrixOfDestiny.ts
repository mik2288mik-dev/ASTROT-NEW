/**
 * Матрица судьбы — расчёт по дате рождения (метод Ладини, 22 старших аркана).
 * Чистая арифметика: сводим числа к 1–22. Никакого ИИ и серверных вызовов.
 */

export type MatrixPositionKey =
  | 'self'
  | 'portrait'
  | 'talents'
  | 'karma'
  | 'comfort'
  | 'personalPurpose'
  | 'socialPurpose'
  | 'spiritualPurpose';

export type MatrixPosition = {
  key: MatrixPositionKey;
  label: string;
  hint: string;
  arcana: number;
};

export type MatrixLifeAreaKey = 'money' | 'love' | 'health' | 'lineage';

export type MatrixLifeArea = {
  key: MatrixLifeAreaKey;
  label: string;
  hint: string;
  arcana: number;
};

export type MatrixResult = {
  day: number;
  month: number;
  year: number;
  /** Главный аркан (центр) */
  center: number;
  positions: MatrixPosition[];
  /** Дополнительные сферы жизни — деньги, любовь, энергия, род */
  lifeAreas: MatrixLifeArea[];
};

/** Свести число к диапазону 1..22 (как в матрице судьбы). */
export function reduceToArcana(n: number): number {
  let x = Math.abs(Math.trunc(n));
  while (x > 22) {
    x = String(x).split('').reduce((s, d) => s + Number(d), 0);
  }
  return x === 0 ? 22 : x;
}

// Подписи позиций — простым языком, без эзотерики («кармическая задача», «предназначение»).
const POSITION_META: Record<MatrixPositionKey, { ru: string; en: string; hintRu: string; hintEn: string }> = {
  self: { ru: 'Твой характер', en: 'Your character', hintRu: 'Привычный способ действовать', hintEn: 'Your usual way of acting' },
  portrait: { ru: 'Первое впечатление', en: 'First impression', hintRu: 'Как ты начинаешь знакомство', hintEn: 'How you meet someone' },
  talents: { ru: 'Сильные стороны', en: 'Strengths', hintRu: 'Что тебе даётся легче', hintEn: 'What comes easily to you' },
  karma: { ru: 'Что бывает непросто', en: 'What can be difficult', hintRu: 'Привычки, которые могут мешать', hintEn: 'Habits that can get in the way' },
  comfort: { ru: 'Что тебя радует', en: 'What you enjoy', hintRu: 'Когда тебе хорошо', hintEn: 'When you feel comfortable' },
  personalPurpose: { ru: 'Личные цели', en: 'Personal goals', hintRu: 'Что важно для себя', hintEn: 'For yourself' },
  socialPurpose: { ru: 'Среди людей', en: 'With other people', hintRu: 'Как ты участвуешь в общем деле', hintEn: 'How you join a shared task' },
  spiritualPurpose: { ru: 'Твои интересы', en: 'Your interests', hintRu: 'Что тебе хочется узнать и попробовать', hintEn: 'What you want to explore' },
};

// Сферы жизни — отдельный блок (простые подписи, без эзотерики).
const LIFE_AREA_META: Record<MatrixLifeAreaKey, { ru: string; en: string; hintRu: string; hintEn: string }> = {
  money: { ru: 'Деньги', en: 'Money', hintRu: 'Покупки и привычки', hintEn: 'Spending and habits' },
  love: { ru: 'Любовь и близость', en: 'Love', hintRu: 'Что важно в отношениях', hintEn: 'What matters in relationships' },
  health: { ru: 'Дела и отдых', en: 'Activity and rest', hintRu: 'Привычный ритм жизни', hintEn: 'Your everyday pace' },
  lineage: { ru: 'Семья', en: 'Family', hintRu: 'Отношения с близкими', hintEn: 'Relationships with family' },
};

/**
 * Рассчитать матрицу по дате рождения ("YYYY-MM-DD"). Время и место НЕ нужны.
 */
export function computeMatrix(birthDate: string, language: 'ru' | 'en' = 'ru'): MatrixResult | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(birthDate || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!day || !month || !year || month > 12 || day > 31) return null;

  const A = reduceToArcana(day);
  const B = reduceToArcana(month);
  const C = reduceToArcana(String(year).split('').reduce((s, d) => s + Number(d), 0));
  const D = reduceToArcana(A + B + C);
  const E = reduceToArcana(A + B + C + D);
  const personal = reduceToArcana(A + B);
  const social = reduceToArcana(C + D);
  const spiritual = reduceToArcana(personal + social);

  const order: Array<[MatrixPositionKey, number]> = [
    ['self', E],
    ['portrait', A],
    ['talents', B],
    ['karma', C],
    ['comfort', D],
    ['personalPurpose', personal],
    ['socialPurpose', social],
    ['spiritualPurpose', spiritual],
  ];

  const positions: MatrixPosition[] = order.map(([key, arcana]) => ({
    key,
    arcana,
    label: language === 'en' ? POSITION_META[key].en : POSITION_META[key].ru,
    hint: language === 'en' ? POSITION_META[key].hintEn : POSITION_META[key].hintRu,
  }));

  // Сферы жизни — детерминированные комбинации базовых чисел (про самопонимание, не предсказание).
  const lifeOrder: Array<[MatrixLifeAreaKey, number]> = [
    ['money', reduceToArcana(B + D)],
    ['love', reduceToArcana(A + personal)],
    ['health', reduceToArcana(E + B)],
    ['lineage', reduceToArcana(C + social)],
  ];
  const lifeAreas: MatrixLifeArea[] = lifeOrder.map(([key, arcana]) => ({
    key,
    arcana,
    label: language === 'en' ? LIFE_AREA_META[key].en : LIFE_AREA_META[key].ru,
    hint: language === 'en' ? LIFE_AREA_META[key].hintEn : LIFE_AREA_META[key].hintRu,
  }));

  return { day, month, year, center: E, positions, lifeAreas };
}
