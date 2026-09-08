const mockRequireAppUser = jest.fn();
const mockQuery = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args),
}));

jest.mock('../lib/db', () => ({
  getPool: () => ({ connect: async () => ({ query: (...args: unknown[]) => mockQuery(...args), release: jest.fn() }) }),
}));
jest.mock('../lib/neboOps', () => ({ enqueueNeboOpsEvent: jest.fn(), wakeNeboOpsDelivery: jest.fn() }));

import handler from '../pages/api/users/events';
const insertedEvent = () => mockQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO user_app_events'))!;

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
        eventId: '018f1234-5678-4abc-8def-0123456789ab',
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
    expect(mockQuery).toHaveBeenCalledTimes(3);
    const params = insertedEvent()[1];
    expect(params.slice(0, 5)).toEqual([
      '42',
      '018f1234-5678-4abc-8def-0123456789ab',
      'restore_success',
      'settings',
      'settings',
    ]);
    expect(JSON.parse(params[5])).toEqual({
      placement: 'settings',
      entitlement_state: 'paid',
      paywall_instance_id: 'pw-restore-1',
      runtime: 'web',
    });
  });

  it('persists canonical natal analytics without personal content or raw ids', async () => {
    const req: any = {
      method: 'POST',
      body: {
        eventType: 'natal_section_open',
        section: 'chart',
        source: 'deep_natal',
        eventPayload: {
          sectionKey: 'strengths',
          accessState: 'open',
          source: 'section_grid',
          reportText: 'private report body',
          chartId: 123,
          birthDate: '1990-01-01',
        },
      },
    };
    const res = response();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const params = insertedEvent()[1];
    expect(params.slice(0, 5)).toEqual(['42', null, 'natal_section_open', 'chart', 'deep_natal']);
    expect(JSON.parse(params[5])).toEqual({
      section_key: 'strengths',
      access_state: 'open',
      source: 'section_grid',
      runtime: 'web',
    });
  });

  it('rejects an event outside the explicit allowlist', async () => {
    const req: any = { method: 'POST', body: { eventType: 'arbitrary_event' } };
    const res = response();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('uses the client event id as a database idempotency key', async () => {
    const req: any = {
      method: 'POST',
      body: {
        eventId: '018f1234-5678-4abc-8def-0123456789ac',
        eventType: 'checkout_start',
        section: 'premium',
        source: 'deep_natal',
        eventPayload: { placement: 'deep_natal' },
      },
    };
    const res = response();

    await handler(req, res);

    expect(insertedEvent()[0]).toContain(
      'ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING',
    );
    expect(insertedEvent()[1][1]).toBe('018f1234-5678-4abc-8def-0123456789ac');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a semantic or malformed event id instead of storing it as null', async () => {
    const req: any = {
      method: 'POST',
      body: {
        eventId: 'evt-person-example-com-purchase',
        eventType: 'checkout_start',
      },
    };
    const res = response();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
