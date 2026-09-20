import { createHash } from 'crypto';

const RELAY_CONTEXT = 'nebo-telegram-relay-v1';

function configuredRelayUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = String(env.NEBO_TELEGRAM_RELAY_URL || '').trim().replace(/\/$/u, '');
  return /^https:\/\//u.test(value) ? value : null;
}

function relayAuthorization(env: NodeJS.ProcessEnv = process.env): string | null {
  const apiKey = String(env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;
  return createHash('sha256').update(`${RELAY_CONTEXT}:${apiKey}`).digest('hex');
}

export function useTelegramRelay(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENAI_RELAY_DIRECT !== '1' && configuredRelayUrl(env) !== null && relayAuthorization(env) !== null;
}

export function telegramRelayAuthorized(value: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = relayAuthorization(env);
  return Boolean(expected && value === expected);
}

/**
 * Timeweb cannot currently reach api.telegram.org reliably. In that runtime a
 * narrowly authenticated Railway route performs the same Bot API request. The
 * route is intentionally limited to JSON Bot API methods: no arbitrary URL or
 * header forwarding is possible.
 */
export async function telegramApiRequest(
  token: string,
  method: string,
  payload?: unknown,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  const relayUrl = configuredRelayUrl();
  const authorization = relayAuthorization();
  if (useTelegramRelay() && relayUrl && authorization) {
    return fetch(relayUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authorization}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token, method, payload: payload ?? {} }),
      signal: options?.signal,
    });
  }

  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
    signal: options?.signal,
  });
}

