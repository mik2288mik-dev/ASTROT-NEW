import { getPool } from '../lib/db';
import * as appAuth from '../lib/auth/appAuth';
import * as neboOps from '../lib/neboOps';
import userEventsHandler from '../pages/api/users/events';
import myTrackerHandler from '../pages/api/integrations/mytracker';
import {
  getMyTrackerConfig, isMyTrackerPostbackAuthorized, parseMyTrackerAttribution,
  getOrCreateMyTrackerUserId, recordMyTrackerAttribution,
} from '../lib/myTracker';
import { processSupportDeliveryOutbox } from '../lib/supportOutbox';
import { logger } from '../lib/logger';
import { startServerOperationalDiagnostic } from '../lib/serverOperationalDiagnostics';
import {
  enqueueNeboOpsEvent,
  enqueueNeboOpsDailySummary,
  getNeboOpsDailySummaryWindow,
  shouldDeliverNeboOpsEvent,
  getNeboOpsConfig,
  processNeboOpsOutbox,
  renderNeboOpsMessage,
  sanitizeNeboOpsPayload,
  sendNeboOpsText,
} from '../lib/neboOps';
import {
  normalizeNotificationTelegramChatId,
  resolveNotificationTelegramRecipient,
} from '../services/notificationRetentionService';

jest.mock('../lib/db', () => ({ getPool: jest.fn() }));
jest.mock('../lib/dailyAstroSignalResolver', () => ({ resolveDailyAstroSignalForUser: jest.fn() }));

const OWNER_ID = '123456789';
const TOKEN = '123456:abcdefghijklmnopqrstuvwxyz_TEST';
const originalEnv = process.env;
const query = jest.fn();
const deliveryQuery = jest.fn();
const release = jest.fn();
const connect = jest.fn();
const processState = globalThis as typeof globalThis & { __neboOpsWorkerV1?: unknown };
let fetchMock: jest.SpiedFunction<typeof fetch>;

function telegramResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function claimOneEvent(attempts = 1, userExists = true) {
  query.mockImplementation(async (sql: string, values?: unknown[]) => {
    if (sql.includes('RETURNING id, event_type, user_id')) {
      return { rows: [{
        id: '41', event_type: 'login', user_id: '-9001',
        payload_json: { isFirstLogin: true, provider: 'telegram' },
        occurred_at: '2026-09-04T20:00:07Z', attempts, lease_token: values?.[1],
      }] };
    }
    if (sql.includes('SELECT u.name, u.language, u.auth_provider')) {
      return { rows: userExists ? [{ name: 'Лёша', language: 'ru', auth_provider: 'telegram' }] : [] };
    }
    return { rows: [], rowCount: 1 };
  });
}

beforeEach(() => {
  process.env = {
    ...originalEnv, NODE_ENV: 'test', NEBO_OPS_TELEGRAM_ENABLED: '1',
    NEBO_OPS_BOT_TOKEN: TOKEN, NEBO_OPS_CHAT_ID: OWNER_ID, OWNER_ID,
  };
  delete processState.__neboOpsWorkerV1;
  query.mockReset();
  release.mockReset();
  deliveryQuery.mockReset().mockImplementation(async (sql: string) => {
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
    if (sql.startsWith('SELECT next_send_at, cooldown_until')) {
      return { rows: [{ next_send_at: new Date(0), cooldown_until: new Date(0) }] };
    }
    return { rows: [], rowCount: 1 };
  });
  connect.mockReset().mockResolvedValue({ query: deliveryQuery, release });
  (getPool as jest.Mock).mockReturnValue({ query, connect });
  fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    telegramResponse(200, { ok: true, result: { message_id: 555 } }),
  );
});

afterEach(() => {
  process.env = originalEnv;
  delete processState.__neboOpsWorkerV1;
  jest.restoreAllMocks();
});

describe('NEBO owner notification configuration', () => {
  it('uses only the configured owner, with the analytics token as a fallback', () => {
    expect(getNeboOpsConfig()).toEqual({ token: TOKEN, chatId: OWNER_ID });
    expect(getNeboOpsConfig({
      NODE_ENV: 'test', NEBO_OPS_TELEGRAM_ENABLED: '1', NEBO_ANALYTICS_BOT_TOKEN: TOKEN, OWNER_ID,
    })).toEqual({ token: TOKEN, chatId: OWNER_ID });
  });

  it.each([
    { NEBO_OPS_TELEGRAM_ENABLED: '0' },
    { NEBO_OPS_CHAT_ID: '987654321' },
    { OWNER_ID: '-10012345', NEBO_OPS_CHAT_ID: '-10012345' },
    { OWNER_ID: '0', NEBO_OPS_CHAT_ID: '0' },
    { NEBO_OPS_BOT_TOKEN: 'invalid-token', NEBO_ANALYTICS_BOT_TOKEN: '' },
  ])('rejects disabled or unsafe configuration: %j', (override) => {
    expect(getNeboOpsConfig({ ...process.env, ...override })).toBeNull();
  });

  it('does not call Telegram when the destination differs from the owner', async () => {
    process.env.NEBO_OPS_CHAT_ID = '987654321';
    await expect(sendNeboOpsText('Проверка')).resolves.toEqual({ ok: false, error: 'OPS_UNCONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('operational data and message formatting', () => {
  it('keeps the operational allowlist and drops arbitrary payload, private text and credentials', () => {
    const sanitized = sanitizeNeboOpsPayload({
      isFirstLogin: true, provider: 'vk_id', runtime: 'native', eventType: 'screen_view',
      section: 'natal_reading', planId: 'monthly', starsAmount: 200,
      name: 'PRIVATE_NAME', email: 'PRIVATE_EMAIL', birthDate: 'PRIVATE_BIRTH',
      question: 'PRIVATE_QUESTION', password: 'PRIVATE_PASSWORD',
      receipt: 'PRIVATE_RECEIPT', error: 'PRIVATE_ERROR', token: 'PRIVATE_TOKEN',
      eventPayload: {
        period: 'month', depth_pct: 75, currency: 'RUB', price_micros: 199000000,
        question: 'PRIVATE_QUESTION', birthPlace: 'PRIVATE_PLACE', receipt: 'PRIVATE_RECEIPT',
        nested: { token: 'PRIVATE_NESTED_TOKEN' },
      },
    });
    expect(sanitized).toEqual({
      isFirstLogin: true, provider: 'vk_id', runtime: 'native', eventType: 'screen_view',
      section: 'natal_reading', planId: 'monthly', starsAmount: 200,
      eventPayload: { period: 'month', depth_pct: 75, currency: 'RUB', price_micros: 199000000 },
    });
    expect(JSON.stringify(sanitized)).not.toContain('PRIVATE_');
    expect(sanitizeNeboOpsPayload({
      provider: 'unknown', section: 'custom_screen', eventType: 'custom_action',
      planId: 'private@example.com', starsAmount: -1, amountMinor: Infinity,
      currency: 'rub', eventPayload: { reason_code: 'raw error with private text', depth_pct: NaN },
    })).toEqual({ eventPayload: {} });
  });

  it('renders first login like the owner example, with actual event time including Moscow seconds', () => {
    const message = renderNeboOpsMessage({
      event_type: 'login', user_id: '9000000003446',
      occurred_at: '2026-09-04T16:03:09Z',
      payload_json: { isFirstLogin: true, provider: 'vk_id', runtime: 'native', question: 'PRIVATE_QUESTION' },
    }, { name: '@vk_38523093', language: 'ru' });
    expect(message.split('\n')).toEqual([
      '👤 Первый вход', '🙋 @vk_38523093 · ID 9000000003446',
      '🔐 Вход: VK ID', '📱 Платформа: Приложение',
      '🎯 Источник установки: не определён', '🌐 Язык: ru',
      '🕒 04.09.2026, 19:03:09 МСК',
    ]);
    expect(message).not.toContain('PRIVATE_QUESTION');
    expect(message).not.toContain('MyTracker');
  });

  it('distinguishes a server-confirmed payment from the client reporting a purchase', () => {
    const base = { user_id: '9001', occurred_at: '2026-09-04T16:03:09Z' };
    const confirmed = renderNeboOpsMessage({
      ...base, event_type: 'payment_confirmed',
      payload_json: { provider: 'rustore', productId: 'monthly', amountMinor: 19900, currency: 'RUB' },
    });
    const client = renderNeboOpsMessage({
      ...base, event_type: 'activity', payload_json: { eventType: 'purchase_success' },
    });
    expect(confirmed.split('\n')[0]).toBe('💰 Оплата подтверждена сервером');
    expect(confirmed).toContain('💵 Сумма: 199.00 RUB');
    expect(client.split('\n')[0]).toBe('📲 Приложение сообщило об оплате');
    expect(client).not.toContain('подтверждена сервером');
  });

  it('waits for MyTracker only for an associated SDK account and labels a known account source', () => {
    const row = {
      event_type: 'login', user_id: '-9001', occurred_at: '2026-09-04T20:00:00Z',
      payload_json: { runtime: 'native' },
    };
    expect(renderNeboOpsMessage(row)).toContain('Источник установки: не определён');
    expect(renderNeboOpsMessage(row, { mytracker_id: 'known-sdk-account' })).toContain('ожидаем MyTracker');
    const known = renderNeboOpsMessage(row, {
      mytracker_id: 'known-sdk-account', attribution_source: 'VK Ads',
      attribution_campaign: 'NEBO · Сентябрь', attribution_at: '2026-09-04T18:00:00Z',
    });
    expect(known).toContain('Источник аккаунта (MyTracker): VK Ads');
    expect(known).toContain('📣 Кампания: NEBO · Сентябрь');
    expect(known).toContain('04.09.2026, 21:00 МСК');
    expect(known).not.toContain('ожидаем');
  });

  it('renders late attribution separately without exposing raw callbacks or unresolved macros', () => {
    const message = renderNeboOpsMessage({
      event_type: 'attribution_received', user_id: '-9001', occurred_at: '2026-09-04T20:00:00Z',
      payload_json: {
        attributionSource: 'VK Ads', attributionCampaign: 'NEBO\nСентябрь',
        attributionCampaignId: '1234', attributionAt: '2026-09-04T18:00:00Z',
        token: 'PRIVATE_SECRET', deeplink: 'PRIVATE_LINK', profileId: 'PRIVATE_DEVICE',
      },
    });
    expect(message).toContain('🎯 MyTracker · Источник определён');
    expect(message).toContain('📍 Источник: VK Ads');
    expect(message).toContain('📣 Кампания: NEBO Сентябрь');
    expect(message).not.toContain('PRIVATE_');
    expect(sanitizeNeboOpsPayload({
      attributionSource: '{mt_traffic_source}', attributionCampaignId: '{mt_campaign_id}',
    })).toEqual({});
  });
});

describe('durable owner notification queue', () => {
  it('notifies only about logins, opening payment and the daily report', async () => {
    expect(shouldDeliverNeboOpsEvent('login')).toBe(true);
    expect(shouldDeliverNeboOpsEvent('activity', { eventType: 'paywall_view' })).toBe(true);
    expect(shouldDeliverNeboOpsEvent('daily_summary')).toBe(true);
    for (const eventType of ['hourly_summary', 'support_ticket', 'ai_error', 'payment_confirmed', 'attribution_received']) {
      expect(shouldDeliverNeboOpsEvent(eventType)).toBe(false);
    }
    for (const eventType of ['screen_view', 'checkout_start', 'question_sent', 'purchase_success']) {
      expect(shouldDeliverNeboOpsEvent('activity', { eventType })).toBe(false);
    }
    await enqueueNeboOpsEvent({ query } as any, {
      eventKey: 'activity:quiet', eventType: 'activity', userId: '-9001', payload: { eventType: 'screen_view' },
    });
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'))!;
    expect(insert[1].slice(5)).toEqual(['dead', 'OWNER_SCOPE_FILTERED']);
  });

  it('retires old noisy queue entries without sending them to Telegram', async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('RETURNING id, event_type, user_id')) return { rows: [{
        id: '41', event_type: 'activity', user_id: '-9001', payload_json: { eventType: 'screen_view' },
        occurred_at: '2026-09-04T20:00:07Z', attempts: 1, lease_token: values?.[1],
      }] };
      return { rows: [], rowCount: 1 };
    });
    await expect(processNeboOpsOutbox(1)).resolves.toEqual({ claimed: 1, sent: 0, failed: 0 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE status IN ('pending', 'failed')"));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1 AND lease_token = $2::uuid'), ['41', expect.any(String)]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the event key for database deduplication and stores only sanitized data', async () => {
    const occurredAt = new Date('2026-09-04T16:03:09Z');
    const event = {
      eventKey: 'login:session-42', eventType: 'login', userId: '-9001', occurredAt,
      payload: { isFirstLogin: true, provider: 'telegram', password: 'PRIVATE_PASSWORD' },
    };
    await enqueueNeboOpsEvent({ query } as Parameters<typeof enqueueNeboOpsEvent>[0], event);
    await enqueueNeboOpsEvent({ query } as Parameters<typeof enqueueNeboOpsEvent>[0], event);
    const inserts = query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'));
    expect(inserts).toHaveLength(2);
    for (const [sql, values] of inserts) {
      expect(sql).toContain('ON CONFLICT (event_key) DO NOTHING');
      expect(values).toEqual([
        'login:session-42', 'login', '-9001', JSON.stringify({ isFirstLogin: true, provider: 'telegram' }), occurredAt,
        'pending', null,
      ]);
    }
  });

  it('is a complete no-op when disabled', async () => {
    process.env.NEBO_OPS_TELEGRAM_ENABLED = '0';
    await enqueueNeboOpsEvent({ query } as Parameters<typeof enqueueNeboOpsEvent>[0], {
      eventKey: 'login:session-42', eventType: 'login',
    });
    await expect(processNeboOpsOutbox()).resolves.toEqual({ sent: 0, failed: 0, claimed: 0 });
    expect(query).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores unsupported event types without failing the business transaction', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(enqueueNeboOpsEvent({ query } as Parameters<typeof enqueueNeboOpsEvent>[0], {
      eventKey: 'custom:42', eventType: 'PRIVATE_RAW_PAYLOAD',
    })).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[nebo-ops] invalid notification event rejected');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('PRIVATE_RAW_PAYLOAD');
  });

  it('rolls back only the enqueue savepoint when outbox persistence fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO nebo_ops_outbox')) throw new Error('PRIVATE_DATABASE_ERROR');
      return { rows: [] };
    });
    await expect(enqueueNeboOpsEvent({ query } as Parameters<typeof enqueueNeboOpsEvent>[0], {
      eventKey: 'payment:42', eventType: 'payment_confirmed', userId: '-9001',
    })).resolves.toBeUndefined();
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'SAVEPOINT nebo_ops_enqueue', expect.stringContaining('INSERT INTO nebo_ops_outbox'),
      'ROLLBACK TO SAVEPOINT nebo_ops_enqueue', 'RELEASE SAVEPOINT nebo_ops_enqueue',
    ]);
    expect(query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('PRIVATE_DATABASE_ERROR');
  });

  it('delivers to the owner and fences the successful update with the claimed lease', async () => {
    claimOneEvent();
    await expect(processNeboOpsOutbox(1)).resolves.toEqual({ sent: 1, failed: 0, claimed: 1 });
    const claim = query.mock.calls.find(([sql]) => sql.includes('RETURNING id, event_type, user_id'))!;
    expect(claim[0]).toContain('FOR UPDATE SKIP LOCKED');
    const completed = query.mock.calls.find(([sql]) => sql.includes("SET status = 'sent'"))!;
    expect(completed[0]).toContain("WHERE id = $1 AND lease_token = $2::uuid AND status = 'processing'");
    expect(completed[1]).toEqual(['41', claim[1][1], 555]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const body = JSON.parse(String(request?.body));
    expect(body.chat_id).toBe(OWNER_ID);
    expect(body.text).toContain('👤 Первый вход');
    expect(body.parse_mode).toBeUndefined();
    expect(deliveryQuery).toHaveBeenCalledWith('SELECT pg_advisory_unlock(2026090401)');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 500, body: { ok: false, description: 'PRIVATE_DATABASE_ERROR' }, expectedError: 'TELEGRAM_UNAVAILABLE', expectedDelay: 20 },
    { status: 429, body: { ok: false, parameters: { retry_after: 73 } }, expectedError: 'TELEGRAM_RATE_LIMIT', expectedDelay: 73 },
  ])('persists a fenced retry for HTTP $status', async ({ status, body, expectedError, expectedDelay }) => {
    claimOneEvent(3);
    fetchMock.mockResolvedValue(telegramResponse(status, body));
    await expect(processNeboOpsOutbox(1)).resolves.toEqual({ sent: 0, failed: 1, claimed: 1 });
    const claim = query.mock.calls.find(([sql]) => sql.includes('RETURNING id, event_type, user_id'))!;
    const retry = query.mock.calls.find(([sql]) => sql.includes('next_attempt_at = NOW() + $5'))!;
    expect(retry[0]).toContain("WHERE id = $1 AND lease_token = $2::uuid AND status = 'processing'");
    expect(retry[1]).toEqual(['41', claim[1][1], 12, expectedError, expectedDelay, 0]);
    expect(JSON.stringify(retry)).not.toContain('PRIVATE_DATABASE_ERROR');
    expect(query.mock.calls.some(([sql]) => sql.includes("SET status = 'sent'"))).toBe(false);
    if (status === 429) {
      expect(deliveryQuery).toHaveBeenCalledWith(
        "UPDATE nebo_ops_delivery_state SET cooldown_until = NOW() + $1 * INTERVAL '1 second' WHERE id = 1", [73],
      );
    }
  });

  it('retries a busy sender in two seconds even after eleven reserved attempts', async () => {
    claimOneEvent(11);
    deliveryQuery.mockResolvedValueOnce({ rows: [{ acquired: false }] });
    await processNeboOpsOutbox(1);
    const retry = query.mock.calls.find(([sql]) => sql.includes('next_attempt_at = NOW() + $5'))!;
    expect(retry[0]).toContain('attempts = GREATEST(0, attempts - $6)');
    expect(retry[1].slice(2)).toEqual([12, 'OPS_BUSY', 2, 1]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
    expect(deliveryQuery).not.toHaveBeenCalledWith('SELECT pg_advisory_unlock(2026090401)');
  });

  it('honors a shared Telegram cooldown without consuming an attempt', async () => {
    const now = Date.parse('2026-09-04T20:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    claimOneEvent();
    deliveryQuery
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ next_send_at: new Date(0), cooldown_until: new Date(now + 73000) }] });
    await processNeboOpsOutbox(1);
    const retry = query.mock.calls.find(([sql]) => sql.includes('next_attempt_at = NOW() + $5'))!;
    expect(retry[1].slice(2)).toEqual([12, 'TELEGRAM_RATE_LIMIT', 73, 1]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(deliveryQuery).toHaveBeenCalledWith('SELECT pg_advisory_unlock(2026090401)');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('removes a deleted user event under its lease without sending an identity alert', async () => {
    claimOneEvent(1, false);
    await expect(processNeboOpsOutbox(1)).resolves.toEqual({ sent: 0, failed: 0, claimed: 1 });
    const claim = query.mock.calls.find(([sql]) => sql.includes('RETURNING id, event_type, user_id'))!;
    expect(query).toHaveBeenCalledWith(
      'DELETE FROM nebo_ops_outbox WHERE id = $1 AND lease_token = $2::uuid', ['41', claim[1][1]],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Telegram response validation', () => {
  it.each([
    null,
    { ok: false, result: { message_id: 555 } },
    { ok: true },
    { ok: true, result: { message_id: '555' } },
    { ok: true, result: { message_id: 1.5 } },
  ])('does not report HTTP 200 with invalid Telegram data as delivered: %j', async (body) => {
    fetchMock.mockResolvedValue(telegramResponse(200, body));
    await expect(sendNeboOpsText('Проверка')).resolves.toEqual({ ok: false, error: 'TELEGRAM_UNAVAILABLE' });
  });

  it('does not leak raw network errors', async () => {
    fetchMock.mockRejectedValue(new Error('PRIVATE_TOKEN_AND_NETWORK_DETAILS'));
    await expect(sendNeboOpsText('Проверка')).resolves.toEqual({ ok: false, error: 'TELEGRAM_NETWORK_ERROR' });
  });
});

describe('recipient identity resolution', () => {
  it.each(['-9001', '9000000003446'])('maps canonical account %s to its positive Telegram identity', async (userId) => {
    query.mockResolvedValue({ rows: [{ provider_subject: '38523093' }] });
    await expect(resolveNotificationTelegramRecipient(userId)).resolves.toBe('38523093');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = $1 AND provider = 'telegram' AND verified_at IS NOT NULL"), [userId],
    );
  });

  it('never falls back to an internal account ID when Telegram is not linked', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(resolveNotificationTelegramRecipient('9000000003446')).resolves.toBeNull();
  });

  it.each(['-10012345', '0', '0123', '@user', '1.5', '9007199254740992', '', null, 38523093])(
    'rejects invalid or non-user Telegram destinations: %j', (subject) => {
      expect(normalizeNotificationTelegramChatId(subject)).toBeNull();
    },
  );

  it('rejects a stored negative Telegram subject', async () => {
    query.mockResolvedValue({ rows: [{ provider_subject: '-10012345' }] });
    await expect(resolveNotificationTelegramRecipient('-9001')).resolves.toBeNull();
  });
});

describe('notification integration with committed user actions', () => {
  const transactionQuery = jest.fn();
  const transactionRelease = jest.fn();
  let statements: string[];
  let committed: boolean;
  let failOutbox: boolean;
  let duplicateEvent: boolean;
  let wakeup: jest.SpiedFunction<typeof neboOps.wakeNeboOpsDelivery>;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost/nebo_ops_test';
    process.env.APP_SESSION_SECRET = 'nebo-ops-integration-test-session-secret-32-bytes';
    statements = [];
    committed = false;
    failOutbox = false;
    duplicateEvent = false;
    transactionRelease.mockReset();
    transactionQuery.mockReset().mockImplementation(async (sql: string) => {
      statements.push(sql);
      if (sql === 'COMMIT') {
        expect(fetchMock).not.toHaveBeenCalled();
        committed = true;
      }
      if (sql.includes('AS is_first_login')) {
        return { rowCount: 1, rows: [{ auth_provider: 'vk_id', is_first_login: true }] };
      }
      if (sql.includes('SELECT is_blocked')) {
        return { rowCount: 1, rows: [{ is_blocked: false }] };
      }
      if (sql.includes('INSERT INTO user_app_events')) {
        return { rowCount: duplicateEvent ? 0 : 1, rows: duplicateEvent ? [] : [{ id: '301' }] };
      }
      if (sql.includes('INSERT INTO nebo_ops_outbox') && failOutbox) {
        throw new Error('PRIVATE_OUTBOX_STORAGE_FAILURE');
      }
      return { rowCount: 1, rows: [] };
    });
    connect.mockResolvedValue({ query: transactionQuery, release: transactionRelease });
    wakeup = jest.spyOn(neboOps, 'wakeNeboOpsDelivery').mockImplementation(() => {
      expect(committed).toBe(true);
      statements.push('WAKE_DELIVERY');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  function userEventRequest() {
    jest.spyOn(appAuth, 'requireAppUser').mockResolvedValue({
      userId: '-9001', provider: 'native', isGuest: false,
    });
    const request = {
      method: 'POST', headers: {},
      body: {
        eventId: '6b8af41a-955d-4db1-8bf1-ec0eacc26f59',
        eventType: 'screen_view', section: 'natal_reading',
        eventPayload: { question: 'PRIVATE_QUESTION' },
      },
    } as Parameters<typeof userEventsHandler>[0];
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return {
      request,
      response,
      run: () => userEventsHandler(request, response as unknown as Parameters<typeof userEventsHandler>[1]),
    };
  }

  it('commits a new auth session and its login notification before waking delivery', async () => {
    const session = await appAuth.createAppUserSession({ userId: '-9001', kind: 'native' });
    expect(appAuth.verifyAppSessionToken(session.token)).toMatchObject({ userId: '-9001', provider: 'native' });
    const sessionIndex = statements.findIndex((sql) => sql.includes('INSERT INTO app_sessions'));
    const outboxIndex = statements.findIndex((sql) => sql.includes('INSERT INTO nebo_ops_outbox'));
    const commitIndex = statements.indexOf('COMMIT');
    expect(sessionIndex).toBeGreaterThan(-1);
    expect(outboxIndex).toBeGreaterThan(sessionIndex);
    expect(commitIndex).toBeGreaterThan(outboxIndex);
    expect(statements.indexOf('WAKE_DELIVERY')).toBeGreaterThan(commitIndex);
    const outbox = transactionQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'))!;
    expect(outbox[1].slice(0, 3)).toEqual([`auth:${session.sessionId}`, 'login', '-9001']);
    expect(JSON.parse(outbox[1][3])).toEqual({ isFirstLogin: true, provider: 'vk_id', runtime: 'native' });
    expect(wakeup).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(transactionRelease).toHaveBeenCalledTimes(1);
  });

  it('commits a newly accepted activity and its notification together', async () => {
    const event = userEventRequest();
    await event.run();
    expect(event.response.status).toHaveBeenCalledWith(200);
    expect(event.response.json).toHaveBeenCalledWith({ success: true });
    const activityIndex = statements.findIndex((sql) => sql.includes('INSERT INTO user_app_events'));
    const outboxIndex = statements.findIndex((sql) => sql.includes('INSERT INTO nebo_ops_outbox'));
    const commitIndex = statements.indexOf('COMMIT');
    expect(activityIndex).toBeGreaterThan(-1);
    expect(outboxIndex).toBeGreaterThan(activityIndex);
    expect(commitIndex).toBeGreaterThan(outboxIndex);
    expect(statements.indexOf('WAKE_DELIVERY')).toBeGreaterThan(commitIndex);
    const outbox = transactionQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'))!;
    expect(outbox[1].slice(0, 3)).toEqual(['activity:301', 'activity', '-9001']);
    expect(outbox[1][3]).not.toContain('PRIVATE_QUESTION');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(transactionRelease).toHaveBeenCalledTimes(1);
  });

  it('acknowledges an already stored activity without inserting or waking a duplicate notification', async () => {
    duplicateEvent = true;
    const event = userEventRequest();
    await event.run();
    expect(event.response.status).toHaveBeenCalledWith(200);
    expect(event.response.json).toHaveBeenCalledWith({ success: true });
    expect(statements.some((sql) => sql.includes('INSERT INTO user_app_events'))).toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO nebo_ops_outbox'))).toBe(false);
    expect(statements).toContain('COMMIT');
    expect(wakeup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(transactionRelease).toHaveBeenCalledTimes(1);
  });

  it.each(['auth', 'activity'] as const)('preserves the %s commit when notification persistence fails', async (flow) => {
    failOutbox = true;
    if (flow === 'auth') {
      const session = await appAuth.createAppUserSession({ userId: '-9001', kind: 'native' });
      expect(appAuth.verifyAppSessionToken(session.token)).toMatchObject({ userId: '-9001' });
    } else {
      const event = userEventRequest();
      await event.run();
      expect(event.response.status).toHaveBeenCalledWith(200);
      expect(event.response.json).toHaveBeenCalledWith({ success: true });
    }
    const businessInsert = flow === 'auth' ? 'INSERT INTO app_sessions' : 'INSERT INTO user_app_events';
    expect(statements.some((sql) => sql.includes(businessInsert))).toBe(true);
    const outboxIndex = statements.findIndex((sql) => sql.includes('INSERT INTO nebo_ops_outbox'));
    const rollbackIndex = statements.indexOf('ROLLBACK TO SAVEPOINT nebo_ops_enqueue');
    const releaseIndex = statements.indexOf('RELEASE SAVEPOINT nebo_ops_enqueue');
    const commitIndex = statements.indexOf('COMMIT');
    expect(outboxIndex).toBeGreaterThan(-1);
    expect(rollbackIndex).toBeGreaterThan(outboxIndex);
    expect(releaseIndex).toBeGreaterThan(rollbackIndex);
    expect(commitIndex).toBeGreaterThan(releaseIndex);
    expect(statements).not.toContain('ROLLBACK');
    expect(committed).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(transactionRelease).toHaveBeenCalledTimes(1);
  });
});

describe('owner support notification preference', () => {
  it('suppresses queued support alerts without sending or retrying them', async () => {
    const supportQuery = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT id, ticket_id, channel, attempts')) {
        return { rows: [{ id: 71, ticket_id: 301, channel: 'telegram', attempts: 9 }], rowCount: 1 };
      }
      if (sql.includes('RETURNING id, ticket_id, channel, attempts')) {
        return { rows: [{ id: 71, ticket_id: 301, channel: 'telegram', attempts: 10 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    connect.mockResolvedValue({ query: supportQuery, release });
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM support_tickets t')) {
        return { rows: [{
          tags: JSON.stringify({ category: 'problem' }),
          body: 'Не получается открыть прогноз после входа.',
          user_id: '-9001', created_at: '2026-09-04T20:00:07Z',
        }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const send = jest.spyOn(neboOps, 'sendNeboOpsText').mockResolvedValue({
      ok: false, error: 'TELEGRAM_RATE_LIMIT', deferred: true, retryAfterSeconds: 300,
    });

    await expect(processSupportDeliveryOutbox(1, undefined, 'telegram')).resolves.toEqual({
      claimed: 1, sent: 0, retried: 0, dead: 1, staleRecovered: 0,
    });
    expect(supportQuery).toHaveBeenCalledWith(
      expect.stringContaining('AND ($4::TEXT IS NULL OR channel = $4::TEXT)'), [10, 1, null, 'telegram'],
    );
    expect(send).not.toHaveBeenCalled();
    const suppressed = query.mock.calls.find(([sql]) => sql.includes('OWNER_SCOPE_FILTERED'))!;
    expect(suppressed[0]).toContain("SET status = 'dead'");
    expect(suppressed[0]).toContain("WHERE id = $1 AND status = 'processing' AND attempts = $2");
    expect(suppressed[1]).toEqual([71, 10]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('daily owner summaries', () => {
  const stats = {
    newUsers: 2, totalUsers: 100, logins: 6, activeUsers: 4, actions: 21, screens: 13, paymentOpens: 3,
    starsPurchases: 1, starsGross: 200, rustoreConfirmations: 3, rustoreTestConfirmations: 2,
    supportTickets: 1, clientPaymentErrors: 2, aiErrors: 1,
  };
  const dailyQuery = jest.fn();
  let persistedKeys: Set<string>;
  let lockAvailable: boolean;

  beforeEach(() => {
    persistedKeys = new Set();
    lockAvailable = true;
    dailyQuery.mockReset().mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: lockAvailable }], rowCount: 1 };
      if (sql.startsWith('SELECT 1 FROM nebo_ops_outbox WHERE event_key')) {
        return { rows: [], rowCount: persistedKeys.has(String(values?.[0])) ? 1 : 0 };
      }
      if (sql.includes('WITH bounds AS')) {
        return { rows: [{
          ...Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, String(value)])),
          topScreens: [{ section: 'natal_reading', count: 8 }, { section: 'PRIVATE_SCREEN', count: 5 }],
          privateUserData: 'PRIVATE_NAME',
        }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO nebo_ops_outbox')) {
        const eventKey = String(values?.[0]);
        const exists = persistedKeys.has(eventKey);
        persistedKeys.add(eventKey);
        return { rows: exists ? [] : [{ id: '801' }], rowCount: exists ? 0 : 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    connect.mockResolvedValue({ query: dailyQuery, release });
  });

  it.each(['2026-09-05T19:59:59Z', '2026-09-05T21:00:00Z', '2026-09-05T00:00:00Z'])(
    'does not issue an hourly or catch-up report outside 23 Moscow: %s', async (date) => {
      expect(getNeboOpsDailySummaryWindow(new Date(date))).toBeNull();
      await expect(enqueueNeboOpsDailySummary(new Date(date))).resolves.toBe(false);
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it.each(['2026-09-05T20:00:00Z', '2026-09-05T20:37:41Z'])(
    'collects only the previous 24 hours at 23 Moscow at %s', async (now) => {
      await expect(enqueueNeboOpsDailySummary(new Date(now))).resolves.toBe(true);
      const scan = dailyQuery.mock.calls.find(([sql]) => sql.includes('WITH bounds AS'))!;
      expect(scan[1]).toEqual(['2026-09-04T20:00:00.000Z', '2026-09-05T20:00:00.000Z']);
      expect(scan[0]).toContain('e.occurred_at >= b.start_utc AND e.occurred_at < b.end_utc');
      const insert = dailyQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'))!;
      expect(insert[0]).toContain('ON CONFLICT (event_key) DO NOTHING RETURNING id');
      expect(insert[1][0]).toBe('daily:2026-09-05');
      expect(insert[1][2]).toBe('2026-09-05T20:00:00.000Z');
      const payload = JSON.parse(insert[1][1]);
      expect(payload.stats).toEqual(stats);
      expect(payload.topScreens).toEqual([{ section: 'natal_reading', count: 8 }, { section: 'unknown', count: 5 }]);
      expect(insert[1][1]).not.toContain('PRIVATE_');
      expect(dailyQuery).toHaveBeenCalledWith('COMMIT');
      expect(release).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('deduplicates the daily report across worker restarts without scanning activity again', async () => {
    await expect(enqueueNeboOpsDailySummary(new Date('2026-09-05T20:01:00Z'))).resolves.toBe(true);
    delete processState.__neboOpsWorkerV1;
    await expect(enqueueNeboOpsDailySummary(new Date('2026-09-05T20:59:00Z'))).resolves.toBe(false);
    expect(dailyQuery.mock.calls.filter(([sql]) => sql.includes('WITH bounds AS'))).toHaveLength(1);
    expect(dailyQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'))).toHaveLength(1);
    expect(persistedKeys.size).toBe(1);
  });

  it('does not scan or enqueue when another collector holds the daily lock', async () => {
    lockAvailable = false;
    await expect(enqueueNeboOpsDailySummary(new Date('2026-09-05T20:01:00Z'))).resolves.toBe(false);
    expect(dailyQuery.mock.calls.some(([sql]) => sql.includes('WITH bounds AS'))).toBe(false);
    expect(dailyQuery.mock.calls.some(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'))).toBe(false);
    expect(dailyQuery).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an invalid date or disabled owner notifications', async () => {
    await expect(enqueueNeboOpsDailySummary(new Date(NaN))).resolves.toBe(false);
    process.env.NEBO_OPS_TELEGRAM_ENABLED = '0';
    await expect(enqueueNeboOpsDailySummary(new Date('2026-09-05T20:01:00Z'))).resolves.toBe(false);
    expect(connect).not.toHaveBeenCalled();
  });

  it('renders useful counts and known screens without identities or raw payload', () => {
    const message = renderNeboOpsMessage({
      event_type: 'daily_summary', user_id: null, occurred_at: '2026-09-05T20:00:00Z',
      payload_json: {
        periodStart: '2026-09-04T20:00:00Z', periodEnd: '2026-09-05T20:00:00Z',
        stats: { ...stats, users: ['PRIVATE_NAME'], question: 'PRIVATE_QUESTION' },
        topScreens: [{ section: 'natal_reading', count: 8 }, { section: 'PRIVATE_SCREEN', count: 5 }],
        userName: 'PRIVATE_NAME', receipt: 'PRIVATE_RECEIPT',
      },
    });
    expect(message).toContain('📊 NEBO · Итоги дня · 23:00 МСК');
    expect(message).toContain('04.09.2026');
    expect(message).toContain('23:00 МСК');
    expect(message).toContain('👤 Новых аккаунтов: 2');
    expect(message).toContain('👥 Всего аккаунтов сейчас: 100');
    expect(message).toContain('💳 Открыли экран оплаты: 3');
    expect(message).toContain('Натальная карта · Разбор: 8');
    expect(message).toContain('Экран не определён: 5');
    expect(message).toContain('валовая сумма: 200 Stars');
    expect(message).toContain('Подтверждения RuStore: 3 · тестовые: 2');
    expect(message).toContain('Ошибки генерации ИИ: 1');
    expect(message).not.toContain('PRIVATE_');
    expect(sanitizeNeboOpsPayload({
      stats: { newUsers: -1, totalUsers: 1.5, logins: Infinity, actions: Number.MAX_SAFE_INTEGER + 1, screens: 0 },
      topScreens: Array.from({ length: 8 }, () => ({ section: 'today', count: 1, user: 'PRIVATE_NAME' })),
    })).toEqual({
      stats: { screens: 0 }, topScreens: Array.from({ length: 5 }, () => ({ section: 'today', count: 1 })),
    });
  });
});

describe('AI generation error notifications', () => {
  it('includes operational context and trace identifiers while omitting private user content', () => {
    const message = renderNeboOpsMessage({
      event_type: 'ai_error', user_id: null, occurred_at: '2026-09-04T20:00:07Z',
      payload_json: {
        operation: 'personal_forecast', stage: 'generation', period: 'week',
        errorCode: 'UPSTREAM_TIMEOUT', httpStatus: 503, durationMs: 1500,
        serverVersion: 'abc1234', reportId: '6b8af41a-955d-4db1-8bf1-ec0eacc26f59', traceId: 'trace_42',
        question: 'PRIVATE_QUESTION', birthDate: 'PRIVATE_BIRTH', email: 'PRIVATE_EMAIL',
        stack: 'PRIVATE_STACK', error: 'PRIVATE_RAW_ERROR', request: { token: 'PRIVATE_TOKEN' },
      },
    });
    expect(message).toContain('⚠️ Ошибка генерации ИИ');
    expect(message).toContain('🙋 Пользователь: не определён');
    expect(message).toContain('Личный прогноз');
    expect(message).toContain('/api/content/forecast/personal');
    expect(message).toContain('Период: Неделя');
    expect(message).toContain('Код: UPSTREAM_TIMEOUT');
    expect(message).toContain('HTTP: 503');
    expect(message).toContain('Длительность: 1,5 с');
    expect(message).toContain('версия abc1234');
    expect(message).toContain('trace_42');
    expect(message).not.toContain('PRIVATE_');
  });
});

describe('MyTracker attribution delivery', () => {
  const now = new Date('2026-09-05T01:00:00Z');
  const analyticsUserId = '5844f96d-3901-49d2-a481-d4b01592e8e4';
  const secret = 'test_mytracker_0123456789abcdefghijklmnop';
  const callback = {
    app_id: '12345', user_id: analyticsUserId, traffic_source: 'VK Ads', traffic_type: 'paid',
    campaign_id: '42', campaign_title: 'Сентябрь', attribution_ts: '1788566400', event_ts: '1788566430',
  };
  const attributionQuery = jest.fn();

  beforeEach(() => {
    process.env.MYTRACKER_ENABLED = '1';
    process.env.MYTRACKER_APP_ID = callback.app_id;
    process.env.MYTRACKER_POSTBACK_SECRET = secret;
    attributionQuery.mockReset().mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, attribution_at')) return { rows: [{ user_id: '-9001' }] };
      if (sql.includes('SELECT 1 FROM nebo_ops_outbox')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    connect.mockResolvedValue({ query: attributionQuery, release });
  });

  function response() {
    return { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  }

  it('requires a dedicated configured application and secret and rejects multi-value credentials', () => {
    expect(getMyTrackerConfig()).toEqual({ appId: '12345', postbackSecret: secret });
    expect(isMyTrackerPostbackAuthorized(secret)).toBe(true);
    expect(isMyTrackerPostbackAuthorized(`${secret}x`)).toBe(false);
    expect(isMyTrackerPostbackAuthorized([secret])).toBe(false);
    expect(getMyTrackerConfig({ ...process.env, MYTRACKER_ENABLED: '0' })).toBeNull();
    expect(getMyTrackerConfig({ ...process.env, MYTRACKER_POSTBACK_SECRET: 'short' })).toBeNull();
    expect(getMyTrackerConfig({ ...process.env, MYTRACKER_APP_ID: 'wrong-app' })).toBeNull();
  });

  it('never accepts an account number, a foreign application, unresolved source or future timestamp', () => {
    expect(parseMyTrackerAttribution(callback, '12345', now)).toMatchObject({
      analyticsUserId, trafficSource: 'VK Ads', attributionAt: '2026-09-05T00:00:00.000Z',
    });
    for (const input of [
      { ...callback, user_id: '-9001' },
      { ...callback, app_id: '99999' },
      { ...callback, traffic_source: '{mt_traffic_source}', traffic_type: '{mt_traffic_type}' },
      { ...callback, attribution_ts: String(now.getTime() / 1000 + 60) },
    ]) expect(() => parseMyTrackerAttribution(input, '12345', now)).toThrow();
    const safe = parseMyTrackerAttribution({ ...callback, email: 'PRIVATE_EMAIL', token: 'PRIVATE_TOKEN' }, '12345', now);
    expect(JSON.stringify(safe)).not.toContain('PRIVATE_');
  });

  it('rejects an unauthenticated callback before touching storage and keeps responses uncached', async () => {
    const res = response();
    await myTrackerHandler({ method: 'GET', query: callback, headers: {} } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(connect).not.toHaveBeenCalled();
  });

  it('preserves the same opaque account ID and generates no identity when disabled', async () => {
    attributionQuery.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith('SELECT analytics_user_id') ? [{ analytics_user_id: analyticsUserId }] : [], rowCount: 1,
    }));
    await expect(getOrCreateMyTrackerUserId('-9001')).resolves.toBe(analyticsUserId);
    const insert = attributionQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO mytracker_users'))!;
    expect(insert[0]).toContain('ON CONFLICT (user_id) DO NOTHING');
    expect(insert[1][1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(insert[1][1]).not.toBe('-9001');
    process.env.MYTRACKER_ENABLED = '0';
    connect.mockClear();
    await expect(getOrCreateMyTrackerUserId('-9001')).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('commits the source and one owner notification together and ignores later repeats', async () => {
    await expect(recordMyTrackerAttribution(callback, now)).resolves.toBe('accepted');
    const update = attributionQuery.mock.calls.find(([sql]) => sql.includes('UPDATE mytracker_users'))!;
    const enqueue = attributionQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'))!;
    expect(enqueue[1][1]).toBe('attribution_received');
    expect(enqueue[1][2]).toBe('-9001');
    expect(JSON.parse(enqueue[1][3])).toMatchObject({ attributionSource: 'VK Ads', attributionCampaign: 'Сентябрь' });
    expect(attributionQuery).toHaveBeenCalledWith('COMMIT');
    const hash = update[1][11];
    attributionQuery.mockClear().mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT user_id, attribution_at') ? [{ user_id: '-9001', payload_hash: hash }] : [], rowCount: 1,
    }));
    await expect(recordMyTrackerAttribution({ ...callback, event_ts: '1788566490' }, now)).resolves.toBe('duplicate');
    expect(attributionQuery.mock.calls.some(([sql]) => sql.includes('UPDATE mytracker_users'))).toBe(false);
    expect(attributionQuery.mock.calls.some(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'))).toBe(false);
  });

  it('does not overwrite a newer attribution or accept an unknown SDK identity', async () => {
    attributionQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT user_id, attribution_at')
        ? [{ user_id: '-9001', attribution_at: '2026-09-05T00:05:00Z' }] : [], rowCount: 1,
    }));
    await expect(recordMyTrackerAttribution(callback, now)).resolves.toBe('stale');
    expect(attributionQuery.mock.calls.some(([sql]) => sql.includes('UPDATE mytracker_users'))).toBe(false);
    attributionQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(recordMyTrackerAttribution(callback, now)).resolves.toBe('unknown_user');
  });

  it('rolls back attribution when notification persistence fails so a callback retry can deliver it', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    attributionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, attribution_at')) return { rows: [{ user_id: '-9001' }] };
      if (sql.includes('INSERT INTO nebo_ops_outbox')) throw new Error('PRIVATE_DATABASE_ERROR');
      return { rows: [], rowCount: 0 };
    });
    await expect(recordMyTrackerAttribution(callback, now)).rejects.toThrow('MYTRACKER_NOTIFICATION_NOT_QUEUED');
    expect(attributionQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(attributionQuery).not.toHaveBeenCalledWith('COMMIT');
  });
});

describe('server diagnostic AI notification hook', () => {
  const diagnosticQuery = jest.fn();

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost/nebo_ops_test';
    process.env.RAILWAY_GIT_COMMIT_SHA = 'abc1234';
    diagnosticQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
    connect.mockResolvedValue({ query: diagnosticQuery, release });
    (getPool as jest.Mock).mockReturnValue({ query: diagnosticQuery, connect });
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  function diagnostic(event: Parameters<typeof startServerOperationalDiagnostic>[2] = 'personal_forecast') {
    return startServerOperationalDiagnostic({
      headers: { 'x-nebo-trace-id': 'client_trace_42', authorization: 'PRIVATE_TOKEN' },
      body: { userId: 'PRIVATE_USER_ID', question: 'PRIVATE_QUESTION', birthDate: 'PRIVATE_BIRTH', email: 'PRIVATE_EMAIL' },
    } as unknown as Parameters<typeof startServerOperationalDiagnostic>[0], {
      setHeader: jest.fn(),
    } as unknown as Parameters<typeof startServerOperationalDiagnostic>[1], event, { source: 'PRIVATE_SOURCE' });
  }

  const finishQueue = () => new Promise<void>((resolve) => setImmediate(resolve));
  const outboxInserts = () => diagnosticQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO nebo_ops_outbox'));

  it('enqueues one sanitized server report when generation and request both report the same final error', async () => {
    const flow = diagnostic();
    const error = { status: 503, code: 'UPSTREAM_TIMEOUT', message: 'PRIVATE_RAW_ERROR', stack: 'PRIVATE_STACK' };
    expect(() => {
      flow.error('generation', error, 'GENERATION_FAILED', { period: 'week', httpStatus: 503 });
      flow.error('request', error, 'REQUEST_FAILED', { period: 'week', httpStatus: 503 });
    }).not.toThrow();
    await finishQueue();
    expect(outboxInserts()).toHaveLength(1);
    const values = outboxInserts()[0][1];
    const payload = JSON.parse(values[3]);
    expect(values[1]).toBe('ai_error');
    expect(values[2]).toBeNull();
    expect(payload).toMatchObject({
      operation: 'personal_forecast', stage: 'generation', traceId: 'client_trace_42',
      period: 'week', errorCode: 'UPSTREAM_TIMEOUT', httpStatus: 503, serverVersion: 'abc1234',
    });
    expect(payload.reportId).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
    expect(payload.durationMs).toEqual(expect.any(Number));
    expect(values[0]).toBe(`ai:${payload.reportId}`);
    expect(values[3]).not.toContain('PRIVATE_');
    expect(diagnosticQuery).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not mistake client errors or in-progress generation for a final AI failure', async () => {
    const flow = diagnostic();
    flow.log('generation', 'in_progress', { httpStatus: 202 });
    flow.log('generation', 'ok', { httpStatus: 200 });
    flow.error('request', { status: 400 }, 'INVALID_PERIOD', { httpStatus: 400 });
    flow.error('generation', { status: 403 }, 'PREMIUM_REQUIRED', { httpStatus: 403 });
    flow.error('request', { status: 429 }, 'RATE_LIMITED', { httpStatus: 429 });
    flow.error('cache_read', { status: 503 }, 'CACHE_TEMPORARILY_UNAVAILABLE', { httpStatus: 503 });
    diagnostic('auth_provider').error('request', { status: 503 }, 'AUTH_PROVIDER_UNAVAILABLE', { httpStatus: 503 });
    await finishQueue();
    expect(outboxInserts()).toHaveLength(0);
    expect(connect).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses distinct server report IDs for separate failures sharing a client trace', async () => {
    const first = diagnostic('natal_question');
    const second = diagnostic('natal_question');
    first.error('generation', new Error('PRIVATE_FIRST_ERROR'), 'NATAL_GENERATION_FAILED');
    second.error('generation', new Error('PRIVATE_SECOND_ERROR'), 'NATAL_GENERATION_FAILED');
    await finishQueue();
    expect(outboxInserts()).toHaveLength(2);
    const values = outboxInserts().map((call) => call[1]);
    expect(values[0][0]).not.toBe(values[1][0]);
    expect(values.map((params) => JSON.parse(params[3]).traceId)).toEqual(['client_trace_42', 'client_trace_42']);
    expect(values.every((params) => JSON.parse(params[3]).operation === 'natal_question')).toBe(true);
  });

  it('keeps diagnostic reporting non-throwing when the outbox insert fails', async () => {
    diagnosticQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO nebo_ops_outbox')) throw new Error('PRIVATE_STORAGE_FAILURE');
      return { rows: [], rowCount: 1 };
    });
    const flow = diagnostic();
    expect(() => flow.error('generation', new Error('PRIVATE_RAW_ERROR'), 'GENERATION_FAILED')).not.toThrow();
    await finishQueue();
    expect(outboxInserts()).toHaveLength(1);
    expect(diagnosticQuery).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT nebo_ops_enqueue');
    expect(diagnosticQuery).toHaveBeenCalledWith('RELEASE SAVEPOINT nebo_ops_enqueue');
    expect(release).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
