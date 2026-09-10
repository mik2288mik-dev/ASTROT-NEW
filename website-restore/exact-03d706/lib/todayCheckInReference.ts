import type {
  DailyCheckInFocus,
  DailyCheckInInput,
  DailyCheckInMood,
  DailyCheckInPeople,
  DailyAstroSignal,
  DailyAstroSignalPoint,
  DailyAstroSignalWindow,
} from '../types';
import type { TodayCheckInDateMode } from './todayCheckInDate';

type Language = 'ru' | 'en';

export type TodayCheckInExpectedValue = {
  value: string;
  label: string;
  hint: string;
};

export type TodayCheckInReference = {
  forecastTitle: string;
  forecastSummary: string;
  dateLabel: string | null;
  bestSlotLabel: string | null;
  bestSlotRange: string | null;
  bestFor: string[];
  avoid: string | null;
  expected: {
    focus: TodayCheckInExpectedValue;
    mood: TodayCheckInExpectedValue;
    people: TodayCheckInExpectedValue;
    forecastFit: TodayCheckInExpectedValue;
  };
  initialInput: DailyCheckInInput;
  isFallback: boolean;
};

type BuildTodayCheckInReferenceOptions = {
  dateMode?: TodayCheckInDateMode;
  dateOverride?: string | null;
};

const RU_FOCUS: Record<DailyCheckInFocus, TodayCheckInExpectedValue> = {
  low: {
    value: 'low',
    label: 'ниже обычного',
    hint: 'NEBO ожидало, что фокус может быть ниже обычного: лучше коротко и без рывка.',
  },
  normal: {
    value: 'normal',
    label: 'ровный',
    hint: 'NEBO ожидало ровный фокус: можно закрывать одно понятное дело без гонки.',
  },
  high: {
    value: 'high',
    label: 'выше обычного',
    hint: 'NEBO ожидало хороший фокус: подходило одно важное дело или точное решение.',
  },
};

const EN_FOCUS: Record<DailyCheckInFocus, TodayCheckInExpectedValue> = {
  low: { value: 'low', label: 'lower than usual', hint: 'NEBO expected softer focus: short and calm worked better.' },
  normal: { value: 'normal', label: 'steady', hint: 'NEBO expected steady focus: one clear task, no rush.' },
  high: { value: 'high', label: 'higher than usual', hint: 'NEBO expected good focus: one important thing could move.' },
};

const RU_MOOD: Record<DailyCheckInMood, TodayCheckInExpectedValue> = {
  heavy: {
    value: 'heavy',
    label: 'тяжелее',
    hint: 'По прогнозу день мог ощущаться тяжелее: больше пауз, меньше давления на себя.',
  },
  steady: {
    value: 'steady',
    label: 'ровно',
    hint: 'По прогнозу настроение должно было быть ровным: без сильных качелей, но и без лишнего разгона.',
  },
  good: {
    value: 'good',
    label: 'легче',
    hint: 'По прогнозу настроение могло быть легче: хорошо заходили простые приятные шаги.',
  },
};

const EN_MOOD: Record<DailyCheckInMood, TodayCheckInExpectedValue> = {
  heavy: { value: 'heavy', label: 'heavier', hint: 'The day could feel heavier: more pauses, less pressure.' },
  steady: { value: 'steady', label: 'steady', hint: 'The day was expected to feel steady, without sharp swings.' },
  good: { value: 'good', label: 'lighter', hint: 'The day could feel lighter: simple good steps worked.' },
};

const RU_PEOPLE: Record<DailyCheckInPeople, TodayCheckInExpectedValue> = {
  social: {
    value: 'social',
    label: 'общение',
    hint: 'NEBO ожидало, что контакт с людьми может быть полезным, если без лишнего давления.',
  },
  quiet: {
    value: 'quiet',
    label: 'тишина',
    hint: 'NEBO ожидало, что лучше зайдет тишина: меньше лишних контактов, больше своего пространства.',
  },
};

const EN_PEOPLE: Record<DailyCheckInPeople, TodayCheckInExpectedValue> = {
  social: { value: 'social', label: 'contact', hint: 'NEBO expected contact to help if it stayed low-pressure.' },
  quiet: { value: 'quiet', label: 'quiet', hint: 'NEBO expected quiet to work better: fewer extra contacts, more space.' },
};

const FORECAST_FIT: Record<Language, TodayCheckInExpectedValue> = {
  ru: {
    value: 'partial',
    label: 'сверь с ориентиром выше',
    hint: 'Отвечай именно про блок выше: совпало, частично или совсем нет.',
  },
  en: {
    value: 'partial',
    label: 'compare with the forecast above',
    hint: 'Answer about the block above: did it fit, partly fit, or miss?',
  },
};

function formatReferenceDate(dateKey: string, language: Language, dateMode: TodayCheckInDateMode = 'same_day') {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0));
  const label = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
  }).format(date);
  if (dateMode === 'previous_day_tail') {
    return language === 'ru' ? `за ${label}` : `for ${label}`;
  }
  return label;
}

function timeToHour(time: string) {
  const hour = Number.parseInt(String(time || '').slice(0, 2), 10);
  return Number.isFinite(hour) ? hour : 0;
}

function windowContainsHour(window: DailyAstroSignalWindow, hour: number) {
  const start = timeToHour(window.start);
  const end = window.end === '00:00' ? 24 : timeToHour(window.end);
  return hour >= start && hour < end;
}

function isDayPoint(point: DailyAstroSignalPoint | null | undefined) {
  return !!point && point.hour >= 6 && point.hour < 22;
}

export function pickTodayCheckInReferencePoint(pulse: DailyAstroSignal): DailyAstroSignalPoint {
  if (isDayPoint(pulse.peakPoint)) return pulse.peakPoint;
  const dayPoints = pulse.points.filter(isDayPoint);
  if (dayPoints.length > 0) {
    return dayPoints.slice().sort((a, b) => b.score - a.score || a.hour - b.hour)[0];
  }
  return pulse.peakPoint || pulse.currentPoint;
}

function pickReferenceWindow(pulse: DailyAstroSignal, referencePoint: DailyAstroSignalPoint): DailyAstroSignalWindow | null {
  const referenceHour = Number(referencePoint.hour);
  return (
    pulse.windows.find((window) => Number.isFinite(referenceHour) && windowContainsHour(window, referenceHour)) ||
    pulse.windows.slice().sort((a, b) => b.score - a.score)[0] ||
    null
  );
}

function expectedFocus(point: DailyAstroSignalPoint, pulse: DailyAstroSignal): DailyCheckInFocus {
  const focus = Number(point.layers?.focus ?? pulse.layers?.focus ?? 50);
  if (point.phase === 'focus_peak' || focus >= 70 || point.score >= 76) return 'high';
  if (point.phase === 'restore' || point.tone === 'restore' || focus <= 44) return 'low';
  return 'normal';
}

function expectedMood(point: DailyAstroSignalPoint, pulse: DailyAstroSignal): DailyCheckInMood {
  const emotions = Number(point.layers?.emotions ?? pulse.layers?.emotions ?? 50);
  if (point.tone === 'caution' || point.tone === 'restore' || emotions <= 42) return 'heavy';
  if (point.tone === 'rise' || point.tone === 'peak' || emotions >= 68) return 'good';
  return 'steady';
}

function expectedPeople(point: DailyAstroSignalPoint, pulse: DailyAstroSignal): DailyCheckInPeople {
  const relationships = Number(point.layers?.relationships ?? pulse.layers?.relationships ?? 50);
  if (point.phase === 'relationships' || point.tone === 'social' || relationships >= 62) return 'social';
  return 'quiet';
}

function dictionary(language: Language) {
  return language === 'ru'
    ? { focus: RU_FOCUS, mood: RU_MOOD, people: RU_PEOPLE }
    : { focus: EN_FOCUS, mood: EN_MOOD, people: EN_PEOPLE };
}

export function buildTodayCheckInReference(
  pulse: DailyAstroSignal | null | undefined,
  language: Language = 'ru',
  options: BuildTodayCheckInReferenceOptions = {}
): TodayCheckInReference {
  const copy = dictionary(language);

  if (!pulse?.currentPoint) {
    const initialInput: DailyCheckInInput = {
      focus: 'normal',
      mood: 'steady',
      people: 'quiet',
      forecastFit: 'partial',
    };
    return {
      forecastTitle: language === 'ru' ? 'Сегодня сверяем общее ощущение дня' : 'Today we compare the overall day feel',
      forecastSummary: language === 'ru'
        ? 'Отметь, как день прошел по факту. Это поможет следующим подсказкам.'
        : 'Mark how the day actually felt. It will help the next prompts.',
      dateLabel: null,
      bestSlotLabel: null,
      bestSlotRange: null,
      bestFor: [],
      avoid: null,
      expected: {
        focus: copy.focus[initialInput.focus],
        mood: copy.mood[initialInput.mood],
        people: copy.people[initialInput.people],
        forecastFit: FORECAST_FIT[language],
      },
      initialInput,
      isFallback: true,
    };
  }

  const referencePoint = pickTodayCheckInReferencePoint(pulse);
  const focus = expectedFocus(referencePoint, pulse);
  const mood = expectedMood(referencePoint, pulse);
  const people = expectedPeople(referencePoint, pulse);
  const referenceWindow = pickReferenceWindow(pulse, referencePoint);
  const initialInput: DailyCheckInInput = {
    focus,
    mood,
    people,
    forecastFit: 'partial',
  };

  return {
    forecastTitle: referencePoint.title,
    forecastSummary: referencePoint.summary,
    dateLabel: (options.dateOverride || pulse.date)
      ? formatReferenceDate(options.dateOverride || pulse.date, language, options.dateMode)
      : null,
    bestSlotLabel: referenceWindow?.label || null,
    bestSlotRange: referenceWindow ? `${referenceWindow.start}-${referenceWindow.end}` : null,
    bestFor: (referencePoint.bestFor || []).slice(0, 3),
    avoid: referencePoint.avoid?.[0] || null,
    expected: {
      focus: copy.focus[focus],
      mood: copy.mood[mood],
      people: copy.people[people],
      forecastFit: FORECAST_FIT[language],
    },
    initialInput,
    isFallback: false,
  };
}
