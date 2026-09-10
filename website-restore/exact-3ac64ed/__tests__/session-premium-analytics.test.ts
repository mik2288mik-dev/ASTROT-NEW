const mockApiFetch = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  isNativeAppRuntime: jest.fn(() => false),
}));

jest.mock('../services/authSessionIntent', () => ({
  getActiveTelegramInitData: jest.fn(() => null),
  getRawTelegramInitData: jest.fn(() => null),
}));

import {
  clearQueuedUserAppEvents,
  recordUserAppEvent,
} from '../services/sessionService';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

const localStorage = createMemoryStorage();
const sessionStorage = createMemoryStorage();

describe('recordUserAppEvent', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage,
        sessionStorage,
        addEventListener: jest.fn(),
      },
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockApiFetch.mockResolvedValue({ ok: true });
  });

  it('sanitizes analytics before it crosses the client API boundary', async () => {
    await recordUserAppEvent({
      eventType: 'purchase_succeeded',
      section: 'premium',
      source: 'today_inline',
      eventPayload: {
        placement: 'today',
        featureKey: 'personal_daily',
        entitlementState: 'paid',
        purchaseToken: 'secret-token',
        receipt: 'secret-receipt',
        forecastText: 'private forecast',
      },
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const request = mockApiFetch.mock.calls[0][1];
    const body = JSON.parse(request.body);
    expect(body.eventId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body).toMatchObject({
      eventType: 'purchase_success',
      section: 'premium',
      source: 'today_inline',
      eventPayload: {
        placement: 'today',
        feature_key: 'personal_daily',
        entitlement_state: 'paid',
      },
    });
  });

  it('keeps a bounded sanitized queue through a temporary network failure and retries in order', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('temporary network failure'));

    await recordUserAppEvent({
      eventType: 'purchase_succeeded',
      section: 'premium',
      source: 'today_inline',
      eventPayload: {
        placement: 'today',
        entitlementState: 'paid',
        receipt: 'secret-receipt',
      },
    });

    const queued = JSON.parse(localStorage.getItem('lumia_user_app_event_queue_v1') || '[]');
    expect(queued).toEqual([expect.objectContaining({
      eventType: 'purchase_success',
      section: 'premium',
      source: 'today_inline',
      eventPayload: {
        placement: 'today',
        entitlement_state: 'paid',
      },
    })]);
    expect(queued[0].eventId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.stringify(queued)).not.toContain('secret-receipt');

    await recordUserAppEvent({
      eventType: 'restore_succeeded',
      section: 'settings',
      source: 'settings',
      eventPayload: { entitlementState: 'paid' },
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(mockApiFetch.mock.calls[1][1].body).eventType).toBe('purchase_success');
    expect(JSON.parse(mockApiFetch.mock.calls[2][1].body).eventType).toBe('restore_success');
    expect(JSON.parse(mockApiFetch.mock.calls[0][1].body).eventId).toBe(
      JSON.parse(mockApiFetch.mock.calls[1][1].body).eventId,
    );
    expect(localStorage.getItem('lumia_user_app_event_queue_v1')).toBeNull();
  });

  it('persists a later success before an earlier slow delivery finishes', async () => {
    let resolveFirst!: (value: { ok: boolean }) => void;
    mockApiFetch
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue({ ok: true });

    const checkout = recordUserAppEvent({
      eventType: 'checkout_started',
      section: 'premium',
      source: 'deep_natal',
      eventPayload: { placement: 'deep_natal', planId: 'premium_month' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    const purchase = recordUserAppEvent({
      eventType: 'purchase_succeeded',
      section: 'premium',
      source: 'deep_natal',
      eventPayload: { placement: 'deep_natal', planId: 'premium_month', entitlementState: 'paid' },
    });
    const queuedBeforeDelivery = JSON.parse(
      localStorage.getItem('lumia_user_app_event_queue_v1') || '[]',
    );
    expect(queuedBeforeDelivery.map((event: { eventType: string }) => event.eventType))
      .toEqual(['checkout_start', 'purchase_success']);

    resolveFirst({ ok: true });
    await Promise.all([checkout, purchase]);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('lumia_user_app_event_queue_v1')).toBeNull();
  });

  it('does not drop a new event when a delivered head is evicted at the queue cap', async () => {
    let resolveFirst!: (value: { ok: boolean }) => void;
    mockApiFetch
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue({ ok: true });

    const first = recordUserAppEvent({
      eventType: 'checkout_start',
      section: 'premium',
      source: 'deep_natal',
      eventPayload: { placement: 'deep_natal', planId: 'premium_month' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    const later = Array.from({ length: 40 }, () => recordUserAppEvent({
      eventType: 'natal_section_open',
      section: 'natal',
      source: 'deep_natal',
      eventPayload: { sectionKey: 'strengths', accessState: 'open', source: 'continue' },
    }));
    const cappedQueue = JSON.parse(
      localStorage.getItem('lumia_user_app_event_queue_v1') || '[]',
    );
    expect(cappedQueue).toHaveLength(40);
    const queuedIds = cappedQueue.map((event: { eventId: string }) => event.eventId);

    resolveFirst({ ok: true });
    await Promise.all([first, ...later]);

    const deliveredIds = mockApiFetch.mock.calls
      .slice(1)
      .map((call) => JSON.parse(call[1].body).eventId);
    expect(deliveredIds).toEqual(queuedIds);
    expect(mockApiFetch).toHaveBeenCalledTimes(41);
    expect(localStorage.getItem('lumia_user_app_event_queue_v1')).toBeNull();
  });

  it('drops the previous account queue before events for a switched account can flush', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('temporary network failure'));
    await recordUserAppEvent({
      eventType: 'checkout_start',
      section: 'premium',
      source: 'deep_natal',
      eventPayload: { placement: 'deep_natal', planId: 'premium_month' },
    });
    expect(localStorage.getItem('lumia_user_app_event_queue_v1')).not.toBeNull();

    clearQueuedUserAppEvents();
    expect(localStorage.getItem('lumia_user_app_event_queue_v1')).toBeNull();

    await recordUserAppEvent({
      eventType: 'screen_view',
      section: 'dashboard',
      source: 'app_open',
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockApiFetch.mock.calls[1][1].body).eventType).toBe('screen_view');
  });

  it('aborts an in-flight event before switched-account auth can attribute it to the next user', async () => {
    let activeAccount = 'A';
    let releaseOldSend!: () => void;
    let oldSignal: AbortSignal | undefined;
    const attributedEvents: Array<{ account: string; eventType: string }> = [];

    mockApiFetch
      .mockImplementationOnce((_path: string, init: RequestInit) => new Promise((resolve, reject) => {
        oldSignal = init.signal || undefined;
        const body = JSON.parse(String(init.body || '{}'));
        const abort = () => {
          const error = new Error('telemetry request aborted');
          error.name = 'AbortError';
          reject(error);
        };
        oldSignal?.addEventListener('abort', abort, { once: true });
        releaseOldSend = () => {
          if (oldSignal?.aborted) return;
          attributedEvents.push({ account: activeAccount, eventType: body.eventType });
          resolve({ ok: true });
        };
      }))
      .mockImplementationOnce((_path: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body || '{}'));
        attributedEvents.push({ account: activeAccount, eventType: body.eventType });
        return Promise.resolve({ ok: true });
      });

    const oldAccountEvent = recordUserAppEvent({
      eventType: 'checkout_start',
      section: 'premium',
      source: 'deep_natal',
      eventPayload: { placement: 'deep_natal', planId: 'premium_month' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(oldSignal?.aborted).toBe(false);

    clearQueuedUserAppEvents();
    activeAccount = 'B';
    releaseOldSend();
    await oldAccountEvent;

    await recordUserAppEvent({
      eventType: 'screen_view',
      section: 'dashboard',
      source: 'app_open',
    });

    expect(oldSignal?.aborted).toBe(true);
    expect(attributedEvents).toEqual([{ account: 'B', eventType: 'screen_view' }]);
  });

  it('does not send unknown events', async () => {
    await recordUserAppEvent({ eventType: 'made_up_event', eventPayload: {} });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
