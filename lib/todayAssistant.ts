import type {
  ActionTimingKey,
  ActionTimingRecommendation,
  ActionTimingState,
  DailyCheckIn,
  DailyCheckInForecastFit,
  DailyCheckInFocus,
  DailyCheckInMood,
  DailyCheckInPeople,
  Language,
  PersonalPatternInsight,
  PersonalPatternTeaser,
  TodayAssistantAccuracySummary,
  TodayAssistantDayMode,
  TodayPulse,
  TodayPulseLayerKey,
  TodayPulseLayers,
  TodayPulsePhase,
  TodayPulsePoint,
} from '../types';

type ActionConfig = {
  label: Record<Language, string>;
  weights: Partial<Record<TodayPulseLayerKey, number>>;
  phases: TodayPulsePhase[];
  avoidTones?: string[];
  now: Record<Language, string>;
  later: Record<Language, string>;
  noEdge: Record<Language, string>;
  caution: Record<Language, string>;
};

const ACTION_CONFIG: Record<ActionTimingKey, ActionConfig> = {
  message: {
    label: { ru: 'написать человеку', en: 'message someone' },
    weights: { relationships: 0.42, emotions: 0.24, focus: 0.18, energy: 0.1, money: 0.06 },
    phases: ['relationships', 'decisions'],
    avoidTones: ['caution'],
    now: { ru: 'Можно написать сейчас', en: 'You can message now' },
    later: { ru: 'Лучше написать позже', en: 'Better to message later' },
    noEdge: { ru: 'Нет сильного окна для переписки', en: 'No strong messaging window' },
    caution: { ru: 'Пиши короче и без проверки реакции на прочность.', en: 'Keep it short and avoid testing the reaction.' },
  },
  money: {
    label: { ru: 'заняться деньгами', en: 'handle money' },
    weights: { money: 0.42, focus: 0.3, energy: 0.16, emotions: 0.08, relationships: 0.04 },
    phases: ['focus_peak', 'decisions'],
    now: { ru: 'Деньги можно разбирать сейчас', en: 'Money tasks can work now' },
    later: { ru: 'Лучшее окно для денег позже', en: 'The better money window is later' },
    noEdge: { ru: 'Сегодня без явного денежного пика', en: 'No clear money peak today' },
    caution: { ru: 'Смотри на цифры, а не на желание быстро закрыть тревогу.', en: 'Trust numbers more than the urge to quiet anxiety fast.' },
  },
  purchase: {
    label: { ru: 'купить вещь', en: 'buy something' },
    weights: { money: 0.34, focus: 0.24, emotions: 0.22, energy: 0.12, relationships: 0.08 },
    phases: ['decisions', 'focus_peak'],
    avoidTones: ['caution'],
    now: { ru: 'Покупку можно делать сейчас', en: 'Buying now is okay' },
    later: { ru: 'Покупку лучше отложить', en: 'Better to delay the purchase' },
    noEdge: { ru: 'Для покупки нет сильного преимущества', en: 'No strong purchase advantage' },
    caution: { ru: 'Добавь в корзину и вернись к решению без спешки.', en: 'Put it in the cart and return without rushing.' },
  },
  serious_talk: {
    label: { ru: 'поговорить серьёзно', en: 'have a serious talk' },
    weights: { relationships: 0.4, emotions: 0.24, focus: 0.2, energy: 0.1, money: 0.06 },
    phases: ['relationships', 'decisions'],
    avoidTones: ['caution', 'peak'],
    now: { ru: 'Серьёзный разговор возможен сейчас', en: 'A serious talk can work now' },
    later: { ru: 'Серьёзный разговор лучше позже', en: 'Better to talk seriously later' },
    noEdge: { ru: 'Сегодня без сильного окна для сложного разговора', en: 'No strong serious-talk window today' },
    caution: { ru: 'Начинай с факта и просьбы, не с накопленного напряжения.', en: 'Start with a fact and request, not stored tension.' },
  },
  work: {
    label: { ru: 'сделать работу', en: 'do focused work' },
    weights: { focus: 0.42, energy: 0.28, money: 0.16, emotions: 0.08, relationships: 0.06 },
    phases: ['focus_peak', 'decisions', 'entry'],
    now: { ru: 'Работу можно брать сейчас', en: 'You can work now' },
    later: { ru: 'Лучшее рабочее окно позже', en: 'The better work window is later' },
    noEdge: { ru: 'Сегодня нет резкого рабочего пика', en: 'No sharp work peak today' },
    caution: { ru: 'Выбери одну задачу и закрой её без прыжков между вкладками.', en: 'Pick one task and close it without jumping tabs.' },
  },
  rest: {
    label: { ru: 'отдохнуть без вины', en: 'rest without guilt' },
    weights: { emotions: 0.28, energy: 0.24, focus: 0.16, relationships: 0.16, money: 0.16 },
    phases: ['restore', 'reflection'],
    now: { ru: 'Отдых сейчас уместен', en: 'Rest makes sense now' },
    later: { ru: 'Отдых лучше зайдёт позже', en: 'Rest will land better later' },
    noEdge: { ru: 'Отдых можно ставить там, где удобно', en: 'Rest can fit where convenient' },
    caution: { ru: 'Это не пауза от жизни, а нормальное восстановление ресурса.', en: 'This is not escaping life, it is restoring capacity.' },
  },
};

const ACTION_KEYS = Object.keys(ACTION_CONFIG) as ActionTimingKey[];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function languageOf(language?: Language): Language {
  return language === 'en' ? 'en' : 'ru';
}

function pointTimeLabel(point: TodayPulsePoint) {
  return point.time || `${String(point.hour).padStart(2, '0')}:00`;
}

function scoreActionPoint(point: TodayPulsePoint, actionKey: ActionTimingKey) {
  const config = ACTION_CONFIG[actionKey];
  let score = 0;
  let total = 0;

  if (actionKey === 'rest') {
    score += (100 - point.layers.energy) * 0.28;
    score += (100 - point.layers.focus) * 0.18;
    score += point.layers.emotions * 0.2;
    score += point.score * 0.12;
    total = 0.78;
  }

  for (const [layer, weight] of Object.entries(config.weights) as Array<[TodayPulseLayerKey, number]>) {
    score += point.layers[layer] * weight;
    total += weight;
  }

  const normalized = total > 0 ? score / total : point.score;
  const phaseBonus = config.phases.includes(point.phase) ? 9 : -2;
  const tonePenalty = config.avoidTones?.includes(point.tone) ? -13 : 0;
  const cautionPenalty = point.tone === 'caution' && actionKey !== 'rest' ? -6 : 0;
  return clamp(normalized + phaseBonus + tonePenalty + cautionPenalty);
}

function windowForPoint(pulse: TodayPulse, point: TodayPulsePoint) {
  return pulse.windows.find((window) => {
    const start = Number(window.start.slice(0, 2));
    const end = Number(window.end.slice(0, 2));
    if (end === 0) return point.hour >= start;
    return point.hour >= start && point.hour < end;
  }) || pulse.windows.find((window) => window.label === point.title) || pulse.windows[0];
}

function recommendationState(nowScore: number, bestScore: number, targetHour: number, nowHour: number): ActionTimingState {
  if (bestScore < 58) return 'no_edge';
  if (targetHour === nowHour || nowScore >= 62 && bestScore - nowScore <= 6) return 'now';
  if (targetHour < nowHour) return 'no_edge'; // лучшее окно дня уже прошло
  if (bestScore - nowScore < 7) return 'no_edge';
  return 'later';
}

function summaryFor(language: Language, actionKey: ActionTimingKey, state: ActionTimingState, target: TodayPulsePoint) {
  const label = ACTION_CONFIG[actionKey].label[language];
  if (language === 'en') {
    if (state === 'now') return `The current rhythm supports ${label}. Keep it simple and concrete.`;
    if (state === 'later') return `The day opens a cleaner window for ${label} around ${pointTimeLabel(target)}.`;
    return `Today does not show a strong advantage for ${label}. Choose the practical slot, not the rushed one.`;
  }
  if (state === 'now') return `Текущий ритм поддерживает ${label}. Держи действие простым и конкретным.`;
  if (state === 'later') return `Более чистое окно для “${label}” открывается около ${pointTimeLabel(target)}.`;
  return `Сегодня нет сильного преимущества для “${label}”. Выбирай удобный слот, но не делай это на бегу.`;
}

function titleFor(language: Language, actionKey: ActionTimingKey, state: ActionTimingState) {
  const config = ACTION_CONFIG[actionKey];
  return config[state === 'now' ? 'now' : state === 'later' ? 'later' : 'noEdge'][language];
}

export function getTodayAssistantDayMode(pulse: TodayPulse): TodayAssistantDayMode {
  const hour = Number.parseInt(pulse.currentTime.slice(0, 2), 10);
  if (hour >= 18 || hour < 4) return 'evening';
  if (hour >= 12) return 'day';
  return 'morning';
}

export function buildActionTimingRecommendation(
  pulse: TodayPulse,
  actionKey: ActionTimingKey,
  languageInput: Language = 'ru'
): ActionTimingRecommendation {
  const language = languageOf(languageInput);
  const nowHour = pulse.currentPoint.hour;
  // Лучшее окно дня ищем по ВСЕМУ дню, а не только в будущем — иначе вечером все
  // действия схлопываются в один оставшийся слот и выглядят одинаково.
  const ranked = pulse.points
    .map((point) => ({ point, score: scoreActionPoint(point, actionKey) }))
    .sort((a, b) => b.score - a.score || a.point.hour - b.point.hour);
  const best = ranked[0] || { point: pulse.currentPoint, score: scoreActionPoint(pulse.currentPoint, actionKey) };
  const nowScore = scoreActionPoint(pulse.currentPoint, actionKey);
  const state = recommendationState(nowScore, best.score, best.point.hour, nowHour);
  const targetPoint = state === 'now' ? pulse.currentPoint : best.point;
  const targetScore = state === 'now' ? nowScore : best.score;
  const bestWindow = windowForPoint(pulse, targetPoint);
  const confidence = clamp(48 + Math.abs(targetScore - 50) * 0.46 + (state === 'no_edge' ? -8 : 8), 42, 88);

  return {
    actionKey,
    state,
    title: titleFor(language, actionKey, state),
    summary: summaryFor(language, actionKey, state, targetPoint),
    bestWindow: {
      start: bestWindow.start,
      end: bestWindow.end,
      label: bestWindow.label,
      score: targetScore,
    },
    targetPoint,
    confidence,
    reasons: [
      targetPoint.title,
      language === 'en'
        ? `The strongest layer here is ${dominantLayer(targetPoint.layers)}.`
        : `Сильнее всего здесь слой “${layerLabel(dominantLayer(targetPoint.layers), language)}”.`,
    ],
    caution: ACTION_CONFIG[actionKey].caution[language],
    date: pulse.date,
    timezone: pulse.timezone,
    generatedAt: new Date().toISOString(),
  };
}

export function buildQuickActionRecommendations(pulse: TodayPulse, language: Language = 'ru') {
  return ACTION_KEYS.map((key) => buildActionTimingRecommendation(pulse, key, language));
}

function dominantLayer(layers: TodayPulseLayers): TodayPulseLayerKey {
  return (Object.keys(layers) as TodayPulseLayerKey[]).reduce(
    (best, key) => (layers[key] > layers[best] ? key : best),
    'energy'
  );
}

function layerLabel(layer: TodayPulseLayerKey, language: Language) {
  const labels: Record<TodayPulseLayerKey, Record<Language, string>> = {
    energy: { ru: 'энергия', en: 'energy' },
    focus: { ru: 'фокус', en: 'focus' },
    emotions: { ru: 'эмоции', en: 'emotions' },
    money: { ru: 'деньги', en: 'money' },
    relationships: { ru: 'контакт', en: 'relationships' },
  };
  return labels[layer][language];
}

function fitValue(value: DailyCheckInForecastFit) {
  if (value === 'yes') return 1;
  if (value === 'partial') return 0.5;
  return 0;
}

function keyCount<T extends string>(values: T[]) {
  return values.reduce((map, value) => {
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map<T, number>());
}

function topEntry<T extends string>(values: T[]) {
  const counts = keyCount(values);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
}

function focusLabel(value: DailyCheckInFocus, language: Language) {
  const labels: Record<DailyCheckInFocus, Record<Language, string>> = {
    low: { ru: 'низкий фокус', en: 'low focus' },
    normal: { ru: 'ровный фокус', en: 'steady focus' },
    high: { ru: 'высокий фокус', en: 'high focus' },
  };
  return labels[value][language];
}

function moodLabel(value: DailyCheckInMood, language: Language) {
  const labels: Record<DailyCheckInMood, Record<Language, string>> = {
    heavy: { ru: 'тяжёлое настроение', en: 'heavy mood' },
    steady: { ru: 'ровное настроение', en: 'steady mood' },
    good: { ru: 'хорошее настроение', en: 'good mood' },
  };
  return labels[value][language];
}

function peopleLabel(value: DailyCheckInPeople, language: Language) {
  const labels: Record<DailyCheckInPeople, Record<Language, string>> = {
    social: { ru: 'хотелось общения', en: 'wanted contact' },
    quiet: { ru: 'хотелось тишины', en: 'wanted quiet' },
  };
  return labels[value][language];
}

export function buildAccuracySummary(checkins: DailyCheckIn[], languageInput: Language = 'ru'): TodayAssistantAccuracySummary {
  const language = languageOf(languageInput);
  const historyCount = checkins.length;
  const recent = checkins.slice(0, 30);
  const fitRate = recent.length
    ? Math.round((recent.reduce((sum, item) => sum + fitValue(item.forecastFit), 0) / recent.length) * 100)
    : 0;
  const progressTarget = historyCount < 3 ? 3 : historyCount < 7 ? 7 : historyCount < 14 ? 14 : 30;
  const focusTop = topEntry(recent.map((item) => item.focus));
  const moodTop = topEntry(recent.map((item) => item.mood));
  const peopleTop = topEntry(recent.map((item) => item.people));
  const bestMatchedLayer = focusTop && focusTop[1] >= Math.max(moodTop?.[1] || 0, peopleTop?.[1] || 0)
    ? 'focus'
    : moodTop && moodTop[1] >= (peopleTop?.[1] || 0)
      ? 'mood'
      : peopleTop
        ? 'people'
        : 'none';

  if (historyCount === 0) {
    return {
      historyCount,
      title: language === 'en' ? 'No evening marks yet' : 'Пока нет вечерних отметок',
      summary: language === 'en'
        ? 'Close one day, and the astrologer will start comparing the forecast with real life.'
        : 'Закрой один день, и астролог начнёт сравнивать прогноз с реальностью.',
      bestMatchedLayer: 'none',
      forecastFitRate: 0,
      progressToInsight: { current: 0, target: progressTarget },
    };
  }

  return {
    historyCount,
    title: language === 'en' ? `${fitRate}% forecast fit` : `${fitRate}% совпадения прогнозов`,
    summary: language === 'en'
      ? `Based on ${historyCount} evening mark${historyCount === 1 ? '' : 's'}, the clearest signal is ${bestMatchedLayer}.`
      : `По ${historyCount} вечерним отметкам самый заметный сигнал сейчас: ${bestMatchedLayer === 'focus' ? 'фокус' : bestMatchedLayer === 'mood' ? 'настроение' : bestMatchedLayer === 'people' ? 'общение' : 'общий ритм'}.`,
    bestMatchedLayer,
    forecastFitRate: fitRate,
    progressToInsight: { current: Math.min(historyCount, progressTarget), target: progressTarget },
  };
}

export function buildPersonalPatterns(
  checkins: DailyCheckIn[],
  _actionEvents: Array<{ actionKey: ActionTimingKey }>,
  languageInput: Language = 'ru'
): PersonalPatternInsight[] {
  const language = languageOf(languageInput);
  const recent = checkins.slice(0, 30);
  if (recent.length < 3) return [];

  const insights: PersonalPatternInsight[] = [];
  const focusTop = topEntry(recent.slice(0, 7).map((item) => item.focus));
  if (focusTop && focusTop[1] >= 2) {
    insights.push({
      id: `focus-${focusTop[0]}-7`,
      kind: recent.length >= 7 ? 'focus' : 'first_repeat',
      windowDays: 7,
      title: language === 'en' ? 'First repeat found' : 'Первый повтор найден',
      summary: language === 'en'
        ? `You more often mark ${focusLabel(focusTop[0], language)}. Tomorrow the astrologer can lift work windows a little higher.`
        : `Ты чаще отмечаешь ${focusLabel(focusTop[0], language)}. Завтра астролог может поднять рабочие окна чуть выше.`,
      evidence: language === 'en'
        ? `${focusTop[1]} of the last ${Math.min(recent.length, 7)} marks`
        : `${focusTop[1]} из последних ${Math.min(recent.length, 7)} отметок`,
      confidence: clamp(52 + focusTop[1] * 8, 50, 82),
    });
  }

  const peopleTop = topEntry(recent.slice(0, 14).map((item) => item.people));
  if (recent.length >= 7 && peopleTop && peopleTop[1] >= 4) {
    insights.push({
      id: `people-${peopleTop[0]}-14`,
      kind: 'people',
      windowDays: 14,
      title: language === 'en' ? 'Contact pattern' : 'Повтор в общении',
      summary: language === 'en'
        ? `In similar days you more often marked that you ${peopleLabel(peopleTop[0], language)}.`
        : `В похожие дни ты чаще отмечаешь: ${peopleLabel(peopleTop[0], language)}.`,
      evidence: language === 'en'
        ? `${peopleTop[1]} of the last ${Math.min(recent.length, 14)} days`
        : `${peopleTop[1]} из последних ${Math.min(recent.length, 14)} дней`,
      confidence: clamp(54 + peopleTop[1] * 5, 52, 86),
    });
  }

  const moodTop = topEntry(recent.map((item) => item.mood));
  if (recent.length >= 14 && moodTop && moodTop[1] >= 7) {
    insights.push({
      id: `mood-${moodTop[0]}-30`,
      kind: 'month',
      windowDays: 30,
      title: language === 'en' ? 'Your month is taking shape' : 'Твой месяц начинает складываться',
      summary: language === 'en'
        ? `The most repeated state is ${moodLabel(moodTop[0], language)}. the astrologer will use it carefully, not as a fixed label.`
        : `Чаще всего повторяется состояние: ${moodLabel(moodTop[0], language)}. астролог будет учитывать это аккуратно, не как ярлык.`,
      evidence: language === 'en'
        ? `${moodTop[1]} of ${recent.length} evening marks`
        : `${moodTop[1]} из ${recent.length} вечерних отметок`,
      confidence: clamp(55 + moodTop[1] * 3, 54, 88),
    });
  }

  return insights.slice(0, 3);
}

export function buildPatternTeaser(
  checkins: DailyCheckIn[],
  insights: PersonalPatternInsight[],
  languageInput: Language = 'ru'
): PersonalPatternTeaser {
  const language = languageOf(languageInput);
  if (insights.length > 0) {
    return {
      state: 'ready',
      title: insights[0].title,
      summary: insights[0].summary,
      progress: { current: Math.max(3, checkins.length), target: Math.max(3, checkins.length) },
    };
  }
  const target = checkins.length < 3 ? 3 : checkins.length < 7 ? 7 : checkins.length < 14 ? 14 : 30;
  const left = Math.max(0, target - checkins.length);
  return {
    state: 'collecting',
    title: language === 'en' ? 'Personal rhythm is collecting' : 'Личный ритм собирается',
    summary: language === 'en'
      ? `${left} more evening mark${left === 1 ? '' : 's'} until the astrologer can show the first honest repeat.`
      : `Ещё ${left} вечерн${left === 1 ? 'яя отметка' : left > 1 && left < 5 ? 'ие отметки' : 'их отметок'} до первого честного повтора.`,
    progress: { current: Math.min(checkins.length, target), target },
  };
}

export function assertDailyCheckInInput(value: any): {
  focus: DailyCheckInFocus;
  mood: DailyCheckInMood;
  people: DailyCheckInPeople;
  forecastFit: DailyCheckInForecastFit;
} | null {
  const focus = value?.focus;
  const mood = value?.mood;
  const people = value?.people;
  const forecastFit = value?.forecastFit;
  if (!['low', 'normal', 'high'].includes(focus)) return null;
  if (!['heavy', 'steady', 'good'].includes(mood)) return null;
  if (!['social', 'quiet'].includes(people)) return null;
  if (!['yes', 'partial', 'no'].includes(forecastFit)) return null;
  return { focus, mood, people, forecastFit };
}

export function isActionTimingKey(value: unknown): value is ActionTimingKey {
  return ACTION_KEYS.includes(value as ActionTimingKey);
}

export function getActionTimingKeys() {
  return ACTION_KEYS;
}
