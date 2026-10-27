import { SIGN_HOROSCOPE_MODEL } from './horoscope/signContract';

/** One AI provider key as seen by the server: set, accepted, and what is known about money. */
export type AiKeyStatus = {
  provider: 'deepseek' | 'openai' | 'anthropic';
  label: string;
  configured: boolean;
  ok: boolean;
  httpStatus?: number;
  error?: string;
  /** DeepSeek only: the account balance it reports. */
  balance?: string;
  /** DeepSeek only: whether the sign horoscope model is still served. */
  modelAvailable?: boolean;
  /** Where to top up or see spending, since OpenAI and Anthropic expose no balance to ordinary keys. */
  billingUrl: string;
};

export type AiKeysStatus = { checkedAt: string; keys: AiKeyStatus[] };

// Every check below is a free read-only call (balance or model list); nothing is generated.
const TIMEOUT_MS = 10_000;
const CACHE_MS = 60_000;
let cache: { at: number; value: AiKeysStatus } | null = null;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string; type?: string } | string; message?: string };
    const message = typeof body.error === 'string' ? body.error : body.error?.message || body.error?.type || body.message || '';
    return String(message).replace(/(sk|key)[-_a-zA-Z0-9*]{6,}/g, '***').slice(0, 160);
  } catch {
    return '';
  }
}

async function call(url: string, headers: Record<string, string>): Promise<Response | Error> {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

async function checkDeepSeek(key: string): Promise<AiKeyStatus> {
  const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const status: AiKeyStatus = { provider: 'deepseek', label: 'DeepSeek', configured: true, ok: false, billingUrl: 'https://platform.deepseek.com/top_up' };
  const headers = { authorization: `Bearer ${key}` };
  const [balance, models] = await Promise.all([call(`${base}/user/balance`, headers), call(`${base}/models`, headers)]);
  if (balance instanceof Error) return { ...status, error: balance.message.slice(0, 120) };
  status.httpStatus = balance.status;
  if (!balance.ok) return { ...status, error: await readError(balance) };
  const info = (await balance.json()) as { is_available?: boolean; balance_infos?: Array<{ total_balance?: string; currency?: string }> };
  const first = info.balance_infos?.[0];
  status.ok = info.is_available !== false;
  status.balance = first ? `${first.total_balance} ${first.currency}` : undefined;
  if (!status.ok) status.error = 'на счёте нет денег';
  if (!(models instanceof Error) && models.ok) {
    const list = (await models.json()) as { data?: Array<{ id?: string }> };
    status.modelAvailable = (list.data || []).some((m) => m.id === SIGN_HOROSCOPE_MODEL);
    if (!status.modelAvailable) {
      status.ok = false;
      status.error = `модель ${SIGN_HOROSCOPE_MODEL} больше не доступна`;
    }
  }
  return status;
}

async function checkOpenAI(key: string): Promise<AiKeyStatus> {
  const status: AiKeyStatus = { provider: 'openai', label: 'OpenAI', configured: true, ok: false, billingUrl: 'https://platform.openai.com/settings/organization/billing/overview' };
  const response = await call('https://api.openai.com/v1/models', { authorization: `Bearer ${key}` });
  if (response instanceof Error) return { ...status, error: response.message.slice(0, 120) };
  return { ...status, ok: response.ok, httpStatus: response.status, ...(response.ok ? {} : { error: await readError(response) }) };
}

async function checkAnthropic(key: string): Promise<AiKeyStatus> {
  const status: AiKeyStatus = { provider: 'anthropic', label: 'Claude', configured: true, ok: false, billingUrl: 'https://console.anthropic.com/settings/billing' };
  const response = await call('https://api.anthropic.com/v1/models', { 'x-api-key': key, 'anthropic-version': '2023-06-01' });
  if (response instanceof Error) return { ...status, error: response.message.slice(0, 120) };
  return { ...status, ok: response.ok, httpStatus: response.status, ...(response.ok ? {} : { error: await readError(response) }) };
}

const MISSING = (provider: AiKeyStatus['provider'], label: string, billingUrl: string): AiKeyStatus => ({ provider, label, configured: false, ok: false, error: 'ключ не задан', billingUrl });

export async function getAiKeysStatus(options: { fresh?: boolean } = {}): Promise<AiKeysStatus> {
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const ds = String(process.env.DEEPSEEK_API_KEY || '').trim();
  const oa = String(process.env.OPENAI_API_KEY || '').trim();
  const an = String(process.env.ANTHROPIC_API_KEY || '').trim();
  const keys = await Promise.all([
    an ? checkAnthropic(an) : MISSING('anthropic', 'Claude', 'https://console.anthropic.com/settings/billing'),
    ds ? checkDeepSeek(ds) : MISSING('deepseek', 'DeepSeek', 'https://platform.deepseek.com/top_up'),
    oa ? checkOpenAI(oa) : MISSING('openai', 'OpenAI', 'https://platform.openai.com/settings/organization/billing/overview'),
  ]);
  const value = { checkedAt: new Date().toISOString(), keys };
  cache = { at: Date.now(), value };
  return value;
}
