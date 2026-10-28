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

// ───────────── Утро: про сам день человека, как от друга ─────────────
const MORNING_RU: Line[] = [
  ['Доброе утро!', 'Мы уже заглянули в твою карту. Есть пара вещей, которые стоит знать до обеда'],
  ['Подъём!', 'Сегодня у тебя есть сильный момент. Рассказать, когда?'],
  ['Кофе налит?', 'Тогда две минуты про твой день: что пойдёт легко, а где притормозить'],
  ['Слушай, тут про тебя', 'Твой день по карте уже разобран. Без воды, по делу'],
  ['Утро вечера мудренее', 'Особенно если знать, что тебе сегодня на руку. Открывай'],
  ['Не проспи хорошее', 'В прогнозе отмечено время, когда у тебя всё будет получаться само'],
  ['Луна сегодня трогает твою карту', 'Рассказываем по-простому, что это значит для твоего настроения'],
  ['Какой у тебя сегодня день?', 'Не по знаку, а лично твой. Уже разобрали, заходи'],
  ['Минутка для себя до начала дня', 'Узнай, где сегодня повезёт, а где лучше не лезть на рожон'],
  ['Утро доброе, правда', 'Сегодня есть за что зацепиться. Рассказываем, за что'],
  ['Привет! Мы про твой день', 'На что сегодня тратить силы, а что смело отложить. Коротко'],
  ['Сегодня держим курс', 'Подсказка по твоей карте уже готова. Одна минута, и ты в теме'],
];
/** Знак — примерно в каждом пятом утреннем. */
const MORNING_SIGN_RU: Line[] = [
  ['{pl}, доброе утро!', 'Но мы про тебя лично, а не про всех {gen}. Твой день уже разобран'],
  ['{pl}, сегодня ваш выход', 'Узнай, в чём сегодня твоя сила'],
  ['Как там {pl}?', 'Твой личный день по карте уже ждёт. Заходи'],
];
const MORNING_WEEKDAY_RU: Record<number, Line[]> = {
  1: [['Понедельник, мы с тобой', 'Подскажем, с какого дела неделя пойдёт легче'], ['Новая неделя, новые шансы', 'Узнай, какой день в ней будет твоим']],
  5: [['Пятница, ура!', 'Узнай, каким будет твой вечер, и планируй смело'], ['Пятница пришла', 'Как пройдёт твой вечер? Мы уже знаем, заходи']],
  6: [['Суббота, можно не спешить', 'Узнай, как отдохнуть так, чтобы правда зарядиться']],
  0: [['Воскресенье, ленивый режим', 'Узнай, что сегодня зарядит тебя лучше всего'], ['Тихое воскресенье', 'Хороший момент узнать, какой будет твоя неделя']],
};
const MORNING_EN: Line[] = [
  ['Good morning!', 'We already looked at your chart. A couple of things are worth knowing before lunch'],
  ['Rise and shine!', 'You have a strong moment today. Want to know when?'],
  ['Coffee ready?', 'Then two minutes about your day: what goes easy and where to slow down'],
  ['Hey, this one is about you', 'Your day by your chart is ready. No fluff, straight to the point'],
];

// ───────────── Днём и вечером: про себя, в разные разделы ─────────────
const INVITE_RU: RoutedLine[] = [
  ['Слушай, а откуда у тебя этот характер?', 'Ответ в твоей натальной карте. Узнаешь себя с первых строк', 'natal'],
  ['У тебя есть суперсила', 'Она записана в твоей карте, и ты её точно недооцениваешь', 'natal'],
  ['Как день, держишься?', 'Подскажем, что ещё стоит успеть, а что спокойно оставить на завтра', 'today'],
  ['Что сделать, а что отпустить', 'Пара строк по твоей карте. Только про тебя', 'today'],
  ['День какой-то странный?', 'Бывает. В твоём прогнозе есть объяснение почему', 'today'],
  ['В чём ты сильнее других', 'Твоя карта отвечает прямо. Читается за пять минут, запоминается надолго', 'natal'],
  ['Поговорим про деньги?', 'Что твоя карта говорит про заработок. Ответ может удивить', 'natal'],
  ['Как ты любишь', 'Натальная карта знает и это. Прочитай и улыбнись', 'natal'],
  ['Батарейка садится?', 'Узнай по своей карте, что заряжает тебя быстрее всего', 'natal'],
  ['Перерыв на себя', 'Как пройдёт остаток твоего дня. Пара строк, честно', 'today'],
  ['Сегодня у тебя кое-что получается особенно', 'Что именно, написано в твоём прогнозе', 'today'],
  ['Твоё дело жизни', 'В карте есть подсказка, какая работа тебе по-настоящему в радость', 'natal'],
];
const INVITE_EN: RoutedLine[] = [
  ['Hey, where does your character come from?', 'Your natal chart has the answer. You will see yourself from line one', 'natal'],
  ['How is the day going?', 'We will tell you what is still worth doing and what can wait', 'today'],
  ['You have a superpower', 'It is written in your chart, and you surely underrate it', 'natal'],
  ['A break for you', 'How the rest of your day goes. A few honest lines', 'today'],
];

// ───────────── Давно не заходил ─────────────
const COMEBACK_RU: Record<3 | 7 | 14, Line[]> = {
  3: [
    ['Эй, мы скучали', 'Пока тебя не было, небо поменялось. Рассказать, что это значит для тебя?'],
    ['Как ты там?', 'Твой сегодняшний день уже разобран. Загляни на минутку, мы подождём'],
    ['Три дня без подсказок', 'Сегодня есть одна важная. Короткая и про тебя'],
  ],
  7: [
    ['Неделя пролетела!', 'Давай узнаем, какой будет следующая. Начнём с сегодня'],
    ['Мы тут, если что', 'Новая неделя по твоей карте: где легко, а где лучше не спешить'],
  ],
  14: [
    ['Давно не виделись', 'Без обид и упрёков. Твоя карта на месте, и сегодня в ней кое-что есть'],
    ['Просто напоминаем о себе', 'Когда захочешь, подсказка по твоей карте будет ждать'],
  ],
};
const COMEBACK_EN: Line[] = [
  ['Hey, we missed you', 'The sky changed while you were away. Want to know what it means for you?'],
  ['Long time no see', 'No pressure. Your chart is here, and today has something in it'],
];

// ───────────── События неба (даты считает сервер по эфемеридам) ─────────────
const SKY_RU: Record<SkyEventKind, Line[]> = {
  full_moon: [
    ['Сегодня полнолуние', 'Все немного на взводе, и это нормально. Узнай, как это заденет тебя'],
    ['Полная Луна!', 'Отличный вечер, чтобы что-то отпустить. Что именно, подскажет твоя карта'],
    ['Полнолуние, выгляни вечером в окно', 'Луна сегодня полная. А что она значит для тебя, рассказываем в прогнозе'],
  ],
  new_moon: [
    ['Сегодня новолуние', 'Лучший день загадать желание. Узнай, с чего начать именно тебе'],
    ['Новолуние, чистый лист', 'Твоя карта подскажет, что сейчас стоит начать'],
  ],
  mercury_rx_start: [
    ['Начался ретроградный Меркурий', 'Три недели, когда слова понимают не так. Подскажем, где быть внимательнее'],
    ['Ретроградный Меркурий, опять', 'Без паники, мы рядом. Узнай, что он может задеть у тебя'],
  ],
  mercury_rx_end: [
    ['Ретроградный Меркурий закончился!', 'Выдыхаем. Можно снова подписывать, покупать и отправлять важное'],
    ['Меркурий нас отпустил', 'Отложенные дела можно возвращать. Подскажем, с какого начать'],
  ],
};
const SKY_EN: Record<SkyEventKind, Line> = {
  full_moon: ['Full moon tonight', 'Everyone is a bit on edge, and that is fine. See how it touches you'],
  new_moon: ['New moon today', 'The best day to make a wish. See where to begin'],
  mercury_rx_start: ['Mercury retrograde has begun', 'Three weeks when words get misread. We will show where to be careful'],
  mercury_rx_end: ['Mercury retrograde is over!', 'Breathe out. You can sign, buy and send important things again'],
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
  { label: 'Доброе утро', title: 'Доброе утро!', body: 'Мы уже заглянули в твою карту. Есть пара вещей, которые стоит знать до обеда', route: 'today' },
  { label: 'Натальная карта', title: 'Откуда у тебя этот характер?', body: 'В твоей натальной карте есть ответ, и он точнее, чем кажется', route: 'natal' },
  { label: 'Полнолуние', title: 'Сегодня полнолуние', body: 'Все немного на взводе, и это нормально. Узнай, как это заденет тебя', route: 'today' },
  { label: 'Меркурий', title: 'Начался ретроградный Меркурий', body: 'Три недели, когда слова понимают не так. Узнай, где тебе быть внимательнее', route: 'today' },
  { label: 'Обновление', title: 'NEBO обновился', body: 'Мы добавили новое. Открой и попробуй первым', route: 'today' },
  { label: 'Скучаем', title: 'Эй, мы скучали', body: 'Пока тебя не было, небо поменялось. Рассказать, что это значит для тебя?', route: 'today' },
];
