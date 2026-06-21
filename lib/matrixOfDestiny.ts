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
  self: { ru: 'Твоя суть', en: 'Your core', hintRu: 'Кто ты внутри', hintEn: 'Who you are inside' },
  portrait: { ru: 'Каким тебя видят', en: 'How others see you', hintRu: 'Первое впечатление', hintEn: 'First impression' },
  talents: { ru: 'Сильные стороны', en: 'Strengths', hintRu: 'На что опираться', hintEn: 'What to lean on' },
  karma: { ru: 'Зона роста', en: 'Growth area', hintRu: 'Главный урок', hintEn: 'Main lesson' },
  comfort: { ru: 'Зона комфорта', en: 'Comfort zone', hintRu: 'Где тебе спокойно', hintEn: 'Where you feel steady' },
  personalPurpose: { ru: 'Личные цели', en: 'Personal goals', hintRu: 'Что важно для себя', hintEn: 'For yourself' },
  socialPurpose: { ru: 'Роль среди людей', en: 'Role among people', hintRu: 'Чем ты полезен другим', hintEn: 'For others' },
  spiritualPurpose: { ru: 'Твой путь', en: 'Your path', hintRu: 'Куда ты идёшь', hintEn: 'Where you are heading' },
};

// Сферы жизни — отдельный блок (простые подписи, без эзотерики).
const LIFE_AREA_META: Record<MatrixLifeAreaKey, { ru: string; en: string; hintRu: string; hintEn: string }> = {
  money: { ru: 'Деньги и достаток', en: 'Money', hintRu: 'Как у тебя с ресурсом', hintEn: 'Your relationship with resources' },
  love: { ru: 'Любовь и близость', en: 'Love', hintRu: 'Что важно в отношениях', hintEn: 'What matters in relationships' },
  health: { ru: 'Энергия и здоровье', en: 'Energy & health', hintRu: 'Где твой ресурс', hintEn: 'Where your energy comes from' },
  lineage: { ru: 'Семейная линия', en: 'Family line', hintRu: 'Опора и опыт рода', hintEn: 'Roots and family experience' },
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
