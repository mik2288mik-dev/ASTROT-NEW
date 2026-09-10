import { hasTelegramBotToken } from '../lib/telegramEnv';
import { toZonedTime } from 'date-fns-tz';
import { db, getPool } from '../lib/db';
import {
  buildNotificationDeepLink,
  effectiveDailyLimit,
  effectiveMinIntervalHours,
  findForbiddenNotificationTerms,
  pickBestScenario,
  renderNotificationTemplate,
  scenarioTriggerMatches,
  isWithinQuietHours,
  type NotificationDayContextLike,
  type NotificationRenderVariables,
} from '../lib/notificationEngineRules';
import {
  serializeEngineTemplate,
  serializeNotificationScenario,
  serializeEngineAsset,
} from '../lib/adminNotificationEngineDb';
import type {
  AdminNotificationScenario,
  AdminScheduledNotificationAsset,
  AdminScheduledNotificationTemplate,
  DailyAstroSignal,
  DailyAstroSignalPoint,
} from '../types';
import { resolveDailyAstroSignalForUser } from '../lib/dailyAstroSignalResolver';
import { sendTelegramPhotoMessage, sendTelegramTextMessage, buildInlineKeyboardUrl } from '../lib/telegramBot';

const DEFAULT_TIMEZONE = 'Europe/Moscow';
const DEFAULT_MAX_PER_DAY = 3;
const DEFAULT_MIN_INTERVAL_HOURS = 4;

type RecipientRow = {
  id: string;
  name: string;
  language: string;
  isPremium: boolean;
  lastSeenAt: string | null;
  chartTimezone: string | null;
};

type UserNotificationSettings = {
  enabled: boolean;
  morningEnabled: boolean;
  dayEnabled: boolean;
  eveningEnabled: boolean;
  reactivationEnabled: boolean;
  timezone: string | null;
  quietHoursStart: string;
  quietHoursEnd: string;
};

type UserNotificationState = {
  lastNotificationAt: string | null;
  notificationsSentToday: number;
  sentTodayDate: string | null;
  lastOpenedAt: string | null;
  lastClickAt: string | null;
  daysWithoutClick: number;
};

type NotificationDaySummary = {
  main_title: string;
  short_text: string;
  current_state: string;
  current_state_text: string;
  best_slot: {
    from: string;
    to: string;
    label: string;
  } | null;
  good_for: string[];
  better_later: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type NotificationDayContext = NotificationDayContextLike & {
  userId: string;
  firstName: string;
  timezone: string;
  localDate: string;
  daySummary: NotificationDaySummary;
  pulse: {
    general_score: number;
    focus: number;
    mood: number;
    social: number;
    money: number;
    energy: number;
  };
};

type PreparedNotification = {
  scenario: AdminNotificationScenario;
  template: AdminScheduledNotificationTemplate;
  media: AdminScheduledNotificationAsset | null;
  context: NotificationDayContext;
  variables: NotificationRenderVariables;
  rendered: {
    title: string;
    body: string;
    caption: string;
    buttonText: string;
  };
  deepLink: string;
  reason: string;
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function isValidTimezone(value?: string | null) {
  const candidate = String(value || '').trim();
  if (!candidate) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTimezone(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const candidate = String(value || '').trim();
    if (isValidTimezone(candidate)) return candidate;
  }
  return DEFAULT_TIMEZONE;
}

function localInfo(now: Date, timezone: string) {
  const zoned = toZonedTime(now, timezone);
  const localTime = `${pad2(zoned.getHours())}:${pad2(zoned.getMinutes())}`;
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const hour = zoned.getHours();
  const dayPart = hour >= 18 || hour < 4 ? 'evening' : hour >= 12 ? 'day' : 'morning';
  return { zoned, localDate, localTime, hour, dayPart: dayPart as 'morning' | 'day' | 'evening' };
}

function addHoursLabel(start: string, hours: number) {
  const h = Number(start.slice(0, 2));
  const m = Number(start.slice(3, 5));
  return `${pad2((h + hours) % 24)}:${pad2(Number.isFinite(m) ? m : 0)}`;
}

function windowForPoint(pulse: DailyAstroSignal, point: DailyAstroSignalPoint | null | undefined) {
  if (!point) return null;
  return pulse.windows.find((item) => {
    const start = Number(item.start.slice(0, 2));
    const end = Number(item.end.slice(0, 2));
    if (end === 0) return point.hour >= start;
    return point.hour >= start && point.hour < end;
  }) || null;
}

function minutesBetween(localTime: string, targetTime: string) {
  const now = Number(localTime.slice(0, 2)) * 60 + Number(localTime.slice(3, 5));
  const target = Number(targetTime.slice(0, 2)) * 60 + Number(targetTime.slice(3, 5));
  return target - now;
}

function confidence(score: number): 'low' | 'medium' | 'high' {
  if (score >= 72) return 'high';
  if (score >= 56) return 'medium';
  return 'low';
}

function fallbackSummary(): NotificationDaySummary {
  return {
    main_title: 'Сегодня без сильных акцентов',
    short_text: 'Можно спокойно выбрать удобный момент и не перегружать день.',
    current_state: 'ровный день',
    current_state_text: 'Подходит для простых дел и спокойного темпа.',
    best_slot: null,
    good_for: ['короткие дела', 'планирование', 'спокойные решения'],
    better_later: ['резкие решения', 'покупка на эмоциях'],
    confidence: 'medium',
  };
}

function summaryFromPulse(pulse: DailyAstroSignal | null): NotificationDaySummary {
  if (!pulse) return fallbackSummary();
  const current = pulse.currentPoint;
  const peak = pulse.peakPoint;
  const bestWindow = windowForPoint(pulse, peak);
  const bestFrom = bestWindow?.start || peak.time;
  const bestTo = bestWindow?.end && bestWindow.end !== '00:00' ? bestWindow.end : addHoursLabel(bestFrom, 2);
  return {
    main_title: current.title || (peak.score >= 70 ? 'Сегодня есть хороший рабочий слот' : 'Сегодня лучше без гонки'),
    short_text: current.summary || 'Хорошо пойдут короткие дела и спокойные решения.',
    current_state: current.title || 'рабочее окно',
    current_state_text: current.summary || 'Подходит для одной важной задачи без распыления.',
    best_slot: peak.score >= 52
      ? {
          from: bestFrom,
          to: bestTo,
          label: bestWindow?.label || 'лучший момент для дел',
        }
      : null,
    good_for: (peak.bestFor?.length ? peak.bestFor : current.bestFor || []).slice(0, 3),
    better_later: (current.avoid?.length ? current.avoid : ['сложный разговор', 'покупка на эмоциях']).slice(0, 3),
    confidence: confidence(peak.score),
  };
}

function pulseSnapshot(pulse: DailyAstroSignal | null): NotificationDayContext['pulse'] {
  const point = pulse?.currentPoint;
  const layers = point?.layers;
  return {
    general_score: point?.score ?? 55,
    focus: layers?.focus ?? 55,
    mood: layers?.emotions ?? 55,
    social: layers?.relationships ?? 55,
    money: layers?.money ?? 55,
    energy: layers?.energy ?? 55,
  };
}

async function listRecipients(limit = 250): Promise<RecipientRow[]> {
  const pool = getPool();
  const result = await pool.query(
    `WITH user_metrics AS (
       SELECT u.id,
              COALESCE(u.name, '') AS name,
              COALESCE(u.language, 'ru') AS language,
              u.premium_until,
              EXISTS (
                SELECT 1 FROM premium_entitlements pe
                WHERE pe.user_id = u.id
                  AND pe.status IN ('active', 'cancelled')
                  AND pe.ends_at > NOW()
                  AND pe.entitlement_state IN ('gift', 'store_trial', 'paid', 'grace', 'cancelled_active')
              ) AS has_active_premium_entitlement,
              COALESCE(MAX(us.last_seen_at), u.last_login) AS last_seen_at,
              MAX(CASE WHEN nc.is_primary = TRUE THEN nc.timezone ELSE NULL END) AS chart_timezone
       FROM users u
       LEFT JOIN user_sessions us ON us.user_id = u.id
       LEFT JOIN natal_charts nc ON nc.user_id = u.id
       GROUP BY u.id
     )
     SELECT *
     FROM user_metrics
     ORDER BY last_seen_at DESC NULLS LAST, id DESC
     LIMIT $1`,
    [Math.max(1, Math.min(1000, limit))]
  );
  const now = Date.now();
  return result.rows.map((row: any) => ({
    id: String(row.id),
    name: row.name || '',
    language: row.language || 'ru',
    isPremium: row.has_active_premium_entitlement === true
      || !!(row.premium_until && new Date(row.premium_until).getTime() > now),
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
    chartTimezone: row.chart_timezone || null,
  }));
}

async function getSettings(userId: string): Promise<UserNotificationSettings> {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM user_notification_settings WHERE user_id = $1`, [userId]);
  const row = result.rows[0];
  return {
    enabled: row?.enabled !== false,
    morningEnabled: row?.morning_enabled !== false,
    dayEnabled: row?.day_enabled !== false,
    eveningEnabled: row?.evening_enabled !== false,
    reactivationEnabled: row?.reactivation_enabled !== false,
    timezone: row?.timezone || null,
    quietHoursStart: row?.quiet_hours_start ? String(row.quiet_hours_start).slice(0, 5) : '22:30',
    quietHoursEnd: row?.quiet_hours_end ? String(row.quiet_hours_end).slice(0, 5) : '08:00',
  };
}

async function getState(userId: string, recipient: RecipientRow, localDate: string): Promise<UserNotificationState> {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM user_notification_state WHERE user_id = $1`, [userId]);
  const row = result.rows[0];
  let daysWithoutClick = Number(row?.days_without_click ?? 0);
  if (!row?.last_click_at && recipient.lastSeenAt) {
    const diff = Date.now() - new Date(recipient.lastSeenAt).getTime();
    daysWithoutClick = Math.max(0, Math.floor(diff / 86400000));
  } else if (row?.last_click_at) {
    const diff = Date.now() - new Date(row.last_click_at).getTime();
    daysWithoutClick = Math.max(0, Math.floor(diff / 86400000));
  }
  return {
    lastNotificationAt: row?.last_notification_at ? new Date(row.last_notification_at).toISOString() : null,
    notificationsSentToday: row?.sent_today_date && String(row.sent_today_date).slice(0, 10) === localDate
      ? Number(row.notifications_sent_today ?? 0)
      : 0,
    sentTodayDate: row?.sent_today_date ? String(row.sent_today_date).slice(0, 10) : null,
    lastOpenedAt: row?.last_opened_at ? new Date(row.last_opened_at).toISOString() : null,
    lastClickAt: row?.last_click_at ? new Date(row.last_click_at).toISOString() : null,
    daysWithoutClick,
  };
}

function sameLocalDate(isoValue: string | null | undefined, timezone: string, dateKey: string) {
  if (!isoValue) return false;
  const date = new Date(isoValue);
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return local === dateKey;
}

async function hasRecentSectionOpen(userId: string, section: string, minutes = 60) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT 1
     FROM user_app_events
     WHERE user_id = $1
       AND section = $2
       AND occurred_at >= NOW() - ($3::int * INTERVAL '1 minute')
     LIMIT 1`,
    [userId, section, minutes]
  );
  return result.rows.length > 0;
}

async function buildContext(recipient: RecipientRow, now: Date): Promise<NotificationDayContext> {
  const settings = await getSettings(recipient.id);
  const timezone = normalizeTimezone(settings.timezone, recipient.chartTimezone);
  const info = localInfo(now, timezone);
  const state = await getState(recipient.id, recipient, info.localDate);
  const resolved = await resolveDailyAstroSignalForUser({
    userId: recipient.id,
    dateKey: info.localDate,
  }).catch(() => null);
  const pulse = resolved?.status === 'ready' ? resolved.pulse : null;
  const openedToday =
    sameLocalDate(recipient.lastSeenAt, timezone, info.localDate) ||
    sameLocalDate(state.lastOpenedAt, timezone, info.localDate);
  const daySummary = summaryFromPulse(pulse);
  const bestFrom = daySummary.best_slot?.from || null;
  const minutesToBestSlot = bestFrom ? minutesBetween(info.localTime, bestFrom) : null;
  const firstName = String(recipient.name || '').trim().split(/\s+/)[0] || 'ты';

  return {
    userId: recipient.id,
    firstName,
    timezone,
    localDate: info.localDate,
    localTime: info.localTime,
    dayPart: state.daysWithoutClick >= 3 ? 'reactivation' : info.dayPart,
    minutesToBestSlot,
    hasBestSlot: !!daySummary.best_slot,
    userState: {
      openedToday,
      daysWithoutClick: state.daysWithoutClick,
    },
    daySummary,
    pulse: pulseSnapshot(pulse),
  };
}

function renderVariables(context: NotificationDayContext): NotificationRenderVariables {
  const summary = context.daySummary;
  return {
    first_name: context.firstName,
    main_title: summary.main_title,
    short_text: summary.short_text,
    current_state: summary.current_state,
    current_state_text: summary.current_state_text,
    best_slot_from: summary.best_slot?.from || 'удобное время',
    best_slot_to: summary.best_slot?.to || '',
    best_slot_label: summary.best_slot?.label || 'ровный день без одного явного пика',
    good_for: summary.good_for,
    better_later: summary.better_later,
    minutes_to_slot: context.minutesToBestSlot ?? 20,
  };
}

function audienceMatches(scenario: AdminNotificationScenario, recipient: RecipientRow, context: NotificationDayContext) {
  const segment = String(scenario.audienceRuleJson?.segment || 'all');
  if (segment === 'premium') return recipient.isPremium;
  if (segment === 'free') return !recipient.isPremium;
  if (segment === 'inactive_3d') return context.userState.daysWithoutClick >= 3;
  if (segment === 'inactive_7d') return context.userState.daysWithoutClick >= 7;
  return true;
}

function scenarioSettingsEnabled(scenario: AdminNotificationScenario, settings: UserNotificationSettings) {
  if (!settings.enabled) return false;
  if (scenario.dayPart === 'morning') return settings.morningEnabled;
  if (scenario.dayPart === 'day') return settings.dayEnabled;
  if (scenario.dayPart === 'evening') return settings.eveningEnabled;
  if (scenario.dayPart === 'reactivation') return settings.reactivationEnabled;
  return true;
}

async function frequencyGate(
  scenario: AdminNotificationScenario,
  recipient: RecipientRow,
  context: NotificationDayContext,
  settings: UserNotificationSettings
): Promise<{ ok: boolean; reason: string }> {
  if (!scenarioSettingsEnabled(scenario, settings)) return { ok: false, reason: 'settings_disabled' };
  if (isWithinQuietHours(context.localTime, settings.quietHoursStart, settings.quietHoursEnd)) {
    return { ok: false, reason: 'quiet_hours' };
  }
  const state = await getState(recipient.id, recipient, context.localDate);
  const dailyLimit = effectiveDailyLimit(state.daysWithoutClick, DEFAULT_MAX_PER_DAY);
  if (state.notificationsSentToday >= dailyLimit) return { ok: false, reason: 'daily_limit' };
  if (state.lastNotificationAt) {
    const minHours = effectiveMinIntervalHours(state.daysWithoutClick, DEFAULT_MIN_INTERVAL_HOURS);
    const diffHours = (Date.now() - new Date(state.lastNotificationAt).getTime()) / 36e5;
    if (diffHours < minHours) return { ok: false, reason: 'cooldown' };
  }
  const pool = getPool();
  const scenarioSends = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM notification_logs
     WHERE user_id = $1
       AND scenario_key = $2
       AND status = 'sent'
       AND sent_at::date = $3::date`,
    [recipient.id, scenario.key, context.localDate]
  );
  if (Number(scenarioSends.rows[0]?.count ?? 0) >= scenario.maxPerDay) {
    return { ok: false, reason: 'scenario_daily_limit' };
  }
  if (scenario.cooldownHours > 0) {
    const recentScenario = await pool.query(
      `SELECT 1
       FROM notification_logs
       WHERE user_id = $1
         AND scenario_key = $2
         AND status = 'sent'
         AND sent_at >= NOW() - ($3::int * INTERVAL '1 hour')
       LIMIT 1`,
      [recipient.id, scenario.key, scenario.cooldownHours]
    );
    if (recentScenario.rows.length) return { ok: false, reason: 'scenario_cooldown' };
  }
  const section = scenario.deepLink || 'today';
  if (await hasRecentSectionOpen(recipient.id, section, 60).catch(() => false)) {
    return { ok: false, reason: 'section_recently_opened' };
  }
  return { ok: true, reason: 'ok' };
}

async function listEnabledScenarios(includeDisabled = false): Promise<AdminNotificationScenario[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT s.*,
            COUNT(t.id)::int AS templates_count,
            COUNT(t.id) FILTER (WHERE t.is_active = TRUE)::int AS active_templates_count,
            MAX(l.sent_at) AS last_sent_at,
            COUNT(l.id) FILTER (WHERE l.status = 'sent')::int AS sent_count,
            COUNT(l.id) FILTER (WHERE l.clicked_at IS NOT NULL)::int AS clicked_count,
            COUNT(l.id) FILTER (WHERE l.status = 'failed')::int AS error_count
     FROM notification_scenarios s
     LEFT JOIN notification_templates t ON t.scenario_id = s.id
     LEFT JOIN notification_logs l ON l.scenario_id = s.id
     WHERE ($1::boolean = TRUE OR s.enabled = TRUE)
     GROUP BY s.id
     ORDER BY s.priority DESC, s.id ASC`,
    [includeDisabled]
  );
  return result.rows.map(serializeNotificationScenario);
}

async function listScenarioTemplates(scenarioId: number): Promise<AdminScheduledNotificationTemplate[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT t.*, s.key AS scenario_key, a.public_url AS asset_public_url, a.mime_type AS asset_mime_type, a.file_name AS asset_file_name
     FROM notification_templates t
     LEFT JOIN notification_scenarios s ON s.id = t.scenario_id
     LEFT JOIN notification_assets a ON a.id = t.asset_id
     WHERE t.scenario_id = $1 AND t.is_active = TRUE
     ORDER BY t.sort_order ASC, t.id ASC`,
    [scenarioId]
  );
  return result.rows.map(serializeEngineTemplate);
}

function pickTemplate(templates: AdminScheduledNotificationTemplate[], userId: string, dateKey: string, scenarioKey: string) {
  if (!templates.length) return null;
  const total = templates.reduce((sum, t) => sum + Math.max(1, Number(t.weight ?? 100)), 0);
  let hash = 2166136261 >>> 0;
  const seed = `${userId}:${dateKey}:${scenarioKey}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let cursor = hash % total;
  for (const template of templates) {
    cursor -= Math.max(1, Number(template.weight ?? 100));
    if (cursor < 0) return template;
  }
  return templates[0];
}

async function pickMedia(
  scenario: AdminNotificationScenario,
  context: NotificationDayContext
): Promise<AdminScheduledNotificationAsset | null> {
  if (scenario.imageMode === 'none') return null;
  const pool = getPool();
  if (scenario.imageMode === 'manual' && scenario.defaultMediaAssetId) {
    const result = await pool.query(
      `SELECT *, 0 AS ref_count FROM notification_assets WHERE id = $1 AND enabled = TRUE`,
      [scenario.defaultMediaAssetId]
    );
    return result.rows[0] ? serializeEngineAsset(result.rows[0]) : null;
  }

  const tags = Array.isArray(scenario.imageStrategyJson?.tags) ? scenario.imageStrategyJson.tags.map(String) : [];
  const dayPart = String(scenario.imageStrategyJson?.dayPart || scenario.dayPart || context.dayPart);
  const result = await pool.query(
    `SELECT a.*, 0 AS ref_count
     FROM notification_assets a
     WHERE a.enabled = TRUE
       AND (
         ($1::text[] IS NOT NULL AND jsonb_exists_any(a.tags, $1::text[]))
         OR a.category = ANY($2::text[])
         OR a.day_part = $3
       )
       AND NOT EXISTS (
         SELECT 1 FROM notification_logs l
         WHERE l.user_id = $4
           AND l.media_asset_id = a.id
           AND l.sent_at >= NOW() - (COALESCE(a.cooldown_days, 30)::int * INTERVAL '1 day')
       )
     ORDER BY a.last_used_at NULLS FIRST, a.id DESC
     LIMIT 1`,
    [tags.length ? tags : null, tags.length ? tags : [dayPart], dayPart, context.userId]
  );
  if (result.rows[0]) return serializeEngineAsset(result.rows[0]);

  const fallback = await pool.query(
    `SELECT *, 0 AS ref_count
     FROM notification_assets
     WHERE enabled = TRUE AND (category = $1 OR day_part = $1)
     ORDER BY last_used_at NULLS FIRST, id DESC
     LIMIT 1`,
    [dayPart]
  );
  return fallback.rows[0] ? serializeEngineAsset(fallback.rows[0]) : null;
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
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = appBaseUrl();
  if (!base) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

async function prepareNotification(
  recipient: RecipientRow,
  scenarios: AdminNotificationScenario[],
  now: Date,
  input?: { forceScenarioId?: number; forceTemplateId?: number; includeDisabled?: boolean }
): Promise<{ prepared: PreparedNotification | null; reason: string }> {
  const settings = await getSettings(recipient.id);
  const context = await buildContext(recipient, now);
  const candidateScenarios = scenarios.filter((scenario) => {
    if (input?.forceScenarioId && Number(scenario.id) !== Number(input.forceScenarioId)) return false;
    if (!input?.includeDisabled && !scenario.enabled) return false;
    if (!audienceMatches(scenario, recipient, context)) return false;
    return scenario.dayPart === context.dayPart || input?.forceScenarioId;
  });
  const picked = input?.forceScenarioId
    ? { scenario: candidateScenarios[0] || null, reason: 'forced' }
    : pickBestScenario(candidateScenarios, context);
  if (!picked.scenario) return { prepared: null, reason: picked.reason };

  if (!input?.forceScenarioId) {
    const trigger = scenarioTriggerMatches(picked.scenario, context);
    if (!trigger.ok) return { prepared: null, reason: trigger.reason };
    const gate = await frequencyGate(picked.scenario, recipient, context, settings);
    if (!gate.ok) return { prepared: null, reason: gate.reason };
  }

  const templates = await listScenarioTemplates(picked.scenario.id);
  let template = input?.forceTemplateId
    ? templates.find((item) => Number(item.id) === Number(input.forceTemplateId)) || null
    : pickTemplate(templates, recipient.id, context.localDate, picked.scenario.key);
  if (!template && input?.forceTemplateId) {
    const pool = getPool();
    const row = await pool.query(
      `SELECT t.*, s.key AS scenario_key, a.public_url AS asset_public_url, a.mime_type AS asset_mime_type, a.file_name AS asset_file_name
       FROM notification_templates t
       LEFT JOIN notification_scenarios s ON s.id = t.scenario_id
       LEFT JOIN notification_assets a ON a.id = t.asset_id
       WHERE t.id = $1`,
      [input.forceTemplateId]
    );
    template = row.rows[0] ? serializeEngineTemplate(row.rows[0]) : null;
  }
  if (!template) return { prepared: null, reason: 'no_active_templates' };

  const forbidden = findForbiddenNotificationTerms([template.title, template.body || template.text].join('\n'));
  if (forbidden.length) return { prepared: null, reason: 'template_forbidden_terms' };

  const variables = renderVariables(context);
  const rendered = renderNotificationTemplate(
    {
      title: template.title || template.name,
      body: template.body || template.text,
      buttonText: template.buttonText || picked.scenario.buttons?.[0]?.text,
    },
    variables,
    {
      main_title: 'Сегодня без сильных акцентов',
      short_text: 'Можно спокойно выбрать удобный момент и не перегружать день.',
      best_slot_from: 'сегодня',
      best_slot_to: '',
    }
  );
  const media = await pickMedia(picked.scenario, context);
  const deepSection = template.deepLink || picked.scenario.deepLink || 'today';
  return {
    prepared: {
      scenario: picked.scenario,
      template,
      media,
      context,
      variables,
      rendered,
      deepLink: buildNotificationDeepLink({
        baseUrl: appBaseUrl(),
        section: deepSection,
        scenarioKey: picked.scenario.key,
      }),
      reason: picked.reason,
    },
    reason: picked.reason,
  };
}

async function createLog(prepared: PreparedNotification, status = 'pending') {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO notification_logs (
       user_id, scenario_id, scenario_key, template_id, media_asset_id, status, payload_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id`,
    [
      prepared.context.userId,
      prepared.scenario.id,
      prepared.scenario.key,
      prepared.template.id,
      prepared.media?.id ?? null,
      status,
      JSON.stringify({
        title: prepared.rendered.title,
        body: prepared.rendered.body,
        buttonText: prepared.rendered.buttonText,
        deepLink: prepared.deepLink,
        reason: prepared.reason,
        variables: prepared.variables,
      }),
    ]
  );
  return Number(result.rows[0].id);
}

async function markSendResult(
  logId: number,
  prepared: PreparedNotification,
  result: { ok: boolean; messageId?: number; error?: string },
  localDate: string
) {
  const pool = getPool();
  await pool.query(
    `UPDATE notification_logs
     SET status = $2,
         sent_at = CASE WHEN $2 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
         telegram_message_id = $3,
         error = $4,
         payload_json = payload_json || $5::jsonb
     WHERE id = $1`,
    [
      logId,
      result.ok ? 'sent' : 'failed',
      result.messageId ?? null,
      result.error ?? null,
      JSON.stringify({ deepLink: prepared.deepLink }),
    ]
  );
  if (result.ok) {
    await pool.query(
      `INSERT INTO user_notification_state (
         user_id, last_notification_at, notifications_sent_today, sent_today_date, days_without_click
       )
       VALUES ($1, CURRENT_TIMESTAMP, 1, $2::date, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         last_notification_at = CURRENT_TIMESTAMP,
         notifications_sent_today = CASE
           WHEN user_notification_state.sent_today_date = $2::date THEN user_notification_state.notifications_sent_today + 1
           ELSE 1
         END,
         sent_today_date = $2::date,
         days_without_click = EXCLUDED.days_without_click,
         updated_at = CURRENT_TIMESTAMP`,
      [prepared.context.userId, localDate, prepared.context.userState.daysWithoutClick]
    );
    await pool.query(`UPDATE notification_templates SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [prepared.template.id]);
    if (prepared.media?.id) {
      await pool.query(`UPDATE notification_assets SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [prepared.media.id]);
    }
  }
}

async function sendPrepared(prepared: PreparedNotification, options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun || process.env.NOTIFICATION_DRY_RUN === '1' || !hasTelegramBotToken();
  if (dryRun) {
    prepared.deepLink = buildNotificationDeepLink({
      baseUrl: appBaseUrl(),
      section: prepared.template.deepLink || prepared.scenario.deepLink || 'today',
      scenarioKey: prepared.scenario.key,
      extra: { dryRun: 1 },
    });
    return { logId: 0, ok: true, messageId: 0, error: undefined as string | undefined, dryRun: true };
  }

  const logId = await createLog(prepared);
  const deepLink = buildNotificationDeepLink({
    baseUrl: appBaseUrl(),
    section: prepared.template.deepLink || prepared.scenario.deepLink || 'today',
    scenarioKey: prepared.scenario.key,
    logId,
  });
  prepared.deepLink = deepLink;
  const keyboard = buildInlineKeyboardUrl(deepLink, prepared.rendered.buttonText);
  const replyMarkup = keyboard ? { inline_keyboard: keyboard } : undefined;
  const result = prepared.media?.publicUrl
      ? await sendTelegramPhotoMessage(
          prepared.context.userId,
          absoluteAssetUrl(prepared.media.publicUrl),
          prepared.rendered.caption,
          { replyMarkup }
      )
      : await sendTelegramTextMessage(prepared.context.userId, prepared.rendered.caption, { replyMarkup });
  await markSendResult(logId, prepared, result, prepared.context.localDate);
  return { logId, ...result, dryRun };
}

export async function runNotificationEngineCron(
  createdBy: string,
  now: Date = new Date(),
  options?: { limit?: number; dryRun?: boolean }
) {
  const scenarios = await listEnabledScenarios(false);
  const recipients = await listRecipients(options?.limit ?? 250);
  const results: Array<{ userId: string; ok: boolean; scenarioKey?: string; detail: string; dryRun?: boolean }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (const recipient of recipients) {
    try {
      const { prepared, reason } = await prepareNotification(recipient, scenarios, now);
      if (!prepared) {
        results.push({ userId: recipient.id, ok: true, detail: reason });
        continue;
      }
      const send = await sendPrepared(prepared, { dryRun: options?.dryRun });
      if (send.ok) successCount += 1;
      else failureCount += 1;
      results.push({
        userId: recipient.id,
        ok: send.ok,
        scenarioKey: prepared.scenario.key,
        detail: send.ok ? `sent:${send.logId}` : send.error || 'failed',
        dryRun: send.dryRun,
      });
    } catch (error: any) {
      failureCount += 1;
      results.push({ userId: recipient.id, ok: false, detail: error?.message || 'error' });
    }
  }

  const dryRunMode = options?.dryRun || process.env.NOTIFICATION_DRY_RUN === '1' || !hasTelegramBotToken();
  if (!dryRunMode) {
    await db.notification_delivery_log.create({
      templateId: null,
      sentAt: new Date(),
      recipientCount: recipients.length,
      successCount,
      failureCount,
      status: failureCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
      errorSummary: failureCount ? `${failureCount} failed` : null,
      visualMode: 'scenario_engine',
    }).catch(() => undefined);
  }

  return {
    ok: failureCount === 0,
    createdBy,
    successCount,
    failureCount,
    totalRecipients: recipients.length,
    results,
  };
}

export async function previewNotificationScenario(input: {
  scenarioId?: number | null;
  templateId?: number | null;
  userId: string;
  now?: Date;
}) {
  const scenarios = await listEnabledScenarios(true);
  const user = await db.users.get(input.userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  const chart = await db.natal_charts.getPrimary(input.userId).catch(() => null);
  const recipient: RecipientRow = {
    id: String(input.userId),
    name: user.name || '',
    language: user.language || 'ru',
    isPremium: !!user.is_premium,
    lastSeenAt: user.last_login ? new Date(user.last_login).toISOString() : null,
    chartTimezone: chart?.timezone || null,
  };
  const { prepared, reason } = await prepareNotification(recipient, scenarios, input.now || new Date(), {
    forceScenarioId: input.scenarioId ?? undefined,
    forceTemplateId: input.templateId ?? undefined,
    includeDisabled: true,
  });
  if (!prepared) {
    return { status: 'skipped' as const, reason };
  }
  return {
    status: 'ready' as const,
    reason: prepared.reason,
    scenario: prepared.scenario,
    template: prepared.template,
    media: prepared.media,
    title: prepared.rendered.title,
    body: prepared.rendered.body,
    text: prepared.rendered.caption,
    imageUrl: prepared.media?.publicUrl || null,
    buttonText: prepared.rendered.buttonText,
    deepLink: buildNotificationDeepLink({
      baseUrl: appBaseUrl(),
      section: prepared.template.deepLink || prepared.scenario.deepLink || 'today',
      scenarioKey: prepared.scenario.key,
      extra: { preview: 1 },
    }),
    variables: prepared.variables,
    context: prepared.context,
  };
}

export async function sendTestScenarioNotification(input: {
  scenarioId?: number | null;
  templateId?: number | null;
  userId: string;
}) {
  const scenarios = await listEnabledScenarios(true);
  const user = await db.users.get(input.userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  const chart = await db.natal_charts.getPrimary(input.userId).catch(() => null);
  const recipient: RecipientRow = {
    id: String(input.userId),
    name: user.name || '',
    language: user.language || 'ru',
    isPremium: !!user.is_premium,
    lastSeenAt: user.last_login ? new Date(user.last_login).toISOString() : null,
    chartTimezone: chart?.timezone || null,
  };
  const { prepared, reason } = await prepareNotification(recipient, scenarios, new Date(), {
    forceScenarioId: input.scenarioId ?? undefined,
    forceTemplateId: input.templateId ?? undefined,
    includeDisabled: true,
  });
  if (!prepared) throw new Error(reason);
  const result = await sendPrepared(prepared);
  return {
    successCount: result.ok ? 1 : 0,
    failureCount: result.ok ? 0 : 1,
    totalRecipients: 1,
    errorSummary: result.error ?? null,
    logId: result.logId,
    dryRun: result.dryRun,
  };
}

export async function recordNotificationAttribution(input: {
  userId: string;
  notificationLogId?: number | null;
  scenarioKey?: string | null;
  section?: string | null;
  source?: string | null;
  eventType: 'click' | 'open';
  payload?: Record<string, any>;
}) {
  const pool = getPool();
  const logId = input.notificationLogId && Number.isFinite(Number(input.notificationLogId))
    ? Number(input.notificationLogId)
    : null;
  const ownedLogId = logId
    ? (
        await pool.query(
          `SELECT id FROM notification_logs WHERE id = $1 AND user_id = $2`,
          [logId, input.userId]
        )
      ).rows[0]?.id ?? null
    : null;
  await pool.query(
    `INSERT INTO user_app_events (user_id, event_type, scenario_key, notification_log_id, section, source, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.userId,
      input.eventType,
      input.scenarioKey ?? null,
      ownedLogId,
      input.section ?? null,
      input.source ?? null,
      JSON.stringify(input.payload || {}),
    ]
  );
  if (ownedLogId) {
    await pool.query(
      `UPDATE notification_logs
       SET clicked_at = COALESCE(clicked_at, CASE WHEN $2 = 'click' THEN CURRENT_TIMESTAMP ELSE clicked_at END),
           opened_at = COALESCE(opened_at, CASE WHEN $2 IN ('click', 'open') THEN CURRENT_TIMESTAMP ELSE opened_at END)
       WHERE id = $1 AND user_id = $3`,
      [ownedLogId, input.eventType, input.userId]
    );
  }
  await pool.query(
    `INSERT INTO user_notification_state (user_id, last_opened_at, last_click_at, days_without_click)
     VALUES (
       $1,
       CASE WHEN $2 IN ('click', 'open') THEN CURRENT_TIMESTAMP ELSE NULL END,
       CASE WHEN $2 = 'click' THEN CURRENT_TIMESTAMP ELSE NULL END,
       0
     )
     ON CONFLICT (user_id) DO UPDATE SET
       last_opened_at = CASE WHEN $2 IN ('click', 'open') THEN CURRENT_TIMESTAMP ELSE user_notification_state.last_opened_at END,
       last_click_at = CASE WHEN $2 = 'click' THEN CURRENT_TIMESTAMP ELSE user_notification_state.last_click_at END,
       days_without_click = 0,
       updated_at = CURRENT_TIMESTAMP`,
    [input.userId, input.eventType]
  );
  return { success: true };
}
