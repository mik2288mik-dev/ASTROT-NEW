import { toZonedTime } from 'date-fns-tz';
import { db, getPool } from '../lib/db';
import {
  buildNotificationDeepLink,
  findForbiddenNotificationTerms,
  renderNotificationTemplate,
  isWithinQuietHours,
  type NotificationRenderVariables,
} from '../lib/notificationEngineRules';
import {
  buildRetentionInlineKeyboard,
  sendTelegramPhotoMessage,
  sendTelegramTextMessage,
  resolveBotUsername,
} from '../lib/telegramBot';
import { buildMiniAppButtonUrl } from '../lib/notificationDeepLink';
import { resolveTodayPulseForUser } from '../lib/todayPulseResolver';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { getZodiacSign } from '../constants';
import type {
  AdminScheduledNotificationQueueItem,
  RetentionNotificationStatus,
  TodayPulse,
  TodayPulsePoint,
} from '../types';

const DEFAULT_TZ = 'Europe/Moscow';
const RECENT_OPEN_MINUTES = 60;
const FREE_DAILY_LIMIT = 2;
const PREMIUM_DAILY_LIMIT = 2;
const IGNORED_LIMIT = 5;
// Жёсткий предохранитель против спама: ни один юзер не получает два пуша ближе, чем за столько часов.
// 7ч → за день максимум 2 пуша, расходятся на УТРО и ВЕЧЕР (дневной выпадает). Действует на ОТПРАВКЕ.
const NOTIFICATION_MIN_GAP_HOURS = Number(process.env.NOTIFICATION_MIN_GAP_HOURS) || 7;

export type RetentionJobType =
  | 'notification-dispatcher'
  | 'daily-card-generator'
  | 'morning-retention-planner'
  | 'midday-retention-planner'
  | 'evening-retention-planner'
  | 'inactive-user-reactivation'
  | 'premium-conversion-planner'
  | 'unfinished-action-reminder'
  | 'weekly-summary-generator'
  | 'admin-campaign-runner';

export type RetentionSegment =
  | 'new_user_no_birth_data'
  | 'birth_data_no_time'
  | 'free_natal_ready_not_opened'
  | 'free_natal_opened_no_premium'
  | 'daily_active_free'
  | 'daily_active_premium'
  | 'inactive_2_days'
  | 'inactive_7_days'
  | 'inactive_14_days'
  | 'love_interested'
  | 'money_interested'
  | 'work_interested'
  | 'assistant_user'
  | 'high_intent_premium';

export type RetentionNotificationType =
  | 'daily_card'
  | 'sign_daily'
  | 'weekly_horoscope'
  | 'compatibility'
  | 'birthday'
  | 'premium_expiring'
  | 'sunday_summary'
  | 'pulse_day'
  | 'assistant'
  | 'natal_free'
  | 'love'
  | 'money'
  | 'work'
  | 'personal_day'
  | 'synastry'
  | 'premium'
  | 'inactive_2d'
  | 'inactive_7d'
  | 'inactive_14d'
  | 'birth_data_missing'
  | 'birth_time_missing'
  | 'unfinished_action';

type RecipientRow = {
  id: string;
  name: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthPlace: string | null;
  premiumUntil: string | null;
  lastLogin: string | null;
  language: string;
  chartId: number | null;
  chartTimezone: string | null;
  hasPrimaryChart: boolean;
};

type PreferenceFlags = Record<
  | 'enabled'
  | 'daily_card'
  | 'pulse_day'
  | 'love'
  | 'money'
  | 'work'
  | 'assistant'
  | 'natal'
  | 'premium'
  | 'synastry'
  | 'evening_summary',
  boolean
>;

export type PersonalizationContext = {
  user: RecipientRow;
  timezone: string;
  localDate: string;
  localTime: string;
  localHour: number;
  isPremium: boolean;
  isBirthdayToday: boolean;
  premiumDaysLeft: number | null;
  hasBirthDate: boolean;
  hasBirthTime: boolean;
  hasBirthPlace: boolean;
  hasPrimaryChart: boolean;
  todayPulse: TodayPulse | null;
  preparedDailyCard: PreparedDailyCard | null;
  recentScreens: string[];
  lockedBlockEvents: number;
  daysInactive: number;
  daysWithoutClick: number;
  ignoredLastCount: number;
  notificationsSentToday: number;
  lastNotificationType: string | null;
  lastTemplateId: number | null;
  preferences: PreferenceFlags;
  quietHoursStart: string;
  quietHoursEnd: string;
  interests: Record<'love' | 'money' | 'work' | 'assistant' | 'synastry', number>;
  segments: RetentionSegment[];
};

type PreparedDailyCard = {
  theme: string;
  summary: string;
  loveText: string;
  workText: string;
  moneyText: string;
  cautionText: string;
  adviceText: string;
};

type RetentionScenarioRow = {
  id: number;
  key: string;
  enabled: boolean;
  priority: number;
  max_per_day: number;
  cooldown_hours: number;
  deep_link: string;
};

type RetentionTemplateRow = {
  id: number;
  scenario_id: number | null;
  title: string;
  body: string;
  button_text: string;
  deep_link: string;
  weight: number;
  asset_id: number | null;
  asset_public_url?: string | null;
};

type RetentionCandidate = {
  type: RetentionNotificationType;
  segment: RetentionSegment | null;
  scenario: RetentionScenarioRow | null;
  template: RetentionTemplateRow | null;
  priority: number;
  reason: string;
  section: string;
  buttonText: string;
  variables: NotificationRenderVariables;
  fallbackTitle: string;
  fallbackBody: string;
  scheduledAt: Date;
  dedupeKey: string;
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function json(value: any, fallback: any = {}) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function safeTimezone(value?: string | null) {
  const tz = String(value || '').trim();
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

function localInfo(now: Date, timezone: string) {
  const zoned = toZonedTime(now, timezone);
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return {
    localDate,
    localTime: `${pad2(zoned.getHours())}:${pad2(zoned.getMinutes())}`,
    localHour: zoned.getHours(),
    zoned,
  };
}

function dateDiffDays(from: string | null, now = new Date()) {
  if (!from) return 999;
  const diff = now.getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function pulseWindow(pulse: TodayPulse | null, point?: TodayPulsePoint | null) {
  if (!pulse || !point) return '';
  const row = pulse.windows.find((item) => {
    const start = Number(item.start.slice(0, 2));
    const end = Number(item.end.slice(0, 2));
    if (end === 0) return point.hour >= start;
    return point.hour >= start && point.hour < end;
  });
  if (!row) return point.time || '';
  return `${row.start}-${row.end === '00:00' ? '23:59' : row.end}`;
}

function preparedCardFromPulse(pulse: TodayPulse | null): PreparedDailyCard {
  const point = pulse?.currentPoint || null;
  const peak = pulse?.peakPoint || point;
  const bestFor = (peak?.bestFor || point?.bestFor || []).slice(0, 2).join(', ');
  const avoid = (point?.avoid || peak?.avoid || []).slice(0, 1)[0] || 'резкие решения';
  return {
    theme: peak?.title || point?.title || 'Что важно сегодня',
    summary: point?.summary || 'Сегодня лучше выбрать один понятный шаг и не перегружать день лишними задачами.',
    loveText: 'В общении лучше смотреть на поступки и говорить коротко, если что-то нужно прояснить.',
    workText: bestFor ? `Для работы подойдёт: ${bestFor}.` : 'Для работы лучше выбрать одну задачу и довести её до результата.',
    moneyText: 'С деньгами лучше не действовать на импульсе: сначала сравни варианты.',
    cautionText: `Лучше не тащить: ${avoid}.`,
    adviceText: peak ? `Лучшее окно: ${pulseWindow(pulse, peak) || 'по ходу дня'}.` : 'Открой день и выбери удобный момент.',
  };
}

function defaultPreferences(row: any): PreferenceFlags {
  return {
    enabled: row?.enabled !== false,
    daily_card: row?.daily_card_enabled !== false,
    pulse_day: row?.pulse_day_enabled !== false,
    love: row?.love_enabled !== false,
    money: row?.money_enabled !== false,
    work: row?.work_enabled !== false,
    assistant: row?.assistant_enabled !== false,
    natal: row?.natal_enabled !== false,
    premium: row?.premium_enabled !== false,
    synastry: row?.synastry_enabled !== false,
    evening_summary: row?.evening_summary_enabled !== false,
  };
}

function preferenceForType(type: RetentionNotificationType): keyof PreferenceFlags {
  if (type === 'daily_card') return 'daily_card';
  if (type === 'sign_daily' || type === 'weekly_horoscope' || type === 'sunday_summary') return 'daily_card';
  if (type === 'compatibility') return 'synastry';
  if (type === 'premium_expiring') return 'premium';
  if (type === 'pulse_day') return 'pulse_day';
  if (type === 'love') return 'love';
  if (type === 'money') return 'money';
  if (type === 'work') return 'work';
  if (type === 'assistant') return 'assistant';
  if (type === 'natal_free' || type === 'birth_data_missing' || type === 'birth_time_missing') return 'natal';
  if (type === 'premium') return 'premium';
  if (type === 'synastry') return 'synastry';
  if (type === 'personal_day') return 'evening_summary';
  return 'enabled';
}

export function detectUserSegments(context: Omit<PersonalizationContext, 'segments'>): RetentionSegment[] {
  const segments = new Set<RetentionSegment>();
  if (!context.hasBirthDate || !context.hasBirthPlace) segments.add('new_user_no_birth_data');
  if (context.hasBirthDate && !context.hasBirthTime) segments.add('birth_data_no_time');
  if (!context.isPremium && context.hasPrimaryChart && !context.recentScreens.includes('natal') && !context.recentScreens.includes('chart')) {
    segments.add('free_natal_ready_not_opened');
  }
  if (!context.isPremium && context.recentScreens.some((s) => s === 'natal' || s === 'chart')) {
    segments.add('free_natal_opened_no_premium');
  }
  if (context.daysInactive >= 14) segments.add('inactive_14_days');
  else if (context.daysInactive >= 7) segments.add('inactive_7_days');
  else if (context.daysInactive >= 2) segments.add('inactive_2_days');
  if (context.daysInactive < 2 && !context.isPremium) segments.add('daily_active_free');
  if (context.daysInactive < 2 && context.isPremium) segments.add('daily_active_premium');
  if (context.interests.love >= 2) segments.add('love_interested');
  if (context.interests.money >= 2) segments.add('money_interested');
  if (context.interests.work >= 2) segments.add('work_interested');
  if (context.interests.assistant >= 2) segments.add('assistant_user');
  if (!context.isPremium && context.lockedBlockEvents > 0) segments.add('high_intent_premium');
  return [...segments];
}

function typeToSection(type: RetentionNotificationType) {
  const map: Record<RetentionNotificationType, string> = {
    daily_card: 'daily_card',
    sign_daily: 'horoscope',
    weekly_horoscope: 'horoscope',
    compatibility: 'synastry',
    birthday: 'horoscope',
    premium_expiring: 'premium',
    sunday_summary: 'horoscope',
    pulse_day: 'pulse_day',
    assistant: 'assistant',
    natal_free: 'natal_free',
    love: 'love',
    money: 'money',
    work: 'work',
    personal_day: 'checkin',
    synastry: 'synastry',
    premium: 'premium',
    inactive_2d: 'daily_card',
    inactive_7d: 'daily_card',
    inactive_14d: 'daily_card',
    birth_data_missing: 'natal_free',
    birth_time_missing: 'natal_free',
    unfinished_action: 'assistant',
  };
  return map[type];
}

function baseVariables(context: PersonalizationContext): NotificationRenderVariables {
  const card = context.preparedDailyCard || preparedCardFromPulse(context.todayPulse);
  const peak = context.todayPulse?.peakPoint || context.todayPulse?.currentPoint || null;
  const avoid = context.todayPulse?.currentPoint?.avoid?.[0] || card.cautionText || 'резкие решения';
  const firstName = String(context.user.name || '').split(/\s+/)[0] || '';
  const signKey = context.user.birthDate ? sunSignFromDate(context.user.birthDate) : null;
  const sign = signKey ? getZodiacSign('ru', signKey) : '';
  return {
    first_name: firstName || 'ты',
    name: firstName || 'ты',
    sign: sign || firstName || 'ты',
    daily_theme: card.theme,
    daily_summary: card.summary,
    pulse_window: pulseWindow(context.todayPulse, peak),
    best_action: context.todayPulse?.currentPoint?.bestFor?.[0] || 'выбрать одно дело',
    avoid_action: avoid,
    interest_topic: 'раздел',
    locked_topic: 'полную карту',
    days_inactive: context.daysInactive,
    unfinished_action: 'закончить настройку',
  };
}

const FALLBACK_COPY: Record<RetentionNotificationType, { title: string; body: string; button: string }> = {
  daily_card: {
    title: '{{sign}}, привет',
    body: 'Глянь свой день на сегодня — там пара любопытных моментов.',
    button: 'Открыть мой день',
  },
  sign_daily: {
    title: '{{sign}}, привет',
    body: 'Ты гороскоп на сегодня смотрел? Там коротко и по делу.',
    button: 'Открыть гороскоп',
  },
  weekly_horoscope: {
    title: 'Гороскоп на неделю готов',
    body: 'Один главный сюжет недели и пара тёплых советов — загляни.',
    button: 'Открыть гороскоп',
  },
  compatibility: {
    title: 'Проверь совместимость',
    body: 'Узнай, насколько вы совпадаете — по знакам за секунду или по картам подробно.',
    button: 'Проверить совместимость',
  },
  birthday: {
    title: 'С днём рождения ✨',
    body: 'Пусть год будет добрым к тебе. Загляни — у нас для тебя кое-что тёплое на сегодня.',
    button: 'Открыть',
  },
  premium_expiring: {
    title: 'Premium скоро закончится',
    body: 'Через пару дней полный доступ закроется. Если пригодился — можно продлить за минуту.',
    button: 'Продлить Premium',
  },
  sunday_summary: {
    title: 'Итог недели',
    body: 'Спокойный вечер — хороший момент оглянуться на неделю и наметить пару шагов на следующую.',
    button: 'Открыть',
  },
  pulse_day: {
    title: 'Есть ориентир по дню',
    body: 'Сейчас лучше свериться с окном дня. Подходит: {{best_action}}. Лучше не тащить: {{avoid_action}}.',
    button: 'Посмотреть пульс дня',
  },
  assistant: {
    title: 'Можно быстро проверить действие',
    body: 'Если есть вопрос, выбери действие в личном помощнике: написать, купить, поговорить, работать или отдыхать.',
    button: 'Спросить Lumia',
  },
  natal_free: {
    title: 'Твоя карта готова',
    body: 'Рассказали о тебе простым языком: характер, отношения, работа и что иногда мешает.',
    button: 'Открыть мою карту',
  },
  love: {
    title: 'Про отношения на сегодня',
    body: 'Сегодня смотри не на слова, а на поступки. В разделе Любовь есть подсказка на день.',
    button: 'Открыть любовь',
  },
  money: {
    title: 'Перед покупкой лучше сделать паузу',
    body: 'День больше подходит для проверки вариантов, чем для импульса. Открой деньги и сравни спокойно.',
    button: 'Открыть деньги',
  },
  work: {
    title: 'Рабочее окно лучше не распылять',
    body: 'Выбери одно конкретное дело и доведи его до результата. Внутри видно, какой формат задачи подойдёт лучше.',
    button: 'Открыть работу',
  },
  personal_day: {
    title: 'День почти закрыт',
    body: 'Отметь вечер: фокус, настроение и совпал ли ориентир дня. Так Lumia будет точнее завтра.',
    button: 'Отметить день',
  },
  synastry: {
    title: 'Можно проверить союз',
    body: 'Если есть человек, с которым всё непросто, в Союзе видно, где чаще возникают совпадения и конфликты.',
    button: 'Проверить союз',
  },
  premium: {
    title: 'Хочешь копнуть глубже?',
    body: 'В бесплатной карте — главное. В полной можно копнуть отношения, деньги и привычные сценарии.',
    button: 'Открыть полную карту',
  },
  inactive_2d: {
    title: 'Глянь, что на сегодня',
    body: 'Загляни на минуту — что сегодня лучше сделать, а где не давить. Без длинного текста.',
    button: 'Открыть Lumia',
  },
  inactive_7d: {
    title: 'Загляни, давно тебя не было',
    body: 'Неделя могла пройти на автомате. Глянь, где сейчас стоит вернуть внимание.',
    button: 'Вернуться',
  },
  inactive_14d: {
    title: 'Можно начать с малого',
    body: 'Открой свой день: там главное и конкретный совет, без лишнего шума.',
    button: 'Открыть',
  },
  birth_data_missing: {
    title: 'Нужны данные рождения',
    body: 'Без даты и места рождения карта не построится. Заполни — и увидишь первый рассказ о себе.',
    button: 'Заполнить данные',
  },
  birth_time_missing: {
    title: 'Можно уточнить карту',
    body: 'Без времени рождения часть карты получится общей. Добавь время — и разбор станет точнее про тебя.',
    button: 'Добавить время',
  },
  unfinished_action: {
    title: 'Можно закончить настройку',
    body: '{{unfinished_action}} займёт меньше минуты. После этого Lumia покажет следующий полезный шаг.',
    button: 'Продолжить',
  },
};

function jobAllowedTypes(jobType: RetentionJobType): RetentionNotificationType[] {
  // Сценарии 'pulse_day' и 'personal_day' убраны — таких фич в приложении нет.
  if (jobType === 'morning-retention-planner') return ['birthday', 'birth_data_missing', 'birth_time_missing', 'natal_free', 'daily_card', 'assistant'];
  if (jobType === 'midday-retention-planner') return ['work', 'money', 'love', 'sign_daily', 'compatibility', 'assistant'];
  if (jobType === 'evening-retention-planner') return ['premium_expiring', 'sunday_summary', 'love', 'money', 'compatibility', 'synastry', 'premium'];
  if (jobType === 'inactive-user-reactivation') return ['inactive_2d', 'inactive_7d', 'inactive_14d'];
  if (jobType === 'premium-conversion-planner') return ['premium_expiring', 'premium'];
  if (jobType === 'unfinished-action-reminder') return ['unfinished_action', 'birth_data_missing', 'birth_time_missing'];
  if (jobType === 'weekly-summary-generator') return ['weekly_horoscope'];
  if (jobType === 'admin-campaign-runner') return ['daily_card', 'sign_daily', 'premium'];
  return [];
}

function candidatePriority(type: RetentionNotificationType, context: PersonalizationContext) {
  const base: Record<RetentionNotificationType, number> = {
    birth_data_missing: 1000,
    birth_time_missing: 950,
    natal_free: 900,
    daily_card: context.isPremium ? 820 : 760,
    sign_daily: 600,
    weekly_horoscope: 770,
    compatibility: 540,
    birthday: 1200,
    premium_expiring: 880,
    sunday_summary: 700,
    pulse_day: 740,
    assistant: 650,
    love: 620 + context.interests.love * 10,
    money: 610 + context.interests.money * 10,
    work: 610 + context.interests.work * 10,
    personal_day: 800,
    premium: 520 + context.lockedBlockEvents * 50,
    synastry: 580 + context.interests.synastry * 10,
    inactive_2d: 700,
    inactive_7d: 730,
    inactive_14d: 750,
    unfinished_action: 860,
  };
  return base[type];
}

function localWeekday(localDate: string): number {
  // 0 = воскресенье. Считаем по локальной дате пользователя (YYYY-MM-DD), без влияния таймзоны сервера.
  const d = new Date(`${localDate}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? -1 : d.getUTCDay();
}

function candidateAllowed(type: RetentionNotificationType, context: PersonalizationContext) {
  if (!context.preferences.enabled) return false;
  if (!context.preferences[preferenceForType(type)]) return false;
  if (type === 'birth_data_missing') return !context.hasBirthDate || !context.hasBirthPlace;
  if (type === 'birth_time_missing') return context.hasBirthDate && context.hasBirthPlace && !context.hasBirthTime;
  if (type === 'natal_free') return context.hasPrimaryChart && context.segments.includes('free_natal_ready_not_opened');
  if (type === 'premium') return !context.isPremium && context.lockedBlockEvents > 0;
  if (type === 'personal_day') return context.localHour >= 18 && context.localHour <= 22;
  if (type === 'pulse_day') return !!context.todayPulse && context.localHour >= 12 && context.localHour < 18;
  if (type === 'daily_card') return context.hasPrimaryChart && context.localHour >= 7 && context.localHour < 12;
  // Дневной гороскоп по знаку — для всех, у кого есть знак (дата рождения), днём.
  if (type === 'sign_daily') return context.hasBirthDate && context.localHour >= 11 && context.localHour < 16;
  // Недельный гороскоп — таймингом управляет недельный планировщик (понедельник).
  if (type === 'weekly_horoscope') return context.hasBirthDate;
  if (type === 'compatibility') return context.localHour >= 12 && context.localHour < 21;
  // Поздравление с днём рождения — один раз в день рождения, утром.
  if (type === 'birthday') return context.isBirthdayToday && context.localHour >= 8 && context.localHour < 13;
  // Premium заканчивается (за 3 дня) или только что закончился (до 2 дней назад) — мягкое напоминание.
  if (type === 'premium_expiring') return context.premiumDaysLeft != null && context.premiumDaysLeft <= 3 && context.premiumDaysLeft >= -2;
  // Воскресный итог недели — вечером в воскресенье, тем у кого есть карта/знак.
  if (type === 'sunday_summary') return context.hasBirthDate && localWeekday(context.localDate) === 0 && context.localHour >= 17 && context.localHour < 22;
  if (type === 'inactive_2d') return context.daysInactive >= 2 && context.daysInactive < 7;
  if (type === 'inactive_7d') return context.daysInactive >= 7 && context.daysInactive < 14;
  if (type === 'inactive_14d') return context.daysInactive >= 14;
  if (type === 'love') return context.interests.love >= 2;
  if (type === 'money') return context.interests.money >= 2;
  if (type === 'work') return context.interests.work >= 2;
  if (type === 'assistant') return context.interests.assistant >= 1 || context.localHour < 12;
  return true;
}

function segmentForType(type: RetentionNotificationType, context: PersonalizationContext): RetentionSegment | null {
  if (type === 'birth_data_missing') return 'new_user_no_birth_data';
  if (type === 'birth_time_missing') return 'birth_data_no_time';
  if (type === 'natal_free') return 'free_natal_ready_not_opened';
  if (type === 'premium') return context.segments.includes('high_intent_premium') ? 'high_intent_premium' : 'free_natal_opened_no_premium';
  if (type === 'inactive_2d') return 'inactive_2_days';
  if (type === 'inactive_7d') return 'inactive_7_days';
  if (type === 'inactive_14d') return 'inactive_14_days';
  if (type === 'love') return 'love_interested';
  if (type === 'money') return 'money_interested';
  if (type === 'work') return 'work_interested';
  if (type === 'assistant') return 'assistant_user';
  return context.isPremium ? 'daily_active_premium' : 'daily_active_free';
}

function sectionRecentlyOpened(type: RetentionNotificationType, context: PersonalizationContext) {
  const section = typeToSection(type);
  if (section === 'daily_card') return context.recentScreens.includes('daily_card') || context.recentScreens.includes('today');
  if (section === 'pulse_day') return context.recentScreens.includes('pulse') || context.recentScreens.includes('pulse_day');
  if (section === 'natal_free' || section === 'natal_full') return context.recentScreens.includes('natal') || context.recentScreens.includes('chart');
  return context.recentScreens.includes(section);
}

async function listEnabledRetentionScenarios() {
  const result = await getPool().query(
    `SELECT id, key, enabled, priority, max_per_day, cooldown_hours, deep_link
     FROM notification_scenarios
     WHERE enabled = TRUE`
  );
  return result.rows.map((row: any): RetentionScenarioRow => ({
    id: Number(row.id),
    key: String(row.key),
    enabled: !!row.enabled,
    priority: Number(row.priority ?? 0),
    max_per_day: Number(row.max_per_day ?? 1),
    cooldown_hours: Number(row.cooldown_hours ?? 20),
    deep_link: String(row.deep_link || ''),
  }));
}

async function pickTemplate(scenario: RetentionScenarioRow | null, context: PersonalizationContext): Promise<RetentionTemplateRow | null> {
  if (!scenario) return null;
  const result = await getPool().query(
    `SELECT t.*, a.public_url AS asset_public_url
     FROM notification_templates t
     LEFT JOIN notification_assets a ON a.id = t.asset_id
     WHERE t.scenario_id = $1 AND t.is_active = TRUE
     ORDER BY t.sort_order ASC, t.id ASC`,
    [scenario.id]
  );
  const rows = result.rows;
  if (!rows.length) return null;
  const total = rows.reduce((sum: number, row: any) => sum + Math.max(1, Number(row.weight ?? 100)), 0);
  let hash = 2166136261 >>> 0;
  const seed = `${context.user.id}:${context.localDate}:${scenario.key}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let cursor = hash % total;
  const picked = rows.find((row: any) => {
    cursor -= Math.max(1, Number(row.weight ?? 100));
    return cursor < 0;
  }) || rows[0];
  return {
    id: Number(picked.id),
    scenario_id: picked.scenario_id != null ? Number(picked.scenario_id) : null,
    title: String(picked.title || picked.name || ''),
    body: String(picked.body || picked.text || ''),
    button_text: String(picked.button_text || ''),
    deep_link: String(picked.deep_link || ''),
    weight: Number(picked.weight ?? 100),
    asset_id: picked.asset_id != null ? Number(picked.asset_id) : null,
    asset_public_url: picked.asset_public_url || null,
  };
}

function scheduleJitterMs(seed: string, maxMinutes = 30): number {
  // Детерминированный сдвиг 0..maxMinutes по (id+сценарий): рассылка «размазывается» во времени,
  // а не уходит всем в одну и ту же минуту. Стабилен между прогонами планировщика.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % (maxMinutes * 60)) * 1000;
}

export function pickRetentionCandidate(
  context: PersonalizationContext,
  scenarios: RetentionScenarioRow[],
  allowedTypes: RetentionNotificationType[] = []
): RetentionCandidate | null {
  if (!context.preferences.enabled) return null;
  if (isWithinQuietHours(context.localTime, context.quietHoursStart, context.quietHoursEnd)) return null;
  if (context.ignoredLastCount >= IGNORED_LIMIT && !context.segments.some((s) => s.startsWith('inactive_'))) return null;
  if (context.notificationsSentToday >= (context.isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT)) return null;

  const types = allowedTypes.length ? allowedTypes : (Object.keys(FALLBACK_COPY) as RetentionNotificationType[]);
  const candidates = types
    .filter((type) => candidateAllowed(type, context))
    .filter((type) => !sectionRecentlyOpened(type, context))
    .map((type) => {
      const scenario = scenarios.find((item) => item.key === type) || null;
      return {
        type,
        scenario,
        priority: (scenario?.priority ?? 0) + candidatePriority(type, context),
      };
    })
    .filter((item) => item.scenario?.enabled);

  const picked = candidates.sort((a, b) => b.priority - a.priority || a.type.localeCompare(b.type))[0];
  if (!picked) return null;
  const fallback = FALLBACK_COPY[picked.type];
  return {
    type: picked.type,
    segment: segmentForType(picked.type, context),
    scenario: picked.scenario,
    template: null,
    priority: picked.priority,
    reason: `planner:${picked.type}`,
    section: typeToSection(picked.type),
    buttonText: fallback.button,
    variables: {
      ...baseVariables(context),
      interest_topic: picked.type,
      days_inactive: context.daysInactive,
    },
    fallbackTitle: fallback.title,
    fallbackBody: fallback.body,
    scheduledAt: new Date(Date.now() + scheduleJitterMs(`${context.user.id}:${picked.type}`)),
    dedupeKey: picked.type,
  };
}

async function listRecipients(limit = 250): Promise<RecipientRow[]> {
  const result = await getPool().query(
    `SELECT u.id,
            u.name,
            u.birth_date,
            u.birth_time,
            u.birth_place,
            u.premium_until,
            u.last_login,
            COALESCE(u.language, 'ru') AS language,
            nc.id AS chart_id,
            nc.timezone AS chart_timezone
     FROM users u
     LEFT JOIN LATERAL (
       SELECT * FROM natal_charts c
       WHERE c.user_id = u.id
       ORDER BY c.is_primary DESC NULLS LAST, c.id ASC
       LIMIT 1
     ) nc ON TRUE
     ORDER BY COALESCE(u.last_login, u.created_at) DESC NULLS LAST, u.id DESC
     LIMIT $1`,
    [Math.max(1, Math.min(limit, 2000))]
  );
  return result.rows.map((row: any) => ({
    id: String(row.id),
    name: row.name || null,
    birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : null,
    birthTime: row.birth_time ? String(row.birth_time).slice(0, 5) : null,
    birthPlace: row.birth_place || null,
    premiumUntil: row.premium_until ? new Date(row.premium_until).toISOString() : null,
    lastLogin: row.last_login ? new Date(row.last_login).toISOString() : null,
    language: row.language || 'ru',
    chartId: row.chart_id != null ? Number(row.chart_id) : null,
    chartTimezone: row.chart_timezone || null,
    hasPrimaryChart: row.chart_id != null,
  }));
}

async function recentScreens(userId: string, sinceMinutes: number) {
  const result = await getPool().query(
    `SELECT DISTINCT COALESCE(NULLIF(section, ''), payload_json->>'screen') AS screen
     FROM user_app_events
     WHERE user_id = $1
       AND occurred_at >= NOW() - ($2::int * INTERVAL '1 minute')
       AND COALESCE(NULLIF(section, ''), payload_json->>'screen') IS NOT NULL`,
    [userId, sinceMinutes]
  );
  return result.rows.map((row: any) => String(row.screen)).filter(Boolean);
}

async function interestScores(userId: string) {
  const result = await getPool().query(
    `SELECT COALESCE(NULLIF(section, ''), payload_json->>'screen') AS screen, COUNT(*)::int AS count
     FROM user_app_events
     WHERE user_id = $1
       AND occurred_at >= NOW() - INTERVAL '30 days'
     GROUP BY 1`,
    [userId]
  );
  const scores = { love: 0, money: 0, work: 0, assistant: 0, synastry: 0 };
  for (const row of result.rows) {
    const screen = String(row.screen || '');
    const count = Number(row.count || 0);
    if (screen.includes('love')) scores.love += count;
    if (screen.includes('money')) scores.money += count;
    if (screen.includes('work')) scores.work += count;
    if (screen.includes('assistant')) scores.assistant += count;
    if (screen.includes('synastry') || screen.includes('union')) scores.synastry += count;
  }
  return scores;
}

async function getPreparedDailyCard(userId: string, dateKey: string): Promise<PreparedDailyCard | null> {
  const result = await getPool().query(`SELECT * FROM daily_cards WHERE user_id = $1 AND date = $2::date LIMIT 1`, [userId, dateKey]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    theme: row.theme || '',
    summary: row.summary || '',
    loveText: row.love_text || '',
    workText: row.work_text || '',
    moneyText: row.money_text || '',
    cautionText: row.caution_text || '',
    adviceText: row.advice_text || '',
  };
}

export async function buildPersonalizationContext(userId: string, now = new Date()): Promise<PersonalizationContext> {
  const result = await getPool().query(
    `SELECT u.id, u.name, u.birth_date, u.birth_time, u.birth_place, u.premium_until, u.last_login,
            COALESCE(u.language, 'ru') AS language, nc.id AS chart_id, nc.timezone AS chart_timezone
     FROM users u
     LEFT JOIN LATERAL (
       SELECT * FROM natal_charts c WHERE c.user_id = u.id ORDER BY c.is_primary DESC NULLS LAST, c.id ASC LIMIT 1
     ) nc ON TRUE
     WHERE u.id = $1`,
    [userId]
  );
  if (!result.rows[0]) throw new Error('USER_NOT_FOUND');
  const row = result.rows[0];
  const user: RecipientRow = {
    id: String(row.id),
    name: row.name || null,
    birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : null,
    birthTime: row.birth_time ? String(row.birth_time).slice(0, 5) : null,
    birthPlace: row.birth_place || null,
    premiumUntil: row.premium_until ? new Date(row.premium_until).toISOString() : null,
    lastLogin: row.last_login ? new Date(row.last_login).toISOString() : null,
    language: row.language || 'ru',
    chartId: row.chart_id != null ? Number(row.chart_id) : null,
    chartTimezone: row.chart_timezone || null,
    hasPrimaryChart: row.chart_id != null,
  };
  return buildContextForRecipient(user, now);
}

async function buildContextForRecipient(user: RecipientRow, now: Date): Promise<PersonalizationContext> {
  const pool = getPool();
  const settings = await pool.query(`SELECT * FROM user_notification_settings WHERE user_id = $1`, [user.id]);
  const settingsRow = settings.rows[0] || {};
  const timezone = safeTimezone(settingsRow.timezone || user.chartTimezone);
  const info = localInfo(now, timezone);
  const resolved = user.hasPrimaryChart
    ? await resolveTodayPulseForUser({ userId: user.id, dateKey: info.localDate }).catch(() => null)
    : null;
  const pulse = resolved?.status === 'ready' ? resolved.pulse : null;
  const preparedDailyCard = await getPreparedDailyCard(user.id, info.localDate).catch(() => null);
  const recent = await recentScreens(user.id, RECENT_OPEN_MINUTES).catch(() => []);
  const interests = await interestScores(user.id).catch(() => ({ love: 0, money: 0, work: 0, assistant: 0, synastry: 0 }));
  const logStats = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'sent' AND sent_at::date = $2::date)::int AS sent_today,
       MAX(notification_type) FILTER (WHERE status = 'sent') AS last_queue_type,
       MAX(template_id) FILTER (WHERE status = 'sent') AS last_template_id
     FROM scheduled_notifications
     WHERE user_id = $1`,
    [user.id, info.localDate]
  ).catch(() => ({ rows: [{}] } as any));
  const ignored = await pool.query(
    `WITH last_sent AS (
       SELECT sn.id
       FROM scheduled_notifications sn
       WHERE sn.user_id = $1 AND sn.status = 'sent'
       ORDER BY sn.sent_at DESC NULLS LAST
       LIMIT 5
     )
     SELECT COUNT(*)::int AS ignored
     FROM last_sent ls
     WHERE NOT EXISTS (
       SELECT 1 FROM notification_events e
       WHERE e.notification_id = ls.id AND e.event_type IN ('clicked', 'opened_app', 'opened_target_screen')
     )`,
    [user.id]
  ).catch(() => ({ rows: [{ ignored: 0 }] } as any));
  const locked = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM user_app_events
     WHERE user_id = $1
       AND occurred_at >= NOW() - INTERVAL '7 days'
       AND (event_type ILIKE '%locked%' OR event_type ILIKE '%paywall%' OR payload_json::text ILIKE '%locked%')`,
    [user.id]
  ).catch(() => ({ rows: [{ count: 0 }] } as any));

  // День рождения сегодня (по локальной дате пользователя, сравниваем месяц-день).
  const birthMd = user.birthDate ? String(user.birthDate).slice(5, 10) : '';
  const isBirthdayToday = !!birthMd && info.localDate.slice(5, 10) === birthMd;
  // Дней до конца премиума (отрицательное — уже истёк).
  const premiumDaysLeft = user.premiumUntil
    ? Math.ceil((new Date(user.premiumUntil).getTime() - now.getTime()) / 86_400_000)
    : null;

  const base = {
    user,
    timezone,
    localDate: info.localDate,
    localTime: info.localTime,
    localHour: info.localHour,
    isPremium: !!(user.premiumUntil && new Date(user.premiumUntil).getTime() > now.getTime()),
    isBirthdayToday,
    premiumDaysLeft,
    hasBirthDate: !!user.birthDate,
    hasBirthTime: !!user.birthTime,
    hasBirthPlace: !!user.birthPlace,
    hasPrimaryChart: user.hasPrimaryChart,
    todayPulse: pulse,
    preparedDailyCard,
    recentScreens: recent,
    lockedBlockEvents: Number(locked.rows[0]?.count || 0),
    daysInactive: dateDiffDays(user.lastLogin, now),
    daysWithoutClick: 0,
    ignoredLastCount: Number(ignored.rows[0]?.ignored || 0),
    notificationsSentToday: Number(logStats.rows[0]?.sent_today || 0),
    lastNotificationType: logStats.rows[0]?.last_queue_type || null,
    lastTemplateId: logStats.rows[0]?.last_template_id != null ? Number(logStats.rows[0].last_template_id) : null,
    preferences: defaultPreferences(settingsRow),
    quietHoursStart: settingsRow.quiet_hours_start ? String(settingsRow.quiet_hours_start).slice(0, 5) : '22:00',
    quietHoursEnd: settingsRow.quiet_hours_end ? String(settingsRow.quiet_hours_end).slice(0, 5) : '08:00',
    interests,
  };
  const state = await pool.query(`SELECT days_without_click FROM user_notification_state WHERE user_id = $1`, [user.id]).catch(() => ({ rows: [] } as any));
  const withClickDays = {
    ...base,
    daysWithoutClick: Number(state.rows[0]?.days_without_click ?? base.daysInactive),
  };
  return {
    ...withClickDays,
    segments: detectUserSegments(withClickDays),
  };
}

async function createCandidate(context: PersonalizationContext, scenarios: RetentionScenarioRow[], allowedTypes: RetentionNotificationType[]) {
  const picked = pickRetentionCandidate(context, scenarios, allowedTypes);
  if (!picked) return null;
  const template = await pickTemplate(picked.scenario, context);
  return { ...picked, template };
}

function renderCandidate(candidate: RetentionCandidate) {
  const raw = {
    title: candidate.template?.title || candidate.fallbackTitle,
    body: candidate.template?.body || candidate.fallbackBody,
    buttonText: candidate.template?.button_text || candidate.buttonText,
  };
  const rendered = renderNotificationTemplate(raw, candidate.variables);
  const forbidden = findForbiddenNotificationTerms(rendered.caption);
  if (forbidden.length) {
    throw new Error(`FORBIDDEN_NOTIFICATION_TONE:${forbidden.join(',')}`);
  }
  return rendered;
}

export async function enqueueNotification(candidate: RetentionCandidate, context: PersonalizationContext) {
  const rendered = renderCandidate(candidate);
  const deepLink = buildNotificationDeepLink({
    baseUrl: appBaseUrl(),
    section: candidate.template?.deep_link || candidate.scenario?.deep_link || candidate.section,
    scenarioKey: candidate.scenario?.key || candidate.type,
    segment: candidate.segment,
    variant: candidate.template?.id ? String(candidate.template.id) : 'fallback',
  });
  const payload = {
    title: rendered.title,
    body: rendered.body,
    caption: rendered.caption,
    buttonText: rendered.buttonText,
    deepLink,
    section: candidate.section,
    variables: candidate.variables,
    assetPublicUrl: candidate.template?.asset_public_url || null,
  };
  const result = await getPool().query(
    `INSERT INTO scheduled_notifications (
       user_id, notification_type, segment, campaign_id, scenario_id, template_id, status,
       scheduled_at, reason, local_date, dedupe_key, payload_json
     )
     VALUES ($1, $2, $3, NULL, $4, $5, 'scheduled', $6, $7, $8::date, $9, $10::jsonb)
     ON CONFLICT (user_id, notification_type, local_date, dedupe_key)
       WHERE status IN ('scheduled', 'sending', 'sent') AND local_date IS NOT NULL AND dedupe_key IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [
      context.user.id,
      candidate.type,
      candidate.segment,
      candidate.scenario?.id ?? null,
      candidate.template?.id ?? null,
      candidate.scheduledAt,
      candidate.reason,
      context.localDate,
      candidate.dedupeKey,
      JSON.stringify(payload),
    ]
  );
  return { enqueued: !!result.rows[0], id: result.rows[0] ? Number(result.rows[0].id) : null, payload };
}

export async function planRetentionNotifications(
  jobType: RetentionJobType,
  now: Date = new Date(),
  options?: { limit?: number; userId?: string | null; dryRun?: boolean }
) {
  const scenarios = await listEnabledRetentionScenarios();
  const allowedTypes = jobAllowedTypes(jobType);
  const recipients = options?.userId
    ? [await buildPersonalizationContext(options.userId, now).then((ctx) => ctx.user)]
    : await listRecipients(options?.limit ?? 250);
  const results: Array<{ userId: string; status: string; type?: string; detail?: string; id?: number | null }> = [];
  let enqueued = 0;

  for (const recipient of recipients) {
    try {
      const context = await buildContextForRecipient(recipient, now);
      const candidate = await createCandidate(context, scenarios, allowedTypes);
      if (!candidate) {
        results.push({ userId: recipient.id, status: 'skipped', detail: 'no_candidate' });
        continue;
      }
      if (options?.dryRun) {
        results.push({ userId: recipient.id, status: 'dry_run', type: candidate.type, detail: candidate.reason });
        continue;
      }
      const queued = await enqueueNotification(candidate, context);
      if (queued.enqueued) enqueued += 1;
      results.push({
        userId: recipient.id,
        status: queued.enqueued ? 'enqueued' : 'duplicate',
        type: candidate.type,
        id: queued.id,
      });
    } catch (error: any) {
      results.push({ userId: recipient.id, status: 'failed', detail: error?.message || 'error' });
    }
  }

  return {
    ok: results.every((item) => item.status !== 'failed'),
    jobType,
    total: recipients.length,
    enqueued,
    results,
  };
}

function appBaseUrl() {
  return (
    process.env.TELEGRAM_MINI_APP_URL ||
    process.env.NEXT_PUBLIC_TELEGRAM_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).trim();
}

function absoluteAssetUrl(publicUrl: string) {
  const url = String(publicUrl || '').trim();
  if (!url || /^https?:\/\//i.test(url)) return url;
  const base = appBaseUrl();
  if (!base) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

async function lockDueNotifications(now: Date, limit: number) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      // Берём максимум ОДИН созревший пуш на юзера за прогон (rn = 1), и только если этому юзеру
      // ничего не уходило за последние NOTIFICATION_MIN_GAP_HOURS часов. Спам/дубли невозможны структурно.
      `WITH due AS (
         SELECT sn.id,
                ROW_NUMBER() OVER (PARTITION BY sn.user_id ORDER BY sn.scheduled_at ASC, sn.id ASC) AS rn
         FROM scheduled_notifications sn
         WHERE sn.status = 'scheduled'
           AND sn.scheduled_at <= $1
           AND (sn.next_retry_at IS NULL OR sn.next_retry_at <= $1)
           AND NOT EXISTS (
             SELECT 1 FROM scheduled_notifications prev
             WHERE prev.user_id = sn.user_id
               AND prev.status = 'sent'
               AND prev.sent_at > $1::timestamptz - (INTERVAL '1 hour' * $3)
           )
       )
       SELECT sn.*, u.name AS user_name
       FROM scheduled_notifications sn
       JOIN due ON due.id = sn.id AND due.rn = 1
       LEFT JOIN users u ON u.id = sn.user_id
       ORDER BY sn.scheduled_at ASC, sn.id ASC
       LIMIT $2
       FOR UPDATE OF sn SKIP LOCKED`,
      [now, Math.max(1, Math.min(limit, 500)), NOTIFICATION_MIN_GAP_HOURS]
    );
    const ids = result.rows.map((row: any) => Number(row.id));
    if (ids.length) {
      await client.query(
        `UPDATE scheduled_notifications
         SET status = 'sending', locked_at = CURRENT_TIMESTAMP, attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1::bigint[])`,
        [ids]
      );
    }
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function previewDueNotifications(now: Date, limit: number) {
  const result = await getPool().query(
    `WITH due AS (
       SELECT sn.id,
              ROW_NUMBER() OVER (PARTITION BY sn.user_id ORDER BY sn.scheduled_at ASC, sn.id ASC) AS rn
       FROM scheduled_notifications sn
       WHERE sn.status = 'scheduled'
         AND sn.scheduled_at <= $1
         AND (sn.next_retry_at IS NULL OR sn.next_retry_at <= $1)
         AND NOT EXISTS (
           SELECT 1 FROM scheduled_notifications prev
           WHERE prev.user_id = sn.user_id
             AND prev.status = 'sent'
             AND prev.sent_at > $1::timestamptz - (INTERVAL '1 hour' * $3)
         )
     )
     SELECT sn.*, u.name AS user_name
     FROM scheduled_notifications sn
     JOIN due ON due.id = sn.id AND due.rn = 1
     LEFT JOIN users u ON u.id = sn.user_id
     ORDER BY sn.scheduled_at ASC, sn.id ASC
     LIMIT $2`,
    [now, Math.max(1, Math.min(limit, 500)), NOTIFICATION_MIN_GAP_HOURS]
  );
  return result.rows;
}

async function createNotificationLogFromQueue(row: any, payload: any) {
  const result = await getPool().query(
    `INSERT INTO notification_logs (
       user_id, scenario_id, scenario_key, template_id, media_asset_id, status, payload_json
     )
     VALUES ($1, $2, $3, $4, NULL, 'pending', $5::jsonb)
     RETURNING id`,
    [
      row.user_id,
      row.scenario_id,
      row.notification_type,
      row.template_id,
      JSON.stringify({
        ...payload,
        queueId: row.id,
        campaignId: row.campaign_id ?? null,
        segment: row.segment ?? null,
      }),
    ]
  );
  return Number(result.rows[0].id);
}

async function recordEvent(input: {
  notificationId?: number | null;
  notificationLogId?: number | null;
  campaignId?: number | null;
  userId: string;
  notificationType?: string | null;
  eventType: string;
  screen?: string | null;
  source?: string | null;
  metadata?: Record<string, any>;
}) {
  await getPool().query(
    `INSERT INTO notification_events (
       notification_id, notification_log_id, campaign_id, user_id, notification_type, event_type, screen, source, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      input.notificationId ?? null,
      input.notificationLogId ?? null,
      input.campaignId ?? null,
      input.userId,
      input.notificationType ?? null,
      input.eventType,
      input.screen ?? null,
      input.source ?? null,
      JSON.stringify(input.metadata || {}),
    ]
  );
}

async function markQueueResult(row: any, logId: number | null, result: { ok: boolean; messageId?: number; error?: string }, payload: any) {
  const pool = getPool();
  const status: RetentionNotificationStatus = result.ok ? 'sent' : Number(row.attempt_count || 0) >= 3 ? 'failed' : 'scheduled';
  const retryAt = result.ok ? null : new Date(Date.now() + Math.min(60, 5 * (Number(row.attempt_count || 1))) * 60000);
  await pool.query(
    `UPDATE scheduled_notifications
     SET status = $2,
         sent_at = CASE WHEN $2 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
         locked_at = NULL,
         next_retry_at = $3,
         notification_log_id = COALESCE($4, notification_log_id),
         telegram_message_id = $5,
         error = $6,
         payload_json = payload_json || $7::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      row.id,
      status,
      retryAt,
      logId,
      result.messageId ?? null,
      result.error ?? null,
      JSON.stringify({ finalDeepLink: payload.deepLink }),
    ]
  );
  if (logId) {
    await pool.query(
      `UPDATE notification_logs
       SET status = $2,
           sent_at = CASE WHEN $2 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
           telegram_message_id = $3,
           error = $4,
           payload_json = payload_json || $5::jsonb
       WHERE id = $1`,
      [logId, result.ok ? 'sent' : 'failed', result.messageId ?? null, result.error ?? null, JSON.stringify({ deepLink: payload.deepLink })]
    );
  }
  await recordEvent({
    notificationId: Number(row.id),
    notificationLogId: logId,
    campaignId: row.campaign_id != null ? Number(row.campaign_id) : null,
    userId: String(row.user_id),
    notificationType: row.notification_type,
    eventType: result.ok ? 'sent' : 'failed',
    metadata: result.ok ? { telegramMessageId: result.messageId ?? null } : { error: result.error },
  }).catch(() => undefined);
}

export async function dispatchScheduledNotifications(
  now: Date = new Date(),
  limit = 100,
  options?: { dryRun?: boolean }
) {
  const dryRun = options?.dryRun || process.env.NOTIFICATION_DRY_RUN === '1' || !process.env.BOT_TOKEN;
  const rows = dryRun ? await previewDueNotifications(now, limit) : await lockDueNotifications(now, limit);
  const results: Array<{ id: number; ok: boolean; detail: string; dryRun?: boolean }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (const row of rows) {
    const payload = json(row.payload_json, {});
    let logId: number | null = null;
    try {
      if (dryRun) {
        const deepLink = buildNotificationDeepLink({
          baseUrl: appBaseUrl(),
          section: payload.section || payload.deepLink || typeToSection(row.notification_type),
          scenarioKey: row.notification_type,
          notificationId: Number(row.id),
          campaignId: row.campaign_id != null ? Number(row.campaign_id) : null,
          segment: row.segment || null,
          variant: row.template_id != null ? String(row.template_id) : 'fallback',
        });
        successCount += 1;
        results.push({ id: Number(row.id), ok: true, detail: `dry_run:${deepLink}`, dryRun: true });
        continue;
      }

      logId = await createNotificationLogFromQueue(row, payload);
      const section = payload.section || payload.deepLink || typeToSection(row.notification_type);
      const deepLink = buildNotificationDeepLink({
        baseUrl: appBaseUrl(),
        section,
        scenarioKey: row.notification_type,
        logId,
        notificationId: Number(row.id),
        campaignId: row.campaign_id != null ? Number(row.campaign_id) : null,
        segment: row.segment || null,
        variant: row.template_id != null ? String(row.template_id) : 'fallback',
      });
      // Кнопка открывает мини-апп (t.me/<bot>?startapp=...), а не браузер. Если имя бота
      // не задано — откатываемся на web-deep-link, чтобы поведение не ломалось.
      const botUsername = await resolveBotUsername();
      const buttonUrl = buildMiniAppButtonUrl(botUsername, section, logId) || deepLink;
      const finalPayload = {
        ...payload,
        deepLink,
        buttonUrl,
      };
      const replyMarkup = buildRetentionInlineKeyboard({
        deepLink: buttonUrl,
        buttonText: payload.buttonText || 'Открыть',
        notificationId: Number(row.id),
        notificationType: row.notification_type,
      });
      const sendResult = payload.assetPublicUrl
          ? await sendTelegramPhotoMessage(String(row.user_id), absoluteAssetUrl(payload.assetPublicUrl), payload.caption || payload.body || '', { replyMarkup })
          : await sendTelegramTextMessage(String(row.user_id), payload.caption || [payload.title, payload.body].filter(Boolean).join('\n\n'), { replyMarkup });
      await markQueueResult(row, logId, sendResult, finalPayload);
      if (sendResult.ok) successCount += 1;
      else failureCount += 1;
      results.push({ id: Number(row.id), ok: sendResult.ok, detail: sendResult.ok ? 'sent' : sendResult.error || 'failed', dryRun });
    } catch (error: any) {
      failureCount += 1;
      await markQueueResult(row, logId, { ok: false, error: error?.message || 'error' }, payload).catch(() => undefined);
      results.push({ id: Number(row.id), ok: false, detail: error?.message || 'error', dryRun });
    }
  }

  return {
    ok: failureCount === 0,
    total: rows.length,
    successCount,
    failureCount,
    results,
  };
}

export async function generateDailyCards(now: Date = new Date(), options?: { limit?: number; userId?: string | null }) {
  const recipients = options?.userId
    ? [await buildPersonalizationContext(options.userId, now).then((ctx) => ctx.user)]
    : await listRecipients(options?.limit ?? 250);
  const results: Array<{ userId: string; status: string; detail?: string }> = [];
  let generated = 0;

  for (const user of recipients) {
    try {
      if (!user.hasPrimaryChart) {
        results.push({ userId: user.id, status: 'skipped', detail: 'no_chart' });
        continue;
      }
      const timezone = safeTimezone(user.chartTimezone);
      const info = localInfo(now, timezone);
      const resolved = await resolveTodayPulseForUser({ userId: user.id, dateKey: info.localDate }).catch(() => null);
      const pulse = resolved?.status === 'ready' ? resolved.pulse : null;
      const card = preparedCardFromPulse(pulse);
      await getPool().query(
        `INSERT INTO daily_cards (
           user_id, chart_id, date, theme, summary, love_text, work_text, money_text, caution_text, advice_text, payload_json, generated_at
         )
         VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, date) DO UPDATE SET
           chart_id = EXCLUDED.chart_id,
           theme = EXCLUDED.theme,
           summary = EXCLUDED.summary,
           love_text = EXCLUDED.love_text,
           work_text = EXCLUDED.work_text,
           money_text = EXCLUDED.money_text,
           caution_text = EXCLUDED.caution_text,
           advice_text = EXCLUDED.advice_text,
           payload_json = EXCLUDED.payload_json,
           generated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP`,
        [
          user.id,
          resolved?.status === 'ready' ? resolved.chartId : user.chartId,
          info.localDate,
          card.theme,
          card.summary,
          card.loveText,
          card.workText,
          card.moneyText,
          card.cautionText,
          card.adviceText,
          JSON.stringify({ pulseDate: pulse?.date || info.localDate }),
        ]
      );
      generated += 1;
      results.push({ userId: user.id, status: 'generated' });
    } catch (error: any) {
      results.push({ userId: user.id, status: 'failed', detail: error?.message || 'error' });
    }
  }
  return { ok: results.every((item) => item.status !== 'failed'), generated, total: recipients.length, results };
}

function rescheduleOutsideQuietHours(base: Date, timezone: string, quietStart = '22:00', quietEnd = '08:00') {
  let candidate = new Date(base);
  for (let i = 0; i < 48; i += 1) {
    const info = localInfo(candidate, timezone);
    if (!isWithinQuietHours(info.localTime, quietStart, quietEnd)) return candidate;
    candidate = new Date(candidate.getTime() + 30 * 60000);
  }
  return candidate;
}

export async function handleNotificationCallback(input: {
  callbackQueryId?: string | null;
  userId: string;
  data: string;
}) {
  const parts = String(input.data || '').split(':');
  if (parts[0] !== 'notif') return { ok: false, message: 'Unknown callback' };
  const action = parts[1];
  const notificationId = Number(parts[2]);
  const type = parts[3] || null;
  if (!Number.isFinite(notificationId) || notificationId < 1) return { ok: false, message: 'Bad notification id' };
  const pool = getPool();
  const row = await pool.query(`SELECT * FROM scheduled_notifications WHERE id = $1 AND user_id = $2`, [notificationId, input.userId]);
  if (!row.rows[0]) return { ok: false, message: 'Notification not found' };
  const notification = row.rows[0];

  if (action === 'later') {
    const settings = await pool.query(`SELECT timezone, quiet_hours_start, quiet_hours_end FROM user_notification_settings WHERE user_id = $1`, [input.userId]);
    const settingsRow = settings.rows[0] || {};
    const next = rescheduleOutsideQuietHours(
      new Date(Date.now() + (2 + Math.floor(Math.random() * 3)) * 3600000),
      safeTimezone(settingsRow.timezone),
      settingsRow.quiet_hours_start ? String(settingsRow.quiet_hours_start).slice(0, 5) : '22:00',
      settingsRow.quiet_hours_end ? String(settingsRow.quiet_hours_end).slice(0, 5) : '08:00'
    );
    await pool.query(
      `UPDATE scheduled_notifications
       SET status = 'scheduled', scheduled_at = $2, next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [notificationId, next]
    );
    await recordEvent({
      notificationId,
      notificationLogId: notification.notification_log_id,
      campaignId: notification.campaign_id,
      userId: input.userId,
      notificationType: notification.notification_type,
      eventType: 'later',
      metadata: { rescheduledAt: next.toISOString() },
    });
    return { ok: true, message: 'Напомним позже' };
  }

  if (action === 'mute_type') {
    const targetType = type || notification.notification_type;
    const column = preferenceColumnForNotificationType(targetType);
    if (column) {
      await pool.query(
        `INSERT INTO user_notification_settings (user_id, ${column})
         VALUES ($1, FALSE)
         ON CONFLICT (user_id) DO UPDATE SET ${column} = FALSE, updated_at = CURRENT_TIMESTAMP`,
        [input.userId]
      );
    }
    await recordEvent({
      notificationId,
      notificationLogId: notification.notification_log_id,
      campaignId: notification.campaign_id,
      userId: input.userId,
      notificationType: targetType,
      eventType: 'muted_type',
      metadata: { type: targetType },
    });
    return { ok: true, message: 'Ок, такие уведомления выключены' };
  }

  if (action === 'disable_all') {
    await pool.query(
      `INSERT INTO user_notification_settings (user_id, enabled)
       VALUES ($1, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP`,
      [input.userId]
    );
    await recordEvent({
      notificationId,
      notificationLogId: notification.notification_log_id,
      campaignId: notification.campaign_id,
      userId: input.userId,
      notificationType: notification.notification_type,
      eventType: 'disabled_all',
    });
    return { ok: true, message: 'Уведомления выключены' };
  }

  return { ok: false, message: 'Unknown callback' };
}

function preferenceColumnForNotificationType(type: string | null) {
  const key = preferenceForType(String(type || '') as RetentionNotificationType);
  const map: Record<string, string> = {
    daily_card: 'daily_card_enabled',
    pulse_day: 'pulse_day_enabled',
    love: 'love_enabled',
    money: 'money_enabled',
    work: 'work_enabled',
    assistant: 'assistant_enabled',
    natal: 'natal_enabled',
    premium: 'premium_enabled',
    synastry: 'synastry_enabled',
    evening_summary: 'evening_summary_enabled',
    enabled: 'enabled',
  };
  return map[key] || null;
}

export async function recordRetentionAttribution(input: {
  userId: string;
  notificationId?: number | null;
  notificationLogId?: number | null;
  campaignId?: number | null;
  notificationType?: string | null;
  scenarioKey?: string | null;
  section?: string | null;
  source?: string | null;
  eventType: 'clicked' | 'opened_app' | 'opened_target_screen';
  payload?: Record<string, any>;
}) {
  const pool = getPool();
  await recordEvent({
    notificationId: input.notificationId ?? null,
    notificationLogId: input.notificationLogId ?? null,
    campaignId: input.campaignId ?? null,
    userId: input.userId,
    notificationType: input.notificationType || input.scenarioKey || null,
    eventType: input.eventType,
    screen: input.section || null,
    source: input.source || 'tg_notification',
    metadata: input.payload || {},
  });
  if (input.notificationId) {
    await pool.query(
      `UPDATE scheduled_notifications
       SET payload_json = payload_json || $2::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [input.notificationId, JSON.stringify({ lastAttribution: input.eventType })]
    ).catch(() => undefined);
  }
  if (input.notificationLogId) {
    await pool.query(
      `UPDATE notification_logs
       SET clicked_at = COALESCE(clicked_at, CASE WHEN $2 = 'clicked' THEN CURRENT_TIMESTAMP ELSE clicked_at END),
           opened_at = COALESCE(opened_at, CASE WHEN $2 IN ('clicked', 'opened_app', 'opened_target_screen') THEN CURRENT_TIMESTAMP ELSE opened_at END)
       WHERE id = $1`,
      [input.notificationLogId, input.eventType]
    ).catch(() => undefined);
  }
  await pool.query(
    `INSERT INTO user_notification_state (user_id, last_opened_at, last_click_at, days_without_click)
     VALUES (
       $1,
       CASE WHEN $2 IN ('clicked', 'opened_app', 'opened_target_screen') THEN CURRENT_TIMESTAMP ELSE NULL END,
       CASE WHEN $2 = 'clicked' THEN CURRENT_TIMESTAMP ELSE NULL END,
       0
     )
     ON CONFLICT (user_id) DO UPDATE SET
       last_opened_at = CASE WHEN $2 IN ('clicked', 'opened_app', 'opened_target_screen') THEN CURRENT_TIMESTAMP ELSE user_notification_state.last_opened_at END,
       last_click_at = CASE WHEN $2 = 'clicked' THEN CURRENT_TIMESTAMP ELSE user_notification_state.last_click_at END,
       days_without_click = 0,
       updated_at = CURRENT_TIMESTAMP`,
    [input.userId, input.eventType]
  );
  return { success: true };
}

export async function listScheduledNotificationQueue(limit = 100, status?: string | null): Promise<AdminScheduledNotificationQueueItem[]> {
  const result = await getPool().query(
    `SELECT sn.*, u.name AS user_name, s.key AS scenario_key
     FROM scheduled_notifications sn
     LEFT JOIN users u ON u.id = sn.user_id
     LEFT JOIN notification_scenarios s ON s.id = sn.scenario_id
     WHERE ($2::text IS NULL OR sn.status = $2)
     ORDER BY sn.scheduled_at DESC, sn.id DESC
     LIMIT $1`,
    [Math.max(1, Math.min(limit, 500)), status || null]
  );
  return result.rows.map(serializeQueueItem);
}

function serializeQueueItem(row: any): AdminScheduledNotificationQueueItem {
  const payload = json(row.payload_json, {});
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    userName: row.user_name || null,
    notificationType: String(row.notification_type || ''),
    segment: row.segment || null,
    status: row.status,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : '',
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    attemptCount: Number(row.attempt_count || 0),
    campaignId: row.campaign_id != null ? Number(row.campaign_id) : null,
    scenarioId: row.scenario_id != null ? Number(row.scenario_id) : null,
    scenarioKey: row.scenario_key || null,
    templateId: row.template_id != null ? Number(row.template_id) : null,
    reason: row.reason || null,
    title: payload.title || '',
    body: payload.body || '',
    buttonText: payload.buttonText || '',
    deepLink: payload.finalDeepLink || payload.deepLink || '',
    telegramMessageId: row.telegram_message_id != null ? Number(row.telegram_message_id) : null,
    error: row.error || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

export async function cancelScheduledNotification(id: number) {
  const result = await getPool().query(
    `UPDATE scheduled_notifications SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status IN ('scheduled', 'failed')
     RETURNING *`,
    [id]
  );
  return !!result.rows[0];
}

export async function retryScheduledNotification(id: number) {
  const result = await getPool().query(
    `UPDATE scheduled_notifications
     SET status = 'scheduled', next_retry_at = NULL, scheduled_at = CURRENT_TIMESTAMP, locked_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status IN ('failed', 'skipped')
     RETURNING *`,
    [id]
  );
  return !!result.rows[0];
}

export async function listRetentionCampaigns(limit = 100) {
  const result = await getPool().query(
    `SELECT id,
            COALESCE(name, title, CONCAT('Campaign #', id)) AS name,
            COALESCE(type, mode, 'manual') AS type,
            COALESCE(segment, target_segment) AS segment,
            COALESCE(status, CASE WHEN sent_at IS NULL THEN 'draft' ELSE 'sent' END) AS status,
            start_at,
            end_at,
            max_sends_per_user,
            ab_test_enabled,
            total_recipients,
            success_count,
            failed_count,
            sent_at,
            created_at
     FROM notification_campaigns
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(limit, 500))]
  );
  return result.rows.map((row: any) => ({
    id: Number(row.id),
    name: String(row.name || ''),
    type: String(row.type || 'manual'),
    segment: row.segment || null,
    status: String(row.status || 'draft'),
    startAt: row.start_at ? new Date(row.start_at).toISOString() : null,
    endAt: row.end_at ? new Date(row.end_at).toISOString() : null,
    maxSendsPerUser: Number(row.max_sends_per_user || 1),
    abTestEnabled: !!row.ab_test_enabled,
    totalRecipients: Number(row.total_recipients || 0),
    successCount: Number(row.success_count || 0),
    failedCount: Number(row.failed_count || 0),
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
  }));
}
