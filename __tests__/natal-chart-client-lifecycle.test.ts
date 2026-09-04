import type { NatalChartData, UserProfile } from '../types';

const mockApiFetch = jest.fn();
const mockCacheWrite = jest.fn();
jest.mock('../services/apiClient', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));
jest.mock('../lib/runtimeDiagnostics', () => ({ diagnosticLog: jest.fn(), showRuntimeDiagnosticsForFailure: jest.fn() }));
jest.mock('../lib/localNatalChartCache', () => ({
  buildNatalChartCacheKey: (profile: UserProfile) => [profile.id, profile.birthDate, profile.birthTime, profile.birthPlace].join('|'),
  writeLocalNatalChart: (...args: unknown[]) => mockCacheWrite(...args),
}));
jest.mock('../lib/natalChartCanonical', () => ({
  ...jest.requireActual('../lib/natalChartCanonical'),
  isCanonicalNatalChartDataComplete: (value: { schemaVersion?: string } | null) => value?.schemaVersion === 'natal-chart-data-v2',
}));

import { forceRecalculateChart, getOrCalculateChart, natalChartMatchesProfile } from '../services/chartService';

const profile = {
  id: '42', name: 'Mira', birthDate: '1990-01-01', birthTime: '10:00', birthTimeMode: 'exact',
  birthPlace: 'Moscow', birthTimezone: 'Europe/Moscow', birthLatitude: 55.7558, birthLongitude: 37.6173,
  language: 'ru',
} as UserProfile;
const chart = {
  schemaVersion: 'natal-chart-data-v2',
  birth: { localDate: profile.birthDate, place: profile.birthPlace, timezone: profile.birthTimezone,
    latitude: profile.birthLatitude, longitude: profile.birthLongitude,
    time: { mode: 'exact', localTime: '10:00', uncertaintyMinutes: null, rangeStart: null, rangeEnd: null } },
} as NatalChartData;
const response = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload });
const savedResponse = () => response({ charts: [{ id: 1, subject_type: 'self', chart_data: chart }] });

describe('natal chart client lifecycle', () => {
  beforeEach(() => { mockApiFetch.mockReset(); mockCacheWrite.mockClear(); });

  it('repeated opening and the legacy force action only read an unchanged stored chart', async () => {
    mockApiFetch.mockImplementation(async () => savedResponse());
    expect(await getOrCalculateChart(profile)).toBe(chart);
    expect(await getOrCalculateChart({ ...profile, name: 'Maria', language: 'en' })).toBe(chart);
    expect(await forceRecalculateChart(profile)).toBe(chart);
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
    expect(mockApiFetch.mock.calls.every((call) => call[1].method === 'GET')).toBe(true);
  });

  it('sends changed birth input through one canonical write and replaces the local cache', async () => {
    const changedProfile = { ...profile, birthDate: '1990-01-02' };
    const changedChart = { ...chart, birth: { ...chart.birth!, localDate: changedProfile.birthDate } };
    mockApiFetch.mockResolvedValueOnce(savedResponse()).mockResolvedValueOnce(response({ chart_data: changedChart }));
    expect(await getOrCalculateChart(changedProfile)).toBe(changedChart);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    const [url, options] = mockApiFetch.mock.calls[1];
    expect(url).toBe('/api/charts');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({ primary: true, birthDate: '1990-01-02' });
    expect(JSON.parse(options.body)).not.toHaveProperty('forceRecalculate');
    expect(mockCacheWrite).toHaveBeenCalledWith(changedProfile, changedChart);
  });

  it('coalesces concurrent opens and creates a missing chart only once', async () => {
    mockApiFetch.mockResolvedValueOnce(response({ charts: [] })).mockResolvedValueOnce(response({ chart_data: chart }));
    const results = await Promise.all([getOrCalculateChart(profile), getOrCalculateChart(profile)]);
    expect(results).toEqual([chart, chart]);
    expect(mockApiFetch.mock.calls.filter((call) => call[1].method === 'POST')).toHaveLength(1);
  });

  it('does not turn a failed database read into a new calculation', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(getOrCalculateChart(profile)).rejects.toMatchObject({ code: 'CHART_READ_FAILED' });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockCacheWrite).not.toHaveBeenCalled();
  });

  it('preserves birth identity across harmless formatting and detects precision changes', () => {
    expect(natalChartMatchesProfile(chart, { ...profile, birthTime: '10:00:00', birthPlace: '  Moscow  ' })).toBe(true);
    expect(natalChartMatchesProfile(chart, { ...profile, birthTimeMode: 'approximate', birthTimeUncertaintyMinutes: 30 })).toBe(false);
    expect(natalChartMatchesProfile(chart, { ...profile, birthLatitude: 50 })).toBe(false);
    expect(natalChartMatchesProfile(chart, { ...profile, birthTimezone: 'Europe/London' })).toBe(false);
  });
});
