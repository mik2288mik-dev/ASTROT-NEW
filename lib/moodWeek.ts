/**
 * «Неделя настроения»: seven days, four quick check-ins a day (mood and how
 * much strength there is, 1–5). After seven days a report shows peaks and dips
 * by day and time of day and compares them with the forecast days and the Moon —
 * honestly, saying so when a week is too little to see anything.
 */

export const MOOD_WEEK_DAYS = 7;
export const MOOD_SLOTS = ['morning', 'day', 'evening', 'night'] as const;
export type MoodSlot = typeof MOOD_SLOTS[number];
export type MoodCheckin = { mood: number; power: number; at: string };
export type MoodWeek = {
  startDayKey: string;
  /** Two reminder times, HH:MM, at least three hours apart. */
  reminderTimes: [string, string];
  checkins: Record<string, Partial<Record<MoodSlot, MoodCheckin>>>;
  reportSeenAt?: string;
};

export const MOOD_SLOT_LABELS: Record<MoodSlot, { ru: string; en: string; hint: { ru: string; en: string } }> = {
  morning: { ru: 'Утро', en: 'Morning', hint: { ru: 'до 12:00', en: 'until 12:00' } },
  day: { ru: 'День', en: 'Day', hint: { ru: '12:00–17:00', en: '12:00–17:00' } },
  evening: { ru: 'Вечер', en: 'Evening', hint: { ru: '17:00–21:00', en: '17:00–21:00' } },
  night: { ru: 'Перед сном', en: 'Before bed', hint: { ru: 'после 21:00', en: 'after 21:00' } },
};

export const MOOD_LEVELS = {
  mood: {
    ru: ['Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'],
    en: ['Bad', 'Meh', 'Okay', 'Good', 'Great'],
  },
  power: {
    ru: ['Сил нет', 'Мало', 'Средне', 'Бодро', 'Полно сил'],
    en: ['Drained', 'Low', 'Medium', 'Lively', 'Full of it'],
  },
} as const;

export const DEFAULT_REMINDER_TIMES: [string, string] = ['10:00', '20:00'];

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

/** Reminder times must fit the notification rules: 9:00–21:00 and three hours apart. */
export function validReminderTimes(times: readonly string[]): boolean {
  if (times.length !== 2) return false;
  const [a, b] = times.map(minutes);
  if (a === null || b === null) return false;
  return a >= 9 * 60 && b <= 21 * 60 && b - a >= 180;
}

export function addDays(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekDayKeys(week: Pick<MoodWeek, 'startDayKey'>): string[] {
  return Array.from({ length: MOOD_WEEK_DAYS }, (_, index) => addDays(week.startDayKey, index));
}

/** 1-based day of the week for today, or null outside the week. */
export function moodWeekDayNumber(week: Pick<MoodWeek, 'startDayKey'>, todayKey: string): number | null {
  const index = weekDayKeys(week).indexOf(todayKey);
  return index === -1 ? null : index + 1;
}

export function isMoodWeekFinished(week: Pick<MoodWeek, 'startDayKey'>, todayKey: string): boolean {
  return todayKey > addDays(week.startDayKey, MOOD_WEEK_DAYS - 1);
}

/** The check-in slot for a local hour. */
export function slotForHour(hour: number): MoodSlot {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'day';
  if (hour < 21) return 'evening';
  return 'night';
}

export function validCheckin(value: Partial<MoodCheckin>): value is MoodCheckin {
  return Number.isInteger(value.mood) && value.mood! >= 1 && value.mood! <= 5
    && Number.isInteger(value.power) && value.power! >= 1 && value.power! <= 5
    && typeof value.at === 'string';
}

type DayContext = {
  /** Forecast tone of the day from the person's calendar: good, hard or none. */
  tone?: 'good' | 'hard' | null;
  /** Moon phase angle at local noon, 0..360 (0 new, 180 full). */
  moonAngle?: number | null;
};

export type MoodReport = {
  checkins: number;
  possible: number;
  average: { mood: number; power: number } | null;
  days: Array<{ dayKey: string; mood: number | null; power: number | null; count: number }>;
  slots: Array<{ slot: MoodSlot; mood: number | null; power: number | null; count: number }>;
  bestDay: string | null;
  worstDay: string | null;
  bestSlot: MoodSlot | null;
  worstSlot: MoodSlot | null;
  forecastLine: string;
  moonLine: string;
  summary: string;
};

function mean(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
}

function formatScore(value: number, language: 'ru' | 'en'): string {
  return language === 'ru' ? String(value).replace('.', ',') : String(value);
}

/** With the preposition: «во вторник», «в среду». */
const WEEKDAYS_RU = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOT_IN_RU: Record<MoodSlot, string> = { morning: 'по утрам', day: 'днём', evening: 'по вечерам', night: 'перед сном' };
const SLOT_IN_EN: Record<MoodSlot, string> = { morning: 'in the mornings', day: 'in the daytime', evening: 'in the evenings', night: 'before bed' };

function weekdayOf(dayKey: string, language: 'ru' | 'en'): string {
  const index = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
  return language === 'ru' ? WEEKDAYS_RU[index] : WEEKDAYS_EN[index];
}

/** Compares mood on two groups of days; says plainly when there is too little to compare. */
function compareGroups(
  groups: { a: number[]; b: number[] },
  labels: { a: string; b: string },
  language: 'ru' | 'en',
): string {
  const ma = mean(groups.a);
  const mb = mean(groups.b);
  if (ma === null || mb === null || (groups.a.length < 2 && groups.b.length < 2)) {
    return language === 'ru' ? 'Для сравнения не хватило дней — нужна неделя с разными днями.' : 'Not enough days to compare — the week needs different kinds of days.';
  }
  if (Math.abs(ma - mb) < 0.5) {
    return language === 'ru'
      ? `${labels.a} и ${labels.b} настроение почти одинаковое (${formatScore(ma, language)} и ${formatScore(mb, language)} из 5). Связи не видно — и это честный результат: сон, погода и люди влияют сильнее.`
      : `${labels.a} and ${labels.b} your mood was about the same (${ma} and ${mb} of 5). No link here — an honest result: sleep, weather and people matter more.`;
  }
  const higher = ma > mb ? labels.a : labels.b;
  return language === 'ru'
    ? `${labels.a} среднее настроение ${formatScore(ma, language)}, ${labels.b} — ${formatScore(mb, language)} из 5. ${higher[0].toUpperCase()}${higher.slice(1)} заметно лучше, но одна неделя — слишком мало, чтобы делать выводы. Повтори неделю через месяц и сравни.`
    : `${labels.a} your average mood was ${ma}, ${labels.b} — ${mb} of 5. ${higher[0].toUpperCase()}${higher.slice(1)} looks better, but one week is too little for conclusions. Repeat in a month and compare.`;
}

export function buildMoodReport(week: MoodWeek, context: Record<string, DayContext>, language: 'ru' | 'en'): MoodReport {
  const ru = language === 'ru';
  const days = weekDayKeys(week).map((dayKey) => {
    const entries = Object.values(week.checkins[dayKey] ?? {}).filter((entry): entry is MoodCheckin => Boolean(entry && validCheckin(entry)));
    return { dayKey, mood: mean(entries.map((entry) => entry.mood)), power: mean(entries.map((entry) => entry.power)), count: entries.length };
  });
  const slots = MOOD_SLOTS.map((slot) => {
    const entries = weekDayKeys(week).map((dayKey) => week.checkins[dayKey]?.[slot]).filter((entry): entry is MoodCheckin => Boolean(entry && validCheckin(entry)));
    return { slot, mood: mean(entries.map((entry) => entry.mood)), power: mean(entries.map((entry) => entry.power)), count: entries.length };
  });
  const all = days.flatMap((day) => Object.values(week.checkins[day.dayKey] ?? {})).filter((entry): entry is MoodCheckin => Boolean(entry && validCheckin(entry)));
  const rated = days.filter((day) => day.mood !== null);
  const ratedSlots = slots.filter((slot) => slot.count >= 2 && slot.mood !== null);
  const bestDay = rated.length >= 2 ? [...rated].sort((a, b) => b.mood! - a.mood! || b.power! - a.power!)[0].dayKey : null;
  const worstDay = rated.length >= 2 ? [...rated].sort((a, b) => a.mood! - b.mood! || a.power! - b.power!)[0].dayKey : null;
  const bestSlot = ratedSlots.length >= 2 ? [...ratedSlots].sort((a, b) => b.mood! - a.mood!)[0].slot : null;
  const worstSlot = ratedSlots.length >= 2 ? [...ratedSlots].sort((a, b) => a.mood! - b.mood!)[0].slot : null;

  const toned = rated.filter((day) => context[day.dayKey]?.tone);
  const forecastLine = toned.length
    ? compareGroups(
      { a: toned.filter((day) => context[day.dayKey]?.tone === 'good').map((day) => day.mood!), b: toned.filter((day) => context[day.dayKey]?.tone === 'hard').map((day) => day.mood!) },
      ru ? { a: 'в лёгкие по прогнозу дни', b: 'в напряжённые' } : { a: 'on easy forecast days', b: 'on tense ones' },
      language,
    )
    : (ru ? 'По твоей карте на этой неделе не было ни особенно лёгких, ни напряжённых дней — сравнивать не с чем.' : 'Your chart had no especially easy or tense days this week — nothing to compare.');

  const phased = rated.filter((day) => typeof context[day.dayKey]?.moonAngle === 'number');
  const moonLine = phased.length
    ? compareGroups(
      { a: phased.filter((day) => context[day.dayKey]!.moonAngle! < 180).map((day) => day.mood!), b: phased.filter((day) => context[day.dayKey]!.moonAngle! >= 180).map((day) => day.mood!) },
      ru ? { a: 'на растущей Луне', b: 'на убывающей' } : { a: 'with a waxing Moon', b: 'with a waning one' },
      language,
    )
    : '';

  const average = all.length ? { mood: mean(all.map((entry) => entry.mood))!, power: mean(all.map((entry) => entry.power))! } : null;
  const parts: string[] = [];
  if (!average) {
    parts.push(ru ? 'Отметок за неделю не набралось — отчёт пустой. Можно начать новую неделю в любой день.' : 'No check-ins this week — the report is empty. You can start a new week any day.');
  } else {
    parts.push(ru
      ? `За неделю ${all.length} ${all.length % 10 === 1 && all.length % 100 !== 11 ? 'отметка' : all.length % 10 >= 2 && all.length % 10 <= 4 && (all.length % 100 < 12 || all.length % 100 > 14) ? 'отметки' : 'отметок'} из ${MOOD_WEEK_DAYS * MOOD_SLOTS.length}. Среднее настроение — ${formatScore(average.mood, language)}, силы — ${formatScore(average.power, language)} из 5.`
      : `${all.length} of ${MOOD_WEEK_DAYS * MOOD_SLOTS.length} check-ins this week. Average mood ${average.mood}, strength ${average.power} of 5.`);
    if (bestDay && worstDay && bestDay !== worstDay) {
      parts.push(ru ? `Лучше всего было ${weekdayOf(bestDay, language)}, труднее всего — ${weekdayOf(worstDay, language)}.` : `${weekdayOf(bestDay, language)} was the best, ${weekdayOf(worstDay, language)} the hardest.`);
    }
    if (bestSlot && worstSlot && bestSlot !== worstSlot) {
      parts.push(ru ? `Настроение выше ${SLOT_IN_RU[bestSlot]}, ниже — ${SLOT_IN_RU[worstSlot]}.` : `Mood is higher ${SLOT_IN_EN[bestSlot]}, lower ${SLOT_IN_EN[worstSlot]}.`);
    }
  }

  return {
    checkins: all.length,
    possible: MOOD_WEEK_DAYS * MOOD_SLOTS.length,
    average,
    days,
    slots,
    bestDay,
    worstDay,
    bestSlot,
    worstSlot,
    forecastLine,
    moonLine,
    summary: parts.join(' '),
  };
}
