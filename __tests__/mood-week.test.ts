import fs from 'fs';
import path from 'path';
import { buildMoodReport, isMoodWeekFinished, moodWeekDayNumber, slotForHour, validReminderTimes, type MoodWeek } from '../lib/moodWeek';
import { DEFAULT_NATIVE_NOTIFICATION_SETTINGS, planNativeNotifications } from '../lib/nativeNotificationPolicy';

const at = '2026-10-05T10:00:00Z';
function week(checkins: MoodWeek['checkins']): MoodWeek {
  return { startDayKey: '2026-10-05', reminderTimes: ['10:00', '20:00'], checkins };
}

describe('«Неделя настроения»', () => {
  it('knows its days, slots and reminder rules', () => {
    const value = week({});
    expect(moodWeekDayNumber(value, '2026-10-05')).toBe(1);
    expect(moodWeekDayNumber(value, '2026-10-11')).toBe(7);
    expect(isMoodWeekFinished(value, '2026-10-11')).toBe(false);
    expect(isMoodWeekFinished(value, '2026-10-12')).toBe(true);
    expect([8, 12, 18, 22].map(slotForHour)).toEqual(['morning', 'day', 'evening', 'night']);
    expect(validReminderTimes(['10:00', '20:00'])).toBe(true);
    expect(validReminderTimes(['10:00', '12:00'])).toBe(false);
    expect(validReminderTimes(['08:00', '20:00'])).toBe(false);
  });

  it('finds peaks and dips by day and time of day', () => {
    const report = buildMoodReport(week({
      '2026-10-05': { morning: { mood: 2, power: 2, at }, evening: { mood: 4, power: 3, at } },
      '2026-10-06': { morning: { mood: 3, power: 3, at }, evening: { mood: 5, power: 4, at } },
      '2026-10-07': { morning: { mood: 1, power: 1, at }, evening: { mood: 2, power: 2, at } },
    }), {}, 'ru');
    expect(report.checkins).toBe(6);
    expect(report.bestDay).toBe('2026-10-06');
    expect(report.worstDay).toBe('2026-10-07');
    expect(report.bestSlot).toBe('evening');
    expect(report.worstSlot).toBe('morning');
    expect(report.summary).toContain('Лучше всего было во вторник, труднее всего — в среду.');
    expect(report.summary).toContain('Настроение выше по вечерам, ниже — по утрам.');
  });

  it('compares with forecast days honestly and admits too little data', () => {
    const checkins = {
      '2026-10-05': { morning: { mood: 5, power: 4, at } },
      '2026-10-06': { morning: { mood: 5, power: 4, at } },
      '2026-10-07': { morning: { mood: 2, power: 2, at } },
      '2026-10-08': { morning: { mood: 2, power: 3, at } },
    };
    const report = buildMoodReport(week(checkins), {
      '2026-10-05': { tone: 'good', moonAngle: 10 },
      '2026-10-06': { tone: 'good', moonAngle: 20 },
      '2026-10-07': { tone: 'hard', moonAngle: 200 },
      '2026-10-08': { tone: 'hard', moonAngle: 210 },
    }, 'ru');
    expect(report.forecastLine).toContain('в лёгкие по прогнозу дни среднее настроение 5');
    expect(report.forecastLine).toContain('одна неделя — слишком мало, чтобы делать выводы');
    const flat = buildMoodReport(week({ '2026-10-05': { morning: { mood: 3, power: 3, at } } }), { '2026-10-05': { tone: 'good' } }, 'ru');
    expect(flat.forecastLine).toContain('не хватило дней');
    expect(buildMoodReport(week({}), {}, 'ru').summary).toContain('отчёт пустой');
  });

  it('puts two mood reminders instead of the usual ones, inside the daily limit', () => {
    const plan = planNativeNotifications({
      accountId: '42', language: 'ru', isSetup: true,
      settings: { ...DEFAULT_NATIVE_NOTIFICATION_SETTINGS, enabled: true },
      now: new Date(2026, 9, 5, 8, 0),
      moodWeek: { startDayKey: '2026-10-05', reminderTimes: ['10:00', '20:00'] },
    });
    const byDay = new Map<string, typeof plan>();
    plan.forEach((item) => byDay.set(item.dayKey, [...(byDay.get(item.dayKey) ?? []), item]));
    for (const day of ['2026-10-06', '2026-10-07', '2026-10-08']) {
      const items = byDay.get(day) ?? [];
      expect(items.filter((item) => item.kind === 'mood')).toHaveLength(2);
      expect(items.filter((item) => item.kind === 'daily' || item.kind === 'invite')).toHaveLength(0);
      expect(items.length).toBeLessThanOrEqual(3);
    }
    const mood = plan.filter((item) => item.kind === 'mood');
    expect(mood.every((item) => item.route === 'mood')).toBe(true);
    expect(mood.every((item) => item.dayKey <= '2026-10-11')).toBe(true);
    expect(new Date(mood[1].at).getHours()).toBe(10);
  });

  it('teaches the installed notification receiver the new kind and route', () => {
    const receiver = fs.readFileSync(path.join(__dirname, '..', 'android/app/src/main/java/ru/tvoygoroskop/app/notifications/NeboNotificationReceiver.java'), 'utf8');
    expect(receiver).toContain('"mood".equals(value)');
  });
});
