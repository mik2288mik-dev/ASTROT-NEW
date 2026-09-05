import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNativeAndroidRuntime } from './nativeRuntime';
import {
  isNativeNotificationQuiet, localNotificationDayKey, makeNativeReadyNotification, normalizeNativeNotificationSettings,
  planNativeDailyNotifications, type NativeNotificationPlan, type NativeNotificationSettings,
} from '../lib/nativeNotificationPolicy';

type Permission = 'granted' | 'prompt' | 'denied' | 'unavailable';
type Context = { accountId: string; language: 'ru' | 'en'; isSetup: boolean };
interface NotificationBridge {
  getPermissionState(): Promise<{ display: Permission }>;
  requestDisplayPermission(): Promise<{ display: Permission }>;
  openSettings(): Promise<{ status: string }>;
  configure(input: NativeNotificationSettings & { accountId: string; readDate: string }): Promise<{ status: string }>;
  schedule(input: { notifications: NativeNotificationPlan[] }): Promise<{ status: string }>;
  cancelAll(): Promise<{ status: string }>;
  consumeTap(): Promise<{ route?: 'today' | 'natal'; accountId?: string }>;
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
  const daily = planNativeDailyNotifications({ ...current, settings, readDate: readDate(current.accountId) });
  const earliestReadyAt = Date.now() + 2000;
  const ready = pendingReady && pendingReady.accountId === current.accountId
    && pendingReady.expiresAt > earliestReadyAt && !isNativeNotificationQuiet(new Date(earliestReadyAt), settings)
    ? { ...pendingReady, at: Math.max(pendingReady.at, earliestReadyAt) } : null;
  const result = await Native.schedule({ notifications: ready ? [ready, ...daily] : daily });
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
export async function consumeNativeNotificationTap(accountId: string): Promise<'today' | 'natal' | null> {
  if (!nativeNotificationsAvailable()) return null;
  const version = generation;
  try {
    const tap = await Native.consumeTap();
    return version === generation && context?.accountId === accountId && tap.accountId === accountId
      && (tap.route === 'today' || tap.route === 'natal') ? tap.route : null;
  } catch { return null; }
}
export function listenNativeNotificationTap(callback: () => void): Promise<PluginListenerHandle> | null {
  return nativeNotificationsAvailable() ? Native.addListener('notificationAction', callback) : null;
}
