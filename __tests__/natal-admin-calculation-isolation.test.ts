const mockRequireAdmin = jest.fn();
const mockCalculate = jest.fn();
const mockResolveCoordinates = jest.fn();

jest.mock('../lib/admin/rbac', () => ({ requireAdminPermission: (...args: unknown[]) => mockRequireAdmin(...args) }));
jest.mock('../lib/db', () => ({ db: {} }));
jest.mock('../lib/swisseph-calculator', () => ({
  calculateNatalChart: (...args: unknown[]) => mockCalculate(...args),
  resolveBirthCoordinates: (...args: unknown[]) => mockResolveCoordinates(...args),
}));

import { AdminAuthError } from '../lib/adminAuth';
import handler from '../pages/api/admin/v2/charts/verify';

function response() {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('isolated administrator natal calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ userId: '1' });
    mockResolveCoordinates.mockResolvedValue({ lat: 55.75, lon: 37.62, timezone: 'Europe/Moscow' });
    mockCalculate.mockResolvedValue({
      sun: { sign: 'Aries', degree: 1 }, moon: { sign: 'Taurus', degree: 2 },
      rising: null, mc: null, houses: [], aspects: [],
      birth: { time: { mode: 'unknown' } }, calculationMetadata: { sampleCount: 5 },
    });
  });

  it('allows an authorized diagnostic calculation without any chart persistence dependency', async () => {
    const req: any = { method: 'POST', body: { name: 'Test', birthDate: '1990-01-01', birthPlace: 'Moscow', birthTimeMode: 'unknown' } };
    const res = response();

    await handler(req, res);

    expect(mockRequireAdmin).toHaveBeenCalledWith(req, 'charts.view');
    expect(mockCalculate).toHaveBeenCalledTimes(1);
    expect(mockCalculate).toHaveBeenCalledWith('Test', '1990-01-01', '', 'Moscow', expect.objectContaining({ birthTime: expect.objectContaining({ mode: 'unknown' }) }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('rejects unauthorized callers before coordinates or Swiss are reached', async () => {
    mockRequireAdmin.mockRejectedValue(new AdminAuthError(403, 'FORBIDDEN', 'Forbidden'));
    const res = response();

    await handler({ method: 'POST', body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockResolveCoordinates).not.toHaveBeenCalled();
    expect(mockCalculate).not.toHaveBeenCalled();
  });
});
