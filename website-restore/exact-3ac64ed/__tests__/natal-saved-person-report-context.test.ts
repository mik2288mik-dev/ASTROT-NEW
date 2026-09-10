const mockUserGet = jest.fn();
const mockChartGetById = jest.fn();
const mockPrimaryGet = jest.fn();
const mockRepairCanonicalChartRecord = jest.fn();
const mockRepairCanonicalChartForUser = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    users: { get: (...args: unknown[]) => mockUserGet(...args) },
    natal_charts: {
      getById: (...args: unknown[]) => mockChartGetById(...args),
      getPrimary: (...args: unknown[]) => mockPrimaryGet(...args),
    },
  },
}));
jest.mock('../lib/natalChartPersistence', () => ({
  repairCanonicalChartForUser: (...args: unknown[]) => mockRepairCanonicalChartForUser(...args),
  repairCanonicalChartRecord: (...args: unknown[]) => mockRepairCanonicalChartRecord(...args),
}));
jest.mock('../lib/astrologyHistoryPersistence', () => ({
  persistNatalReadingHistory: jest.fn(),
}));
jest.mock('../lib/contentArchitecture', () => ({
  getContentLayer: jest.fn(),
  getPremiumEntitlementState: jest.fn(),
}));
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: jest.fn() }));

import { resolveReadingContext } from '../lib/natalReading/apiHelper';
import { isCanonicalNatalChartDataComplete } from '../lib/natalChartCanonical';

const primaryChartData = {
  schemaVersion: 'natal-chart-data-v2',
  positions: { sun: { sign: 'Aries' } },
  chartQuality: { birthTimeQuality: 'exact' },
  calculationVersion: 'primary-v1',
};
const savedChartData = {
  schemaVersion: 'natal-chart-data-v2',
  birth: { time: { mode: 'unknown' } },
  positions: {
    sun: { sign: 'Scorpio' },
    moon: { sign: 'Cancer' },
    chiron: { sign: 'Leo' },
    northNode: { sign: 'Gemini' },
  },
  angles: { ascendant: null, mc: null, descendant: null, ic: null },
  houses: [],
  aspects: [],
  chartQuality: { birthTimeMode: 'unknown', birthTimeQuality: 'unknown' },
  calculationMetadata: { ephemerisEngine: 'Swiss Ephemeris' },
  calculationVersion: 'swisseph-canonical-v2',
  birthTimeQuality: 'unknown',
};

describe('saved-person natal report context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserGet.mockResolvedValue({
      id: 'owner-1', name: 'Owner', birth_date: '1990-01-01', birth_time: '12:00',
      birth_place: 'Moscow', language: 'ru', is_setup: true, is_premium: true,
    });
    mockPrimaryGet.mockResolvedValue({
      id: 1, user_id: 'owner-1', is_primary: true, subject_type: 'self',
      name: 'Owner', birth_date: '1990-01-01', birth_time: '12:00', birth_place: 'Moscow',
      chart_data: primaryChartData,
    });
    mockChartGetById.mockResolvedValue({
      id: 77, user_id: 'owner-1', is_primary: false, subject_type: 'saved_person',
      name: 'Лена', birth_date: '1994-02-03', birth_time: null, birth_place: 'Казань',
      relation_label: 'подруга', archived_at: null, chart_data: savedChartData,
    });
  });

  it('uses the requested saved chart and its subject profile instead of the owner primary chart', async () => {
    expect(isCanonicalNatalChartDataComplete(savedChartData)).toBe(true);
    const context = await resolveReadingContext('owner-1', 77);

    expect(mockChartGetById).toHaveBeenCalledWith(77);
    expect(mockPrimaryGet).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
    expect(context).toMatchObject({
      chartId: 77,
      chartData: savedChartData,
      chartSubjectType: 'saved_person',
      relationLabel: 'подруга',
      profile: {
        id: 'owner-1',
        name: 'Лена',
        birthDate: '1994-02-03',
        birthTime: '',
        birthPlace: 'Казань',
      },
    });
    expect(context?.chartData).not.toBe(primaryChartData);
  });

  it('can read an existing primary snapshot without repairing or invoking calculation', async () => {
    mockPrimaryGet.mockResolvedValueOnce({
      id: 1,
      user_id: 'owner-1',
      is_primary: true,
      subject_type: 'self',
      name: 'Owner',
      birth_date: '1990-01-01',
      birth_time: '12:00',
      birth_place: 'Moscow',
      chart_data: primaryChartData,
    });

    const context = await resolveReadingContext(
      'owner-1',
      null,
      undefined,
      undefined,
      { repairCanonical: false },
    );

    expect(context?.chartData).toBe(primaryChartData);
    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
  });

  it('normalizes PostgreSQL Date values before exposing the profile', async () => {
    const storedBirthDate = new Date('1990-01-01T00:00:00.000Z');
    mockUserGet.mockResolvedValueOnce({
      id: 'owner-1', name: 'Owner', birth_date: storedBirthDate, birth_time: '12:00',
      birth_place: 'Moscow', language: 'ru', is_setup: true, is_premium: true,
    });
    mockPrimaryGet.mockResolvedValueOnce({
      id: 1, user_id: 'owner-1', is_primary: true, subject_type: 'self',
      name: 'Owner', birth_date: storedBirthDate, birth_time: '12:00', birth_place: 'Moscow',
      chart_data: primaryChartData,
    });

    const context = await resolveReadingContext('owner-1', null);

    expect(context?.profile.birthDate).toBe('1990-01-01');
  });
});
