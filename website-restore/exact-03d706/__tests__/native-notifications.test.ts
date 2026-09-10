import type { NativeNotificationPlan, NativeNotificationSettings } from '../lib/nativeNotificationPolicy';

const mockNative = {
  getPermissionState: jest.fn(),
  requestDisplayPermission: jest.fn(),
  openSettings: jest.fn(),
  configure: jest.fn(),
  schedule: jest.fn(),
  cancelAll: jest.fn(),
  consumeTap: jest.fn(),
  addListener: jest.fn(),
};
const mockIsPluginAvailable = jest.fn();
const mockIsNativeAndroidRuntime = jest.fn();
const mockRegisterPlugin = jest.fn(() => mockNative);

jest.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: mockIsPluginAvailable },
  registerPlugin: mockRegisterPlugin,
}));
jest.mock('../services/nativeRuntime', () => ({ isNativeAndroidRuntime: mockIsNativeAndroidRuntime }));

type NotificationService = typeof import('../services/nativeNotifications');
type DisplayPermission = 'granted' | 'prompt' | 'denied';
let notifications: NotificationService;
let permission: DisplayPermission;
let records: Map<string, string>;
const account = (accountId = 'account-a') => ({ accountId, language: 'ru' as const, isSetup: true });
const storageKey = (kind: string, accountId = 'account-a') => `nebo.native-notifications.v1.${kind}.${accountId}`;
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function seedSettings(patch: Partial<NativeNotificationSettings> = {}, accountId = 'account-a'): void {
  records.set(storageKey('settings', accountId), JSON.stringify({
    enabled: true, mode: 'important', quietStart: '22:00', quietEnd: '09:00', ...patch,
  }));
}
function scheduledPlans(): NativeNotificationPlan[] {
  return mockNative.schedule.mock.calls.flatMap((call) => (call[0] as { notifications: NativeNotificationPlan[] }).notifications);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  jest.setSystemTime(new Date(2026, 8, 5, 12));
  permission = 'granted';
  records = new Map();
  const storage: Storage = {
    get length() { return records.size; },
    clear: () => records.clear(),
    getItem: (key) => records.get(key) ?? null,
    key: (index) => [...records.keys()][index] ?? null,
    removeItem: (key) => { records.delete(key); },
    setItem: (key, value) => { records.set(key, String(value)); },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { localStorage: storage } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
  mockIsPluginAvailable.mockReturnValue(true);
  mockIsNativeAndroidRuntime.mockReturnValue(true);
  mockRegisterPlugin.mockImplementation(() => mockNative);
  mockNative.getPermissionState.mockImplementation(async () => ({ display: permission }));
  mockNative.requestDisplayPermission.mockImplementation(async () => {
    permission = 'granted';
    return { display: permission };
  });
  mockNative.configure.mockResolvedValue({ status: 'configured' });
  mockNative.schedule.mockResolvedValue({ status: 'scheduled' });
  mockNative.cancelAll.mockResolvedValue({ status: 'cancelled' });
  mockNative.consumeTap.mockResolvedValue({});
  mockNative.openSettings.mockResolvedValue({ status: 'opened' });
  mockNative.addListener.mockResolvedValue({ remove: jest.fn() });
  notifications = require('../services/nativeNotifications');
});

afterEach(async () => {
  await settle();
  jest.useRealTimers();
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('native notification permission and lifecycle boundaries', () => {
  it('registers the custom Android bridge and leaves default preferences disabled', async () => {
    await notifications.setNativeNotificationContext(account());
    expect(mockRegisterPlugin).toHaveBeenCalledWith('NeboNotifications');
    expect(mockNative.configure).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'account-a', enabled: false, mode: 'important', readDate: '',
    }));
    expect(mockNative.getPermissionState).not.toHaveBeenCalled();
    expect(mockNative.requestDisplayPermission).not.toHaveBeenCalled();
    expect(mockNative.schedule).not.toHaveBeenCalled();
  });

  it.each(['prompt', 'denied'] as const)('never prompts during automatic sync when permission is %s', async (state) => {
    permission = state;
    seedSettings({ mode: 'daily' });
    await notifications.setNativeNotificationContext(account());
    notifications.setNativeNotificationForeground(true);
    notifications.markNativeTodayRead('account-a');
    await settle();
    await notifications.getNativeNotificationSettings('account-a');
    expect(mockNative.cancelAll).toHaveBeenCalled();
    expect(mockNative.schedule).not.toHaveBeenCalled();
    expect(mockNative.requestDisplayPermission).not.toHaveBeenCalled();
  });

  it('requests permission only for an explicit enable action', async () => {
    permission = 'prompt';
    await notifications.setNativeNotificationContext(account());
    await expect(notifications.saveNativeNotificationSettings('account-a', { enabled: true })).rejects.toThrow('permission_required');
    expect(mockNative.requestDisplayPermission).not.toHaveBeenCalled();
    expect(records.has(storageKey('settings'))).toBe(false);

    await notifications.saveNativeNotificationSettings('account-a', { enabled: true }, true);
    expect(mockNative.requestDisplayPermission).toHaveBeenCalledTimes(1);
    expect(JSON.parse(records.get(storageKey('settings'))!)).toMatchObject({ enabled: true, mode: 'important' });
    expect(mockNative.configure).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: 'account-a', enabled: true }));
  });

  it('does not repeatedly request a denied permission or save an enabled preference', async () => {
    permission = 'denied';
    await notifications.setNativeNotificationContext(account());
    await expect(notifications.saveNativeNotificationSettings('account-a', { enabled: true }, true)).rejects.toThrow('permission_required');
    expect(mockNative.requestDisplayPermission).not.toHaveBeenCalled();
    expect(records.has(storageKey('settings'))).toBe(false);
  });

  it('passes disabled configuration to native cancellation without a permission check or new schedule', async () => {
    seedSettings({ mode: 'daily' });
    await notifications.setNativeNotificationContext(account());
    expect(scheduledPlans()).toHaveLength(7);
    jest.clearAllMocks();

    await notifications.saveNativeNotificationSettings('account-a', { enabled: false });
    expect(mockNative.configure).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'account-a', enabled: false }));
    expect(mockNative.getPermissionState).not.toHaveBeenCalled();
    expect(mockNative.requestDisplayPermission).not.toHaveBeenCalled();
    expect(mockNative.schedule).not.toHaveBeenCalled();
  });

  it('cancels native plans on logout', async () => {
    seedSettings({ mode: 'daily' });
    await notifications.setNativeNotificationContext(account());
    jest.clearAllMocks();
    await notifications.clearNativeNotifications();
    notifications.notifyNativeResultReady('account-a', 'today', 'after-logout', true);
    notifications.markNativeTodayRead('account-a');
    await settle();
    expect(mockNative.cancelAll).toHaveBeenCalledTimes(1);
    expect(mockNative.schedule).not.toHaveBeenCalled();
    expect(records.has(storageKey('read'))).toBe(false);
  });

  it.each(['logout', 'switch'] as const)('cannot save or schedule the old account after %s during the permission dialog', async (action) => {
    permission = 'prompt';
    const dialog = deferred<{ display: DisplayPermission }>();
    mockNative.requestDisplayPermission.mockReturnValue(dialog.promise);
    await notifications.setNativeNotificationContext(account());
    const save = notifications.saveNativeNotificationSettings('account-a', { enabled: true, mode: 'daily' }, true)
      .catch((error: unknown) => error);
    await settle();
    expect(mockNative.requestDisplayPermission).toHaveBeenCalledTimes(1);

    if (action === 'logout') await notifications.clearNativeNotifications();
    else await notifications.setNativeNotificationContext(account('account-b'));
    dialog.resolve({ display: 'granted' });
    await expect(save).resolves.toMatchObject({ message: 'account_changed' });
    expect(records.has(storageKey('settings'))).toBe(false);
    expect(records.has(storageKey('settings', 'account-b'))).toBe(false);
    expect(mockNative.schedule).not.toHaveBeenCalled();
  });

  it('does not open a stale permission dialog after switching accounts during the permission check', async () => {
    await notifications.setNativeNotificationContext(account());
    const check = deferred<{ display: DisplayPermission }>();
    mockNative.getPermissionState.mockReturnValueOnce(check.promise);
    const save = notifications.saveNativeNotificationSettings('account-a', { enabled: true }, true)
      .catch((error: unknown) => error);
    await notifications.setNativeNotificationContext(account('account-b'));
    check.resolve({ display: 'prompt' });
    await expect(save).resolves.toMatchObject({ message: 'account_changed' });
    expect(mockNative.requestDisplayPermission).not.toHaveBeenCalled();
    expect(mockNative.schedule).not.toHaveBeenCalled();
  });

  it('does nothing in a browser or when the native plugin is absent', async () => {
    mockIsNativeAndroidRuntime.mockReturnValue(false);
    await notifications.setNativeNotificationContext(account());
    expect(notifications.nativeNotificationsAvailable()).toBe(false);
    mockIsNativeAndroidRuntime.mockReturnValue(true);
    mockIsPluginAvailable.mockReturnValue(false);
    await notifications.setNativeNotificationContext(account());
    expect(notifications.listenNativeNotificationTap(jest.fn())).toBeNull();
    expect(mockNative.configure).not.toHaveBeenCalled();
    expect(mockNative.requestDisplayPermission).not.toHaveBeenCalled();
  });
});

describe('native notification result and reading rules', () => {
  beforeEach(async () => {
    seedSettings();
    await notifications.setNativeNotificationContext(account());
    jest.clearAllMocks();
  });

  it('schedules a real background result once per content and keeps its actual route', async () => {
    notifications.setNativeNotificationForeground(false);
    notifications.notifyNativeResultReady('account-a', 'natal', 'chart-revision-1', true);
    await settle();
    expect(scheduledPlans()).toEqual([expect.objectContaining({
      accountId: 'account-a', route: 'natal', kind: 'ready', title: 'Натальная карта сохранена',
    })]);
    jest.advanceTimersByTime(3000);
    notifications.notifyNativeResultReady('account-a', 'natal', 'chart-revision-1', true);
    await settle();
    expect(mockNative.schedule).toHaveBeenCalledTimes(1);
  });

  it('keeps a fresh ready result when the native bridge takes longer than the original delivery delay', async () => {
    const configured = deferred<{ status: string }>();
    mockNative.configure.mockReturnValueOnce(configured.promise);
    notifications.setNativeNotificationForeground(false);
    notifications.notifyNativeResultReady('account-a', 'today', 'slow-bridge-result', true);
    await settle();
    jest.advanceTimersByTime(5000);
    configured.resolve({ status: 'configured' });
    await settle();
    expect(scheduledPlans()).toHaveLength(1);
    expect(scheduledPlans()[0]).toMatchObject({ accountId: 'account-a', route: 'today', kind: 'ready' });
    expect(scheduledPlans()[0].at).toBeGreaterThan(Date.now());
    expect(scheduledPlans()[0].at).toBeLessThan(scheduledPlans()[0].expiresAt);
  });

  it('remembers visible and cached results without replaying them after backgrounding', async () => {
    notifications.notifyNativeResultReady('account-a', 'today', 'visible-result', true);
    notifications.setNativeNotificationForeground(false);
    notifications.notifyNativeResultReady('account-a', 'today', 'visible-result', true);
    notifications.notifyNativeResultReady('account-a', 'natal', 'cached-chart', false);
    notifications.notifyNativeResultReady('account-a', 'natal', 'cached-chart', true);
    await settle();
    expect(mockNative.schedule).not.toHaveBeenCalled();
    expect(JSON.parse(records.get(storageKey('seen'))!)).toEqual(['today:visible-result', 'natal:cached-chart']);
  });

  it('does not replay a result received while notifications were disabled', async () => {
    await notifications.saveNativeNotificationSettings('account-a', { enabled: false });
    notifications.setNativeNotificationForeground(false);
    notifications.notifyNativeResultReady('account-a', 'today', 'result-while-off', true);
    await notifications.saveNativeNotificationSettings('account-a', { enabled: true });
    jest.clearAllMocks();
    notifications.notifyNativeResultReady('account-a', 'today', 'result-while-off', true);
    await settle();
    expect(mockNative.schedule).not.toHaveBeenCalled();
  });

  it('drops a pending ready notification when the app returns before delivery', async () => {
    notifications.setNativeNotificationForeground(false);
    notifications.notifyNativeResultReady('account-a', 'today', 'result-1', true);
    await settle();
    expect(scheduledPlans()).toHaveLength(1);
    jest.clearAllMocks();
    notifications.setNativeNotificationForeground(true);
    await settle();
    expect(mockNative.schedule).toHaveBeenCalledWith({ notifications: [] });
  });

  it('does not accept results from an obsolete account or with no content identity', async () => {
    notifications.setNativeNotificationForeground(false);
    notifications.notifyNativeResultReady('account-b', 'today', 'other-account-result', true);
    notifications.notifyNativeResultReady('account-a', 'today', '', true);
    await settle();
    expect(mockNative.schedule).not.toHaveBeenCalled();
    expect(records.has(storageKey('seen'))).toBe(false);
    expect(records.has(storageKey('seen', 'account-b'))).toBe(false);
  });

  it('replaces the daily plan without today after reading and does not repeat the write', async () => {
    jest.setSystemTime(new Date(2026, 8, 5, 8, 30));
    seedSettings({ mode: 'daily' });
    await notifications.setNativeNotificationContext(account());
    expect(scheduledPlans().some((plan) => plan.dayKey === '2026-09-05')).toBe(true);
    jest.clearAllMocks();
    notifications.markNativeTodayRead('account-a');
    await settle();
    expect(JSON.parse(records.get(storageKey('read'))!)).toBe('2026-09-05');
    expect(mockNative.configure).toHaveBeenCalledWith(expect.objectContaining({ readDate: '2026-09-05' }));
    expect(scheduledPlans()).toHaveLength(7);
    expect(scheduledPlans().every((plan) => plan.dayKey !== '2026-09-05')).toBe(true);
    jest.clearAllMocks();
    notifications.markNativeTodayRead('account-a');
    await settle();
    expect(mockNative.configure).not.toHaveBeenCalled();
  });

  it('does not mark content read from a background or obsolete account', async () => {
    notifications.markNativeTodayRead('account-b');
    notifications.setNativeNotificationForeground(false);
    notifications.markNativeTodayRead('account-a');
    await settle();
    expect(records.has(storageKey('read'))).toBe(false);
    expect(records.has(storageKey('read', 'account-b'))).toBe(false);
    expect(mockNative.configure).not.toHaveBeenCalled();
  });
});

describe('native notification tap identity', () => {
  it.each(['today', 'natal'] as const)('returns a valid %s tap only for the current account', async (route) => {
    await notifications.setNativeNotificationContext(account());
    mockNative.consumeTap.mockResolvedValue({ accountId: 'account-a', route });
    await expect(notifications.consumeNativeNotificationTap('account-a')).resolves.toBe(route);
  });

  it('ignores old-account taps and unknown routes', async () => {
    await notifications.setNativeNotificationContext(account('account-b'));
    mockNative.consumeTap.mockResolvedValueOnce({ accountId: 'account-a', route: 'today' });
    await expect(notifications.consumeNativeNotificationTap('account-b')).resolves.toBeNull();
    mockNative.consumeTap.mockResolvedValueOnce({ accountId: 'account-b', route: 'https://unexpected.example' });
    await expect(notifications.consumeNativeNotificationTap('account-b')).resolves.toBeNull();
  });

  it('ignores a tap that resolves after switching accounts', async () => {
    await notifications.setNativeNotificationContext(account());
    const tap = deferred<{ accountId: string; route: string }>();
    mockNative.consumeTap.mockReturnValue(tap.promise);
    const consumed = notifications.consumeNativeNotificationTap('account-a');
    await notifications.setNativeNotificationContext(account('account-b'));
    tap.resolve({ accountId: 'account-a', route: 'today' });
    await expect(consumed).resolves.toBeNull();
  });
});
