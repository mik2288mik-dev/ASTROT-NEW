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
import { getBotUsername } from './botLink';

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
  assistant: 'chat',
  chat: 'chat',
  horoscope: 'horo',
  daily: 'horo',
  today: 'today',
};

export type StartParamRoute = {
  view: string;
  screen?: string;
  todaySection?: string;
};

/** короткий код → экран приложения (обратная сторона SECTION_TO_CODE) */
const CODE_TO_ROUTE: Record<string, StartParamRoute> = {
  dc: { view: 'dashboard', screen: 'daily_card', todaySection: 'daily-card' },
  pd: { view: 'dashboard', screen: 'pulse_day', todaySection: 'pulse' },
  pday: { view: 'dashboard', screen: 'checkin', todaySection: 'checkin' },
  btime: { view: 'dashboard', screen: 'best_time', todaySection: 'best-time' },
  mwin: { view: 'dashboard', screen: 'mini_win', todaySection: 'mini-win' },
  natal: { view: 'chart' },
  natalx: { view: 'chart' },
  love: { view: 'horoscope' },
  money: { view: 'horoscope' },
  work: { view: 'horoscope' },
  prem: { view: 'dashboard' },
  compat: { view: 'union' },
  chat: { view: 'oracle' },
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
 * Пусто, если NEXT_PUBLIC_TELEGRAM_BOT_USERNAME не задан — тогда вызывающий код
 * откатывается на старый web-deep-link (поведение не ломается).
 */
export function buildMiniAppButtonUrl(section: string | null | undefined, logId?: number | null): string {
  const bot = getBotUsername();
  if (!bot) return '';
  const code = sectionToStartCode(section);
  const param = logId != null && Number.isFinite(Number(logId)) ? `${code}-${logId}` : code;
  return `https://t.me/${bot}?startapp=${param}`;
}
