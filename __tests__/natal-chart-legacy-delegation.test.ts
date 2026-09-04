const mockEnsurePrimary = jest.fn();
const mockCreateSaved = jest.fn();

jest.mock('../lib/natalChartPersistence', () => ({
  ensureCanonicalPrimaryChart: (...args: unknown[]) => mockEnsurePrimary(...args),
  createOrReuseCanonicalChart: (...args: unknown[]) => mockCreateSaved(...args),
}));
jest.mock('../lib/database-url', () => ({ resolveDatabaseUrl: () => '' }));

import { db } from '../lib/db';
import { ChartAccessPolicyError } from '../lib/chartAccessPolicy';

describe('legacy natal chart adapters', () => {
  const birth = { name: 'Анна', birthDate: '1992-03-14', birthTime: '09:30', birthPlace: 'Москва' };
  const saved = { id: 7, input_hash: 'server-calculated', chart_data: { stored: true } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsurePrimary.mockResolvedValue({ chart: saved, source: 'cache' });
    mockCreateSaved.mockResolvedValue({ chart: saved, reused: true });
  });

  it('routes primary writes through the canonical service and ignores supplied calculation and hash', async () => {
    const result = await db.natal_charts.persistPrimary('42', { ...birth, chartData: { forged: true }, inputHash: 'forged' });

    expect(result).toBe(saved);
    expect(mockEnsurePrimary).toHaveBeenCalledWith({ userId: '42', ...birth });
  });

  it('routes the oldest set API through the same service without trusting client coordinates', async () => {
    const result = await db.natal_charts.set('42', { name: birth.name, latitude: 0, longitude: 0 }, birth.birthDate, birth.birthTime, birth.birthPlace, 'forged');

    expect(result).toBe(saved);
    expect(mockEnsurePrimary).toHaveBeenCalledWith({ userId: '42', ...birth });
  });

  it('routes saved-person writes through central identity reuse and limits', async () => {
    const result = await db.natal_charts.create('42', { ...birth, chartData: { forged: true }, inputHash: 'forged' });

    expect(result).toBe(saved);
    expect(mockCreateSaved).toHaveBeenCalledWith({ userId: '42', ...birth });
  });

  it('propagates central saved-person capacity failures without another write', async () => {
    const error = new ChartAccessPolicyError('CHART_LIMIT_REACHED', 'Limit reached');
    mockCreateSaved.mockRejectedValueOnce(error);

    await expect(db.natal_charts.create('42', birth)).rejects.toBe(error);
    expect(mockEnsurePrimary).not.toHaveBeenCalled();
  });
});
