import {
  DEFAULT_NATIVE_NOTIFICATION_SETTINGS,
  isNativeNotificationQuiet,
  localNotificationDayKey,
  makeNativeReadyNotification,
  normalizeNativeNotificationSettings,
  notificationTimeMinutes,
  planNativeDailyNotifications,
  type NativeNotificationSettings,
} from '../lib/nativeNotificationPolicy';

const localMorning = () => new Date(2026, 8, 5, 8, 30);
const settings = (overrides: Partial<NativeNotificationSettings> = {}): NativeNotificationSettings => ({
  ...DEFAULT_NATIVE_NOTIFICATION_SETTINGS,
  ...overrides,
});
const dailyInput = (
  overrides: Partial<Parameters<typeof planNativeDailyNotifications>[0]> = {},
): Parameters<typeof planNativeDailyNotifications>[0] => ({
  accountId: 'account-1',
  language: 'ru',
  isSetup: true,
  settings: settings({ enabled: true, mode: 'daily' }),
  now: localMorning(),
  ...overrides,
});
const readyInput = (
  overrides: Partial<Parameters<typeof makeNativeReadyNotification>[0]> = {},
): Parameters<typeof makeNativeReadyNotification>[0] => ({
  accountId: 'account-1',
  language: 'ru',
  route: 'today',
  settings: settings({ enabled: true }),
  now: new Date(2026, 8, 5, 12),
  ...overrides,
});

describe('native notification preferences and local clock', () => {
  it('defaults to disabled important-only notifications', () => {
    expect(normalizeNativeNotificationSettings(undefined)).toEqual({
      enabled: false, mode: 'important', quietStart: '22:00', quietEnd: '09:00',
    });
    expect(DEFAULT_NATIVE_NOTIFICATION_SETTINGS).toEqual(normalizeNativeNotificationSettings(null));
  });

  it.each([undefined, null, false, 1, 'true', 'false'])('requires a literal opt-in, not %p', (enabled) => {
    expect(normalizeNativeNotificationSettings({ enabled }).enabled).toBe(false);
  });

  it('preserves explicit choices and falls back safely for malformed settings', () => {
    expect(normalizeNativeNotificationSettings({
      enabled: true, mode: 'daily', quietStart: '23:30', quietEnd: '08:15',
    })).toEqual({ enabled: true, mode: 'daily', quietStart: '23:30', quietEnd: '08:15' });
    expect(normalizeNativeNotificationSettings({
      enabled: true, mode: 'unknown', quietStart: '24:00', quietEnd: '9:00',
    })).toEqual({ enabled: true, mode: 'important', quietStart: '22:00', quietEnd: '09:00' });
  });

  it.each(['24:00', '23:60', '9:00', '-1:00', '09:00:00', ' 09:00', '', null, 900])(
    'rejects invalid clock value %p', (value) => {
      expect(notificationTimeMinutes(value)).toBeNull();
    },
  );

  it('accepts the first and last valid minute of a day', () => {
    expect(notificationTimeMinutes('00:00')).toBe(0);
    expect(notificationTimeMinutes('23:59')).toBe(1439);
  });

  it.each([
    [21, 59, false], [22, 0, true], [23, 59, true],
    [0, 0, true], [8, 59, true], [9, 0, false],
  ])('handles overnight quiet hours at %i:%i', (hour, minute, quiet) => {
    expect(isNativeNotificationQuiet(new Date(2026, 8, 5, hour, minute), settings())).toBe(quiet);
  });

  it('handles daytime quiet boundaries and treats equal boundaries as all-day quiet', () => {
    const daytime = settings({ quietStart: '12:15', quietEnd: '14:45' });
    expect(isNativeNotificationQuiet(new Date(2026, 8, 5, 12, 14), daytime)).toBe(false);
    expect(isNativeNotificationQuiet(new Date(2026, 8, 5, 12, 15), daytime)).toBe(true);
    expect(isNativeNotificationQuiet(new Date(2026, 8, 5, 14, 45), daytime)).toBe(false);
    const allDay = settings({ quietStart: '09:00', quietEnd: '09:00' });
    for (const hour of [0, 9, 12, 23]) {
      expect(isNativeNotificationQuiet(new Date(2026, 8, 5, hour), allDay)).toBe(true);
    }
  });

  it('fails closed for invalid dates or unnormalized quiet hours', () => {
    expect(isNativeNotificationQuiet(new Date(NaN), settings())).toBe(true);
    expect(isNativeNotificationQuiet(localMorning(), settings({ quietStart: 'invalid' }))).toBe(true);
    expect(localNotificationDayKey(new Date(NaN))).toBe('');
  });

  it('uses the local calendar around midnight and year rollover', () => {
    expect(localNotificationDayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(localNotificationDayKey(new Date(2027, 0, 1, 0, 1))).toBe('2027-01-01');
  });
});

describe('daily native notification policy', () => {
  it('requires enabled daily mode, completed setup, and an account', () => {
    expect(planNativeDailyNotifications(dailyInput({ settings: settings() }))).toEqual([]);
    expect(planNativeDailyNotifications(dailyInput({ settings: settings({ enabled: true }) }))).toEqual([]);
    expect(planNativeDailyNotifications(dailyInput({ isSetup: false }))).toEqual([]);
    expect(planNativeDailyNotifications(dailyInput({ accountId: '' }))).toEqual([]);
    expect(planNativeDailyNotifications(dailyInput({ now: new Date(NaN) }))).toEqual([]);
  });

  it('plans no more than seven distinct days within the next eight local calendar days', () => {
    const plans = planNativeDailyNotifications(dailyInput({ readDate: '2026-09-05' }));
    expect(plans.map((plan) => plan.dayKey)).toEqual([
      '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09',
      '2026-09-10', '2026-09-11', '2026-09-12',
    ]);
    expect(new Set(plans.map((plan) => plan.id)).size).toBe(7);
    for (const plan of plans) {
      expect(plan.at).toBeLessThan(new Date(2026, 8, 13).getTime());
      expect(plan).toMatchObject({ accountId: 'account-1', route: 'today', kind: 'daily' });
    }
  });

  it('keeps the chosen time on local calendar days across the new year', () => {
    const plans = planNativeDailyNotifications(dailyInput({ now: new Date(2026, 11, 31, 8) }));
    expect(plans).toHaveLength(7);
    expect(plans[0].dayKey).toBe('2026-12-31');
    expect(plans[1].dayKey).toBe('2027-01-01');
    expect(plans[6].dayKey).toBe('2027-01-06');
    for (const plan of plans) {
      const at = new Date(plan.at);
      expect([at.getHours(), at.getMinutes()]).toEqual([9, 0]);
    }
  });

  it.each([[9, 0], [9, 1], [14, 30], [23, 59]])(
    'does not create an immediate catch-up after the chosen time at %i:%i', (hour, minute) => {
      const plans = planNativeDailyNotifications(dailyInput({ now: new Date(2026, 8, 5, hour, minute) }));
      expect(plans).toHaveLength(7);
      expect(plans[0].at).toBe(new Date(2026, 8, 6, 9).getTime());
      expect(plans.some((plan) => plan.dayKey === '2026-09-05')).toBe(false);
    },
  );

  it.each([
    ['22:00', '09:00', 9, 0],
    ['00:00', '10:17', 10, 17],
    ['09:00', '20:59', 20, 59],
  ])('stays in daytime outside quiet hours %s–%s', (quietStart, quietEnd, hour, minute) => {
    const plans = planNativeDailyNotifications(dailyInput({
      settings: settings({ enabled: true, mode: 'daily', quietStart, quietEnd }),
    }));
    expect(plans).toHaveLength(7);
    for (const plan of plans) {
      const at = new Date(plan.at);
      expect([at.getHours(), at.getMinutes()]).toEqual([hour, minute]);
      expect(plan.at).toBeGreaterThanOrEqual(new Date(at.getFullYear(), at.getMonth(), at.getDate(), 9).getTime());
      expect(plan.at).toBeLessThan(new Date(at.getFullYear(), at.getMonth(), at.getDate(), 21).getTime());
      expect(plan.expiresAt).toBeGreaterThan(plan.at);
      expect(plan.expiresAt).toBeLessThanOrEqual(new Date(at.getFullYear(), at.getMonth(), at.getDate(), 21).getTime());
    }
  });

  it.each([['09:00', '21:00'], ['09:00', '09:00']])(
    'does not move daytime reminders into the night when quiet hours are %s–%s', (quietStart, quietEnd) => {
      expect(planNativeDailyNotifications(dailyInput({
        settings: settings({ enabled: true, mode: 'daily', quietStart, quietEnd }),
      }))).toEqual([]);
    },
  );

  it.each(['ru', 'en'] as const)('offers future reading without claiming an AI result is already ready (%s)', (language) => {
    const plans = planNativeDailyNotifications(dailyInput({ language }));
    expect(plans).toHaveLength(7);
    for (const plan of plans) {
      expect(`${plan.title} ${plan.body}`).not.toMatch(/готов|рассчитан|сохранен|\bready\b|\bsaved\b/i);
    }
  });
});

describe('ready native notification policy', () => {
  it('suppresses ready notifications when disabled, quiet, or the clock is invalid', () => {
    expect(makeNativeReadyNotification(readyInput({ settings: settings() }))).toBeNull();
    expect(makeNativeReadyNotification(readyInput({ now: new Date(2026, 8, 5, 22) }))).toBeNull();
    expect(makeNativeReadyNotification(readyInput({ now: new Date(2026, 8, 6, 0) }))).toBeNull();
    expect(makeNativeReadyNotification(readyInput({ now: new Date(NaN) }))).toBeNull();
    expect(makeNativeReadyNotification(readyInput({
      settings: settings({ enabled: true, quietStart: '09:00', quietEnd: '09:00' }),
    }))).toBeNull();
  });

  it('does not schedule across the start of quiet hours during its delivery delay', () => {
    expect(makeNativeReadyNotification(readyInput({ now: new Date(2026, 8, 5, 21, 59, 59) }))).toBeNull();
  });

  it('does not create a ready notification without an account', () => {
    expect(makeNativeReadyNotification(readyInput({ accountId: '' }))).toBeNull();
  });

  it.each(['ru', 'en'] as const)('routes real forecast and chart results to their matching screens (%s)', (language) => {
    const today = makeNativeReadyNotification(readyInput({ language, route: 'today' }));
    const natal = makeNativeReadyNotification(readyInput({ language, route: 'natal' }));
    expect(today).toMatchObject({ accountId: 'account-1', route: 'today', kind: 'ready', dayKey: '2026-09-05' });
    expect(natal).toMatchObject({ accountId: 'account-1', route: 'natal', kind: 'ready', dayKey: '2026-09-05' });
    expect(today?.title).toMatch(/прогноз готов|forecast is ready/i);
    expect(natal?.title).toMatch(/карта сохранена|chart is saved/i);
    expect(natal?.title).not.toMatch(/разбор|reading|forecast|прогноз/i);
    expect(today?.id).not.toBe(natal?.id);
    expect(today!.at).toBeGreaterThan(readyInput().now!.getTime());
    expect(today!.expiresAt).toBeGreaterThan(today!.at);
  });
});
