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

// ───────────── Утро ─────────────
const MORNING_RU: Line[] = [
  ['Доброе утро', 'Гороскоп на сегодня уже ждёт'],
  ['Гороскоп на сегодня готов', 'Узнай, чего ждать от дня'],
  ['Что сегодня по гороскопу?', 'Пара минут — и ты в курсе'],
  ['Новый день', 'Посмотри, что он тебе готовит'],
  ['Кофе уже налит?', 'Тогда самое время для гороскопа'],
  ['Твой прогноз на день', 'Уже готов — открой, пока пьёшь кофе'],
  ['Каким будет этот день?', 'Ответ — в гороскопе на сегодня'],
  ['Гороскоп вместо будильника', 'Ладно, будильник оставь. Но прогноз глянь'],
  ['С добрым утром', 'Прогноз на сегодня обновился'],
  ['Утренний гороскоп', 'Короткий, понятный и уже готов'],
  ['Пять минут до начала дня?', 'Хватит, чтобы прочитать гороскоп'],
  ['Привет! Новый день — новый прогноз', 'Открой и посмотри, на что сегодня делать ставку'],
];
/** Знак — примерно в каждом пятом утреннем. */
const MORNING_SIGN_RU: Line[] = [
  ['Что сегодня ждёт {gen}?', 'Гороскоп на день уже готов'],
  ['Доброе утро, {pl}', 'Гороскоп на сегодня уже ждёт'],
  ['{pl}, ваш гороскоп готов', 'Загляни, пока день не закрутил'],
  ['Как сегодня {dat}?', 'Гороскоп знает — открывай'],
];
const MORNING_WEEKDAY_RU: Record<number, Line[]> = {
  1: [['Понедельник, держись', 'Гороскоп подскажет, с чего начать неделю'], ['Новая неделя', 'Посмотри гороскоп — с ним проще начать']],
  5: [['Наконец пятница', 'Загляни в гороскоп — как пройдёт вечер'], ['Пятница!', 'Посмотри, что гороскоп думает о твоих планах на вечер']],
  6: [['Доброе утро, выходной', 'Гороскоп на сегодня уже ждёт, можно без спешки']],
  0: [['Спокойного воскресенья', 'Гороскоп на сегодня уже готов'], ['Воскресенье — день без спешки', 'Как раз есть время на гороскоп']],
};
const MORNING_EN: Line[] = [
  ['Good morning', 'Today’s horoscope is waiting'],
  ['Your horoscope is ready', 'See what the day has in store'],
  ['New day', 'See what it has for you'],
  ['Coffee poured?', 'Then it’s horoscope time'],
];

// ───────────── Днём и вечером: зовём в разные разделы ─────────────
const INVITE_RU: RoutedLine[] = [
  ['Проверь совместимость', 'Узнай, насколько вы подходите друг другу', 'compatibility'],
  ['Твоя натальная карта', 'Узнай о себе то, чего не скажет обычный гороскоп', 'natal'],
  ['Как проходит день?', 'Загляни в личный прогноз — там есть подсказки на вечер', 'today'],
  ['Гороскоп для близких', 'Посмотри прогноз на сегодня для их знаков', 'horoscope'],
  ['Есть кто-то на примете?', 'Проверь, как вы совпадаете по знакам', 'compatibility'],
  ['Знаешь свои сильные стороны?', 'Натальная карта покажет — открой', 'natal'],
  ['Личный прогноз на сегодня', 'Составлен по твоей дате рождения. Посмотри', 'today'],
  ['Скинь гороскоп другу', 'Пусть тоже знает, чего ждать от дня', 'horoscope'],
  ['Ссоритесь из-за ерунды?', 'Глянь совместимость — может, дело в знаках', 'compatibility'],
  ['Ты сложнее, чем кажется', 'И натальная карта это подтверждает', 'natal'],
  ['Перерыв?', 'Самое время глянуть личный прогноз', 'today'],
  ['А что у друзей?', 'Почитай гороскоп для их знаков — будет о чём поговорить', 'horoscope'],
  ['Вы подходите друг другу?', 'Проверь совместимость — это займёт минуту', 'compatibility'],
  ['Откуда у тебя этот характер?', 'Ответ — в натальной карте', 'natal'],
  ['День в разгаре', 'Сверься с личным прогнозом — вдруг там важное', 'today'],
  ['Совместимость с друзьями', 'Узнай, с кем тебе легче всего', 'compatibility'],
];
const INVITE_EN: RoutedLine[] = [
  ['Check your compatibility', 'See how well you match', 'compatibility'],
  ['Your natal chart', 'Learn what a regular horoscope won’t tell you', 'natal'],
  ['How’s your day going?', 'Your personal forecast has tips for the evening', 'today'],
  ['Share with a friend', 'Let them know what today holds', 'horoscope'],
];

// ───────────── Давно не заходил ─────────────
const COMEBACK_RU: Record<3 | 7 | 14, Line[]> = {
  3: [
    ['Как дела?', 'Гороскоп на сегодня уже ждёт'],
    ['Ты где пропадаешь?', 'Гороскоп на сегодня уже готов, заходи'],
    ['Без тебя тут тихо', 'Загляни на минутку — гороскоп обновился'],
    ['Мы скучаем', 'Загляни — за эти дни появилось новое'],
  ],
  7: [
    ['Целая неделя без гороскопа', 'Загляни — посмотри, что ждёт дальше'],
    ['Неделю не виделись', 'Мы держали для тебя свежий гороскоп'],
    ['Возвращайся', 'Прогноз на сегодня уже готов'],
  ],
  14: [
    ['Мы всё ещё здесь', 'Гороскоп на сегодня ждёт, когда будет минутка'],
    ['Не будем навязываться', 'Но гороскоп на сегодня всё-таки готов'],
    ['Давно не виделись', 'Загляни — посмотри, что нового'],
  ],
};
const COMEBACK_EN: Line[] = [
  ['We miss you', 'Today’s horoscope is waiting'],
  ['Long time no see', 'Take a look at what’s new'],
];

// ───────────── События неба (даты считает сервер по эфемеридам) ─────────────
const SKY_RU: Record<SkyEventKind, Line[]> = {
  full_moon: [
    ['Сегодня полнолуние', 'Выгляни вечером в окно. А потом — в гороскоп'],
    ['Полнолуние', 'Говорят, сегодня все немного на взводе. Посмотри, что у тебя по гороскопу'],
    ['Луна сегодня полная', 'Хороший вечер, чтобы почитать гороскоп'],
  ],
  new_moon: [
    ['Сегодня новолуние', 'Хорошее время начать что-то новое. Посмотри гороскоп'],
    ['Новолуние', 'Время загадывать желания. Гороскоп подскажет, на что ставить'],
  ],
  mercury_rx_start: [
    ['Меркурий ретроградный', 'Да, опять. Перепроверяй сообщения и загляни в гороскоп'],
    ['Начался ретроградный Меркурий', 'Без паники. Посмотри, что это значит для тебя'],
  ],
  mercury_rx_end: [
    ['Меркурий больше не ретроградный', 'Можно выдохнуть. Гороскоп на сегодня уже ждёт'],
    ['Ретроградный Меркурий всё', 'Можно смело отправлять важные сообщения. И читать гороскоп'],
  ],
};
const SKY_EN: Record<SkyEventKind, Line> = {
  full_moon: ['Full moon tonight', 'Look out the window. Then check your horoscope'],
  new_moon: ['New moon today', 'A good time to start something new'],
  mercury_rx_start: ['Mercury retrograde', 'Yes, again. Double-check your messages and read your horoscope'],
  mercury_rx_end: ['Mercury is direct again', 'You can breathe out. Today’s horoscope is waiting'],
};

// ───────────── Праздники (MM-DD) ─────────────
const HOLIDAYS_RU: Record<string, RoutedLine> = {
  '01-01': ['С Новым годом!', 'Пусть год будет классным. Загляни в гороскоп на первый день года', 'horoscope'],
  '01-07': ['С Рождеством!', 'Тёплого дня. Гороскоп на сегодня уже ждёт', 'horoscope'],
  '02-14': ['С Днём всех влюблённых', 'Хороший повод проверить совместимость', 'compatibility'],
  '02-23': ['С 23 Февраля!', 'Хорошего дня. Гороскоп на сегодня уже ждёт', 'horoscope'],
  '03-08': ['С 8 Марта!', 'Пусть день будет лёгким. Гороскоп на сегодня уже ждёт', 'horoscope'],
  '04-01': ['Это не шутка', 'Гороскоп на сегодня правда готов', 'horoscope'],
  '05-01': ['С Первомаем!', 'Хороших выходных. Гороскоп на сегодня уже готов', 'horoscope'],
  '05-09': ['С Днём Победы', 'Мирного неба и спокойного дня', 'today'],
  '06-12': ['С Днём России!', 'Хорошего выходного. Гороскоп на сегодня уже ждёт', 'horoscope'],
  '07-08': ['День семьи, любви и верности', 'Проверь совместимость с любимым человеком', 'compatibility'],
  '09-01': ['С 1 сентября!', 'Посмотри гороскоп на сегодня', 'horoscope'],
  '10-31': ['Хэллоуин!', 'Не страшно — это просто гороскоп на сегодня', 'horoscope'],
  '11-04': ['С Днём народного единства', 'Хорошего выходного. Гороскоп на сегодня уже ждёт', 'horoscope'],
  '12-31': ['С наступающим!', 'Загляни в гороскоп на последний день года', 'horoscope'],
};
const HOLIDAYS_EN: Record<string, RoutedLine> = {
  '01-01': ['Happy New Year!', 'Check your horoscope for the first day of the year', 'horoscope'],
  '02-14': ['Happy Valentine’s Day', 'A good reason to check your compatibility', 'compatibility'],
  '10-31': ['Happy Halloween!', 'Nothing scary — just today’s horoscope', 'horoscope'],
  '12-31': ['Happy New Year’s Eve', 'Check your horoscope for the last day of the year', 'horoscope'],
};
const FRIDAY_13_RU: RoutedLine = ['Пятница, 13-е', 'Без паники — лучше загляни в гороскоп на сегодня', 'horoscope'];

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
  if (lang === 'en') return make(pick(MORNING_EN, seed), 'horoscope', lang, null);
  if (sign && seed % 5 === 0) return make(pick(MORNING_SIGN_RU, Math.floor(seed / 5)), 'horoscope', lang, sign);
  const weekdayLines = MORNING_WEEKDAY_RU[weekday];
  if (weekdayLines && seed % 3 === 0) return make(pick(weekdayLines, Math.floor(seed / 3)), 'horoscope', lang, null);
  return make(pick(MORNING_RU, seed), 'horoscope', lang, null);
}
export function inviteCopy(lang: Lang, seed: number): PushCopy {
  const [title, body, route] = pick(lang === 'en' ? INVITE_EN : INVITE_RU, seed);
  return make([title, body], route, lang, null);
}
export function comebackCopy(lang: Lang, days: 3 | 7 | 14, seed: number): PushCopy {
  return make(pick(lang === 'en' ? COMEBACK_EN : COMEBACK_RU[days], seed), 'horoscope', lang, null);
}
export function skyEventCopy(lang: Lang, kind: SkyEventKind, seed: number): PushCopy {
  return make(lang === 'en' ? SKY_EN[kind] : pick(SKY_RU[kind], seed), 'horoscope', lang, null);
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
  return { title: clean ? `С днём рождения, ${clean}!` : 'С днём рождения!', body: 'Пусть этот год будет лучшим. Загляни — у тебя сегодня особенный прогноз', route: 'today' };
}
export function seasonCopy(lang: Lang, sign: ZodiacSign): PushCopy {
  if (lang === 'en') return { title: `${SIGN_EN[sign]} season is here`, body: 'It’s your time. Check your horoscope', route: 'horoscope' };
  return make(['Начался сезон {season}', 'Это твоё время года. Загляни в гороскоп'], 'horoscope', lang, sign);
}
// ───────────── Неделя настроения ─────────────
const MOOD_MORNING_RU: Line[] = [
  ['Как ты сегодня?', 'Две отметки — и утро записано в неделю настроения'],
  ['Пять секунд на себя', 'Отметь настроение и силы — это всё'],
  ['Доброе утро', 'Как спалось? Отметь настроение — неделя ждёт'],
  ['Утренняя отметка', 'Честно: как оно сейчас? Никто, кроме тебя, не увидит'],
];
const MOOD_EVENING_RU: Line[] = [
  ['Как прошёл день?', 'Отметь вечер — и дневную отметку, если её ещё нет'],
  ['Вечерняя отметка', 'Пять секунд: настроение и силы. Отчёт уже собирается'],
  ['Отметься перед отдыхом', 'Как ты к вечеру? Две кнопки — и всё'],
  ['Минутка для недели настроения', 'Отметь, как сейчас. Даже «так себе» — тоже честно'],
];
const MOOD_MORNING_EN: Line[] = [
  ['How are you today?', 'Two taps and the morning is in your mood week'],
  ['Five seconds for you', 'Mark your mood and strength — that is all'],
];
const MOOD_EVENING_EN: Line[] = [
  ['How was the day?', 'Mark the evening — and the daytime, if you missed it'],
  ['Evening check-in', 'Five seconds: mood and strength. The report is building'],
];
export function moodCopy(lang: Lang, evening: boolean, seed: number): PushCopy {
  const list = lang === 'en' ? (evening ? MOOD_EVENING_EN : MOOD_MORNING_EN) : (evening ? MOOD_EVENING_RU : MOOD_MORNING_RU);
  return make(pick(list, seed), 'mood', lang, null);
}
// ───────────── Сериалы ─────────────
const STORY_RU: Line[] = [
  ['Вышла новая серия', 'Твой сериал продолжается — чем же всё кончилось вчера?'],
  ['Новая серия уже здесь', 'Пять минут чтения — и узнаешь, что было дальше'],
  ['Продолжение готово', 'Герои не стали ждать: сегодня новая серия'],
  ['Сериал ждёт', 'Новая серия вышла. Самое время для пяти минут истории'],
];
const STORY_EN: Line[] = [
  ['A new episode is out', 'Your series continues — how did yesterday end?'],
  ['The next episode is here', 'A five-minute read to find out what happened next'],
];
export function storyCopy(lang: Lang, seed: number): PushCopy {
  return make(pick(lang === 'en' ? STORY_EN : STORY_RU, seed), 'stories', lang, null);
}
export function readyCopy(lang: Lang, route: 'today' | 'natal'): PushCopy {
  if (lang === 'en') {
    return route === 'today'
      ? { title: 'Your personal forecast is ready', body: 'Open it — everything is in place', route }
      : { title: 'Your natal chart is ready', body: 'Open it, there is a lot about you', route };
  }
  return route === 'today'
    ? { title: 'Личный прогноз готов', body: 'Открывай — всё уже на месте', route }
    : { title: 'Натальная карта готова', body: 'Открывай, там много интересного про тебя', route };
}

/** Готовые заготовки для ручной отправки из админки (быстрая вставка). */
/** Manual admin messages also reach installed APKs, which know only the first four routes. */
export const ADMIN_PUSH_PRESETS: Array<{ label: string; title: string; body: string; route: Exclude<PushRoute, 'mood' | 'stories'> }> = [
  { label: 'Доброе утро', title: 'Доброе утро', body: 'Гороскоп на сегодня уже ждёт', route: 'horoscope' },
  { label: 'Совместимость', title: 'Проверь совместимость', body: 'Узнай, насколько вы подходите друг другу', route: 'compatibility' },
  { label: 'Натальная карта', title: 'Твоя натальная карта', body: 'Узнай о себе то, чего не скажет обычный гороскоп', route: 'natal' },
  { label: 'Полнолуние', title: 'Сегодня полнолуние', body: 'Выгляни вечером в окно. А потом — в гороскоп', route: 'horoscope' },
  { label: 'Меркурий', title: 'Меркурий ретроградный', body: 'Да, опять. Перепроверяй сообщения и загляни в гороскоп', route: 'horoscope' },
  { label: 'Обновление', title: 'Мы обновились', body: 'Добавили новое — загляни и посмотри', route: 'today' },
  { label: 'Скучаем', title: 'Давно не виделись', body: 'Загляни — посмотри, что нового', route: 'horoscope' },
];
