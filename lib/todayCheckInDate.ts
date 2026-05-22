import type { TodayPulse } from '../types';

export type TodayCheckInDateMode = 'same_day' | 'previous_day_tail';

export type TodayCheckInDateInfo = {
  date: string;
  mode: TodayCheckInDateMode;
};

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  date.setUTCDate(date.getUTCDate() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function clockHour(value: string | null | undefined) {
  const hour = Number.parseInt(String(value || '').slice(0, 2), 10);
  return Number.isFinite(hour) ? hour : null;
}

export function getTodayCheckInDateInfo(pulse: Pick<TodayPulse, 'date' | 'currentTime'>): TodayCheckInDateInfo {
  const hour = clockHour(pulse.currentTime);
  if (hour != null && hour >= 0 && hour < 4) {
    return {
      date: previousDateKey(pulse.date),
      mode: 'previous_day_tail',
    };
  }

  return {
    date: pulse.date,
    mode: 'same_day',
  };
}
