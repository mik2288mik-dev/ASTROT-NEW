import { createHash } from 'crypto';

type AlertConfig = { token: string; chatId: string };

const DEDUPE_MS = 5 * 60 * 1000;
const MAX_ALERTS_PER_HOUR = 20;
const REQUEST_TIMEOUT_MS = 8_000;
const recentFingerprints = new Map<string, number>();
const sentAt: number[] = [];

const globalState = globalThis as typeof globalThis & {
  __neboOwnerErrorAlertsInstalled?: boolean;
  __neboOwnerErrorOriginalConsoleError?: typeof console.error;
};

function getConfig(): AlertConfig | null {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') return null;
  if (process.env.NEBO_ERROR_ALERTS_ENABLED === '0') return null;

  const token = String(
    process.env.NEBO_ERRORS_BOT_TOKEN
      || process.env.NEBO_OPS_BOT_TOKEN
      || process.env.NEBO_ANALYTICS_BOT_TOKEN
      || '',
  ).trim();
  const chatId = String(
    process.env.NEBO_ERRORS_CHAT_ID
      || process.env.NEBO_OPS_CHAT_ID
      || process.env.OWNER_ID
      || '',
  ).trim();

  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  if (!/^-?\d{1,16}$/.test(chatId)) return null;
  return { token, chatId };
}

function redact(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, '[redacted-openai-key]')
    .replace(/\b\d{5,}:[A-Za-z0-9_-]{20,}\b/g, '[redacted-telegram-token]')
    .replace(/(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s/]+(@)/gi, '$1[redacted]$2')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[redacted]')
    .replace(/(["']?(?:authorization|cookie|token|secret|password|api[_-]?key|access[_-]?token|refresh[_-]?token)["']?\s*[:=]\s*["']?)[^"',}\s]+/gi, '$1[redacted]')
    .replace(/([?&](?:token|key|secret|code|state|auth|signature)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderArg(value: unknown): { text: string; stack?: string } {
  if (value instanceof Error) {
    return {
      text: redact(`${value.name}: ${value.message}`).slice(0, 1_200),
      stack: value.stack ? redact(value.stack).slice(0, 1_600) : undefined,
    };
  }
  if (typeof value === 'string') return { text: redact(value).slice(0, 1_200) };
  try {
    return { text: redact(JSON.stringify(value)).slice(0, 1_200) };
  } catch {
    return { text: redact(String(value)).slice(0, 1_200) };
  }
}

function normalizeFingerprint(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b-?\d{2,}\b/g, '<num>')
    .slice(0, 700);
}

function canSend(fingerprint: string, now: number): boolean {
  for (const [key, timestamp] of recentFingerprints) {
    if (now - timestamp > DEDUPE_MS) recentFingerprints.delete(key);
  }
  const previous = recentFingerprints.get(fingerprint);
  if (previous && now - previous < DEDUPE_MS) return false;

  while (sentAt.length && now - sentAt[0] > 60 * 60 * 1000) sentAt.shift();
  if (sentAt.length >= MAX_ALERTS_PER_HOUR) return false;

  recentFingerprints.set(fingerprint, now);
  sentAt.push(now);
  return true;
}

function runtimeLabel(): string {
  if (process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_SERVICE_ID) return 'Railway';
  return 'Timeweb / Node';
}

function serverVersion(): string {
  const value = String(
    process.env.RAILWAY_GIT_COMMIT_SHA
      || process.env.NEBO_DEPLOY_MARKER
      || process.env.GIT_COMMIT_SHA
      || '',
  ).trim();
  return /^[A-Za-z0-9._:-]{5,80}$/.test(value) ? value : '';
}

async function sendAlert(args: unknown[]): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const rendered = args.slice(0, 8).map(renderArg);
  const message = rendered.map((item) => item.text).filter(Boolean).join(' | ').slice(0, 1_800);
  if (!message) return;

  const fingerprint = createHash('sha256')
    .update(normalizeFingerprint(message))
    .digest('hex')
    .slice(0, 12);
  const now = Date.now();
  if (!canSend(fingerprint, now)) return;

  const stack = rendered.find((item) => item.stack)?.stack;
  const version = serverVersion();
  const lines = [
    '🚨 NEBO · Ошибка сервера',
    `🖥 ${runtimeLabel()}`,
    `🕒 ${new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(now))} МСК`,
    `🔎 ID ошибки: ${fingerprint}`,
    ...(version ? [`📦 Версия: ${version}`] : []),
    '',
    `🧾 ${message}`,
    ...(stack ? ['', `📚 ${stack}`] : []),
  ];

  try {
    await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: lines.join('\n').slice(0, 3_900),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Never recurse into console.error from the error reporter itself.
  }
}

export function installOwnerErrorAlerts(): void {
  if (globalState.__neboOwnerErrorAlertsInstalled) return;
  globalState.__neboOwnerErrorAlertsInstalled = true;

  const original = console.error.bind(console);
  globalState.__neboOwnerErrorOriginalConsoleError = original;
  console.error = (...args: unknown[]) => {
    original(...args);
    void sendAlert(args);
  };

  process.on('unhandledRejection', (reason) => {
    original('[unhandledRejection]', reason);
    void sendAlert(['[unhandledRejection]', reason]);
  });

  process.on('uncaughtExceptionMonitor', (error, origin) => {
    original('[uncaughtException]', origin, error);
    void sendAlert(['[uncaughtException]', origin, error]);
  });
}
