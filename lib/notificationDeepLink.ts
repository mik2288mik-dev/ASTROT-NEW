/**
 * Ссылки-кнопки для пушей бота.
 *
 * Кнопка должна ОТКРЫВАТЬ МИНИ-АПП (внутри Telegram, с авторизацией), а не вести на
 * сырой web-URL в браузере. Для этого используем прямую ссылку мини-аппа:
 *   https://t.me/<bot>?startapp=<code>[-<logId>]
 * Telegram отдаёт <code>[-<logId>] в initData.start_param. Приложение читает его и
 * открывается на нужном экране (см. resolveStartParamRoute) + может атрибутировать клик.
 *
 * start_param допускает только [A-Za-z0-9_-] и до 64 символов, поэтому секции кодируем
 * короткими токенами без подчёркиваний, а logId отделяем дефисом.
 */

/** section (как в payload.section / deep_link) → короткий код для start_param */
const SECTION_TO_CODE: Record<string, string> = {
  daily_card: 'dc',
  pulse: 'pd',
  pulse_day: 'pd',
  checkin: 'pday',
  personal_day: 'pday',
  'best-time': 'btime',
  'mini-win': 'mwin',
  natal: 'natal',
  natal_free: 'natal',
  natal_full: 'natalx',
  love: 'love',
  money: 'money',
  work: 'work',
  premium: 'prem',
  synastry: 'compat',
  union: 'compat',
  compatibility: 'compat',
  assistant: 'today',
  chat: 'today',
  horoscope: 'horo',
  daily: 'horo',
  today: 'today',
};

export type StartParamRoute = {
  view: string;
  screen?: string;
  todaySection?: string;
};

/** короткий код → экран приложения (обратная сторона SECTION_TO_CODE).
 *  view-значения совпадают с ViewState приложения (App.tsx). */
const CODE_TO_ROUTE: Record<string, StartParamRoute> = {
  dc: { view: 'dashboard', todaySection: 'daily-card' },
  pd: { view: 'dashboard', todaySection: 'pulse' },
  pday: { view: 'personal_daily' },
  btime: { view: 'dashboard', todaySection: 'best-time' },
  mwin: { view: 'dashboard', todaySection: 'mini-win' },
  natal: { view: 'chart' },
  natalx: { view: 'chart' },
  love: { view: 'personal_daily' },
  money: { view: 'personal_daily' },
  work: { view: 'personal_daily' },
  prem: { view: 'dashboard' },
  compat: { view: 'synastry' },
  chat: { view: 'dashboard' },
  horo: { view: 'horoscope' },
  today: { view: 'dashboard' },
};

export function sectionToStartCode(section: string | null | undefined): string {
  const key = String(section || '').trim();
  return SECTION_TO_CODE[key] || 'today';
}

/** Разбирает start_param из ссылки пуша: "<code>" или "<code>-<logId>". */
export function resolveStartParamRoute(startParam: string | null | undefined): { route: StartParamRoute; logId: number | null } | null {
  const raw = String(startParam || '').trim();
  if (!raw) return null;
  const match = raw.match(/^([a-z]+)(?:-(\d+))?$/i);
  if (!match) return null;
  const code = match[1].toLowerCase();
  const route = CODE_TO_ROUTE[code];
  if (!route) return null;
  return { route, logId: match[2] ? Number(match[2]) : null };
}

/**
 * Ссылка-кнопка, открывающая мини-апп на нужном разделе.
 * botUsername резолвит вызывающий код (env или getMe). Пусто, если имя бота
 * неизвестно — тогда вызывающий откатывается на web-deep-link (не ломаемся).
 */
export function buildMiniAppButtonUrl(botUsername: string | null | undefined, section: string | null | undefined, logId?: number | null): string {
  const bot = String(botUsername || '').replace(/^@/, '').trim();
  if (!bot) return '';
  const code = sectionToStartCode(section);
  const param = logId != null && Number.isFinite(Number(logId)) ? `${code}-${logId}` : code;
  return `https://t.me/${bot}?startapp=${param}`;
}
