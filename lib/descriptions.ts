const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
] as const;

type BodyType = 'sun' | 'moon' | 'ascendant';
type SignName = typeof SIGN_NAMES[number];

const DESCRIPTIONS: Record<BodyType, Record<SignName, string>> = {
  sun: {
    Aries: 'Лидер, энергичный, импульсивный',
    Taurus: 'Надёжный, упорный, чувственный',
    Gemini: 'Любопытный, общительный, гибкий',
    Cancer: 'Эмоциональный, заботливый, интуитивный',
    Leo: 'Творческий, щедрый, уверенный',
    Virgo: 'Аналитичный, практичный, перфекционист',
    Libra: 'Дипломатичный, гармоничный, эстет',
    Scorpio: 'Глубокий, страстный, трансформирующий',
    Sagittarius: 'Свободолюбивый, философ, искатель',
    Capricorn: 'Целеустремлённый, дисциплинированный, амбициозный',
    Aquarius: 'Оригинальный, гуманист, независимый',
    Pisces: 'Чувствительный, мечтательный, сострадательный',
  },
  moon: {
    Aries: 'Импульсивные эмоции, быстрая реакция',
    Taurus: 'Стабильность, потребность в комфорте',
    Gemini: 'Изменчивость, потребность в общении',
    Cancer: 'Глубокие чувства, привязанность к дому',
    Leo: 'Яркие эмоции, потребность в признании',
    Virgo: 'Анализ чувств, практичность в эмоциях',
    Libra: 'Потребность в гармонии, партнёрстве',
    Scorpio: 'Интенсивные переживания, глубина',
    Sagittarius: 'Оптимизм, свобода в чувствах',
    Capricorn: 'Сдержанность, ответственность',
    Aquarius: 'Отстранённость, нестандартность',
    Pisces: 'Эмпатия, мечтательность, интуиция',
  },
  ascendant: {
    Aries: 'Активная маска, первопроходец',
    Taurus: 'Спокойная маска, материалист',
    Gemini: 'Лёгкая маска, коммуникатор',
    Cancer: 'Защитная маска, заботливый',
    Leo: 'Яркая маска, центр внимания',
    Virgo: 'Скромная маска, служитель',
    Libra: 'Обходительная маска, дипломат',
    Scorpio: 'Загадочная маска, магнетизм',
    Sagittarius: 'Открытая маска, искатель истины',
    Capricorn: 'Серьёзная маска, амбиции',
    Aquarius: 'Уникальная маска, новатор',
    Pisces: 'Мягкая маска, мечтатель',
  },
};

export function getShortDescription(body: BodyType, sign: string): string {
  const normalizedSign = sign?.trim();
  if (!normalizedSign) return '';

  const signKey = SIGN_NAMES.find(s => s.toLowerCase() === normalizedSign.toLowerCase());
  if (!signKey) return '';

  const bodyMap = DESCRIPTIONS[body];
  if (!bodyMap) return '';

  return bodyMap[signKey] || '';
}
