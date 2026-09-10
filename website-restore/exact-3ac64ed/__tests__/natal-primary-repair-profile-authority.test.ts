const mockUserGet = jest.fn();
const mockUserUpdateExisting = jest.fn();
const mockBirthProfileGet = jest.fn();
const mockBirthProfileSet = jest.fn();
const mockGetPrimary = jest.fn();
const mockFindByInputHash = jest.fn();
const mockPersistPrimary = jest.fn();
const mockResolveBirthCoordinates = jest.fn();
const mockCalculateNatalChart = jest.fn();

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

describe('self-chart repair profile authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    mockCalculateNatalChart.mockResolvedValue({
      schemaVersion: 'natal-chart-data-v2',
      calculationVersion: 'swisseph-canonical-v2',
      sun: {},
      moon: {},
    });
    mockPersistPrimary.mockResolvedValue({ id: 7 });
  });

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

    await repairCanonicalChartForUser('42');

    expect(mockUserUpdateExisting).toHaveBeenCalledWith('42', expect.objectContaining({
      name: 'Новая анкета',
      birth_date: '1994-05-06',
      birth_time: expected.localTime,
      birth_place: 'Казань',
    }));
    expect(mockBirthProfileSet).toHaveBeenCalledWith('42', expect.objectContaining(expected));
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
});
