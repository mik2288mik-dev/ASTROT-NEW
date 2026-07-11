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
  daysWithoutClick: number;
};

export type NotificationDayContextLike = {
  localTime: string;
  dayPart: NotificationDayPart;
  minutesToBestSlot: number | null;
  hasBestSlot: boolean;
  userState: NotificationUserStateLike;
};

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const EXTRA_NOTIFICATION_VARIABLES = [
  'sign',
  'name',
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

const STRICT_APP_FORBIDDEN_PATTERNS = [
  /\u0437\u0432[\u0435\u0451]\u0437\u0434\u044b\s+\u0433\u043e\u0432\u043e\u0440\u044f\u0442/i,
  /\u0441\u0443\u0434\u044c\u0431[\u0430\u044b\u0435\u0443]/i,
  /\u043c\u0430\u0433\u0438\u0447\u0435\u0441\u043a/i,
  /\u044d\u043d\u0435\u0440\u0433\u0435\u0442\u0438\u043a/i,
  /\u044d\u043d\u0435\u0440\u0433\u0438\u044f/i,
  /\u0432\u0438\u0431\u0440\u0430\u0446/i,
  /\u043f\u043e\u0440\u0442\u0430\u043b/i,
  /\u043e\u0442\u043a\u0440\u043e\u0439\s+\u0441\u0435\u0440\u0434\u0446\u0435/i,
  /\u0443\u0434\u0430\u0447[\u0430\u0438\u0443\u0435]/i,
  /\u0433\u043e\u0440\u043e\u0441\u043a\u043e\u043f\s+\u0434\u043b\u044f\s+\u0432\u0441\u0435\u0445/i,
  /\u0437\u0430\u0439\u0434\u0438\s+\u0432\s+\u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435/i,
  /\u0442\u0432\u043e\u0439\s+\u0433\u043e\u0440\u043e\u0441\u043a\u043e\u043f\s+\u0433\u043e\u0442\u043e\u0432/i,
  /\u043d\u0435\s+\u043f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\s+\u0443\u0434\u0430\u0447\u0443/i,
  /\u043a\u0430\u0440\u043c\u0438\u0447\u0435\u0441\u043a/i,
  /\u043f\u0440\u0435\u0434\u043d\u0430\u0447\u0435\u0440\u0442\u0430\u043d/i,
  /\b\u043a\u0430\u0440\u043c[\u0430\u044b\u0443\u0435]\b/i,
  /\u0430\u0441\u0446\u0435\u043d\u0434\u0435\u043d\u0442/i,
  /\u0432\u043e\u0441\u0445\u043e\u0434\u044f\u0449(\u0438\u0439|\u0435\u0433\u043e|\u0435\u043c\u0443)\s+\u0437\u043d\u0430\u043a/i,
  /\u0441\u0435\u043a\u0441\u0442\u0438\u043b|\u043a\u0432\u0430\u0434\u0440\u0430\u0442\u0443\u0440|\u043e\u043f\u043f\u043e\u0437\u0438\u0446\u0438|\u0442\u0440\u0438\u0433\u043e\u043d|\b\u0442\u0440\u0438\u043d\b|\u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438[\u0435\u044f]\s+\u043f\u043b\u0430\u043d\u0435\u0442/i,
  /\u043c\u0435\u0440\u043a\u0443\u0440\u0438|\u0432\u0435\u043d\u0435\u0440[\u0430\u044b\u0443\u0435]|\u044e\u043f\u0438\u0442\u0435\u0440|\u0441\u0430\u0442\u0443\u0440\u043d|\b\u0443\u0440\u0430\u043d\b|\u043d\u0435\u043f\u0442\u0443\u043d|\u043f\u043b\u0443\u0442\u043e\u043d|\b\u043c\u0430\u0440\u0441[\u0430\u0435\u0443]?\b/i,
  /\u043f\u0443\u043b\u044c\u0441\s+\u0434\u043d\u044f|\u0432\u0435\u0447\u0435\u0440\u043d(\u044f\u044f|\u044e\u044e|\u0435\u0439)\s+\u043e\u0442\u043c\u0435\u0442\u043a|\u043e\u043a\u043d\u043e\s+\u0434\u043d\u044f/i,
];

// Правило продукта для пушей: максимум ОДИН уместный эмодзи на сообщение (😄/✨/😉 — любой),
// никакого эмодзи-спама и иконок-пиктограмм пачками.
// Покрывает эмодзи-пиктограммы, символы, стрелки, дингбаты и модификаторы (VS16/ZWJ/тон кожи).
const NOTIFICATION_EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2900}-\u{297F}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\u{20E3}]/gu;

export function hasNotificationEmoji(text: string): boolean {
  return new RegExp(NOTIFICATION_EMOJI_RE.source, 'u').test(String(text || ''));
}

/** Оставляет максимум один эмодзи (первый, если allowEmoji) и убирает все остальные; чистит пробелы. */
export function enforceNotificationEmoji(text: string, allowEmoji = true): string {
  let kept = false;
  const stripped = String(text || '').replace(NOTIFICATION_EMOJI_RE, (match) => {
    if (allowEmoji && !kept) {
      kept = true;
      return match;
    }
    return '';
  });
  return stripped
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.!?…:;])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function readableRegexSource(source: string): string {
  return source.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (_match, codePoint, codeUnit) => (
    String.fromCodePoint(parseInt(codePoint || codeUnit, 16))
  ));
}

export function findForbiddenNotificationTerms(text: string): string[] {
  const value = String(text || '');
  return [...NOTIFICATION_FORBIDDEN_PATTERNS, ...STRICT_APP_FORBIDDEN_PATTERNS]
    .filter((pattern) => pattern.test(value))
    .map((pattern) => readableRegexSource(pattern.source));
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
  // Один эмодзи на всё сообщение: заголовок приоритетнее — тело сохраняет эмодзи, только если в заголовке его нет.
  const title = enforceNotificationEmoji(renderNotificationText(rawTitle, variables, fallbacks));
  const body = enforceNotificationEmoji(renderNotificationText(rawBody, variables, fallbacks), !hasNotificationEmoji(title));
  const caption = [title, body].filter(Boolean).join('\n\n').trim();
  const buttonText = enforceNotificationEmoji(renderNotificationText(template.buttonText || 'Открыть', variables, fallbacks), false);
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
  if (typeof rule.minDaysWithoutClick === 'number' && context.userState.daysWithoutClick < rule.minDaysWithoutClick) {
    return { ok: false, reason: 'not_inactive_enough' };
  }
  if (typeof rule.maxDaysWithoutClick === 'number' && context.userState.daysWithoutClick > rule.maxDaysWithoutClick) {
    return { ok: false, reason: 'too_inactive_for_scenario' };
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
