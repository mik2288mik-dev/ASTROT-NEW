import type { TodayAssistantHomeResult } from '../types';

function clockMinutes(value: string | null | undefined) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function shouldShowTodayAssistantFirst(result: TodayAssistantHomeResult | null | undefined) {
  if (!result || result.status !== 'ready') return false;

  const minutes = clockMinutes(result.pulse.currentTime);
  const currentPoint = result.pulse.currentPoint;

  if (result.dayMode === 'evening') {
    return result.checkIn.status === 'open';
  }

  if (result.dayMode === 'morning') {
    if (minutes == null) return false;
    return minutes >= 8 * 60 && minutes <= 10 * 60 + 30;
  }

  if (result.dayMode === 'day') {
    return currentPoint.isKeyMoment === true || currentPoint.score >= 76;
  }

  return false;
}
