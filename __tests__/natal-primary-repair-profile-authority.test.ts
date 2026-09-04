const mockUserGet = jest.fn();
const mockUserUpdateExisting = jest.fn();
const mockBirthProfileGet = jest.fn();
const mockBirthProfileSet = jest.fn();
const mockGetPrimary = jest.fn();
const mockFindByInputHash = jest.fn();
const mockPersistPrimary = jest.fn();
const mockResolveBirthCoordinates = jest.fn();
const mockCalculateNatalChart = jest.fn();
const mockWithUserLock = jest.fn();
const mockGetBirthProfile = jest.fn();
const mockSyncPrimaryProfile = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    users: {
      get: (...args: unknown[]) => mockUserGet(...args),
      updateExisting: (...args: unknown[]) => mockUserUpdateExisting(...args),
    },
  },
}));

jest.mock('../lib/birthProfileRepository', () => ({
  birthProfileRepository: {
    get: (...args: unknown[]) => mockBirthProfileGet(...args),
    set: (...args: unknown[]) => mockBirthProfileSet(...args),
  },
}));

jest.mock('../lib/natalChartV2Repository', () => ({
  natalChartV2Repository: {
    withUserLock: (...args: unknown[]) => mockWithUserLock(...args),
    getPrimary: (...args: unknown[]) => mockGetPrimary(...args),
    findByInputHash: (...args: unknown[]) => mockFindByInputHash(...args),
    persistPrimary: (...args: unknown[]) => mockPersistPrimary(...args),
  },
}));

jest.mock('../lib/swisseph-calculator', () => ({
  resolveBirthCoordinates: (...args: unknown[]) => mockResolveBirthCoordinates(...args),
  calculateNatalChart: (...args: unknown[]) => mockCalculateNatalChart(...args),
}));

import { repairCanonicalChartForUser } from '../lib/natalChartPersistence';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

describe('self-chart repair profile authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    mockWithUserLock.mockImplementation(async (_userId: string, work: (repo: any) => Promise<unknown>) => work({
      getAll: async () => [await mockGetPrimary()],
      getBirthProfile: (...args: unknown[]) => mockGetBirthProfile(...args),
      getCalculations: async () => [],
      persistPrimary: (...args: unknown[]) => mockPersistPrimary(...args),
      syncPrimaryProfile: (...args: unknown[]) => mockSyncPrimaryProfile(...args),
    }));
    mockUserGet.mockResolvedValue({
      id: '42',
      name: 'Новая анкета',
      birth_date: '1994-05-06',
      birth_time: '14:25',
      birth_place: 'Казань',
      language: 'ru',
    });
    mockUserUpdateExisting.mockResolvedValue({ id: '42' });
    mockGetPrimary.mockResolvedValue({
      id: 7,
      user_id: '42',
      subject_type: 'self',
      name: 'Старая карта',
      birth_date: '1980-01-02',
      birth_time: '08:10',
      birth_time_mode: 'exact',
      birth_time_uncertainty_minutes: null,
      birth_time_range_start: null,
      birth_time_range_end: null,
      birth_place: 'Москва',
      chart_data: {},
    });
    mockFindByInputHash.mockResolvedValue(null);
    mockResolveBirthCoordinates.mockResolvedValue({
      lat: 55.79,
      lon: 49.12,
      timezone: 'Europe/Moscow',
    });
    mockCalculateNatalChart.mockImplementation(async (_name: string, date: string, _time: string, place: string, options: any) => canonicalNatalChart({
      birthDate: date, birthPlace: place, time: options.birthTime, coordinates: options.coordinates,
    }));
    mockPersistPrimary.mockResolvedValue({ id: 7 });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    {
      label: 'exact',
      userTime: '14:25',
      settings: {
        birth_time_mode: 'exact',
        birth_time_uncertainty_minutes: null,
        birth_time_range_start: null,
        birth_time_range_end: null,
      },
      expected: { mode: 'exact', localTime: '14:25' },
    },
    {
      label: 'approximate',
      userTime: '14:25',
      settings: {
        birth_time_mode: 'approximate',
        birth_time_uncertainty_minutes: 30,
        birth_time_range_start: null,
        birth_time_range_end: null,
      },
      expected: { mode: 'approximate', localTime: '14:25', uncertaintyMinutes: 30 },
    },
    {
      label: 'unknown',
      userTime: null,
      settings: {
        birth_time_mode: 'unknown',
        birth_time_uncertainty_minutes: null,
        birth_time_range_start: null,
        birth_time_range_end: null,
      },
      expected: { mode: 'unknown', localTime: null },
    },
    {
      label: 'legacy exact without an explicit mode',
      userTime: '14:25',
      settings: {
        birth_time_mode: null,
        birth_time_uncertainty_minutes: null,
        birth_time_range_start: null,
        birth_time_range_end: null,
      },
      expected: { mode: 'exact', localTime: '14:25' },
    },
    {
      label: 'legacy unknown without an explicit mode',
      userTime: null,
      settings: {
        birth_time_mode: null,
        birth_time_uncertainty_minutes: null,
        birth_time_range_start: null,
        birth_time_range_end: null,
      },
      expected: { mode: 'unknown', localTime: null },
    },
  ])('repairs from the current $label profile without restoring stale chart data', async ({
    userTime,
    settings,
    expected,
  }) => {
    mockUserGet.mockResolvedValueOnce({
      id: '42',
      name: 'Новая анкета',
      birth_date: '1994-05-06',
      birth_time: userTime,
      birth_place: 'Казань',
      language: 'ru',
    });
    mockBirthProfileGet.mockResolvedValueOnce(settings);
    mockGetBirthProfile.mockResolvedValueOnce({
      id: '42', name: 'Новая анкета', birth_date: '1994-05-06',
      birth_time: userTime, birth_place: 'Казань', ...settings,
    });

    await repairCanonicalChartForUser('42');

    expect(mockSyncPrimaryProfile).toHaveBeenCalledWith('42', expect.objectContaining({
      name: 'Новая анкета',
      birthDate: '1994-05-06',
      time: expect.objectContaining(expected),
      birthPlace: 'Казань',
    }));
    expect(mockUserUpdateExisting).not.toHaveBeenCalled();
    expect(mockBirthProfileSet).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).toHaveBeenCalledWith(
      'Новая анкета',
      '1994-05-06',
      expected.localTime || '',
      'Казань',
      expect.objectContaining({ birthTime: expect.objectContaining(expected) }),
    );
    expect(mockPersistPrimary).toHaveBeenCalledWith('42', expect.objectContaining({
      birthDate: '1994-05-06',
      birthTime: expected.localTime || undefined,
      birthTimeMode: expected.mode,
      birthPlace: 'Казань',
    }));
  });

  it('re-reads the profile under the lock after a competing profile edit', async () => {
    mockBirthProfileGet.mockResolvedValueOnce({ birth_time_mode: 'exact' });
    mockGetBirthProfile.mockResolvedValueOnce({
      id: '42', name: 'После изменения', birth_date: '1998-07-08',
      birth_time: null, birth_time_mode: 'unknown', birth_place: 'Самара',
    });

    await repairCanonicalChartForUser('42');

    expect(mockCalculateNatalChart).toHaveBeenCalledWith('После изменения', '1998-07-08', '', 'Самара',
      expect.objectContaining({ birthTime: expect.objectContaining({ mode: 'unknown' }) }));
    expect(mockWithUserLock.mock.invocationCallOrder[0]).toBeLessThan(mockGetBirthProfile.mock.invocationCallOrder[0]);
    expect(mockGetBirthProfile.mock.invocationCallOrder[0]).toBeLessThan(mockCalculateNatalChart.mock.invocationCallOrder[0]);
    expect(mockPersistPrimary.mock.invocationCallOrder[0]).toBeLessThan(mockSyncPrimaryProfile.mock.invocationCallOrder[0]);
  });
});
