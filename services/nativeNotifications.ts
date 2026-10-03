import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNativeAndroidRuntime } from './nativeRuntime';
import { apiFetch, getApiBaseUrl } from './apiClient';
import {
  isNativeNotificationQuiet, localNotificationDayKey, makeNativeReadyNotification, NATIVE_NOTIFICATION_ROUTES,
  normalizeNativeNotificationSettings, normalizeSkyEvents, planNativeNotifications, resolveNotificationSign,
  type NativeMoodWeek, type NativeNotificationPlan, type NativeNotificationRoute, type NativeNotificationSettings,
} from '../lib/nativeNotificationPolicy';

type Permission = 'granted' | 'prompt' | 'denied' | 'unavailable';
type Context = {
  accountId: string; language: 'ru' | 'en'; isSetup: boolean;
  name?: string; birthDate?: string; selectedSign?: string | null;
};
interface NotificationBridge {
  getPermissionState(): Promise<{ display: Permission }>;
  requestDisplayPermission(): Promise<{ display: Permission }>;
  openSettings(): Promise<{ status: string }>;
  configure(input: NativeNotificationSettings & { accountId: string; readDate: string }): Promise<{ status: string }>;
  schedule(input: { notifications: NativeNotificationPlan[] }): Promise<{ status: string }>;
  configureInbox(input: { baseUrl: string; token: string; cursor: number }): Promise<{ status: string }>;
  cancelAll(): Promise<{ status: string }>;
  consumeTap(): Promise<{ route?: string; accountId?: string }>;
  addListener(name: 'notificationAction', callback: () => void): Promise<PluginListenerHandle>;
}
const Native = registerPlugin<NotificationBridge>('NeboNotifications');
let context: Context | null = null;
let generation = 0;
let operations: Promise<unknown> = Promise.resolve();
let foreground = true;
let pendingReady: NativeNotificationPlan | null = null;

export function nativeNotificationsAvailable(): boolean {
  try { return typeof window !== 'undefined' && isNativeAndroidRuntime() && Capacitor.isPluginAvailable('NeboNotifications'); }
  catch { return false; }
}
function key(accountId: string, kind: string): string { return `nebo.native-notifications.v1.${kind}.${accountId}`; }
function read(accountId: string, kind: string): unknown {
  try { return JSON.parse(localStorage.getItem(key(accountId, kind)) || 'null'); } catch { return null; }
}
function write(accountId: string, kind: string, value: unknown): boolean {
  try { localStorage.setItem(key(accountId, kind), JSON.stringify(value)); return true; } catch { return false; }
}
function preferences(accountId: string): NativeNotificationSettings {
  return normalizeNativeNotificationSettings(read(accountId, 'settings'));
}
function readDate(accountId: string): string {
  const value = read(accountId, 'read');
  return typeof value === 'string' ? value : '';
}
function enqueue<T>(action: () => Promise<T>): Promise<T> {
  const next = operations.catch(() => undefined).then(action);
  operations = next.catch(() => undefined);
  return next;
}
function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Регистрирует устройство для уведомлений из админки: сервер связывает случайный
 * токен с аккаунтом, Android раз в пару часов забирает по нему новые сообщения.
 * Раз в день обновляем знак/язык (рассылки по знаку) и забираем события неба.
 * Возвращает true, если события неба изменились и расписание стоит пересобрать.
 */
async function registerInbox(current: Context): Promise<boolean> {
  const stored = read(current.accountId, 'push-token');
  const token = typeof stored === 'string' && /^[a-f0-9]{48}$/.test(stored) ? stored : randomToken();
  if (token !== stored && !write(current.accountId, 'push-token', token)) return false;
  const today = localNotificationDayKey();
  const storedCursor = read(current.accountId, 'push-cursor');
  if (read(current.accountId, 'push-registered') === `${today}:${token}` && typeof storedCursor === 'number') {
    // Сервер уже знает устройство сегодня; Android мог сбросить токен при смене аккаунта — отдаём заново.
    await Native.configureInbox({ baseUrl: getApiBaseUrl(), token, cursor: storedCursor });
    return false;
  }
  const response = await apiFetch('/api/app/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token, language: current.language,
      sign: resolveNotificationSign(current.selectedSign, current.birthDate),
    }),
  });
  if (!response.ok) return false;
  const payload = await response.json().catch(() => null) as { cursor?: unknown; events?: unknown } | null;
  const events = normalizeSkyEvents(payload?.events);
  const eventsChanged = JSON.stringify(events) !== JSON.stringify(normalizeSkyEvents(read(current.accountId, 'sky-events')));
  if (eventsChanged) write(current.accountId, 'sky-events', events);
  const cursor = typeof payload?.cursor === 'number' && Number.isSafeInteger(payload.cursor) ? payload.cursor : 0;
  const result = await Native.configureInbox({ baseUrl: getApiBaseUrl(), token, cursor });
  if (result.status === 'configured' && write(current.accountId, 'push-cursor', cursor)) {
    write(current.accountId, 'push-registered', `${today}:${token}`);
  }
  return eventsChanged;
}

async function sync(expectedGeneration: number): Promise<void> {
  if (!nativeNotificationsAvailable() || expectedGeneration !== generation || !context) return;
  const current = context;
  const settings = preferences(current.accountId);
  const configured = await Native.configure({ ...settings, accountId: current.accountId, readDate: readDate(current.accountId) });
  if (configured.status !== 'configured') throw new Error('unavailable');
  if (expectedGeneration !== generation) return;
  if (!settings.enabled) return;
  const permission = await Native.getPermissionState();
  if (permission.display !== 'granted') {
    await Native.cancelAll();
    return;
  }
  if (expectedGeneration !== generation) return;
  await schedulePlan(current, settings);
  if (expectedGeneration !== generation) return;
  // Рассылки из админки и события неба — дополнительный канал; его сбой не ломает локальное расписание.
  const eventsChanged = await registerInbox(current).catch(() => false);
  if (eventsChanged && expectedGeneration === generation) await schedulePlan(current, settings);
}

async function schedulePlan(current: Context, settings: NativeNotificationSettings): Promise<void> {
  const planned = planNativeNotifications({
    ...current, settings, readDate: readDate(current.accountId),
    profile: { sign: resolveNotificationSign(current.selectedSign, current.birthDate), name: current.name, birthDate: current.birthDate },
    skyEvents: normalizeSkyEvents(read(current.accountId, 'sky-events')),
    moodWeek: read(current.accountId, 'mood-week') as NativeMoodWeek | null,
  });
  const earliestReadyAt = Date.now() + 2000;
  const ready = pendingReady && pendingReady.accountId === current.accountId
    && pendingReady.expiresAt > earliestReadyAt && !isNativeNotificationQuiet(new Date(earliestReadyAt), settings)
    ? { ...pendingReady, at: Math.max(pendingReady.at, earliestReadyAt) } : null;
  const result = await Native.schedule({ notifications: ready ? [ready, ...planned] : planned });
  if (result.status !== 'scheduled') throw new Error(result.status);
}

/** Lifecycle synchronization never asks Android for permission. */
export function setNativeNotificationContext(next: Context): Promise<void> {
  if (!nativeNotificationsAvailable()) return Promise.resolve();
  if (context?.accountId !== next.accountId) {
    generation += 1;
    pendingReady = null;
  }
  context = next;
  const version = generation;
  return enqueue(() => sync(version)).catch(() => undefined);
}
export function clearNativeNotifications(): Promise<void> {
  generation += 1;
  context = null;
  pendingReady = null;
  return enqueue(async () => { if (nativeNotificationsAvailable()) await Native.cancelAll(); }).then(() => undefined).catch(() => undefined);
}
export function setNativeNotificationForeground(active: boolean): void {
  foreground = active;
  if (active) {
    pendingReady = null;
    const version = generation;
    void enqueue(() => sync(version)).catch(() => undefined);
  }
}
export async function getNativeNotificationSettings(accountId: string) {
  let permission: Permission = 'unavailable';
  if (nativeNotificationsAvailable()) {
    try { permission = (await Native.getPermissionState()).display; } catch { /* Show unavailable in settings. */ }
  }
  return { ...preferences(accountId), permission };
}
export async function saveNativeNotificationSettings(
  accountId: string, patch: Partial<NativeNotificationSettings>, requestPermission = false,
): Promise<void> {
  if (!nativeNotificationsAvailable()) throw new Error('unavailable');
  const version = generation;
  if (context?.accountId !== accountId) throw new Error('account_changed');
  const settings = normalizeNativeNotificationSettings({ ...preferences(accountId), ...patch });
  if (settings.enabled) {
    let permission = (await Native.getPermissionState()).display;
    if (version !== generation || context?.accountId !== accountId) throw new Error('account_changed');
    if (permission === 'prompt' && requestPermission) permission = (await Native.requestDisplayPermission()).display;
    if (permission !== 'granted') throw new Error('permission_required');
  }
  if (version !== generation || context?.accountId !== accountId) throw new Error('account_changed');
  localStorage.setItem(key(accountId, 'settings'), JSON.stringify(settings));
  if (!settings.enabled) pendingReady = null;
  await enqueue(() => sync(version));
}

/**
 * Один раз после онбординга предлагаем включить уведомления (системный диалог Android).
 * Если человек уже что-то выбирал в настройках или отказал — больше не спрашиваем.
 */
export async function offerNativeNotificationsOnce(accountId: string): Promise<void> {
  if (!nativeNotificationsAvailable() || context?.accountId !== accountId || !context.isSetup) return;
  if (read(accountId, 'settings') !== null || read(accountId, 'offered') === true) return;
  if (!write(accountId, 'offered', true)) return;
  try {
    const permission = (await Native.getPermissionState()).display;
    if (permission !== 'granted' && permission !== 'prompt') return;
    await saveNativeNotificationSettings(accountId, { enabled: true, mode: 'daily' }, true);
  } catch { /* Отказ или смена аккаунта — остаёмся выключенными. */ }
}
/**
 * «Неделя настроения» reminders. Starting a week also offers notifications once
 * (the person asked for reminders), then the plan is rebuilt.
 */
export async function setNativeMoodWeek(accountId: string, week: NativeMoodWeek | null): Promise<'scheduled' | 'off' | 'unavailable'> {
  if (!nativeNotificationsAvailable() || context?.accountId !== accountId) return 'unavailable';
  write(accountId, 'mood-week', week);
  if (week && !preferences(accountId).enabled) {
    try {
      await saveNativeNotificationSettings(accountId, { enabled: true, mode: preferences(accountId).mode }, true);
    } catch {
      return 'off';
    }
  }
  const version = generation;
  await enqueue(() => sync(version)).catch(() => undefined);
  return preferences(accountId).enabled ? 'scheduled' : 'off';
}
export async function openNativeNotificationSettings(): Promise<void> {
  if (!nativeNotificationsAvailable() || (await Native.openSettings()).status !== 'opened') throw new Error('unavailable');
}
export function markNativeTodayRead(accountId: string): void {
  if (context?.accountId !== accountId || !foreground) return;
  const day = localNotificationDayKey();
  if (readDate(accountId) === day) return;
  try { localStorage.setItem(key(accountId, 'read'), JSON.stringify(day)); } catch { return; }
  if (pendingReady?.route === 'today') pendingReady = null;
  const version = generation;
  void enqueue(() => sync(version)).catch(() => undefined);
}

/** Called by a real successful result. Cached/visible results are remembered, never replayed later. */
export function notifyNativeResultReady(accountId: string, route: 'today' | 'natal', contentKey: string, eligible: boolean): void {
  if (!nativeNotificationsAvailable() || context?.accountId !== accountId || !contentKey) return;
  const value = read(accountId, 'seen');
  const seen = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(-16) : [];
  const resultKey = `${route}:${contentKey}`;
  if (seen.includes(resultKey)) return;
  try { localStorage.setItem(key(accountId, 'seen'), JSON.stringify([...seen, resultKey].slice(-16))); } catch { return; }
  if (!eligible || foreground) return;
  pendingReady = makeNativeReadyNotification({ ...context, route, settings: preferences(accountId) });
  if (!pendingReady) return;
  const version = generation;
  void enqueue(() => sync(version)).catch(() => undefined);
}
export async function consumeNativeNotificationTap(accountId: string): Promise<NativeNotificationRoute | null> {
  if (!nativeNotificationsAvailable()) return null;
  const version = generation;
  try {
    const tap = await Native.consumeTap();
    return version === generation && context?.accountId === accountId && tap.accountId === accountId
      && NATIVE_NOTIFICATION_ROUTES.includes(tap.route as NativeNotificationRoute) ? tap.route as NativeNotificationRoute : null;
  } catch { return null; }
}
export function listenNativeNotificationTap(callback: () => void): Promise<PluginListenerHandle> | null {
  return nativeNotificationsAvailable() ? Native.addListener('notificationAction', callback) : null;
}
