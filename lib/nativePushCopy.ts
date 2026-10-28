/**
 * Тексты Android-уведомлений: простыми человеческими словами, по-доброму,
 * иногда с шуткой. Без эзотерики, «энергий», «вселенной» и эмодзи.
 * Знак — изредка и к месту, не в каждом пуше.
 * Плейсхолдеры: {pl} — «Рыбы», {gen} — «Рыб», {dat} — «Рыбам», {season} — «Рыб» (в «сезон Рыб»).
 */
import type { ZodiacSign } from './zodiac-utils';

export type PushRoute = 'today' | 'natal' | 'horoscope' | 'compatibility' | 'mood' | 'stories';
export type PushCopy = { title: string; body: string; route: PushRoute };
export type SkyEventKind = 'full_moon' | 'new_moon' | 'mercury_rx_start' | 'mercury_rx_end';
type Lang = 'ru' | 'en';

type SignForms = { pl: string; gen: string; dat: string; season: string };
export const SIGN_FORMS_RU: Record<ZodiacSign, SignForms> = {
  Aries: { pl: 'Овны', gen: 'Овнов', dat: 'Овнам', season: 'Овна' },
  Taurus: { pl: 'Тельцы', gen: 'Тельцов', dat: 'Тельцам', season: 'Тельца' },
  Gemini: { pl: 'Близнецы', gen: 'Близнецов', dat: 'Близнецам', season: 'Близнецов' },
  Cancer: { pl: 'Раки', gen: 'Раков', dat: 'Ракам', season: 'Рака' },
  Leo: { pl: 'Львы', gen: 'Львов', dat: 'Львам', season: 'Льва' },
  Virgo: { pl: 'Девы', gen: 'Дев', dat: 'Девам', season: 'Девы' },
  Libra: { pl: 'Весы', gen: 'Весов', dat: 'Весам', season: 'Весов' },
  Scorpio: { pl: 'Скорпионы', gen: 'Скорпионов', dat: 'Скорпионам', season: 'Скорпиона' },
  Sagittarius: { pl: 'Стрельцы', gen: 'Стрельцов', dat: 'Стрельцам', season: 'Стрельца' },
  Capricorn: { pl: 'Козероги', gen: 'Козерогов', dat: 'Козерогам', season: 'Козерога' },
  Aquarius: { pl: 'Водолеи', gen: 'Водолеев', dat: 'Водолеям', season: 'Водолея' },
  Pisces: { pl: 'Рыбы', gen: 'Рыб', dat: 'Рыбам', season: 'Рыб' },
};
const SIGN_EN: Record<ZodiacSign, string> = {
  Aries: 'Aries', Taurus: 'Taurus', Gemini: 'Gemini', Cancer: 'Cancer', Leo: 'Leo', Virgo: 'Virgo',
  Libra: 'Libra', Scorpio: 'Scorpio', Sagittarius: 'Sagittarius', Capricorn: 'Capricorn', Aquarius: 'Aquarius', Pisces: 'Pisces',
};

type Line = [title: string, body: string];
type RoutedLine = [title: string, body: string, route: PushRoute];

// ───────────── Утро: про сам день человека ─────────────
const MORNING_RU: Line[] = [
  ['Твой день уже посчитан', 'Что пойдёт легко, а где лучше не спешить. По твоей карте, а не по знаку'],
  ['Одна подсказка на сегодня', 'Короткая и только про тебя. Как раз на время кофе'],
  ['Где сегодня будет легче?', 'В прогнозе отмечено время, когда всё складывается само'],
  ['Прежде чем начнёшь день', 'Минута, и ты знаешь, на что сегодня тратить силы, а на что нет'],
  ['Что сегодня в твою пользу?', 'Твоя карта отвечает на это каждое утро. Сегодня тоже'],
  ['Настроение дня по твоей карте', 'Узнай, когда будет легко, а когда лучше не спорить'],
  ['Сегодня важно одно', 'Что именно, написано в прогнозе. Читается за минуту'],
  ['Кофе и пара строк про тебя', 'Лучшее начало дня: знать, что сегодня играет за тебя'],
  ['Луна сегодня проходит твою карту', 'Узнай, как это скажется на настроении и делах'],
  ['Утро без гадания', 'Твой день уже разобран по дате рождения. Открывай'],
  ['Каким будет твой день?', 'Не как у всех по знаку, а именно у тебя. Ответ уже здесь'],
  ['Сегодня есть хороший момент', 'Узнай, в какие часы он у тебя и на что его потратить'],
];
/** Знак — примерно в каждом пятом утреннем. */
const MORNING_SIGN_RU: Line[] = [
  ['Что сегодня ждёт {gen}?', 'А тебя лично? Это в прогнозе по твоей карте'],
  ['{pl}, сегодня ваш ход', 'Узнай, где сегодня твоя сильная сторона'],
  ['Доброе утро, {pl}', 'День уже разобран по твоей карте. Открывай'],
];
const MORNING_WEEKDAY_RU: Record<number, Line[]> = {
  1: [['Понедельник, но без паники', 'Узнай, с какого дела твоя неделя пойдёт легче'], ['Новая неделя', 'Узнай, какой день в ней будет твоим']],
  5: [['Пятница!', 'Узнай, каким будет вечер именно у тебя'], ['Наконец пятница', 'Как пройдёт твой вечер? Ответ уже в прогнозе']],
  6: [['Выходной', 'Узнай, как провести его так, чтобы правда отдохнуть']],
  0: [['Спокойное воскресенье', 'Узнай, что сегодня зарядит тебя лучше всего'], ['Воскресенье', 'Хороший день, чтобы понять, какой будет твоя неделя']],
};
const MORNING_EN: Line[] = [
  ['Your day is already worked out', 'What goes easy and where not to rush. From your chart, not your sign'],
  ['One tip for today', 'Short and only about you. Just in time for coffee'],
  ['What is on your side today?', 'Your chart answers this every morning. Today too'],
  ['A good moment is coming today', 'Find out when it is for you and how to use it'],
];

// ───────────── Днём и вечером: про себя, в разные разделы ─────────────
const INVITE_RU: RoutedLine[] = [
  ['Откуда у тебя этот характер?', 'В твоей натальной карте есть ответ, и он точнее, чем кажется', 'natal'],
  ['Твоя сильная сторона', 'Она есть в натальной карте, и ты наверняка её недооцениваешь', 'natal'],
  ['Остаток дня', 'Узнай, что ещё стоит успеть сегодня, а что спокойно оставить на завтра', 'today'],
  ['Что сделать, а что отпустить', 'Пара строк по твоей карте, только про тебя', 'today'],
  ['Почему сегодня так?', 'Если день идёт странно, в твоём прогнозе есть объяснение', 'today'],
  ['В чём ты сильнее других', 'Карта рождения отвечает на это прямо. Читается за пять минут', 'natal'],
  ['Деньги и ты', 'Что твоя карта говорит про заработок. Ответ может удивить', 'natal'],
  ['Как ты любишь', 'Натальная карта рассказывает и об этом. Прочитай, и узнаешь себя', 'natal'],
  ['Сил к вечеру мало?', 'Узнай по своей карте, что заряжает тебя быстрее всего', 'natal'],
  ['Минута для себя', 'Как пройдёт остаток твоего дня. Про тебя, а не про всех', 'today'],
  ['Что тебе сегодня удаётся лучше всего', 'В личном прогнозе это написано прямо', 'today'],
  ['Твоё призвание', 'В карте есть подсказка, какая работа тебе по-настоящему подходит', 'natal'],
];
const INVITE_EN: RoutedLine[] = [
  ['Where does your character come from?', 'Your natal chart has the answer, and it is sharper than you think', 'natal'],
  ['The rest of your day', 'What is still worth doing today and what can wait until tomorrow', 'today'],
  ['Your strong side', 'It is in your natal chart, and you probably underrate it', 'natal'],
  ['Your evening by your chart', 'What to do and what to let go. A few lines only about you', 'today'],
];

// ───────────── Давно не заходил ─────────────
const COMEBACK_RU: Record<3 | 7 | 14, Line[]> = {
  3: [
    ['Пока тебя не было', 'Небо успело поменяться. Узнай, что это значит для тебя'],
    ['Как ты?', 'Сегодняшний день уже разобран по твоей карте'],
    ['Три дня без подсказок', 'Сегодня есть одна важная. Короткая и только про тебя'],
  ],
  7: [
    ['Неделя пролетела', 'Узнай, какой будет следующая. Начни с сегодняшнего дня'],
    ['Новая неделя по твоей карте', 'Где будет легко, а где лучше не спешить'],
  ],
  14: [
    ['Давно не виделись', 'Без упрёков. Твоя карта на месте, и сегодняшний день в ней тоже'],
    ['Мы рядом, когда понадобимся', 'Подсказка по твоей карте будет ждать сколько нужно'],
  ],
};
const COMEBACK_EN: Line[] = [
  ['While you were away', 'The sky has changed. Find out what it means for you'],
  ['Long time no see', 'No pressure. Your chart is here, and so is today'],
];

// ───────────── События неба (даты считает сервер по эфемеридам) ─────────────
const SKY_RU: Record<SkyEventKind, Line[]> = {
  full_moon: [
    ['Сегодня полнолуние', 'Эмоции громче обычного. Узнай, как это скажется именно на тебе'],
    ['Полная Луна', 'Хороший вечер, чтобы что-то отпустить. Что именно, подскажет твоя карта'],
    ['Полнолуние', 'Выгляни вечером в окно. А потом узнай, что оно значит для тебя'],
  ],
  new_moon: [
    ['Сегодня новолуние', 'Лучший день загадать желание и начать новое. Узнай, с чего начать тебе'],
    ['Новолуние', 'Чистый лист. Твоя карта подскажет, что сейчас стоит начать'],
  ],
  mercury_rx_start: [
    ['Начался ретроградный Меркурий', 'Три недели, когда слова понимают не так. Узнай, где тебе быть внимательнее'],
    ['Меркурий снова ретроградный', 'Без паники. Узнай, что он заденет у тебя'],
  ],
  mercury_rx_end: [
    ['Ретроградный Меркурий закончился', 'Можно снова подписывать, покупать и отправлять важное'],
    ['Меркурий отпустил', 'Отложенные дела можно возвращать. Узнай, с какого начать'],
  ],
};
const SKY_EN: Record<SkyEventKind, Line> = {
  full_moon: ['Full moon tonight', 'Feelings run louder than usual. See how it touches you'],
  new_moon: ['New moon today', 'The best day to make a wish and start something. See where to begin'],
  mercury_rx_start: ['Mercury retrograde has begun', 'Three weeks when words get misread. See where to be careful'],
  mercury_rx_end: ['Mercury retrograde is over', 'You can sign, buy and send important things again'],
};

// ───────────── Праздники (MM-DD) ─────────────
const HOLIDAYS_RU: Record<string, RoutedLine> = {
  '01-01': ['С Новым годом!', 'Пусть год будет классным. Узнай, каким будет его первый день для тебя', 'today'],
  '01-07': ['С Рождеством!', 'Тёплого дня. Узнай, чем он будет хорош для тебя', 'today'],
  '02-14': ['С Днём всех влюблённых', 'Узнай, как ты любишь и что тебе важно в паре', 'natal'],
  '02-23': ['С 23 Февраля!', 'Хорошего дня. Узнай, в чём сегодня твоя сила', 'today'],
  '03-08': ['С 8 Марта!', 'Пусть день будет лёгким. Узнай, что сегодня порадует тебя', 'today'],
  '04-01': ['Это не шутка', 'Твой прогноз на сегодня правда про тебя. Проверь', 'today'],
  '05-01': ['С Первомаем!', 'Хороших выходных. Узнай, как отдохнуть на полную', 'today'],
  '05-09': ['С Днём Победы', 'Мирного неба и спокойного дня', 'today'],
  '06-12': ['С Днём России!', 'Хорошего выходного. Узнай, чем он будет хорош для тебя', 'today'],
  '07-08': ['День семьи, любви и верности', 'Узнай, что тебе важно в близких отношениях', 'natal'],
  '09-01': ['С 1 сентября!', 'Новый сезон. Узнай, с чего его лучше начать тебе', 'today'],
  '10-31': ['Хэллоуин!', 'Ничего страшного, просто твой день по карте', 'today'],
  '11-04': ['С Днём народного единства', 'Хорошего выходного. Узнай, как провести его с пользой для себя', 'today'],
  '12-31': ['С наступающим!', 'Узнай, каким будет последний день года для тебя', 'today'],
};
const HOLIDAYS_EN: Record<string, RoutedLine> = {
  '01-01': ['Happy New Year!', 'See how the first day of the year looks for you', 'today'],
  '02-14': ['Happy Valentine’s Day', 'See how you love and what matters to you in a couple', 'natal'],
  '10-31': ['Happy Halloween!', 'Nothing scary, just your day by your chart', 'today'],
  '12-31': ['Happy New Year’s Eve', 'See how the last day of the year looks for you', 'today'],
};
const FRIDAY_13_RU: RoutedLine = ['Пятница, 13-е', 'Без паники. Узнай, что сегодня на самом деле в твою пользу', 'today'];

function fill(text: string, lang: Lang, sign: ZodiacSign | null): string {
  const forms = sign ? SIGN_FORMS_RU[sign] : null;
  return text
    .replace(/\{pl\}/g, lang === 'en' ? (sign ? SIGN_EN[sign] : '') : forms?.pl || '')
    .replace(/\{gen\}/g, forms?.gen || '')
    .replace(/\{dat\}/g, forms?.dat || '')
    .replace(/\{season\}/g, forms?.season || '')
    .replace(/\s{2,}/g, ' ').trim();
}
function pick<T>(list: T[], seed: number): T { return list[((seed % list.length) + list.length) % list.length]; }
function make(line: Line, route: PushRoute, lang: Lang, sign: ZodiacSign | null): PushCopy {
  return { title: fill(line[0], lang, sign), body: fill(line[1], lang, sign), route };
}

export function morningCopy(lang: Lang, sign: ZodiacSign | null, weekday: number, seed: number): PushCopy {
  if (lang === 'en') return make(pick(MORNING_EN, seed), 'today', lang, null);
  if (sign && seed % 5 === 0) return make(pick(MORNING_SIGN_RU, Math.floor(seed / 5)), 'today', lang, sign);
  const weekdayLines = MORNING_WEEKDAY_RU[weekday];
  if (weekdayLines && seed % 3 === 0) return make(pick(weekdayLines, Math.floor(seed / 3)), 'today', lang, null);
  return make(pick(MORNING_RU, seed), 'today', lang, null);
}
export function inviteCopy(lang: Lang, seed: number): PushCopy {
  const [title, body, route] = pick(lang === 'en' ? INVITE_EN : INVITE_RU, seed);
  return make([title, body], route, lang, null);
}
export function comebackCopy(lang: Lang, days: 3 | 7 | 14, seed: number): PushCopy {
  return make(pick(lang === 'en' ? COMEBACK_EN : COMEBACK_RU[days], seed), 'today', lang, null);
}
export function skyEventCopy(lang: Lang, kind: SkyEventKind, seed: number): PushCopy {
  return make(lang === 'en' ? SKY_EN[kind] : pick(SKY_RU[kind], seed), 'today', lang, null);
}
/** Праздник/пятница 13-е на конкретную дату (месяц 1-12) или null. */
export function holidayCopy(lang: Lang, month: number, day: number, weekday: number): PushCopy | null {
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const entry = (lang === 'en' ? HOLIDAYS_EN : HOLIDAYS_RU)[key]
    || (lang === 'ru' && day === 13 && weekday === 5 ? FRIDAY_13_RU : null);
  return entry ? make([entry[0], entry[1]], entry[2], lang, null) : null;
}
export function birthdayCopy(lang: Lang, name: string): PushCopy {
  const clean = name.trim().split(/\s+/)[0]?.slice(0, 24) || '';
  if (lang === 'en') return { title: clean ? `Happy birthday, ${clean}!` : 'Happy birthday!', body: 'Have an amazing year. Check what today holds for you', route: 'today' };
  return { title: clean ? `С днём рождения, ${clean}!` : 'С днём рождения!', body: 'Пусть этот год будет лучшим. Загляни, у тебя сегодня особенный прогноз', route: 'today' };
}
export function seasonCopy(lang: Lang, sign: ZodiacSign): PushCopy {
  if (lang === 'en') return { title: `${SIGN_EN[sign]} season is here`, body: 'It is your time of year. See what it brings you', route: 'today' };
  return make(['Начался сезон {season}', 'Это твоё время года. Узнай, что оно принесёт тебе'], 'today', lang, sign);
}
// ───────────── Неделя настроения ─────────────
const MOOD_MORNING_RU: Line[] = [
  ['Как ты сегодня?', 'Отметь настроение и силы, это две кнопки. В конце недели увидишь, как она прошла'],
  ['Пять секунд на себя', 'Отметь настроение и силы, это всё'],
  ['Доброе утро', 'Как спалось? Отметь настроение, неделя ждёт'],
  ['Утренняя отметка', 'Честно: как оно сейчас? Никто, кроме тебя, не увидит'],
];
const MOOD_EVENING_RU: Line[] = [
  ['Как прошёл день?', 'Отметь, как ты к вечеру. Если днём не отмечал, отметь и день'],
  ['Вечерняя отметка', 'Отметь настроение и силы, это пять секунд. Из отметок соберётся отчёт за неделю'],
  ['Отметься перед отдыхом', 'Как ты к вечеру? Две кнопки, и всё'],
  ['Минутка для недели настроения', 'Отметь, как ты сейчас. Даже «так себе» это честный ответ'],
];
const MOOD_MORNING_EN: Line[] = [
  ['How are you today?', 'Mark your mood and energy, it takes two taps. At the end of the week you will see how it went'],
  ['Five seconds for you', 'Mark your mood and strength, that is all'],
];
const MOOD_EVENING_EN: Line[] = [
  ['How was the day?', 'Mark how you feel tonight. If you skipped the daytime check-in, mark that too'],
  ['Evening check-in', 'Mark your mood and energy, it takes five seconds. Your weekly report is built from these'],
];
export function moodCopy(lang: Lang, evening: boolean, seed: number): PushCopy {
  const list = lang === 'en' ? (evening ? MOOD_EVENING_EN : MOOD_MORNING_EN) : (evening ? MOOD_EVENING_RU : MOOD_MORNING_RU);
  return make(pick(list, seed), 'mood', lang, null);
}
// ───────────── Сериалы ─────────────
const STORY_RU: Line[] = [
  ['Вышла новая серия', 'Твой сериал продолжается, чем же всё кончилось вчера?'],
  ['Новая серия уже здесь', 'Пять минут чтения, и узнаешь, что было дальше'],
  ['Продолжение готово', 'Герои не стали ждать: сегодня новая серия'],
  ['Сериал ждёт', 'Новая серия вышла. Самое время для пяти минут истории'],
];
const STORY_EN: Line[] = [
  ['A new episode is out', 'Your series continues, how did yesterday end?'],
  ['The next episode is here', 'A five-minute read to find out what happened next'],
];
export function storyCopy(lang: Lang, seed: number): PushCopy {
  return make(pick(lang === 'en' ? STORY_EN : STORY_RU, seed), 'stories', lang, null);
}
export function readyCopy(lang: Lang, route: 'today' | 'natal'): PushCopy {
  if (lang === 'en') {
    return route === 'today'
      ? { title: 'Your personal forecast is ready', body: 'It is based on your chart, open it', route }
      : { title: 'Your natal chart is ready', body: 'Open it, there is a lot about you', route };
  }
  return route === 'today'
    ? { title: 'Личный прогноз готов', body: 'Он составлен по твоей карте, открывай', route }
    : { title: 'Натальная карта готова', body: 'Открывай, там много интересного про тебя', route };
}

/** Готовые заготовки для ручной отправки из админки (быстрая вставка). */
/** Manual admin messages also reach installed APKs, which know only the first four routes. */
export const ADMIN_PUSH_PRESETS: Array<{ label: string; title: string; body: string; route: Exclude<PushRoute, 'mood' | 'stories'> }> = [
  { label: 'Доброе утро', title: 'Твой день уже посчитан', body: 'Что пойдёт легко, а где лучше не спешить. По твоей карте, а не по знаку', route: 'today' },
  { label: 'Натальная карта', title: 'Откуда у тебя этот характер?', body: 'В твоей натальной карте есть ответ, и он точнее, чем кажется', route: 'natal' },
  { label: 'Полнолуние', title: 'Сегодня полнолуние', body: 'Эмоции громче обычного. Узнай, как это скажется именно на тебе', route: 'today' },
  { label: 'Меркурий', title: 'Начался ретроградный Меркурий', body: 'Три недели, когда слова понимают не так. Узнай, где тебе быть внимательнее', route: 'today' },
  { label: 'Обновление', title: 'NEBO обновился', body: 'Мы добавили новое. Открой и попробуй первым', route: 'today' },
  { label: 'Скучаем', title: 'Пока тебя не было', body: 'Небо успело поменяться. Узнай, что это значит для тебя', route: 'today' },
];
