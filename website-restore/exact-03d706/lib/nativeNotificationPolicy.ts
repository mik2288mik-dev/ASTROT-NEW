export type NativeNotificationSettings = {
  enabled: boolean;
  mode: 'important' | 'daily';
  quietStart: string;
  quietEnd: string;
};
export type NativeNotificationPlan = {
  id: number; title: string; body: string; at: number; expiresAt: number;
  accountId: string; kind: 'daily' | 'ready'; dayKey: string; route: 'today' | 'natal';
};
export const DEFAULT_NATIVE_NOTIFICATION_SETTINGS: NativeNotificationSettings = {
  enabled: false, mode: 'important', quietStart: '22:00', quietEnd: '09:00',
};
const HOUR = 3_600_000;
const DAILY_COPY = {
  ru: [
    ['Прогноз без планёрки', 'Личный прогноз на сегодня. Пара минут — и можно дальше по делам.'],
    ['На сегодня есть что почитать', 'Открой личный прогноз. С кофе тоже считается.'],
    ['Что там на сегодня?', 'Твой личный прогноз — в NEBO. Читать с серьёзным лицом необязательно.'],
    ['Новый день. Новая страница.', 'Открой прогноз на сегодня, когда будет удобно.'],
  ],
  en: [
    ['Your forecast, minus the meeting', 'Take a moment to read your personal forecast for today.'],
    ['A little reading for today', 'Open your personal forecast. Coffee is welcome.'],
    ['What is on today?', 'Your personal forecast is in NEBO. No serious face required.'],
    ['New day. New page.', 'Read today’s forecast whenever you have a moment.'],
  ],
};

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
    mode: input.mode === 'daily' ? 'daily' : 'important',
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

/** A reminder offers a forecast; it never claims a future AI response is already generated. */
export function planNativeDailyNotifications(input: {
  accountId: string; language: 'ru' | 'en'; isSetup: boolean; settings: NativeNotificationSettings;
  readDate?: string; now?: Date;
}): NativeNotificationPlan[] {
  const now = input.now || new Date();
  if (!input.accountId || !input.isSetup || !input.settings.enabled || input.settings.mode !== 'daily'
    || !Number.isFinite(now.getTime())) return [];
  const result: NativeNotificationPlan[] = [];
  for (let offset = 0; offset <= 7 && result.length < 7; offset++) {
    let at: Date | null = null;
    // Choose the first daytime minute outside quiet hours, not a surprise night reminder.
    for (let minute = 9 * 60; minute < 21 * 60; minute++) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 0, minute);
      if (!isNativeNotificationQuiet(candidate, input.settings)) { at = candidate; break; }
    }
    if (!at || at.getTime() <= now.getTime()) continue;
    const dayKey = localNotificationDayKey(at);
    if (dayKey === input.readDate) continue;
    const dateNumber = Math.floor(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) / (24 * HOUR));
    const [title, body] = DAILY_COPY[input.language][dateNumber % DAILY_COPY[input.language].length];
    result.push({
      id: 63000 + dateNumber % 10000, title, body, at: at.getTime(),
      expiresAt: Math.min(at.getTime() + 3 * HOUR, new Date(at.getFullYear(), at.getMonth(), at.getDate(), 21).getTime()),
      accountId: input.accountId, kind: 'daily', dayKey, route: 'today',
    });
  }
  return result;
}

export function makeNativeReadyNotification(input: {
  accountId: string; language: 'ru' | 'en'; route: 'today' | 'natal';
  settings: NativeNotificationSettings; now?: Date;
}): NativeNotificationPlan | null {
  const now = input.now || new Date();
  if (!input.accountId || !input.settings.enabled || isNativeNotificationQuiet(now, input.settings)
    || isNativeNotificationQuiet(new Date(now.getTime() + 2000), input.settings)) return null;
  const copy = input.language === 'en'
    ? input.route === 'today'
      ? ['Your personal forecast is ready', 'Open Today. The text is there; the wait is over.']
      : ['Your natal chart is saved', 'Open your chart in NEBO when you have a moment.']
    : input.route === 'today'
      ? ['Личный прогноз готов', 'Открой «Сегодня». Текст на месте — ожидание закончилось.']
      : ['Натальная карта сохранена', 'Можно открывать карту в NEBO. Всё рассчитано и на месте.'];
  return {
    id: input.route === 'today' ? 62001 : 62002, title: copy[0], body: copy[1],
    at: now.getTime() + 2000, expiresAt: now.getTime() + HOUR / 2,
    accountId: input.accountId, kind: 'ready', dayKey: localNotificationDayKey(now), route: input.route,
  };
}
