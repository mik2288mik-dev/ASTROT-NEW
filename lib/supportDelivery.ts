import { logger } from './logger';
import { sendTelegramTextMessage } from './telegramBot';

export const SUPPORT_CATEGORIES = ['problem', 'idea', 'payment', 'question', 'other'] as const;
export type SupportCategory = typeof SUPPORT_CATEGORIES[number];

export type SupportDiagnostics = {
  appVersion?: string;
  versionCode?: string;
  platform?: string;
  lastScreen?: string;
  distributionChannel?: string;
};

export type SupportTicketPayload = {
  category: SupportCategory;
  message: string;
  replyEmail: string | null;
  diagnostics: SupportDiagnostics | null;
};

export type SupportDeliveryInput = SupportTicketPayload & {
  ticketId: number;
};

export type SupportDeliveryResult = {
  channel: 'email' | 'telegram';
  result: 'sent' | 'failed' | 'unconfigured';
};

export type SupportDeliveryChannel = SupportDeliveryResult['channel'];

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const SUPPORT_DELIVERY_TIMEOUT_MS = 5_000;
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 4_000;
const TOP_LEVEL_KEYS = new Set(['category', 'message', 'replyEmail', 'diagnostics']);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const APP_VERSION_PATTERN = /^\d{1,5}(?:\.\d{1,5}){1,3}(?:[-+][0-9A-Za-z.-]{1,24})?$/u;
const MAX_VERSION_CODE = 2_100_000_000;
const SUPPORT_PLATFORMS = ['android', 'web'] as const;
const SUPPORT_LAST_SCREENS = ['settings.feedback'] as const;
const SUPPORT_DISTRIBUTION_CHANNELS = [
  'telegram',
  'rustore',
  'google_play',
  'development',
] as const;

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  problem: 'Ошибка',
  idea: 'Пожелание',
  payment: 'Оплата',
  question: 'Вопрос',
  other: 'Другое',
};

export class SupportPayloadError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalDiagnosticString(value: unknown, key: keyof SupportDiagnostics): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value !== value.trim() || CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new SupportPayloadError('SUPPORT_DIAGNOSTICS_INVALID', `Invalid ${key}`);
  }
  return value;
}

function parseAppVersion(value: unknown): string | undefined {
  const version = optionalDiagnosticString(value, 'appVersion');
  if (version !== undefined && !APP_VERSION_PATTERN.test(version)) {
    throw new SupportPayloadError('SUPPORT_DIAGNOSTICS_INVALID', 'Invalid appVersion');
  }
  return version;
}

function parseVersionCode(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = typeof value === 'number'
    ? value
    : (typeof value === 'string' && /^\d{1,10}$/u.test(value) ? Number(value) : Number.NaN);
  if (!Number.isSafeInteger(numeric) || numeric < 1 || numeric > MAX_VERSION_CODE) {
    throw new SupportPayloadError('SUPPORT_DIAGNOSTICS_INVALID', 'Invalid versionCode');
  }
  return String(numeric);
}

function parseDiagnosticEnum<const T extends readonly string[]>(
  value: unknown,
  key: keyof SupportDiagnostics,
  allowed: T,
): T[number] | undefined {
  const normalized = optionalDiagnosticString(value, key);
  if (normalized !== undefined && !allowed.includes(normalized)) {
    throw new SupportPayloadError('SUPPORT_DIAGNOSTICS_INVALID', `Invalid ${key}`);
  }
  return normalized as T[number] | undefined;
}

function parseDiagnostics(value: unknown): SupportDiagnostics | null {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) throw new SupportPayloadError('SUPPORT_DIAGNOSTICS_INVALID', 'diagnostics must be an object');
  const allowedKeys = new Set<keyof SupportDiagnostics>([
    'appVersion',
    'versionCode',
    'platform',
    'lastScreen',
    'distributionChannel',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key as keyof SupportDiagnostics)) {
      throw new SupportPayloadError('SUPPORT_DIAGNOSTICS_INVALID', `Unknown diagnostics field: ${key}`);
    }
  }
  const diagnostics: SupportDiagnostics = {
    appVersion: parseAppVersion(value.appVersion),
    versionCode: parseVersionCode(value.versionCode),
    platform: parseDiagnosticEnum(value.platform, 'platform', SUPPORT_PLATFORMS),
    lastScreen: parseDiagnosticEnum(value.lastScreen, 'lastScreen', SUPPORT_LAST_SCREENS),
    distributionChannel: parseDiagnosticEnum(
      value.distributionChannel,
      'distributionChannel',
      SUPPORT_DISTRIBUTION_CHANNELS,
    ),
  };
  for (const key of Object.keys(diagnostics) as Array<keyof SupportDiagnostics>) {
    if (diagnostics[key] === undefined) delete diagnostics[key];
  }
  return Object.keys(diagnostics).length ? diagnostics : null;
}

function parseReplyEmail(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new SupportPayloadError('SUPPORT_REPLY_EMAIL_INVALID', 'replyEmail must be a string');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || /[\r\n]/u.test(email) || !EMAIL_PATTERN.test(email)) {
    throw new SupportPayloadError('SUPPORT_REPLY_EMAIL_INVALID', 'Укажите корректный email для ответа');
  }
  return email;
}

export function parseSupportTicketPayload(value: unknown): SupportTicketPayload {
  if (!isPlainObject(value)) throw new SupportPayloadError('SUPPORT_BODY_INVALID', 'Request body must be an object');
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) throw new SupportPayloadError('SUPPORT_BODY_INVALID', `Unknown field: ${key}`);
  }
  if (typeof value.category !== 'string' || !SUPPORT_CATEGORIES.includes(value.category as SupportCategory)) {
    throw new SupportPayloadError('SUPPORT_CATEGORY_INVALID', 'Выберите тип обращения');
  }
  if (typeof value.message !== 'string') {
    throw new SupportPayloadError('SUPPORT_MESSAGE_INVALID', 'Опишите обращение');
  }
  const message = value.message.trim();
  if (
    message.length < MESSAGE_MIN_LENGTH
    || message.length > MESSAGE_MAX_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(message)
  ) {
    throw new SupportPayloadError(
      'SUPPORT_MESSAGE_INVALID',
      `Сообщение должно содержать от ${MESSAGE_MIN_LENGTH} до ${MESSAGE_MAX_LENGTH} символов`,
    );
  }
  return {
    category: value.category as SupportCategory,
    message,
    replyEmail: parseReplyEmail(value.replyEmail),
    diagnostics: parseDiagnostics(value.diagnostics),
  };
}

export function buildSupportSubject(category: SupportCategory): string {
  return `NEBO: ${CATEGORY_LABELS[category]}`;
}

export function serializeSupportMetadata(payload: SupportTicketPayload): string {
  return JSON.stringify({
    category: payload.category,
    ...(payload.replyEmail ? { replyEmail: payload.replyEmail } : {}),
    ...(payload.diagnostics ? { diagnostics: payload.diagnostics } : {}),
  });
}

export function parseSupportMetadata(value: unknown): Pick<SupportTicketPayload, 'category' | 'replyEmail' | 'diagnostics'> | null {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value);
    if (!isPlainObject(parsed) || !SUPPORT_CATEGORIES.includes(parsed.category as SupportCategory)) return null;
    return {
      category: parsed.category as SupportCategory,
      replyEmail: parseReplyEmail(parsed.replyEmail),
      diagnostics: parseDiagnostics(parsed.diagnostics),
    };
  } catch {
    return null;
  }
}

function validConfiguredValue(value: unknown): string {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.includes('_REQUIRED') || /^(?:replace-with|your[_-])/iu.test(normalized)) return '';
  return normalized;
}

function firstConfiguredValue(...values: unknown[]): string {
  for (const value of values) {
    const configured = validConfiguredValue(value);
    if (configured) return configured;
  }
  return '';
}

function validMailbox(value: string): boolean {
  return value.length <= 254 && !/[\r\n]/u.test(value) && EMAIL_PATTERN.test(value);
}

function validSender(value: string): boolean {
  if (!value || value.length > 320 || /[\r\n]/u.test(value)) return false;
  const mailbox = '(?:[^<>\\s@]+@[^<>\\s@]+\\.[^<>\\s@]+)';
  return new RegExp(`^(?:${mailbox}|[^<>]{1,200}<${mailbox}>)$`).test(value);
}

function diagnosticsText(diagnostics: SupportDiagnostics | null): string {
  if (!diagnostics) return 'Не приложены';
  return (Object.entries(diagnostics) as Array<[keyof SupportDiagnostics, string]>)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function versionText(diagnostics: SupportDiagnostics | null): string {
  const version = diagnostics?.appVersion;
  const code = diagnostics?.versionCode;
  if (version && code) return `${version} (${code})`;
  return version || code || 'не указана';
}

function supportAdminUrl(): string {
  const configured = validConfiguredValue(process.env.SUPPORT_ADMIN_URL);
  if (!configured) return '';
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function logDelivery(ticketId: number, channel: SupportDeliveryResult['channel'], result: SupportDeliveryResult['result']): void {
  const payload = {
    scope: 'support',
    event: 'support_delivery',
    status: result,
    metadata: { ticketId, channel, result },
  };
  if (result === 'sent') logger.info(payload);
  else logger.warn(payload);
}

async function sendSupportEmail(input: SupportDeliveryInput): Promise<SupportDeliveryResult> {
  const apiKey = validConfiguredValue(process.env.RESEND_API_KEY);
  const to = firstConfiguredValue(process.env.SUPPORT_EMAIL_TO, process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
  const from = firstConfiguredValue(process.env.SUPPORT_EMAIL_FROM, process.env.AUTH_EMAIL_FROM);
  if (!apiKey || !validMailbox(to) || !validSender(from)) return { channel: 'email', result: 'unconfigured' };
  try {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': `support-ticket-${input.ticketId}-email-v1`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(input.replyEmail ? { reply_to: input.replyEmail } : {}),
        subject: `${buildSupportSubject(input.category)} #${input.ticketId}`,
        text: [
          `Новое обращение NEBO #${input.ticketId}`,
          `Категория: ${CATEGORY_LABELS[input.category]}`,
          `Email для ответа: ${input.replyEmail || 'не указан'}`,
          '',
          'Технические данные:',
          diagnosticsText(input.diagnostics),
          '',
          'Текст обращения:',
          input.message,
        ].join('\n'),
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(SUPPORT_DELIVERY_TIMEOUT_MS),
    });
    return { channel: 'email', result: response.ok ? 'sent' : 'failed' };
  } catch {
    return { channel: 'email', result: 'failed' };
  }
}

async function sendSupportTelegram(input: SupportDeliveryInput): Promise<SupportDeliveryResult> {
  const chatId = firstConfiguredValue(process.env.SUPPORT_TELEGRAM_CHAT_ID, process.env.OWNER_ID);
  if (!chatId) return { channel: 'telegram', result: 'unconfigured' };
  try {
    const adminUrl = supportAdminUrl();
    const result = await sendTelegramTextMessage(
      chatId,
      [
        `Новое обращение NEBO #${input.ticketId}`,
        `Категория: ${CATEGORY_LABELS[input.category]}`,
        `Версия: ${versionText(input.diagnostics)}`,
        `Канал: ${input.diagnostics?.distributionChannel || 'не указан'}`,
      ].join('\n'),
      adminUrl
        ? { replyMarkup: { inline_keyboard: [[{ text: 'Открыть админку', url: adminUrl }]] } }
        : undefined,
    );
    return { channel: 'telegram', result: result.ok ? 'sent' : 'failed' };
  } catch {
    return { channel: 'telegram', result: 'failed' };
  }
}

export async function deliverSupportTicketChannel(
  input: SupportDeliveryInput,
  channel: SupportDeliveryChannel,
): Promise<SupportDeliveryResult> {
  const delivery = channel === 'email'
    ? await sendSupportEmail(input)
    : await sendSupportTelegram(input);
  logDelivery(input.ticketId, delivery.channel, delivery.result);
  return delivery;
}

export async function deliverSupportTicket(input: SupportDeliveryInput): Promise<SupportDeliveryResult[]> {
  return Promise.all([
    deliverSupportTicketChannel(input, 'email'),
    deliverSupportTicketChannel(input, 'telegram'),
  ]);
}

export async function sendSupportTelegramReply(input: {
  ticketId: number;
  chatId: string;
  message: string;
}): Promise<SupportDeliveryResult> {
  let result: SupportDeliveryResult;
  try {
    const sent = await sendTelegramTextMessage(input.chatId, `Поддержка NEBO:\n\n${input.message}`);
    result = { channel: 'telegram', result: sent.ok ? 'sent' : 'failed' };
  } catch {
    result = { channel: 'telegram', result: 'failed' };
  }
  logDelivery(input.ticketId, result.channel, result.result);
  return result;
}

export async function sendSupportEmailReply(input: {
  ticketId: number;
  messageId: number;
  to: string;
  message: string;
}): Promise<SupportDeliveryResult> {
  const apiKey = validConfiguredValue(process.env.RESEND_API_KEY);
  const from = firstConfiguredValue(process.env.SUPPORT_EMAIL_FROM, process.env.AUTH_EMAIL_FROM);
  if (!apiKey || !validSender(from)) {
    const result = { channel: 'email', result: 'unconfigured' } as const;
    logDelivery(input.ticketId, result.channel, result.result);
    return result;
  }
  if (
    !Number.isSafeInteger(input.ticketId)
    || input.ticketId < 1
    || !Number.isSafeInteger(input.messageId)
    || input.messageId < 1
    || !validMailbox(input.to)
    || !input.message
    || input.message.length > MESSAGE_MAX_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(input.message)
  ) {
    const result = { channel: 'email', result: 'failed' } as const;
    logDelivery(input.ticketId, result.channel, result.result);
    return result;
  }
  let result: SupportDeliveryResult;
  try {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': `support-ticket-${input.ticketId}-reply-${input.messageId}-email-v1`,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `Ответ поддержки NEBO #${input.ticketId}`,
        text: input.message,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(SUPPORT_DELIVERY_TIMEOUT_MS),
    });
    result = { channel: 'email', result: response.ok ? 'sent' : 'failed' };
  } catch {
    result = { channel: 'email', result: 'failed' };
  }
  logDelivery(input.ticketId, result.channel, result.result);
  return result;
}
