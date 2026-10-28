/**
 * Numerology for «Моя карта → Числа»: life path, the personal year / month / day,
 * the Pythagorean square and the numbers of a name. Pure calculations, no network.
 * Texts are plain and warm, the same voice as the rest of the app.
 */

export type NumberMeaning = { title: string; text: string; short: string };

const digitSum = (value: number): number => String(Math.abs(Math.trunc(value))).split('').reduce((sum, ch) => sum + Number(ch), 0);

/** Reduces to one digit; 11 and 22 stay as they are when `master` is on. */
export function reduceNumber(value: number, master = false): number {
  let current = Math.abs(Math.trunc(value));
  while (current > 9) {
    if (master && (current === 11 || current === 22)) return current;
    current = digitSum(current);
  }
  return current;
}

export type BirthParts = { year: number; month: number; day: number };

export function parseBirthDate(value: string | null | undefined): BirthParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31 || parts.year < 1900) return null;
  return parts;
}

/** Число судьбы: day, month and year are reduced one by one, then added together. */
export function lifePathNumber(birth: BirthParts): number {
  return reduceNumber(reduceNumber(birth.day, true) + reduceNumber(birth.month, true) + reduceNumber(birth.year, true), true);
}

export function personalYearNumber(birth: BirthParts, year: number): number {
  return reduceNumber(reduceNumber(birth.day) + reduceNumber(birth.month) + reduceNumber(year));
}

export function personalMonthNumber(birth: BirthParts, year: number, month: number): number {
  return reduceNumber(personalYearNumber(birth, year) + month);
}

export function personalDayNumber(birth: BirthParts, year: number, month: number, day: number): number {
  return reduceNumber(personalMonthNumber(birth, year, month) + day);
}

export type NumberRow = { n: number; count: number; digits: string };
export type PythagorasSquare = {
  /** The four working numbers of the method. */
  working: [number, number, number, number];
  /** Cells in the order of the canvas: 1 2 3 / 4 5 6 / 7 8 9. */
  cells: NumberRow[];
};

/** Квадрат Пифагора: the digits of the date and of the four working numbers are counted. */
export function pythagorasSquare(birth: BirthParts): PythagorasSquare {
  const day = String(birth.day).padStart(2, '0');
  const month = String(birth.month).padStart(2, '0');
  const dateDigits = `${day}${month}${birth.year}`;
  const first = digitSum(Number(dateDigits));
  const second = digitSum(first);
  const firstDayDigit = Number(day[0]) || Number(day[1]);
  const third = Math.abs(first - 2 * firstDayDigit);
  const fourth = digitSum(third);
  const all = `${dateDigits}${first}${second}${third}${fourth}`;
  const cells = Array.from({ length: 9 }, (_, index) => {
    const n = index + 1;
    const count = all.split('').filter((ch) => ch === String(n)).length;
    return { n, count, digits: count ? String(n).repeat(count) : '' };
  });
  return { working: [first, second, third, fourth], cells };
}

// ───────────── Texts ─────────────

export const LIFE_PATH: Record<number, NumberMeaning> = {
  1: { title: 'Ты начинаешь первым', short: 'Лидер', text: 'Тебе важно самому выбирать путь и вести за собой. Ты лучше всех начинаешь новое, а вот ждать подсказок тяжело. Твоя сила в решительности, а слабое место в упрямстве: иногда полезно спросить, что думают другие.' },
  2: { title: 'Ты умеешь договариваться', short: 'Миротворец', text: 'Ты чувствуешь людей и мягко сглаживаешь углы. Рядом с тобой спокойнее и тем, кто горячится, и тем, кто молчит. Твоя сила в чуткости, а слабое место в том, что ты слишком долго подстраиваешься. Говорить о своих желаниях тоже важно.' },
  3: { title: 'Тебе нужно выражать себя', short: 'Творец', text: 'Тебе нужно говорить, творить и радовать людей. Ты легко заводишь знакомства и находишь слова, когда другие теряются. Твоя сила в живости, а слабое место в разбросанности: полезно доводить начатое до конца.' },
  4: { title: 'На тебя можно опереться', short: 'Строитель', text: 'Ты строишь всё основательно: планы, дом, отношения. Любишь порядок и держишь слово. Твоя сила в надёжности, а слабое место в том, что трудно принимать перемены. Иногда стоит делать что-то просто для радости, без списка.' },
  5: { title: 'Тебе нужны свобода и новые впечатления', short: 'Искатель', text: 'Тебе нужны движение, дорога и перемены. Рутина быстро надоедает, зато ты легко приспосабливаешься и находишь выход там, где другие застревают. Твоя сила в гибкости, а слабое место в непостоянстве: важное лучше закреплять.' },
  6: { title: 'Ты заботишься о близких', short: 'Хранитель', text: 'Дом, семья и близкие для тебя главное. Ты умеешь создавать уют и поддерживать людей. Твоя сила в тепле и ответственности, а слабое место в том, что ты берёшь на себя слишком много. Отдых для тебя не каприз, а необходимость.' },
  7: { title: 'Тебе важно понять, как всё устроено', short: 'Мыслитель', text: 'Ты ищешь суть и не любишь поверхностное. Тебе нужно время наедине с собой, там ты думаешь лучше всего. Твоя сила в глубине и интуиции, а слабое место в замкнутости: близким полезно знать, что у тебя на душе.' },
  8: { title: 'Ты умеешь добиваться своего', short: 'Достигатель', text: 'Ты хорошо видишь цель, считаешь ресурсы и доводишь дело до результата. Тебе близки деньги, власть и ответственность за большое дело. Твоя сила в упорстве, а слабое место в том, что работа может вытеснить всё остальное.' },
  9: { title: 'Тебе хочется, чтобы сделанное помогало людям', short: 'Помощник', text: 'Тебе мало просто сделать, хочется, чтобы это кому-то помогло. Отсюда сила и усталость: ты берёшь на себя больше других. Твоя сила в щедрости и широком взгляде, а слабое место в том, что трудно отпускать прошлое.' },
  11: { title: 'Ты чувствуешь больше, чем можешь объяснить', short: 'Чуткий', text: 'У тебя очень тонкая интуиция, ты улавливаешь настроение людей и ситуаций раньше, чем они сами это понимают. Твоя сила в вдохновении, а слабое место в напряжении: тебе нужно больше тишины и отдыха, чем другим.' },
  22: { title: 'Тебе по силам дела, которые переживут тебя', short: 'Созидатель', text: 'Ты умеешь превращать большие идеи в реальные дела. У тебя есть и воображение, и практичность. Твоя сила в масштабе, а слабое место в строгости к себе: не обязательно всё делать идеально и в одиночку.' },
};

export const PERSONAL_YEAR: Record<number, string> = {
  1: 'Год новых начал. Хорошо браться за своё, менять привычки и строить планы на несколько лет вперёд.',
  2: 'Год терпения и отношений. Результаты приходят медленнее, зато важны союзы, договорённости и умение ждать.',
  3: 'Год общения и творчества. Больше встреч, идей и лёгкости. Хорошо показывать себя и учиться новому.',
  4: 'Год порядка и труда. Время укреплять основу: деньги, дом, здоровье, документы. Отдых тоже нужно планировать.',
  5: 'Год перемен и движения. Поездки, новые люди и неожиданные повороты. Хорошо пробовать новое и не бояться менять планы.',
  6: 'Год семьи и заботы. Важны дом, близкие и ответственность. Хорошо налаживать отношения и наводить уют.',
  7: 'Год размышлений. Время остановиться, разобраться в себе, учиться и больше быть наедине. Важное лучше не форсировать.',
  8: 'Год денег и результатов. Хорошо заниматься работой, финансами и крупными целями. Внимание к своим силам.',
  9: 'Год завершений. Время закончить старое, отпустить лишнее и подготовить место для нового цикла.',
};

export const PERSONAL_MONTH: Record<number, string> = {
  1: 'Хорошо начинать своё.',
  2: 'Лучше не торопить события и договариваться.',
  3: 'Больше общения, хорошо показывать себя.',
  4: 'Месяц порядка: дела, деньги, документы.',
  5: 'Много движения и неожиданных предложений.',
  6: 'Важны дом и близкие.',
  7: 'Нужно больше времени для себя.',
  8: 'Хороший месяц для работы и денег.',
  9: 'Время закончить начатое и разобрать лишнее.',
};

export const PERSONAL_DAY: Record<number, string> = {
  1: 'Хорошо браться за новое и решать за себя.',
  2: 'Лучше договариваться, чем настаивать.',
  3: 'Хороший день для общения и идей.',
  4: 'День для привычных дел и порядка.',
  5: 'Тянет на новое: поездки, встречи, смена обстановки.',
  6: 'Дом и близкие на первом месте.',
  7: 'Нужно побыть в тишине и подумать.',
  8: 'Хорошо заниматься делами и деньгами.',
  9: 'Хорошо завершать дела и отпускать лишнее.',
};

export type SquareCell = { title: string; none: string; some: string; strong: string };
export const SQUARE_CELLS: Record<number, SquareCell> = {
  1: { title: 'Характер', none: 'Воля мягкая: ты чаще уступаешь, чем настаиваешь. Сила воли развивается в спокойных, но регулярных делах.', some: 'Характер ровный: ты умеешь настоять на своём, не давя на других.', strong: 'Сильный, упрямый характер. Ты точно знаешь, чего хочешь, и мало кто может тебя переубедить.' },
  2: { title: 'Энергия', none: 'Своей энергии немного, и ты чутко её берёшь у людей и природы. Тебе важно высыпаться и отдыхать.', some: 'Энергии хватает на привычные дела. Следи за режимом, и сил будет достаточно.', strong: 'Энергии много, она заразительна. Ей нужен выход: спорт, дело или хобби.' },
  3: { title: 'Интерес к знаниям', none: 'Знания даются через опыт, а не через учебники. Лучше учиться на практике.', some: 'Тебе интересно узнавать новое, особенно если это связано с жизнью.', strong: 'Тебя тянет к учёбе, ты легко схватываешь и любишь разбираться в причинах.' },
  4: { title: 'Здоровье', none: 'Здоровью нужно внимание: режим, сон и движение дают больше, чем кажется.', some: 'Здоровье обычное. Хорошо работают регулярность и спокойный ритм.', strong: 'Крепкое здоровье и выносливость. Главное не растрачивать их на спешку.' },
  5: { title: 'Логика', none: 'Решения ты принимаешь скорее сердцем и интуицией. Для важного пригодится план на бумаге.', some: 'Логика и интуиция у тебя работают вместе, и это хорошее сочетание.', strong: 'Ты хорошо считаешь и видишь причины. Интуиция тоже сильна: ей стоит доверять.' },
  6: { title: 'Труд', none: 'Рутина тебе не близка, ты работаешь рывками. Лучше выбирать дело с разнообразием.', some: 'Ты спокойно работаешь руками и головой, особенно когда видишь смысл.', strong: 'Ты практичный и трудолюбивый. Умеешь работать руками и любишь, когда всё сделано хорошо.' },
  7: { title: 'Удача', none: 'Удача сама не придёт, поэтому полагайся на план и подготовку, а не на случай.', some: 'Иногда везёт, иногда нет. Помогают подготовка и спокойствие.', strong: 'Тебе часто везёт в нужный момент. Хорошо, если ты не забываешь работать и не рассчитываешь только на удачу.' },
  8: { title: 'Долг', none: 'Обязательства даются тяжело: тебе нужна свобода, и ты не любишь, когда на тебя давят.', some: 'Ты держишь слово, когда понимаешь, зачем это нужно.', strong: 'Ты очень ответственный: помнишь о долге перед людьми. Не забывай и о себе.' },
  9: { title: 'Память', none: 'Мелкие детали забываются, помогают записи и напоминания. Зато ты легче отпускаешь прошлое.', some: 'Память нормальная: главное ты помнишь, а лишнее забываешь.', strong: 'У тебя цепкая память и тяга к знаниям. Ты помнишь людей, слова и детали.' },
};

export type SquareTier = 'none' | 'some' | 'strong';
export function squareTier(count: number): SquareTier {
  return count === 0 ? 'none' : count >= 3 ? 'strong' : 'some';
}

/** One plain sentence about the strongest and the empty cells, as on the canvas. */
export function squareSummary(square: PythagorasSquare): string {
  const strong = square.cells.filter((cell) => cell.count >= 3).map((cell) => cell.n);
  const none = square.cells.filter((cell) => cell.count === 0).map((cell) => cell.n);
  const parts: string[] = [];
  if (strong.length) parts.push(`Ярче всего: ${strong.map((n) => SQUARE_CELLS[n].title.toLowerCase()).join(', ')}.`);
  if (none.length) parts.push(`Пустые клетки: ${none.map((n) => SQUARE_CELLS[n].title.toLowerCase()).join(', ')}. Здесь лучше опираться на план, а не на удачу.`);
  return parts.join(' ') || 'У тебя ровный набор, без сильных перекосов.';
}

// ───────────── Numbers of a name ─────────────

const LETTER_VALUE: Record<string, number> = {
  а: 1, б: 2, в: 3, г: 4, д: 5, е: 6, ё: 7, ж: 8, з: 9,
  и: 1, й: 2, к: 3, л: 4, м: 5, н: 6, о: 7, п: 8, р: 9,
  с: 1, т: 2, у: 3, ф: 4, х: 5, ц: 6, ч: 7, ш: 8, щ: 9,
  ъ: 1, ы: 2, ь: 3, э: 4, ю: 5, я: 6,
};
const VOWELS = new Set('аеёиоуыэюя'.split(''));

export type NameNumbers = { soul: number; outer: number; talent: number };

/** Души (гласные), внешнего образа (согласные) и всего имени. Works for Russian letters. */
export function nameNumbers(name: string): NameNumbers | null {
  const letters = String(name || '').toLowerCase().split('').filter((ch) => ch in LETTER_VALUE);
  if (letters.length < 2) return null;
  const sum = (list: string[]) => list.reduce((total, ch) => total + LETTER_VALUE[ch], 0);
  const vowels = letters.filter((ch) => VOWELS.has(ch));
  const consonants = letters.filter((ch) => !VOWELS.has(ch));
  return {
    soul: reduceNumber(sum(vowels), true),
    outer: reduceNumber(sum(consonants), true),
    talent: reduceNumber(sum(letters), true),
  };
}

export const NAME_NUMBER_INTRO = {
  soul: 'Чего ты хочешь на самом деле, в глубине. Считается по гласным буквам имени.',
  outer: 'Каким тебя видят люди при первой встрече. Считается по согласным буквам имени.',
  talent: 'Твой природный талант, который даётся легко. Считается по всем буквам имени.',
} as const;

/** Each name number is told through the headline of the same number, from its own angle. */
export function nameNumberText(kind: keyof NameNumbers, value: number): string {
  const base = LIFE_PATH[value] ?? LIFE_PATH[reduceNumber(value)];
  const lead = { soul: 'В глубине', outer: 'Со стороны', talent: 'Твой талант' }[kind];
  return `${lead}: ${base.title.charAt(0).toLowerCase()}${base.title.slice(1)}.`;
}

/** The number that is missing from the birth date: what a person is here to learn. */
export function missingLessons(square: PythagorasSquare): number[] {
  return square.cells.filter((cell) => cell.count === 0).map((cell) => cell.n);
}
