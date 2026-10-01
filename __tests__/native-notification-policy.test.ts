import {
  DEFAULT_NATIVE_NOTIFICATION_SETTINGS,
  isNativeNotificationQuiet,
  localNotificationDayKey,
  makeNativeReadyNotification,
  NATIVE_MAX_PER_DAY,
  normalizeNativeNotificationSettings,
  notificationTimeMinutes,
  planNativeNotifications,
  resolveNotificationSign,
  type NativeNotificationPlan,
  type NativeNotificationSettings,
} from '../lib/nativeNotificationPolicy';
import { ADMIN_PUSH_PRESETS, holidayCopy, SIGN_FORMS_RU } from '../lib/nativePushCopy';
import { ZODIAC_SIGNS } from '../lib/zodiac-utils';

// Суббота, 5 сентября 2026 — в ближайшие две недели нет праздников и смены сезона Рыб.
const localMorning = () => new Date(2026, 8, 5, 8, 30);
const settings = (overrides: Partial<NativeNotificationSettings> = {}): NativeNotificationSettings => ({
  ...DEFAULT_NATIVE_NOTIFICATION_SETTINGS,
  ...overrides,
});
type PlanInput = Parameters<typeof planNativeNotifications>[0];
const planInput = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  accountId: '1001',
  language: 'ru',
  isSetup: true,
  settings: settings({ enabled: true, mode: 'daily' }),
  now: localMorning(),
  profile: { sign: 'Pisces', name: 'Аня', birthDate: '1995-03-01' },
  ...overrides,
});
const readyInput = (
  overrides: Partial<Parameters<typeof makeNativeReadyNotification>[0]> = {},
): Parameters<typeof makeNativeReadyNotification>[0] => ({
  accountId: '1001',
  language: 'ru',
  route: 'today',
  settings: settings({ enabled: true }),
  now: new Date(2026, 8, 5, 12),
  ...overrides,
});
const byDay = (plans: NativeNotificationPlan[]) => plans.reduce<Record<string, NativeNotificationPlan[]>>((acc, plan) => {
  (acc[plan.dayKey] ||= []).push(plan);
  return acc;
}, {});
const key = (day: number) => localNotificationDayKey(new Date(2026, 8, 5 + day));
const BANNED = /космос|вселенн|энерги|звёзды (говорят|подскаж)|разбор|\{|\}|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/iu;

describe('native notification preferences and local clock', () => {
  it('defaults to disabled, everything mode once enabled', () => {
    expect(normalizeNativeNotificationSettings(undefined)).toEqual({
      enabled: false, mode: 'daily', quietStart: '22:00', quietEnd: '09:00',
    });
    expect(DEFAULT_NATIVE_NOTIFICATION_SETTINGS).toEqual(normalizeNativeNotificationSettings(null));
  });

  it.each([undefined, null, false, 1, 'true', 'false'])('requires a literal opt-in, not %p', (enabled) => {
    expect(normalizeNativeNotificationSettings({ enabled }).enabled).toBe(false);
  });

  it('preserves explicit choices and falls back safely for malformed settings', () => {
    expect(normalizeNativeNotificationSettings({
      enabled: true, mode: 'important', quietStart: '23:30', quietEnd: '08:15',
    })).toEqual({ enabled: true, mode: 'important', quietStart: '23:30', quietEnd: '08:15' });
    expect(normalizeNativeNotificationSettings({
      enabled: true, mode: 'unknown', quietStart: '24:00', quietEnd: '9:00',
    })).toEqual({ enabled: true, mode: 'daily', quietStart: '22:00', quietEnd: '09:00' });
  });

  it.each(['24:00', '23:60', '9:00', '-1:00', '09:00:00', ' 09:00', '', null, 900])(
    'rejects invalid clock value %p', (value) => {
      expect(notificationTimeMinutes(value)).toBeNull();
    },
  );

  it.each([
    [21, 59, false], [22, 0, true], [23, 59, true],
    [0, 0, true], [8, 59, true], [9, 0, false],
  ])('handles overnight quiet hours at %i:%i', (hour, minute, quiet) => {
    expect(isNativeNotificationQuiet(new Date(2026, 8, 5, hour, minute), settings())).toBe(quiet);
  });

  it('fails closed for invalid dates or unnormalized quiet hours', () => {
    expect(isNativeNotificationQuiet(new Date(NaN), settings())).toBe(true);
    expect(isNativeNotificationQuiet(localMorning(), settings({ quietStart: 'invalid' }))).toBe(true);
    expect(localNotificationDayKey(new Date(NaN))).toBe('');
  });
});

describe('notification sign', () => {
  it('prefers the selected sign and falls back to the birth date', () => {
    expect(resolveNotificationSign('scorpio', '1995-03-01')).toBe('Scorpio');
    expect(resolveNotificationSign(null, '1995-03-01')).toBe('Pisces');
    expect(resolveNotificationSign(null, '1990-12-25')).toBe('Capricorn');
    expect(resolveNotificationSign(null, '1990-01-10')).toBe('Capricorn');
    expect(resolveNotificationSign(null, '1990-07-23')).toBe('Leo');
    expect(resolveNotificationSign('nope', 'bad')).toBeNull();
  });
});

describe('engagement schedule', () => {
  it('requires enabled settings, completed setup, an account and a valid clock', () => {
    expect(planNativeNotifications(planInput({ settings: settings() }))).toEqual([]);
    expect(planNativeNotifications(planInput({ isSetup: false }))).toEqual([]);
    expect(planNativeNotifications(planInput({ accountId: '' }))).toEqual([]);
    expect(planNativeNotifications(planInput({ now: new Date(NaN) }))).toEqual([]);
  });

  it('alternates one and two a day in the first week, then backs off for an absent user', () => {
    const days = byDay(planNativeNotifications(planInput()));
    const firstWeek = [1, 2, 4, 5, 6].map((day) => days[key(day)]?.length || 0);
    expect(firstWeek.every((count) => count === 1 || count === 2)).toBe(true);
    expect(firstWeek).toContain(1);
    expect(firstWeek).toContain(2);
    expect(days[key(3)].map((plan) => plan.kind)).toEqual(['comeback']);
    expect(days[key(7)].map((plan) => plan.kind)).toEqual(['comeback']);
    expect(days[key(10)].map((plan) => plan.kind)).toEqual(['daily']);
    expect(days[key(14)].map((plan) => plan.kind)).toEqual(['comeback']);
    for (const day of [8, 9, 11, 12, 13]) expect(days[key(day)]).toBeUndefined();
  });

  it('keeps every plan in daytime, outside quiet hours, two a day on ordinary days, with unique ids', () => {
    const plans = planNativeNotifications(planInput());
    expect(new Set(plans.map((plan) => plan.id)).size).toBe(plans.length);
    expect(plans.length).toBeLessThanOrEqual(32);
    for (const list of Object.values(byDay(plans))) expect(list.length).toBeLessThanOrEqual(2);
    for (const plan of plans) {
      const at = new Date(plan.at);
      expect(at.getHours()).toBeGreaterThanOrEqual(9);
      expect(at.getHours()).toBeLessThan(21);
      expect(isNativeNotificationQuiet(at, settings())).toBe(false);
      expect(plan.expiresAt).toBeGreaterThan(plan.at);
      expect(plan.at - localMorning().getTime()).toBeLessThan(16 * 24 * 3_600_000);
      expect(plan.accountId).toBe('1001');
    }
    const sorted = plans.map((plan) => plan.at).sort((x, y) => x - y);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(3 * 3_600_000);
  });

  it('adds sky events on top: up to three on an active day, one while the user is away', () => {
    const plans = planNativeNotifications(planInput({
      skyEvents: [{ dayKey: key(2), kind: 'full_moon' }, { dayKey: key(9), kind: 'mercury_rx_start' }, { dayKey: 'junk', kind: 'full_moon' } as any],
    }));
    const days = byDay(plans);
    const fullMoon = days[key(2)].find((plan) => plan.kind === 'sky')!;
    expect(fullMoon.title).toMatch(/олнолуни|Луна/);
    expect(new Date(fullMoon.at).getHours()).toBe(20);
    expect(days[key(2)].length).toBeLessThanOrEqual(NATIVE_MAX_PER_DAY);
    expect(days[key(2)].length).toBeGreaterThan(1);
    expect(days[key(9)].map((plan) => plan.kind)).toEqual(['sky']);
    expect(days[key(9)][0].title).toMatch(/Меркурий/);
  });

  it('does not ping again within three hours of the visit that planned it', () => {
    const now = new Date(2026, 8, 5, 18, 0);
    const plans = planNativeNotifications(planInput({ now }));
    expect(plans.every((plan) => plan.at > now.getTime() + 3 * 3_600_000)).toBe(true);
  });

  it('skips the morning horoscope on a day already read', () => {
    const morning = planNativeNotifications(planInput()).find((plan) => plan.kind === 'daily')!;
    const plans = planNativeNotifications(planInput({ readDate: morning.dayKey }));
    expect(plans.some((plan) => plan.kind === 'daily' && plan.dayKey === morning.dayKey)).toBe(false);
  });

  it('mentions the sign now and then, not in every push, and keeps the copy clean', () => {
    let mornings = 0;
    let mentions = 0;
    for (const sign of ZODIAC_SIGNS) {
      const forms = SIGN_FORMS_RU[sign];
      for (let start = 0; start < 60; start += 7) {
        const plans = planNativeNotifications(planInput({ accountId: `${1000 + start}`, profile: { sign }, now: new Date(2026, 8, 5 + start, 8, 30) }));
        for (const plan of plans) {
          const text = `${plan.title} ${plan.body}`;
          if (plan.kind === 'daily') mornings += 1;
          if (new RegExp(`${forms.pl}|${forms.gen}|${forms.dat}`).test(text)) mentions += 1;
          expect(text).not.toMatch(BANNED);
          expect(plan.title.length).toBeLessThanOrEqual(70);
          expect(plan.body.length).toBeLessThanOrEqual(180);
        }
      }
    }
    expect(mentions).toBeGreaterThan(0);
    expect(mentions / mornings).toBeLessThan(0.35);
  });

  it('uses many different texts', () => {
    const titles = new Set<string>();
    for (let start = 0; start < 60; start += 5) {
      for (const plan of planNativeNotifications(planInput({ now: new Date(2026, 8, 5 + start, 8, 30) }))) titles.add(plan.title);
    }
    expect(titles.size).toBeGreaterThan(25);
  });

  it('reads cleanly without a known sign', () => {
    const plans = planNativeNotifications(planInput({ profile: {} }));
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(`${plan.title} ${plan.body}`).not.toMatch(BANNED);
      expect(`${plan.title} ${plan.body}`).not.toMatch(/\s{2}|\s[,!?.]|^[,!?.]|у\s+сегодня/);
    }
  });

  it('opens matching screens', () => {
    const plans = planNativeNotifications(planInput());
    expect(plans.filter((plan) => plan.kind === 'daily').every((plan) => plan.route === 'horoscope')).toBe(true);
    expect(new Set(plans.filter((plan) => plan.kind === 'invite').map((plan) => plan.route)).size).toBeGreaterThan(1);
  });

  it('greets on the birthday by name', () => {
    const plans = planNativeNotifications(planInput({ profile: { sign: 'Virgo', name: 'Аня Петрова', birthDate: '1995-09-08' } }));
    const birthday = byDay(plans)[key(3)];
    expect(birthday[0]).toMatchObject({ kind: 'birthday', title: 'С днём рождения, Аня!' });
    expect(new Date(birthday[0].at).getHours()).toBe(9);
  });

  it('congratulates on holidays and Valentine’s leads to compatibility', () => {
    const plans = planNativeNotifications(planInput({ now: new Date(2026, 1, 12, 8) }));
    const valentine = plans.find((plan) => plan.dayKey === '2026-02-14');
    expect(valentine).toMatchObject({ kind: 'holiday', route: 'compatibility' });
    expect(plans.find((plan) => plan.dayKey === '2026-02-23')).toMatchObject({ kind: 'holiday' });
    expect(holidayCopy('ru', 11, 13, 5)?.title).toBe('Пятница, 13-е');
  });

  it('announces the start of the user’s own sign season', () => {
    const plans = planNativeNotifications(planInput({ now: new Date(2026, 1, 15, 8) }));
    expect(plans.find((plan) => plan.dayKey === '2026-02-19')).toMatchObject({ kind: 'season', title: 'Начался сезон Рыб' });
  });

  it('keeps important mode to occasions only', () => {
    const plans = planNativeNotifications(planInput({
      settings: settings({ enabled: true, mode: 'important' }), skyEvents: [{ dayKey: key(5), kind: 'new_moon' }],
    }));
    expect(plans.map((plan) => plan.kind)).toEqual(['comeback', 'sky', 'comeback', 'comeback']);
  });

  it('plans nothing when quiet hours cover the whole day', () => {
    expect(planNativeNotifications(planInput({
      settings: settings({ enabled: true, quietStart: '09:00', quietEnd: '09:00' }),
    }))).toEqual([]);
  });

  it('ships admin presets that fit the native limits', () => {
    for (const preset of ADMIN_PUSH_PRESETS) {
      expect(preset.title.length).toBeLessThanOrEqual(70);
      expect(preset.body.length).toBeLessThanOrEqual(240);
      expect(`${preset.title} ${preset.body}`).not.toMatch(BANNED);
    }
  });
});

describe('ready native notification policy', () => {
  it('suppresses ready notifications when disabled, quiet, or the clock is invalid', () => {
    expect(makeNativeReadyNotification(readyInput({ settings: settings() }))).toBeNull();
    expect(makeNativeReadyNotification(readyInput({ now: new Date(2026, 8, 5, 22) }))).toBeNull();
    expect(makeNativeReadyNotification(readyInput({ now: new Date(NaN) }))).toBeNull();
    expect(makeNativeReadyNotification(readyInput({ now: new Date(2026, 8, 5, 21, 59, 59) }))).toBeNull();
    expect(makeNativeReadyNotification(readyInput({ accountId: '' }))).toBeNull();
  });

  it.each(['ru', 'en'] as const)('routes real forecast and chart results to their matching screens (%s)', (language) => {
    const today = makeNativeReadyNotification(readyInput({ language, route: 'today' }));
    const natal = makeNativeReadyNotification(readyInput({ language, route: 'natal' }));
    expect(today).toMatchObject({ accountId: '1001', route: 'today', kind: 'ready', dayKey: '2026-09-05' });
    expect(natal).toMatchObject({ accountId: '1001', route: 'natal', kind: 'ready', dayKey: '2026-09-05' });
    expect(today?.title).toMatch(/прогноз готов|forecast is ready/i);
    expect(natal?.title).toMatch(/карта готова|chart is ready/i);
    expect(today?.id).not.toBe(natal?.id);
    expect(today!.expiresAt).toBeGreaterThan(today!.at);
  });
});
