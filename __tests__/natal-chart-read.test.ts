const mockPrimary = jest.fn();
const mockById = jest.fn();
const mockAll = jest.fn();
const mockPremium = jest.fn();

jest.mock('../lib/natalChartV2Repository', () => ({ natalChartV2Repository: {
  getPrimary: (...args: unknown[]) => mockPrimary(...args),
  getById: (...args: unknown[]) => mockById(...args),
  getAll: (...args: unknown[]) => mockAll(...args),
} }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: (...args: unknown[]) => mockPremium(...args) }));

import { getCanonicalNatalChart } from '../lib/natalChartRead';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

describe('canonical natal read', () => {
  let self: any;
  let first: any;
  let extra: any;
  beforeEach(() => {
    jest.clearAllMocks();
    const chart = canonicalNatalChart({ calculationVersion: 'previous-calculator' });
    self = { id: 1, user_id: '42', subject_type: 'self', input_hash: 'self', chart_data: chart };
    first = { ...self, id: 2, subject_type: 'saved_person', input_hash: 'first' };
    extra = { ...first, id: 3 };
    mockPrimary.mockResolvedValue(self);
    mockById.mockImplementation(async (id: number) => [self, first, extra].find((row) => row.id === id));
    mockAll.mockResolvedValue([self, first, extra]);
    mockPremium.mockResolvedValue({ isPremium: false });
  });

  it('returns exactly the stored calculation even after a calculator release', async () => {
    await expect(getCanonicalNatalChart('42')).resolves.toBe(self);
    expect(mockPrimary).toHaveBeenCalledWith('42');
  });

  it('allows Free first saved chart and locks excess until Premium returns', async () => {
    await expect(getCanonicalNatalChart('42', 2)).resolves.toBe(first);
    await expect(getCanonicalNatalChart('42', 3)).rejects.toMatchObject({ code: 'PREMIUM_REQUIRED' });
    mockPremium.mockResolvedValue({ isPremium: true });
    await expect(getCanonicalNatalChart('42', 3)).resolves.toBe(extra);
  });

  it('rejects missing, foreign and archived charts before serving data', async () => {
    await expect(getCanonicalNatalChart('42', 99)).rejects.toMatchObject({ code: 'CHART_NOT_FOUND', status: 404 });
    first.user_id = '43';
    await expect(getCanonicalNatalChart('42', 2)).rejects.toMatchObject({ code: 'CHART_NOT_FOUND', status: 404 });
    self.archived_at = new Date();
    await expect(getCanonicalNatalChart('42')).rejects.toMatchObject({ code: 'CHART_ARCHIVED' });
  });

  it.each(['missing_hash', 'incomplete_data'])('reports CHART_REPAIR_REQUIRED for %s with no calculation dependency', async (damage) => {
    if (damage === 'missing_hash') self.input_hash = null;
    else self.chart_data = {};
    await expect(getCanonicalNatalChart('42')).rejects.toMatchObject({ code: 'CHART_REPAIR_REQUIRED', status: 409 });
  });
});
