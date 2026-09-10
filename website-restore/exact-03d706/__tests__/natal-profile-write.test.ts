import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockEnsureChart = jest.fn();
const mockBirthGet = jest.fn();
const mockBirthSet = jest.fn();
jest.mock('../lib/db', () => ({
  db: { users: { get: (...args: unknown[]) => mockGetUser(...args), updateExisting: (...args: unknown[]) => mockUpdateUser(...args), ensureReferralCode: async () => 'TEST' } },
  getPool: () => ({ query: async () => ({ rows: [] }) }),
}));
jest.mock('../lib/birthProfileRepository', () => ({ birthProfileRepository: {
  get: (...args: unknown[]) => mockBirthGet(...args), set: (...args: unknown[]) => mockBirthSet(...args),
} }));
jest.mock('../lib/natalChartPersistence', () => ({ ensureCanonicalPrimaryChart: (...args: unknown[]) => mockEnsureChart(...args) }));
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: async () => ({ userId: '42' }) }));
jest.mock('../lib/adminAuth', () => ({ AdminAuthError: class extends Error {}, getConfiguredOwnerId: () => null, handleAdminError: jest.fn() }));
jest.mock('../lib/database-url', () => ({ hasDatabaseUrl: () => true }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: async () => ({ isPremium: false }), publicPremiumEntitlementSnapshot: (value: unknown) => value }));
jest.mock('../lib/personalForecastPrewarm', () => ({ buildPersonalForecastPrewarmProfile: () => null, queuePersonalForecastPrewarm: jest.fn(), queuePersonalForecastPrewarmForUser: jest.fn() }));

import handler from '../pages/api/users/[id]';

async function request(body: Record<string, unknown>, method = 'POST') {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  await handler({ method, query: { id: '42' }, body } as unknown as NextApiRequest, response as unknown as NextApiResponse);
  return response;
}

describe('birth profile writes use the canonical snapshot transaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: '42', name: 'Mira', birth_date: '1990-01-01', birth_time: '10:00:00', birth_place: 'Moscow', language: 'ru', theme: 'light', is_setup: true, ref_code: 'TEST' });
    mockBirthGet.mockResolvedValue({ birth_time_mode: 'exact' });
    mockUpdateUser.mockResolvedValue({ id: '42', name: 'Mira' });
    mockEnsureChart.mockResolvedValue({ chart: { id: 1 }, source: 'cache' });
  });

  it('creates the complete snapshot before applying profile attributes and never rewrites birth fields afterward', async () => {
    const response = await request({ name: 'Mira', birthDate: '1990-01-02', birthTime: '10:30', birthPlace: 'Kazan', birthLatitude: 55.79, birthLongitude: 49.12, birthTimezone: 'Europe/Moscow', isSetup: true });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(mockEnsureChart).toHaveBeenCalledWith(expect.objectContaining({
      userId: '42', birthDate: '1990-01-02', birthTime: '10:30', birthPlace: 'Kazan',
      coordinates: { lat: 55.79, lon: 49.12, timezone: 'Europe/Moscow' },
    }));
    expect(mockEnsureChart.mock.invocationCallOrder[0]).toBeLessThan(mockUpdateUser.mock.invocationCallOrder[0]);
    expect(mockUpdateUser.mock.calls[0][1]).not.toHaveProperty('birth_date');
    expect(mockUpdateUser.mock.calls[0][1]).not.toHaveProperty('birth_time');
    expect(mockUpdateUser.mock.calls[0][1]).not.toHaveProperty('birth_place');
    expect(mockBirthSet).not.toHaveBeenCalled();
  });

  it('does not mutate the profile if the new snapshot fails', async () => {
    mockEnsureChart.mockRejectedValueOnce(new Error('EPHEMERIS_UNAVAILABLE'));
    const response = await request({ birthDate: '1990-01-02' });
    expect(response.status).toHaveBeenCalledWith(500);
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockBirthSet).not.toHaveBeenCalled();
  });

  it('does not enter calculation on a profile read or a non-birth settings write', async () => {
    expect((await request({}, 'GET')).status).toHaveBeenCalledWith(200);
    expect((await request({ theme: 'dark', name: 'Maria' })).status).toHaveBeenCalledWith(200);
    expect(mockEnsureChart).not.toHaveBeenCalled();
  });

  it('preserves unknown-time accuracy when the user explicitly changes it', async () => {
    const response = await request({ birthTimeMode: 'unknown', birthTime: '' });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(mockEnsureChart).toHaveBeenCalledWith(expect.objectContaining({
      birthDate: '1990-01-01', birthPlace: 'Moscow', birthTime: undefined, birthTimeMode: 'unknown',
    }));
  });

  it('allows account settings before birth setup without creating a partial snapshot', async () => {
    mockGetUser.mockResolvedValue({ id: '42', name: 'Mira', birth_date: null, birth_time: null, birth_place: null, is_setup: false });
    mockBirthGet.mockResolvedValue(null);
    const response = await request({ birthDate: '', birthPlace: '', birthTime: '', isSetup: false, theme: 'dark' });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(mockEnsureChart).not.toHaveBeenCalled();
    expect(mockUpdateUser).toHaveBeenCalledWith('42', expect.objectContaining({ theme: 'dark' }));
  });
});
