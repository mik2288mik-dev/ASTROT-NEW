import type { TodayPulse, TodayPulseWindow } from '../types';

type Language = 'ru' | 'en';

export type TodayCheckInReference = {
  title: string;
  summary: string;
  dateLabel: string | null;
  bestSlotLabel: string | null;
  bestSlotRange: string | null;
  bestFor: string[];
  avoid: string | null;
  isFallback: boolean;
};

function formatReferenceDate(dateKey: string, language: Language) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0));
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function timeToHour(time: string) {
  const hour = Number.parseInt(String(time || '').slice(0, 2), 10);
  return Number.isFinite(hour) ? hour : 0;
}

function windowContainsHour(window: TodayPulseWindow, hour: number) {
  const start = timeToHour(window.start);
  const end = window.end === '00:00' ? 24 : timeToHour(window.end);
  return hour >= start && hour < end;
}

function pickReferenceWindow(pulse: TodayPulse): TodayPulseWindow | null {
  const peakHour = Number(pulse.peakPoint?.hour);
  const currentHour = Number(pulse.currentPoint?.hour);
  return (
    pulse.windows.find((window) => Number.isFinite(peakHour) && windowContainsHour(window, peakHour)) ||
    pulse.windows.find((window) => Number.isFinite(currentHour) && windowContainsHour(window, currentHour)) ||
    pulse.windows.slice().sort((a, b) => b.score - a.score)[0] ||
    null
  );
}

export function buildTodayCheckInReference(
  pulse: TodayPulse | null | undefined,
  language: Language = 'ru'
): TodayCheckInReference {
  if (!pulse?.currentPoint) {
    return {
      title: language === 'ru' ? 'Сегодня сверяем общее ощущение дня' : 'Today we compare the overall day feel',
      summary: language === 'ru'
        ? 'Отметь фокус, настроение и совпадение. LUMIA учтёт это в следующих подсказках.'
        : 'Mark focus, mood, and fit. LUMIA will use it for the next prompts.',
      dateLabel: null,
      bestSlotLabel: null,
      bestSlotRange: null,
      bestFor: [],
      avoid: null,
      isFallback: true,
    };
  }

  const referenceWindow = pickReferenceWindow(pulse);
  return {
    title: pulse.currentPoint.title,
    summary: pulse.currentPoint.summary,
    dateLabel: pulse.date ? formatReferenceDate(pulse.date, language) : null,
    bestSlotLabel: referenceWindow?.label || null,
    bestSlotRange: referenceWindow ? `${referenceWindow.start}-${referenceWindow.end}` : null,
    bestFor: (pulse.currentPoint.bestFor || []).slice(0, 3),
    avoid: pulse.currentPoint.avoid?.[0] || null,
    isFallback: false,
  };
}
