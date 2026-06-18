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

export type MatrixResult = {
  day: number;
  month: number;
  year: number;
  /** Главный аркан (центр) */
  center: number;
  positions: MatrixPosition[];
};

/** Свести число к диапазону 1..22 (как в матрице судьбы). */
export function reduceToArcana(n: number): number {
  let x = Math.abs(Math.trunc(n));
  while (x > 22) {
    x = String(x).split('').reduce((s, d) => s + Number(d), 0);
  }
  return x === 0 ? 22 : x;
}

const POSITION_META: Record<MatrixPositionKey, { ru: string; en: string; hintRu: string; hintEn: string }> = {
  self: { ru: 'Твоя суть', en: 'Your core', hintRu: 'Главный аркан — кто ты внутри', hintEn: 'Your central archetype' },
  portrait: { ru: 'Каким тебя видят', en: 'How others see you', hintRu: 'Первое впечатление и портрет', hintEn: 'First impression' },
  talents: { ru: 'Таланты и сильные стороны', en: 'Talents & strengths', hintRu: 'На что опираться', hintEn: 'What to lean on' },
  karma: { ru: 'Кармическая задача', en: 'Karmic task', hintRu: 'Главный урок и зона роста', hintEn: 'Main lesson' },
  comfort: { ru: 'Зона комфорта', en: 'Comfort zone', hintRu: 'Где тебе спокойно и устойчиво', hintEn: 'Where you feel steady' },
  personalPurpose: { ru: 'Личное предназначение', en: 'Personal purpose', hintRu: 'Что важно реализовать для себя', hintEn: 'For yourself' },
  socialPurpose: { ru: 'Социальное предназначение', en: 'Social purpose', hintRu: 'Чем ты полезен другим', hintEn: 'For others' },
  spiritualPurpose: { ru: 'Главное предназначение', en: 'Main purpose', hintRu: 'Куда ведёт твой путь', hintEn: 'Where your path leads' },
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

  return { day, month, year, center: E, positions };
}
