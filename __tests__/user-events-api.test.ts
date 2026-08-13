const mockRequireAppUser = jest.fn();
const mockQuery = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args),
}));

jest.mock('../lib/db', () => ({
  getPool: () => ({ query: (...args: unknown[]) => mockQuery(...args) }),
}));

import handler from '../pages/api/users/events';

function response() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('POST /api/users/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAppUser.mockResolvedValue({ userId: '42', isGuest: false });
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
  });

  it('persists only sanitized allowlisted analytics properties', async () => {
    const req: any = {
      method: 'POST',
      body: {
        eventType: 'restore_succeeded',
        section: 'settings',
        source: 'settings',
        eventPayload: {
          placement: 'settings',
          entitlementState: 'paid',
          paywallInstanceId: 'pw-restore-1',
          email: 'person@example.com',
          purchaseToken: 'secret-token',
          receipt: 'secret-receipt',
          productId: 'purchase-token-shaped-value',
        },
      },
    };
    const res = response();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][1];
    expect(params.slice(0, 4)).toEqual(['42', 'restore_succeeded', 'settings', 'settings']);
    expect(JSON.parse(params[4])).toEqual({
      placement: 'settings',
      entitlement_state: 'paid',
      paywall_instance_id: 'pw-restore-1',
    });
  });

  it('rejects an event outside the explicit allowlist', async () => {
    const req: any = { method: 'POST', body: { eventType: 'arbitrary_event' } };
    const res = response();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
