/**
 * «Для тебя» on the home screen: up to three personal suggestions picked by
 * plain rules from the person's own data. Deterministic, no AI. Each suggestion
 * has an occurrence key, so «Скрыть» hides exactly this one (this new moon,
 * this birthday) and the next occasion can still show up.
 */
import type { InterestSignals } from './interestSignals';

export type ForYouRuleId =
  | 'premium_ending'
  | 'birthday'
  | 'new_moon'
  | 'mercury'
  | 'month_review'
  | 'pair'
  | 'compatibility'
  | 'love_week'
  | 'birth_time'
  | 'test_unfinished'
  | 'mood_report';

export type ForYouAction =
  | { type: 'premium' }
  | { type: 'future'; monthKey?: string }
  | { type: 'wishes'; newMoonKey: string }
  | { type: 'month_review'; monthKey: string }
  | { type: 'pair'; chartId: string; name: string }
  | { type: 'compatibility' }
  | { type: 'week' }
  | { type: 'birth_time' }
  | { type: 'test'; testId: string }
  | { type: 'mood' };

export type ForYouOffer = {
  id: ForYouRuleId;
  /** Hides this occasion only. */
  occurrence: string;
  title: string;
  body: string;
  cta: string;
  action: ForYouAction;
};

export type ForYouContext = {
  language: 'ru' | 'en';
  /** Today in the person's timezone, YYYY-MM-DD. */
  todayKey: string;
  /** ISO week key of today, e.g. 2026-W41. */
  weekKey: string;
  birthDate: string;
  birthTimeKnown: boolean;
  premium: boolean;
  premiumEndsAt: string | null;
  premiumAutoRenew: boolean | null;
  signals: InterestSignals;
  savedPeople: ReadonlyArray<{ id: string; name: string }>;
  newMoonKey: string | null;
  mercuryRetroKey: string | null;
  /** Wishes saved per new moon day. */
  wishKeys: ReadonlySet<string>;
  /** Months (YYYY-MM) already summed up. */
  reviewedMonths: ReadonlySet<string>;
  /** Occurrence keys the person hid. */
  dismissed: ReadonlySet<string>;
  /** A test started and not finished. */
  unfinishedTest?: { id: string; title: string; answered: number; total: number; updatedAt: string } | null;
  /** Start day of a finished «Неделя настроения» whose report was not opened yet. */
  moodReportReady?: string | null;
};

export const FOR_YOU_LIMIT = 3;
export const FOR_YOU_COMPATIBILITY_OPENS = 3;
export const FOR_YOU_LOVE_READS = 5;

const MONTHS_GEN_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dayNumber(dayKey: string): number {
  return Math.round(Date.parse(`${dayKey}T12:00:00Z`) / 86_400_000);
}

export function daysBetweenKeys(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

function dateRu(dayKey: string): string {
  return `${Number(dayKey.slice(8, 10))} ${MONTHS_GEN_RU[Number(dayKey.slice(5, 7)) - 1]}`;
}

function dateEn(dayKey: string): string {
  return `${MONTHS_EN[Number(dayKey.slice(5, 7)) - 1]} ${Number(dayKey.slice(8, 10))}`;
}

function pluralDaysRu(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/** Next birthday on or after today, YYYY-MM-DD (29 February → 28 February in other years). */
export function nextBirthdayKey(birthDate: string, todayKey: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const year = Number(todayKey.slice(0, 4));
  const build = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const day = match[2] === '02' && match[3] === '29' && !leap ? '28' : match[3];
    return `${y}-${match[2]}-${day}`;
  };
  const thisYear = build(year);
  return thisYear >= todayKey ? thisYear : build(year + 1);
}

function lastDayOfMonth(todayKey: string): string {
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${todayKey.slice(0, 7)}-${String(days).padStart(2, '0')}`;
}

function relativeDayRu(days: number, dayKey: string): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days === 2) return 'послезавтра';
  return dateRu(dayKey);
}

export function buildForYouOffers(context: ForYouContext): ForYouOffer[] {
  const ru = context.language === 'ru';
  const offers: ForYouOffer[] = [];
  const { todayKey } = context;

  if (context.premium && context.premiumEndsAt && context.premiumAutoRenew !== true) {
    const endKey = context.premiumEndsAt.slice(0, 10);
    const left = daysBetweenKeys(todayKey, endKey);
    if (left >= 0 && left <= 5) {
      offers.push({
        id: 'premium_ending',
        occurrence: `premium:${endKey}`,
        title: ru ? `NEBO+ открыт до ${dateRu(endKey)}` : `NEBO+ is open until ${dateEn(endKey)}`,
        body: ru
          ? 'Говорим заранее, без спешки. Если захочешь продолжить — продлить можно в пару касаний, все карты и разборы останутся на месте.'
          : 'Just a heads-up. If you want to keep it, renewing takes a couple of taps — your charts and readings stay where they are.',
        cta: ru ? 'Посмотреть варианты' : 'See options',
        action: { type: 'premium' },
      });
    }
  }

  const birthday = nextBirthdayKey(context.birthDate, todayKey);
  if (birthday) {
    const left = daysBetweenKeys(todayKey, birthday);
    if (left >= 0 && left <= 14) {
      offers.push({
        id: 'birthday',
        occurrence: `birthday:${birthday.slice(0, 4)}`,
        title: ru
          ? (left === 0 ? 'С днём рождения!' : `До дня рождения ${left} ${pluralDaysRu(left)}`)
          : (left === 0 ? 'Happy birthday!' : `${left} ${left === 1 ? 'day' : 'days'} to your birthday`),
        body: ru
          ? 'Прогноз на твой новый год: что ждёт по месяцам — от дня рождения и дальше.'
          : 'A forecast for your new year: what each month holds, from your birthday onwards.',
        cta: ru ? 'Открыть год вперёд' : 'Open the year ahead',
        action: { type: 'future', monthKey: birthday.slice(0, 7) },
      });
    }
  }

  if (context.newMoonKey && !context.wishKeys.has(context.newMoonKey)) {
    const left = daysBetweenKeys(todayKey, context.newMoonKey);
    if (left >= 0 && left <= 2) {
      offers.push({
        id: 'new_moon',
        occurrence: `newmoon:${context.newMoonKey}`,
        title: ru ? `Новолуние ${relativeDayRu(left, context.newMoonKey)}` : (left === 0 ? 'New moon today' : `New moon on ${dateEn(context.newMoonKey)}`),
        body: ru
          ? 'Задумай, что хочешь за месяц: три-пять коротких пунктов. В конце месяца вместе отметим, что сбылось.'
          : 'Write down what you want this month: three to five short points. At the end of the month we will mark what came true.',
        cta: ru ? 'Записать планы' : 'Write plans',
        action: { type: 'wishes', newMoonKey: context.newMoonKey },
      });
    }
  }

  if (context.mercuryRetroKey) {
    const left = daysBetweenKeys(todayKey, context.mercuryRetroKey);
    if (left >= 1 && left <= 10) {
      offers.push({
        id: 'mercury',
        occurrence: `mercury:${context.mercuryRetroKey}`,
        title: ru ? `Что успеть до ${dateRu(context.mercuryRetroKey)}` : `What to finish before ${dateEn(context.mercuryRetroKey)}`,
        body: ru
          ? 'Потом Меркурий три недели идёт назад. Подписать, купить технику, взять билеты — лучше до этой даты.'
          : 'Then Mercury goes retrograde for three weeks. Signing, buying gadgets and booking tickets is better done before.',
        cta: ru ? 'Открыть календарь' : 'Open the calendar',
        action: { type: 'future' },
      });
    }
  }

  const monthKey = todayKey.slice(0, 7);
  if (daysBetweenKeys(todayKey, lastDayOfMonth(todayKey)) <= 2 && !context.reviewedMonths.has(monthKey)) {
    const month = Number(monthKey.slice(5, 7)) - 1;
    offers.push({
      id: 'month_review',
      occurrence: `month:${monthKey}`,
      title: ru ? `Итоги: ${MONTHS_RU[month]}` : `${MONTHS_EN[month]} in review`,
      body: ru
        ? 'Отметь, что сбылось из задуманного, и запиши одну хорошую вещь, которая случилась за месяц.'
        : 'Mark what came true from your plans and write down one good thing that happened this month.',
      cta: ru ? 'Подвести итоги' : 'Review the month',
      action: { type: 'month_review', monthKey },
    });
  }

  const unopened = context.savedPeople.find((person) => !context.signals.openedPairs.includes(person.id));
  if (unopened) {
    offers.push({
      id: 'pair',
      occurrence: `pair:${unopened.id}:${context.weekKey}`,
      title: ru ? `Ты и ${unopened.name}: как вы на этой неделе` : `You and ${unopened.name} this week`,
      body: ru
        ? 'Посмотри вашу совместимость: что даётся легко, а о чём лучше договориться заранее.'
        : 'See your compatibility: what comes easily and what is better agreed on in advance.',
      cta: ru ? 'Сравнить нас' : 'Compare us',
      action: { type: 'pair', chartId: unopened.id, name: unopened.name },
    });
  }

  if (context.signals.compatibilityOpens >= FOR_YOU_COMPATIBILITY_OPENS) {
    offers.push({
      id: 'compatibility',
      occurrence: `compat:${monthKey}`,
      title: ru ? 'Полный разбор вашей пары' : 'The full reading of your pair',
      body: ru
        ? 'Совместимость — явно твоя тема. В полном разборе: где вы похожи, о чём спорите и как договариваться.'
        : 'Compatibility is clearly your topic. The full reading shows where you are alike, what you argue about and how to agree.',
      cta: ru ? 'Открыть разбор' : 'Open the reading',
      action: { type: 'compatibility' },
    });
  }

  if (context.signals.loveReads >= FOR_YOU_LOVE_READS) {
    offers.push({
      id: 'love_week',
      occurrence: `love:${context.weekKey}`,
      title: ru ? 'Твоя неделя в отношениях' : 'Your week in relationships',
      body: ru
        ? 'Ты часто читаешь про любовь и близких. В разборе недели — когда лучше поговорить, а когда дать друг другу воздух.'
        : 'You often read about love and close people. The week reading shows when to talk and when to give each other space.',
      cta: ru ? 'Читать неделю' : 'Read the week',
      action: { type: 'week' },
    });
  }

  if (context.moodReportReady) {
    offers.push({
      id: 'mood_report',
      occurrence: `mood:${context.moodReportReady}`,
      title: ru ? 'Твой отчёт готов' : 'Your report is ready',
      body: ru
        ? 'Неделя настроения закончилась. Посмотри, когда тебе было лучше всего и совпало ли это с прогнозом.'
        : 'Your mood week is over. See when you felt best and whether it matched the forecast.',
      cta: ru ? 'Открыть отчёт' : 'Open the report',
      action: { type: 'mood' },
    });
  }

  if (context.unfinishedTest) {
    const test = context.unfinishedTest;
    offers.push({
      id: 'test_unfinished',
      occurrence: `test:${test.id}:${test.updatedAt.slice(0, 10)}`,
      title: ru ? 'Продолжить тест' : 'Continue the test',
      body: ru
        ? `«${test.title}»: отвечено ${test.answered} из ${test.total}. Осталось совсем немного — результат уже ждёт.`
        : `«${test.title}» — ${test.answered} of ${test.total} answered. Almost there, the result is waiting.`,
      cta: ru ? 'Продолжить' : 'Continue',
      action: { type: 'test', testId: test.id },
    });
  }

  if (!context.birthTimeKnown) {
    offers.push({
      id: 'birth_time',
      occurrence: 'birthtime',
      title: ru ? 'Уточни время рождения' : 'Add your birth time',
      body: ru
        ? 'С временем карта станет точнее: появятся Асцендент и дома, а прогнозы — конкретнее.'
        : 'With a birth time the chart gets precise: the Ascendant and houses appear and forecasts get specific.',
      cta: ru ? 'Добавить время' : 'Add time',
      action: { type: 'birth_time' },
    });
  }

  return offers.filter((offer) => !context.dismissed.has(offer.occurrence)).slice(0, FOR_YOU_LIMIT);
}
