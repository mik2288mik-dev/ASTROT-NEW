const mockChartGetById = jest.fn();
const mockRepairSaved = jest.fn();
const mockUserGet = jest.fn();
const mockResolveBirthCoordinates = jest.fn();
const mockCalculateNatalChart = jest.fn();
const mockGetAll = jest.fn();
const mockWithUserLock = jest.fn();
const mockCreate = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    users: { get: (...args: unknown[]) => mockUserGet(...args) },
  },
}));

jest.mock('../lib/birthProfileRepository', () => ({
  birthProfileRepository: { get: jest.fn(), set: jest.fn() },
}));

jest.mock('../lib/natalChartV2Repository', () => ({
  natalChartV2Repository: {
    getById: (...args: unknown[]) => mockChartGetById(...args),
    withUserLock: (...args: unknown[]) => mockWithUserLock(...args),
  },
}));

jest.mock('../lib/swisseph-calculator', () => ({
  resolveBirthCoordinates: (...args: unknown[]) => mockResolveBirthCoordinates(...args),
  calculateNatalChart: (...args: unknown[]) => mockCalculateNatalChart(...args),
}));

import { repairCanonicalChartRecord } from '../lib/natalChartPersistence';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

describe('saved-person canonical repair identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    mockWithUserLock.mockImplementation(async (_userId: string, work: (repo: any) => Promise<unknown>) => work({
      getAll: (...args: unknown[]) => mockGetAll(...args),
      getCalculations: async () => [],
      repairSaved: (...args: unknown[]) => mockRepairSaved(...args),
      create: mockCreate,
    }));
    mockGetAll.mockImplementation(async () => [await mockChartGetById()]);
    mockUserGet.mockResolvedValue({ id: 'owner-1' });
    mockResolveBirthCoordinates.mockResolvedValue({ lat: 55.79, lon: 49.12, timezone: 'Europe/Moscow' });
    mockCalculateNatalChart.mockImplementation(async (_name: string, date: string, _time: string, place: string, options: any) => canonicalNatalChart({
      birthDate: date, birthPlace: place, time: options.birthTime, coordinates: options.coordinates,
    }));
    mockRepairSaved.mockResolvedValue({ id: 77, user_id: 'owner-1', subject_type: 'saved_person' });
  });
  afterEach(() => jest.restoreAllMocks());

  it('updates the same chart id and preserves approximate-time metadata', async () => {
    mockChartGetById.mockResolvedValue({
      id: 77,
      user_id: 'owner-1',
      is_primary: false,
      subject_type: 'saved_person',
      name: 'Марина',
      birth_date: '1991-06-10',
      birth_time: '12:20',
      birth_time_mode: 'approximate',
      birth_time_uncertainty_minutes: 30,
      birth_time_range_start: null,
      birth_time_range_end: null,
      birth_place: 'Казань',
    });

    const result = await repairCanonicalChartRecord('owner-1', 77);

    expect(result).toMatchObject({ source: 'repaired', chart: { id: 77 } });
    expect(mockCalculateNatalChart).toHaveBeenCalledWith(
      'Марина',
      '1991-06-10',
      '12:20',
      'Казань',
      expect.objectContaining({
        birthTime: expect.objectContaining({
          mode: 'approximate',
          localTime: '12:20',
          uncertaintyMinutes: 30,
        }),
      }),
    );
    expect(mockRepairSaved).toHaveBeenCalledWith(
      'owner-1',
      77,
      expect.objectContaining({
        birthTime: '12:20',
        birthTimeMode: 'approximate',
        birthTimeUncertaintyMinutes: 30,
        birthTimeRangeStart: null,
        birthTimeRangeEnd: null,
      }),
    );
  });

  it('preserves an explicit time range while repairing the same chart id', async () => {
    mockChartGetById.mockResolvedValue({
      id: 78,
      user_id: 'owner-1',
      is_primary: false,
      subject_type: 'saved_person',
      name: 'Игорь',
      birth_date: '1988-03-02',
      birth_time: null,
      birth_time_mode: 'range',
      birth_time_uncertainty_minutes: null,
      birth_time_range_start: '08:00',
      birth_time_range_end: '10:00',
      birth_place: 'Казань',
    });
    mockRepairSaved.mockResolvedValueOnce({ id: 78, user_id: 'owner-1', subject_type: 'saved_person' });

    await repairCanonicalChartRecord('owner-1', 78);

    expect(mockRepairSaved).toHaveBeenCalledWith(
      'owner-1',
      78,
      expect.objectContaining({
        birthTime: undefined,
        birthTimeMode: 'range',
        birthTimeUncertaintyMinutes: null,
        birthTimeRangeStart: '08:00',
        birthTimeRangeEnd: '10:00',
      }),
    );
  });

  it('refuses to repair a chart through another user identity', async () => {
    mockChartGetById.mockResolvedValue({
      id: 79,
      user_id: 'owner-2',
      is_primary: false,
      subject_type: 'saved_person',
    });

    await expect(repairCanonicalChartRecord('owner-1', 79)).resolves.toBeNull();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
    expect(mockRepairSaved).not.toHaveBeenCalled();
  });

  it('uses the locked current saved-person row and never creates another identity', async () => {
    const chart = {
      id: 77, user_id: 'owner-1', subject_type: 'saved_person', name: 'Марина',
      birth_date: '1991-06-10', birth_time: '12:20', birth_time_mode: 'exact', birth_place: 'Казань',
    };
    mockChartGetById.mockResolvedValueOnce(chart);
    mockGetAll.mockResolvedValueOnce([{ ...chart, birth_date: '1992-07-11', birth_time: '15:30', relation_label: 'подруга' }]);

    await repairCanonicalChartRecord('owner-1', 77);

    expect(mockCalculateNatalChart).toHaveBeenCalledWith('Марина', '1992-07-11', '15:30', 'Казань', expect.anything());
    expect(mockRepairSaved).toHaveBeenCalledWith('owner-1', 77, expect.objectContaining({
      birthDate: '1992-07-11', birthTime: '15:30', relationLabel: 'подруга',
    }));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockWithUserLock.mock.invocationCallOrder[0]).toBeLessThan(mockGetAll.mock.invocationCallOrder[0]);
    expect(mockGetAll.mock.invocationCallOrder[0]).toBeLessThan(mockCalculateNatalChart.mock.invocationCallOrder[0]);
  });
});
