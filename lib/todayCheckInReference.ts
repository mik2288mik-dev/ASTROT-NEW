import type {
  DailyCheckInFocus,
  DailyCheckInInput,
  DailyCheckInMood,
  DailyCheckInPeople,
  TodayPulse,
  TodayPulseWindow,
} from '../types';

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

const RU_FOCUS: Record<DailyCheckInFocus, TodayCheckInExpectedValue> = {
  low: {
    value: 'low',
    label: 'ниже обычного',
    hint: 'LUMIA ожидала, что фокус может быть ниже обычного: лучше коротко и без рывка.',
  },
  normal: {
    value: 'normal',
    label: 'ровный',
    hint: 'LUMIA ожидала ровный фокус: можно закрывать одно понятное дело без гонки.',
  },
  high: {
    value: 'high',
    label: 'выше обычного',
    hint: 'LUMIA ожидала хороший фокус: подходило одно важное дело или точное решение.',
  },
};

const EN_FOCUS: Record<DailyCheckInFocus, TodayCheckInExpectedValue> = {
  low: { value: 'low', label: 'lower than usual', hint: 'LUMIA expected softer focus: short and calm worked better.' },
  normal: { value: 'normal', label: 'steady', hint: 'LUMIA expected steady focus: one clear task, no rush.' },
  high: { value: 'high', label: 'higher than usual', hint: 'LUMIA expected good focus: one important thing could move.' },
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
    hint: 'LUMIA ожидала, что контакт с людьми может быть полезным, если без лишнего давления.',
  },
  quiet: {
    value: 'quiet',
    label: 'тишина',
    hint: 'LUMIA ожидала, что лучше зайдет тишина: меньше лишних контактов, больше своего пространства.',
  },
};

const EN_PEOPLE: Record<DailyCheckInPeople, TodayCheckInExpectedValue> = {
  social: { value: 'social', label: 'contact', hint: 'LUMIA expected contact to help if it stayed low-pressure.' },
  quiet: { value: 'quiet', label: 'quiet', hint: 'LUMIA expected quiet to work better: fewer extra contacts, more space.' },
};

const FORECAST_FIT: Record<Language, TodayCheckInExpectedValue> = {
  ru: {
    value: 'partial',
    label: 'сверь с ориентиром выше',
    hint: 'Отвечай именно про блок “Сегодня LUMIA ожидала”: совпало, частично или совсем нет.',
  },
  en: {
    value: 'partial',
    label: 'compare with the forecast above',
    hint: 'Answer about the block above: did it fit, partly fit, or miss?',
  },
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

function expectedFocus(pulse: TodayPulse): DailyCheckInFocus {
  const focus = Number(pulse.currentPoint.layers?.focus ?? pulse.layers?.focus ?? 50);
  if (pulse.currentPoint.phase === 'focus_peak' || focus >= 70 || pulse.currentPoint.score >= 76) return 'high';
  if (pulse.currentPoint.phase === 'restore' || pulse.currentPoint.tone === 'restore' || focus <= 44) return 'low';
  return 'normal';
}

function expectedMood(pulse: TodayPulse): DailyCheckInMood {
  const emotions = Number(pulse.currentPoint.layers?.emotions ?? pulse.layers?.emotions ?? 50);
  if (pulse.currentPoint.tone === 'caution' || pulse.currentPoint.tone === 'restore' || emotions <= 42) return 'heavy';
  if (pulse.currentPoint.tone === 'rise' || pulse.currentPoint.tone === 'peak' || emotions >= 68) return 'good';
  return 'steady';
}

function expectedPeople(pulse: TodayPulse): DailyCheckInPeople {
  const relationships = Number(pulse.currentPoint.layers?.relationships ?? pulse.layers?.relationships ?? 50);
  if (pulse.currentPoint.phase === 'relationships' || pulse.currentPoint.tone === 'social' || relationships >= 62) return 'social';
  return 'quiet';
}

function dictionary(language: Language) {
  return language === 'ru'
    ? { focus: RU_FOCUS, mood: RU_MOOD, people: RU_PEOPLE }
    : { focus: EN_FOCUS, mood: EN_MOOD, people: EN_PEOPLE };
}

export function buildTodayCheckInReference(
  pulse: TodayPulse | null | undefined,
  language: Language = 'ru'
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
        ? 'Отметь, как день прошел по факту. LUMIA учтет это в следующих подсказках.'
        : 'Mark how the day actually felt. LUMIA will use it for the next prompts.',
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

  const focus = expectedFocus(pulse);
  const mood = expectedMood(pulse);
  const people = expectedPeople(pulse);
  const referenceWindow = pickReferenceWindow(pulse);
  const initialInput: DailyCheckInInput = {
    focus,
    mood,
    people,
    forecastFit: 'partial',
  };

  return {
    forecastTitle: pulse.currentPoint.title,
    forecastSummary: pulse.currentPoint.summary,
    dateLabel: pulse.date ? formatReferenceDate(pulse.date, language) : null,
    bestSlotLabel: referenceWindow?.label || null,
    bestSlotRange: referenceWindow ? `${referenceWindow.start}-${referenceWindow.end}` : null,
    bestFor: (pulse.currentPoint.bestFor || []).slice(0, 3),
    avoid: pulse.currentPoint.avoid?.[0] || null,
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
