import {
  NOTIFICATION_FORBIDDEN_PATTERNS,
  NOTIFICATION_VARIABLES,
  type NotificationDayPart,
} from './notificationScenarioCatalog';

export type NotificationRenderVariables = Record<string, string | number | boolean | string[] | null | undefined>;

export type NotificationScenarioLike = {
  key: string;
  dayPart: NotificationDayPart;
  priority: number;
  timeWindowStart: string;
  timeWindowEnd: string;
  triggerRuleJson?: Record<string, any> | null;
};

export type NotificationTemplateLike = {
  title?: string | null;
  body?: string | null;
  text?: string | null;
  buttonText?: string | null;
};

export type NotificationUserStateLike = {
  openedToday: boolean;
  acceptedFocusToday: boolean;
  completedCheckinToday?: boolean;
  completedCheckinYesterday: boolean;
  checkinStreak: number;
  daysWithoutClick: number;
};

export type NotificationDayContextLike = {
  localTime: string;
  dayPart: NotificationDayPart;
  minutesToBestSlot: number | null;
  hasBestSlot: boolean;
  hasPatternProgress: boolean;
  userState: NotificationUserStateLike;
};

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const EXTRA_NOTIFICATION_VARIABLES = [
  'daily_theme',
  'daily_summary',
  'pulse_window',
  'best_action',
  'avoid_action',
  'interest_topic',
  'locked_topic',
  'days_inactive',
  'unfinished_action',
] as const;

const STRICT_LUMIA_FORBIDDEN_PATTERNS = [
  /зв[её]зды\s+говорят/i,
  /судьб[аыеу]/i,
  /магическ/i,
  /энергетик/i,
  /энергия/i,
  /вибрац/i,
  /портал/i,
  /открой\s+сердце/i,
  /удач[аиуе]/i,
  /гороскоп\s+для\s+всех/i,
  /зайди\s+в\s+приложение/i,
  /твой\s+гороскоп\s+готов/i,
  /не\s+пропусти\s+удачу/i,
  /кармическ/i,
  /предначертан/i,
];

export function findForbiddenNotificationTerms(text: string): string[] {
  const value = String(text || '');
  return [...NOTIFICATION_FORBIDDEN_PATTERNS, ...STRICT_LUMIA_FORBIDDEN_PATTERNS]
    .filter((pattern) => pattern.test(value))
    .map((pattern) => pattern.source);
}

export function findUnknownNotificationVariables(text: string): string[] {
  const known = new Set<string>([...NOTIFICATION_VARIABLES, ...EXTRA_NOTIFICATION_VARIABLES] as readonly string[]);
  const unknown = new Set<string>();
  for (const match of String(text || '').matchAll(VARIABLE_RE)) {
    const name = match[1];
    if (!known.has(name)) unknown.add(name);
  }
  return [...unknown];
}

export function stringifyNotificationVariable(value: NotificationRenderVariables[string], fallback = ''): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  return String(value);
}

export function renderNotificationText(
  template: string,
  variables: NotificationRenderVariables,
  fallbacks: NotificationRenderVariables = {}
): string {
  return String(template || '')
    .replace(VARIABLE_RE, (_, rawName: string) => {
      const name = rawName.trim();
      return stringifyNotificationVariable(variables[name], stringifyNotificationVariable(fallbacks[name], ''));
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function renderNotificationTemplate(
  template: NotificationTemplateLike,
  variables: NotificationRenderVariables,
  fallbacks: NotificationRenderVariables = {}
) {
  const rawTitle = template.title || '';
  const rawBody = template.body || template.text || '';
  const title = renderNotificationText(rawTitle, variables, fallbacks);
  const body = renderNotificationText(rawBody, variables, fallbacks);
  const caption = [title, body].filter(Boolean).join('\n\n').trim();
  const buttonText = renderNotificationText(template.buttonText || 'Открыть LUMIA', variables, fallbacks);
  return { title, body, caption, buttonText };
}

function toMinutes(hhmm: string): number {
  const [h, m] = String(hhmm || '00:00').slice(0, 5).split(':').map((part) => Number(part));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function isTimeInWindow(localTime: string, start: string, end: string): boolean {
  const t = toMinutes(localTime);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return true;
  if (s < e) return t >= s && t <= e;
  return t >= s || t <= e;
}

export function isWithinQuietHours(localTime: string, quietStart = '22:30', quietEnd = '08:00'): boolean {
  return isTimeInWindow(localTime, quietStart, quietEnd);
}

export function scenarioTriggerMatches(
  scenario: NotificationScenarioLike,
  context: NotificationDayContextLike
): { ok: boolean; reason: string } {
  if (!isTimeInWindow(context.localTime, scenario.timeWindowStart, scenario.timeWindowEnd)) {
    return { ok: false, reason: 'outside_time_window' };
  }

  const rule = scenario.triggerRuleJson || {};
  if (rule.requiresBestSlot && !context.hasBestSlot) {
    return { ok: false, reason: 'no_best_slot' };
  }
  if (typeof rule.minutesToSlotMax === 'number') {
    if (context.minutesToBestSlot == null || context.minutesToBestSlot < 0 || context.minutesToBestSlot > rule.minutesToSlotMax) {
      return { ok: false, reason: 'slot_not_soon' };
    }
  }
  if (rule.openedToday === false && context.userState.openedToday) {
    return { ok: false, reason: 'already_opened_today' };
  }
  if (rule.acceptedFocusToday === true && !context.userState.acceptedFocusToday) {
    return { ok: false, reason: 'focus_not_accepted' };
  }
  if (rule.hasPatternProgress === true && !context.hasPatternProgress) {
    return { ok: false, reason: 'no_pattern_progress' };
  }
  if (typeof rule.minDaysWithoutClick === 'number' && context.userState.daysWithoutClick < rule.minDaysWithoutClick) {
    return { ok: false, reason: 'not_inactive_enough' };
  }
  if (typeof rule.maxDaysWithoutClick === 'number' && context.userState.daysWithoutClick > rule.maxDaysWithoutClick) {
    return { ok: false, reason: 'too_inactive_for_scenario' };
  }
  if (scenario.key === 'evening_checkin' && context.userState.completedCheckinToday) {
    return { ok: false, reason: 'checkin_completed' };
  }

  return { ok: true, reason: 'matched' };
}

export function pickBestScenario<T extends NotificationScenarioLike>(
  scenarios: T[],
  context: NotificationDayContextLike
): { scenario: T | null; reason: string } {
  const eligible = scenarios
    .map((scenario) => ({ scenario, match: scenarioTriggerMatches(scenario, context) }))
    .filter((item) => item.match.ok)
    .sort((a, b) => b.scenario.priority - a.scenario.priority || a.scenario.key.localeCompare(b.scenario.key));

  if (eligible[0]) {
    return { scenario: eligible[0].scenario, reason: eligible[0].match.reason };
  }

  return { scenario: null, reason: 'no_matching_scenario' };
}

export function buildNotificationDeepLink(input: {
  baseUrl: string;
  section: string;
  scenarioKey?: string | null;
  logId?: number | null;
  notificationId?: number | null;
  campaignId?: number | null;
  segment?: string | null;
  variant?: string | null;
  extra?: Record<string, string | number | boolean | null | undefined>;
}): string {
  const base = String(input.baseUrl || '').trim();
  if (!base) return '';

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return base;
  }

  const section = String(input.section || 'today').trim();
  url.searchParams.set('source', 'tg_notification');
  if (input.scenarioKey) url.searchParams.set('scenario', input.scenarioKey);
  if (input.logId != null) url.searchParams.set('nl', String(input.logId));
  if (input.notificationId != null) url.searchParams.set('notification_id', String(input.notificationId));
  if (input.campaignId != null) url.searchParams.set('campaign_id', String(input.campaignId));
  if (input.segment) url.searchParams.set('segment', input.segment);
  if (input.variant) url.searchParams.set('variant', input.variant);

  if (section === 'daily_card') {
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('screen', 'daily_card');
    url.searchParams.set('todaySection', 'daily-card');
  } else if (section === 'pulse' || section === 'pulse_day') {
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('screen', 'pulse_day');
    url.searchParams.set('todaySection', 'pulse');
  } else if (section === 'checkin') {
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('screen', 'checkin');
    url.searchParams.set('todaySection', 'checkin');
  } else if (section === 'best-time') {
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('screen', 'best_time');
    url.searchParams.set('todaySection', 'best-time');
  } else if (section === 'mini-win') {
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('screen', 'mini_win');
    url.searchParams.set('todaySection', 'mini-win');
  } else if (section === 'natal' || section === 'natal_free') {
    url.searchParams.set('view', 'chart');
    url.searchParams.set('screen', 'natal_free');
  } else if (section === 'natal_full') {
    url.searchParams.set('view', 'chart');
    url.searchParams.set('screen', 'natal_full');
  } else if (section === 'love' || section === 'money' || section === 'work') {
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('screen', section);
    url.searchParams.set('story', section);
  } else if (section === 'assistant') {
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('screen', 'assistant');
    url.searchParams.set('todaySection', 'assistant');
  } else if (section === 'synastry') {
    url.searchParams.set('view', 'synastry');
    url.searchParams.set('screen', 'synastry');
  } else if (section === 'premium') {
    url.searchParams.set('view', 'settings');
    url.searchParams.set('screen', 'premium');
  } else {
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('screen', 'today');
    url.searchParams.set('todaySection', 'today');
  }

  for (const [key, value] of Object.entries(input.extra || {})) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export function effectiveDailyLimit(daysWithoutClick: number, defaultLimit = 3): number {
  if (daysWithoutClick >= 7) return 1;
  if (daysWithoutClick >= 3) return 1;
  return defaultLimit;
}

export function effectiveMinIntervalHours(daysWithoutClick: number, defaultHours = 4): number {
  if (daysWithoutClick >= 7) return 72;
  return defaultHours;
}
