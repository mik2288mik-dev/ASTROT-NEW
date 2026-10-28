/**
 * Китайский гороскоп: животное года, стихия, характер и отношения между животными.
 * Новый год по китайскому календарю наступает в конце января или в феврале (даты до 2026 включительно), поэтому
 * день рождения до этой даты относится к прошлому году.
 */
export type ChineseAnimal = {
  name: string;
  /** Для согласования стихии: «Деревянный Дракон» или «Деревянная Змея». */
  gender: 'm' | 'f';
  hieroglyph: string;
  character: string;
  /** Что ждать в 2026 году (год Лошади). */
  year2026: string;
};

export const CHINESE_ANIMALS: ChineseAnimal[] = [
  {
    "name": "Крыса",
    "gender": "f",
    "hieroglyph": "鼠",
    "character": "Находчивая и быстрая: видит выгоду там, где другие проходят мимо. Ценит своих и умеет копить.",
    "year2026": "Лошадь стоит напротив Крысы, поэтому год с напряжением. Лучше не рисковать деньгами и держаться проверенных людей."
  },
  {
    "name": "Бык",
    "gender": "m",
    "hieroglyph": "牛",
    "character": "Терпеливый и надёжный: делает медленно, но на века. Не любит, когда торопят.",
    "year2026": "Год быстрый, а Бык любит без спешки. Получится, если не спорить с переменами, а встроить их в свой план."
  },
  {
    "name": "Тигр",
    "gender": "m",
    "hieroglyph": "虎",
    "character": "Смелый и прямой: бросается в бой за своих. Не терпит, когда им командуют.",
    "year2026": "Хороший год: Лошадь и Тигр союзники. Смелые шаги в работе и любви получатся."
  },
  {
    "name": "Кролик",
    "gender": "m",
    "hieroglyph": "兔",
    "character": "Мягкий и дипломатичный: умеет сгладить любой спор. Ценит уют и спокойствие.",
    "year2026": "Спокойный год без резких поворотов. Хорошо заняться домом и тем, что радует."
  },
  {
    "name": "Дракон",
    "gender": "m",
    "hieroglyph": "龍",
    "character": "Яркий и уверенный: любит большие цели и внимание. Заражает других своей энергией.",
    "year2026": "Энергии много, но не всё пойдёт по плану. Помогут союзники: не тяни всё в одиночку."
  },
  {
    "name": "Змея",
    "gender": "f",
    "hieroglyph": "蛇",
    "character": "Мудрая и спокойная: сначала думает, потом делает. Хорошо чувствует людей и редко в них ошибается.",
    "year2026": "Год требует скорости, а Змея любит подумать. Хорошо для учёбы и новых связей, а большие решения лучше принимать без спешки."
  },
  {
    "name": "Лошадь",
    "gender": "f",
    "hieroglyph": "馬",
    "character": "Свободная и быстрая: любит движение, новых людей и перемены. Скучает в рутине.",
    "year2026": "Год своего знака: энергии много, но легко перегореть. Выбирай главное и береги силы."
  },
  {
    "name": "Коза",
    "gender": "f",
    "hieroglyph": "羊",
    "character": "Творческая и добрая: тонко чувствует красоту. Лучше раскрывается, когда рядом поддержка.",
    "year2026": "Лошадь и Коза дружат, поэтому год мягкий. Хорошо для творчества, отношений и дома."
  },
  {
    "name": "Обезьяна",
    "gender": "f",
    "hieroglyph": "猴",
    "character": "Умная и весёлая: найдёт выход из любой ситуации. Быстро учится и так же быстро скучает.",
    "year2026": "Год активный, и Обезьяне это нравится. Новые знакомства и поездки принесут пользу."
  },
  {
    "name": "Петух",
    "gender": "m",
    "hieroglyph": "雞",
    "character": "Честный и собранный: любит порядок и говорит правду в лицо. Замечает любую мелочь.",
    "year2026": "Год шумный, а Петух любит порядок. Получится, если не пытаться всё контролировать."
  },
  {
    "name": "Собака",
    "gender": "f",
    "hieroglyph": "狗",
    "character": "Верная и справедливая: защищает своих и не терпит фальши. На неё можно положиться.",
    "year2026": "Хороший год: Лошадь и Собака союзники. Время для смелых решений и новых друзей."
  },
  {
    "name": "Свинья",
    "gender": "f",
    "hieroglyph": "豬",
    "character": "Щедрая и открытая: умеет радоваться жизни и делиться. Верит людям, иногда слишком.",
    "year2026": "Ровный год. Хорошо для денег и отдыха, а в спорах лучше уступать."
  }
];

/** Родительный падеж: «год Крысы». */
export const CHINESE_GENITIVE: string[] = ["Крысы","Быка","Тигра","Кролика","Дракона","Змеи","Лошади","Козы","Обезьяны","Петуха","Собаки","Свиньи"];

export type ChineseElement = { name: string; masculine: string; feminine: string; color: string; text: string };

export const CHINESE_ELEMENTS: ChineseElement[] = [
  {
    "name": "Металл",
    "masculine": "Металлический",
    "feminine": "Металлическая",
    "color": "#8A94A6",
    "text": "Металл даёт твёрдость и честность: держишь слово и не любишь полумер."
  },
  {
    "name": "Вода",
    "masculine": "Водяной",
    "feminine": "Водяная",
    "color": "#3A7BD5",
    "text": "Вода даёт гибкость и чутьё: легко подстраиваешься и понимаешь людей."
  },
  {
    "name": "Дерево",
    "masculine": "Деревянный",
    "feminine": "Деревянная",
    "color": "#2FA36B",
    "text": "Дерево даёт рост и доброту: тянешься к новому и помогаешь расти другим."
  },
  {
    "name": "Огонь",
    "masculine": "Огненный",
    "feminine": "Огненная",
    "color": "#F08A3C",
    "text": "Огонь даёт страсть и смелость: зажигаешь других и действуешь быстро."
  },
  {
    "name": "Земля",
    "masculine": "Земляной",
    "feminine": "Земляная",
    "color": "#C9973B",
    "text": "Земля даёт опору и терпение: на тебя можно положиться, ты строишь надолго."
  }
];

export type ChineseRelation = 'trine' | 'friend' | 'same' | 'neutral' | 'harm' | 'clash';

export const CHINESE_RELATIONS: Record<ChineseRelation, { title: string; text: string }> = {
  "trine": {
    "title": "Союзники",
    "text": "Одна команда: похожие цели и общий ритм. Легко понимать друг друга без долгих объяснений."
  },
  "friend": {
    "title": "Тайные друзья",
    "text": "Разные, но тянутся друг к другу. Каждый даёт другому то, чего ему не хватает."
  },
  "same": {
    "title": "Похожие",
    "text": "Одно животное: много общего, но и одинаковые слабые места. Важно не соревноваться."
  },
  "neutral": {
    "title": "Ровно",
    "text": "Без особой тяги и без острых углов. Всё решает умение договариваться."
  },
  "harm": {
    "title": "Трения",
    "text": "Мелкие обиды копятся незаметно. Помогает говорить о них сразу, пока они маленькие."
  },
  "clash": {
    "title": "Противоположности",
    "text": "Разный взгляд на жизнь, поэтому искрит. Это притягивает, если уважать разницу."
  }
};

/** День китайского Нового года (месяц*100+день) для лет с 1950 по 2026. */
const NEW_YEAR_DAY = [217,206,127,214,203,124,212,131,218,208,128,215,205,125,213,202,121,209,130,217,206,127,215,203,123,211,131,218,207,128,216,205,125,213,202,220,209,129,217,206,127,215,204,123,210,131,219,207,128,216,205,124,212,201,122,209,129,218,207,126,214,203,123,210,131,219,208,128,216,205,125,212,201,122,210,129,217];
const NEW_YEAR_FIRST_YEAR = 1950;
const NEW_YEAR_FALLBACK = 204;

const HARM_PAIRS: Array<[number, number]> = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
const FRIEND_PAIRS: Array<[number, number]> = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];

const inPairs = (pairs: Array<[number, number]>, a: number, b: number) =>
  pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export type ChineseSign = { year: number; animal: number; element: number };

/** Китайский знак по дате рождения. Для лет до 1950 берётся 4 февраля как среднее. */
export function chineseSign(birthDate: string): ChineseSign | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate || '');
  if (!match) return null;
  const year = Number(match[1]);
  const monthDay = Number(match[2]) * 100 + Number(match[3]);
  const newYear = NEW_YEAR_DAY[year - NEW_YEAR_FIRST_YEAR] ?? NEW_YEAR_FALLBACK;
  const chineseYear = monthDay < newYear ? year - 1 : year;
  return { year: chineseYear, animal: (((chineseYear - 4) % 12) + 12) % 12, element: Math.floor((chineseYear % 10) / 2) };
}

export function chineseAdjective(sign: ChineseSign): string {
  const element = CHINESE_ELEMENTS[sign.element];
  const animal = CHINESE_ANIMALS[sign.animal];
  return `${animal.gender === 'm' ? element.masculine : element.feminine} ${animal.name}`;
}

/** Годы с 1930 по 2026, в которые родились люди этого животного. */
export function chineseYears(animal: number): number[] {
  const years: number[] = [];
  for (let year = 1930; year <= 2026; year += 1) if ((((year - 4) % 12) + 12) % 12 === animal) years.push(year);
  return years;
}

export function chineseRelation(a: number, b: number): ChineseRelation {
  if (a === b) return 'same';
  if (a % 4 === b % 4) return 'trine';
  if (inPairs(FRIEND_PAIRS, a, b)) return 'friend';
  if ((a + 6) % 12 === b) return 'clash';
  if (inPairs(HARM_PAIRS, a, b)) return 'harm';
  return 'neutral';
}

/** Год рождения как «1989», без даты: для сравнения по году. */
export function chineseSignOfYear(year: number): ChineseSign {
  return { year, animal: (((year - 4) % 12) + 12) % 12, element: Math.floor((year % 10) / 2) };
}
