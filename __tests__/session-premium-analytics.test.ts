const mockApiFetch = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  isNativeAppRuntime: jest.fn(() => false),
}));

jest.mock('../services/authSessionIntent', () => ({
  getActiveTelegramInitData: jest.fn(() => null),
  getRawTelegramInitData: jest.fn(() => null),
}));

import { recordUserAppEvent } from '../services/sessionService';

describe('recordUserAppEvent', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(JSON.parse(request.body)).toEqual({
      eventType: 'purchase_succeeded',
      section: 'premium',
      source: 'today_inline',
      eventPayload: {
        placement: 'today',
        feature_key: 'personal_daily',
        entitlement_state: 'paid',
      },
    });
  });

  it('does not send unknown events', async () => {
    await recordUserAppEvent({ eventType: 'made_up_event', eventPayload: {} });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
