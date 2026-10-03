const mockUser = jest.fn();
const mockQuery = jest.fn();
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: (...args: unknown[]) => mockUser(...args) }));
jest.mock('../lib/db', () => ({ getPool: () => ({ query: mockQuery }) }));
import handler from '../pages/api/users/feature-state';

function response() {
  const res: any = { setHeader: jest.fn() };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('/api/users/feature-state', () => {
  beforeEach(() => {
    mockUser.mockReset().mockResolvedValue({ userId: 'u1', provider: 'native' });
    mockQuery.mockReset().mockResolvedValue({ rows: [] });
  });

  it('returns only the signed-in person’s records of a known feature', async () => {
    mockQuery.mockImplementation(async (sql: string) => (
      sql.includes('SELECT') ? { rows: [{ item_key: '2026-10-10', value: { items: [] } }] } : { rows: [] }
    ));
    const res = response();
    await handler({ method: 'GET', query: { feature: 'wishes' }, headers: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ items: { '2026-10-10': { items: [] } } });
    const select = mockQuery.mock.calls.find(([sql]) => String(sql).includes('SELECT'));
    expect(select?.[1]).toEqual(['u1', 'wishes']);
  });

  it('rejects unknown features, bad keys and oversized values', async () => {
    const unknown = response();
    await handler({ method: 'GET', query: { feature: 'anything' }, headers: {} } as any, unknown);
    expect(unknown.status).toHaveBeenCalledWith(400);

    const badKey = response();
    await handler({ method: 'PUT', body: { feature: 'wishes', key: '../x', value: 1 }, headers: {} } as any, badKey);
    expect(badKey.status).toHaveBeenCalledWith(400);

    const big = response();
    await handler({ method: 'PUT', body: { feature: 'wishes', key: 'k', value: 'x'.repeat(9000) }, headers: {} } as any, big);
    expect(big.status).toHaveBeenCalledWith(413);
  });

  it('upserts and deletes one record', async () => {
    const saved = response();
    await handler({ method: 'PUT', body: { feature: 'for_you', key: 'dismissed', value: { a: '1' } }, headers: {} } as any, saved);
    expect(saved.status).toHaveBeenCalledWith(200);
    expect(mockQuery.mock.calls.some(([sql, params]) => String(sql).includes('INSERT INTO user_feature_state') && params[0] === 'u1')).toBe(true);

    const removed = response();
    await handler({ method: 'PUT', body: { feature: 'for_you', key: 'dismissed', value: null }, headers: {} } as any, removed);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).startsWith('DELETE FROM user_feature_state'))).toBe(true);
  });

  it('answers 401 without a session', async () => {
    mockUser.mockRejectedValue(Object.assign(new Error('auth'), { status: 401, code: 'AUTH_REQUIRED' }));
    const res = response();
    await handler({ method: 'GET', query: { feature: 'wishes' }, headers: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
