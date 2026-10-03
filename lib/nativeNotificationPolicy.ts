import {
  birthdayCopy, comebackCopy, holidayCopy, inviteCopy, moodCopy, morningCopy, readyCopy, seasonCopy, skyEventCopy,
  type PushCopy, type PushRoute, type SkyEventKind,
} from './nativePushCopy';
import { APPROXIMATE_SUN_SIGN_DATES, ZODIAC_SIGNS, type ZodiacSign } from './zodiac-utils';

export type NativeNotificationSettings = {
  enabled: boolean;
  /** important — только поводы (ДР, праздники, небо, «давно не заходил», готовый результат); daily — ещё утро и день. */
  mode: 'important' | 'daily';
  quietStart: string;
  quietEnd: string;
};
export type NativeNotificationKind = 'daily' | 'invite' | 'comeback' | 'holiday' | 'birthday' | 'season' | 'sky' | 'ready' | 'mood';
export type NativeNotificationRoute = PushRoute;
export type NativeNotificationPlan = {
  id: number; title: string; body: string; at: number; expiresAt: number;
  accountId: string; kind: NativeNotificationKind; dayKey: string; route: NativeNotificationRoute;
};
/** Событие неба на локальную дату; даты считает сервер по Swiss Ephemeris. */
export type NativeSkyEvent = { dayKey: string; kind: SkyEventKind };
export const SKY_EVENT_KINDS: readonly SkyEventKind[] = ['full_moon', 'new_moon', 'mercury_rx_start', 'mercury_rx_end'];
export type NativeNotificationProfile = {
  sign?: ZodiacSign | null;
  name?: string;
  /** YYYY-MM-DD */
  birthDate?: string;
};
export const NATIVE_NOTIFICATION_ROUTES: readonly NativeNotificationRoute[] = ['today', 'natal', 'horoscope', 'compatibility', 'mood'];
/** «Неделя настроения»: seven days from startDayKey, two reminders at the chosen times. */
export type NativeMoodWeek = { startDayKey: string; reminderTimes: [string, string] };
export const DEFAULT_NATIVE_NOTIFICATION_SETTINGS: NativeNotificationSettings = {
  enabled: false, mode: 'daily', quietStart: '22:00', quietEnd: '09:00',
};
/** Сколько дней вперёд планируем. Нативная сторона принимает до 16 суток. */
export const NATIVE_PLAN_DAYS = 14;
/** Обычный день — 1–2, в день события (праздник, ДР, небо) — до 3. */
export const NATIVE_MAX_PER_DAY = 3;
const HOUR = 3_600_000;
const MINUTE = 60_000;

export function localNotificationDayKey(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function notificationTimeMinutes(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
export function normalizeNativeNotificationSettings(value: unknown): NativeNotificationSettings {
  const input = value && typeof value === 'object' ? value as Partial<NativeNotificationSettings> : {};
  return {
    enabled: input.enabled === true,
    mode: input.mode === 'important' ? 'important' : 'daily',
    quietStart: notificationTimeMinutes(input.quietStart) !== null ? input.quietStart! : '22:00',
    quietEnd: notificationTimeMinutes(input.quietEnd) !== null ? input.quietEnd! : '09:00',
  };
}
export function isNativeNotificationQuiet(date: Date, settings: NativeNotificationSettings): boolean {
  const start = notificationTimeMinutes(settings.quietStart);
  const end = notificationTimeMinutes(settings.quietEnd);
  if (!Number.isFinite(date.getTime()) || start === null || end === null || start === end) return true;
  const minute = date.getHours() * 60 + date.getMinutes();
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}
export function normalizeSkyEvents(value: unknown): NativeSkyEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is NativeSkyEvent => !!item && typeof item === 'object'
    && typeof (item as NativeSkyEvent).dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((item as NativeSkyEvent).dayKey)
    && SKY_EVENT_KINDS.includes((item as NativeSkyEvent).kind)).slice(0, 32);
}

/** Знак для текстов: выбранный в профиле, иначе по дате рождения. */
export function resolveNotificationSign(selected: unknown, birthDate: unknown): ZodiacSign | null {
  if (typeof selected === 'string') {
    const match = ZODIAC_SIGNS.find((sign) => sign.toLowerCase() === selected.trim().toLowerCase());
    if (match) return match;
  }
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return null;
  for (const sign of ZODIAC_SIGNS) {
    const range = APPROXIMATE_SUN_SIGN_DATES[sign];
    const afterStart = parsed.month === range.startMonth && parsed.day >= range.startDay;
    const beforeEnd = parsed.month === range.endMonth && parsed.day <= range.endDay;
    const between = range.startMonth < range.endMonth && parsed.month > range.startMonth && parsed.month < range.endMonth;
    if (afterStart || beforeEnd || between) return sign;
  }
  return null;
}
function parseBirthDate(value: unknown): { month: number; day: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { month, day } : null;
}
function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i++) result = (result * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(result);
}
function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * HOUR));
}

/** Первая минута не раньше preferred и не позже 21:00, вне тихих часов. */
function slotTime(day: Date, preferredMinute: number, settings: NativeNotificationSettings): Date | null {
  for (let minute = preferredMinute; minute < 21 * 60; minute++) {
    const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute);
    if (!isNativeNotificationQuiet(candidate, settings)) return candidate;
  }
  return null;
}

/** Три окна дня: утро, обед, вечер. Между ними больше трёх часов (нативный минимум). */
type Window = 0 | 1 | 2;
type Candidate = { kind: NativeNotificationKind; copy: PushCopy; window: Window; event: boolean; minute?: number };
/** Ритм первой недели: где-то два, где-то один — чтобы не было ощущения конвейера. */
const RHYTHM = [2, 1, 2, 2, 1, 2, 1];

/**
 * Расписание локальных уведомлений, пересобирается при каждом заходе в приложение.
 * «Давно не заходил» считается от момента планирования: зашёл — план переписан.
 * Дни 1–6: 1–2 обычных (утро — гороскоп, днём/вечером — повод заглянуть в раздел);
 * дни 3, 7, 14 — «возвращайся»; день 10 — одно утреннее. Праздник, ДР, начало сезона
 * своего знака, полнолуние/новолуние, ретроградный Меркурий — добавляются сверху,
 * в такой день до трёх. Пока человек пропадает (после 6-го дня) — не больше одного в день.
 */
export function planNativeNotifications(input: {
  accountId: string; language: 'ru' | 'en'; isSetup: boolean; settings: NativeNotificationSettings;
  readDate?: string; now?: Date; profile?: NativeNotificationProfile; skyEvents?: NativeSkyEvent[];
  moodWeek?: NativeMoodWeek | null;
}): NativeNotificationPlan[] {
  const now = input.now || new Date();
  if (!input.accountId || !input.isSetup || !input.settings.enabled || !Number.isFinite(now.getTime())) return [];
  const lang = input.language;
  const sign = input.profile?.sign || null;
  const birth = parseBirthDate(input.profile?.birthDate);
  const userSeed = hash(input.accountId);
  const everyday = input.settings.mode === 'daily';
  const sky = normalizeSkyEvents(input.skyEvents);
  const windowMinute = (window: Window, kind: NativeNotificationKind) => window === 0
    ? 9 * 60 + (kind === 'daily' ? userSeed % 30 : 30)
    : window === 1 ? 13 * 60 + userSeed % 40 : (kind === 'sky' ? 20 * 60 : 19 * 60) + userSeed % 30;
  const result: NativeNotificationPlan[] = [];

  for (let offset = 0; offset <= NATIVE_PLAN_DAYS; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const number = dayNumber(day);
    const seed = number + userSeed;
    const dayKey = localNotificationDayKey(day);
    const month = day.getMonth() + 1;
    const date = day.getDate();
    const weekday = day.getDay();
    const active = offset <= 6;

    // События дня — в порядке важности.
    const events: Candidate[] = [];
    if (birth && birth.month === month && birth.day === date) {
      events.push({ kind: 'birthday', copy: birthdayCopy(lang, input.profile?.name || ''), window: 0, event: true });
    }
    const holiday = holidayCopy(lang, month, date, weekday);
    if (holiday) events.push({ kind: 'holiday', copy: holiday, window: 0, event: true });
    if (sign && APPROXIMATE_SUN_SIGN_DATES[sign].startMonth === month && APPROXIMATE_SUN_SIGN_DATES[sign].startDay === date) {
      events.push({ kind: 'season', copy: seasonCopy(lang, sign), window: 1, event: true });
    }
    for (const event of sky.filter((item) => item.dayKey === dayKey)) {
      const evening = event.kind === 'full_moon';
      events.push({ kind: 'sky', copy: skyEventCopy(lang, event.kind, seed), window: evening ? 2 : 1, event: true });
    }

    // Обычные поводы. В неделю настроения два её напоминания заменяют обычные — лимит дня не растёт.
    const routine: Candidate[] = [];
    const moodTimes = moodWeekTimes(input.moodWeek, dayKey);
    const comebackDays = offset === 3 || offset === 7 || offset === 14 ? offset as 3 | 7 | 14 : null;
    if (moodTimes) {
      moodTimes.forEach((minute, index) => routine.push({
        kind: 'mood', copy: moodCopy(lang, index === 1, seed + index), window: minute < 12 * 60 ? 0 : minute < 17 * 60 ? 1 : 2, event: false, minute,
      }));
    } else if (comebackDays) routine.push({ kind: 'comeback', copy: comebackCopy(lang, comebackDays, seed), window: 1, event: false });
    else if (everyday && active && offset > 0) {
      const count = RHYTHM[(offset + userSeed) % RHYTHM.length];
      const morning = count === 2 || seed % 2 === 0;
      const invite = count === 2 || !morning;
      if (morning) routine.push({ kind: 'daily', copy: morningCopy(lang, sign, weekday, seed), window: 0, event: false });
      if (invite) routine.push({ kind: 'invite', copy: inviteCopy(lang, seed), window: seed % 2 === 0 ? 1 : 2, event: false });
    } else if (everyday && offset === 0) {
      routine.push({ kind: 'invite', copy: inviteCopy(lang, seed), window: 2, event: false });
    } else if (everyday && offset === 10) {
      routine.push({ kind: 'daily', copy: morningCopy(lang, sign, weekday, seed), window: 0, event: false });
    }

    const cap = moodTimes ? (events.length ? NATIVE_MAX_PER_DAY : 2) : !active ? 1 : events.length ? NATIVE_MAX_PER_DAY : 2;
    const taken = new Map<Window, Candidate>();
    for (const candidate of [...events, ...routine]) {
      if (taken.size >= cap) break;
      // Событие сдвигает обычный повод в свободное окно; совсем некуда — обычный пропадает.
      const order: Window[] = [candidate.window, ...([0, 1, 2] as Window[]).filter((w) => w !== candidate.window)];
      const free = order.find((w) => !taken.has(w));
      if (free !== undefined) taken.set(free, candidate);
    }

    for (const [window, slot] of [...taken.entries()].sort((a, b) => a[0] - b[0])) {
      const at = slotTime(day, slot.minute ?? windowMinute(window, slot.kind), input.settings);
      // Сегодня зовём только на то, что будет не раньше чем через 3 часа: человек только что был в приложении.
      if (!at || at.getTime() <= now.getTime() + (offset === 0 ? 3 * HOUR : 0)) continue;
      const atKey = localNotificationDayKey(at);
      if (slot.kind === 'daily' && atKey === input.readDate) continue;
      if (!everyday && (slot.kind === 'daily' || slot.kind === 'invite')) continue;
      // Неделя настроения — выбор самого человека, поэтому её напоминания идут и в режиме «только важное».
      if (slot.kind === 'mood' && !moodTimes) continue;
      const endOfDay = new Date(at.getFullYear(), at.getMonth(), at.getDate(), 21).getTime();
      result.push({
        id: 700000 + (number % 10000) * 4 + window,
        title: slot.copy.title, body: slot.copy.body, route: slot.copy.route,
        at: at.getTime(), expiresAt: Math.max(at.getTime() + 30 * MINUTE, Math.min(at.getTime() + 4 * HOUR, endOfDay)),
        accountId: input.accountId, kind: slot.kind, dayKey: atKey,
      });
    }
  }
  return result;
}

/** Reminder minutes of the mood week for this day, or null outside the week. */
function moodWeekTimes(week: NativeMoodWeek | null | undefined, dayKey: string): number[] | null {
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week.startDayKey)) return null;
  const start = Date.parse(`${week.startDayKey}T12:00:00Z`);
  const offset = Math.round((Date.parse(`${dayKey}T12:00:00Z`) - start) / (24 * HOUR));
  if (!Number.isFinite(offset) || offset < 0 || offset > 6) return null;
  const times = week.reminderTimes.map(notificationTimeMinutes);
  if (times.some((value) => value === null)) return null;
  const [first, second] = times as number[];
  return second - first >= 180 && first >= 9 * 60 && second <= 21 * 60 ? [first, second] : null;
}

export function makeNativeReadyNotification(input: {
  accountId: string; language: 'ru' | 'en'; route: 'today' | 'natal';
  settings: NativeNotificationSettings; now?: Date;
}): NativeNotificationPlan | null {
  const now = input.now || new Date();
  if (!input.accountId || !input.settings.enabled || isNativeNotificationQuiet(now, input.settings)
    || isNativeNotificationQuiet(new Date(now.getTime() + 2000), input.settings)) return null;
  const copy = readyCopy(input.language, input.route);
  return {
    id: input.route === 'today' ? 62001 : 62002, title: copy.title, body: copy.body,
    at: now.getTime() + 2000, expiresAt: now.getTime() + HOUR / 2,
    accountId: input.accountId, kind: 'ready', dayKey: localNotificationDayKey(now), route: input.route,
  };
}
