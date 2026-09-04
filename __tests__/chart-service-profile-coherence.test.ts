const mockApiFetch = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
jest.mock('../services/sessionService', () => ({
  getTelegramInitDataHeaders: () => ({}),
}));
jest.mock('../lib/localNatalChartCache', () => {
  const actual = jest.requireActual('../lib/localNatalChartCache');
  return { ...actual, writeLocalNatalChart: jest.fn() };
});
jest.mock('../lib/runtimeDiagnostics', () => ({
  diagnosticLog: jest.fn(),
  showRuntimeDiagnosticsForFailure: jest.fn(),
}));

import type { UserProfile } from '../types';
import { getOrCalculateChart, natalChartMatchesProfile } from '../services/chartService';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

function response(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

function canonicalChart(mode: 'exact' | 'approximate' | 'unknown', time: string | null) {
  return canonicalNatalChart({
    birthDate: '1991-06-12',
    birthPlace: 'Москва, Россия',
    coordinates: { lat: 55.7558, lon: 37.6173, timezone: 'Europe/Moscow' },
    time: { mode, localTime: time, uncertaintyMinutes: mode === 'approximate' ? 30 : null, rangeStart: null, rangeEnd: null },
  }) as any;
}
function profile(mode: 'exact' | 'approximate' | 'unknown'): UserProfile {
  return {
    id: '1001',
    name: 'Анна',
    birthDate: '1991-06-12',
    birthTime: mode === 'unknown' ? '' : '08:45',
    birthTimeMode: mode,
    birthTimeUncertaintyMinutes: mode === 'approximate' ? 30 : null,
    birthPlace: 'Москва, Россия',
    birthLatitude: 55.7558,
    birthLongitude: 37.6173,
    birthTimezone: 'Europe/Moscow',
    isSetup: false,
    language: 'ru',
    theme: 'light',
    isPremium: false,
  };
}

describe('chart service profile coherence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('matches only the chart created from the current birth profile', () => {
    const exact = canonicalChart('exact', '08:45');
    const current = profile('exact');
    expect(natalChartMatchesProfile(exact, { ...current, birthTime: '08:45:00' })).toBe(true);
    expect(natalChartMatchesProfile(exact, { ...current, birthDate: '1991-06-13' })).toBe(false);
    expect(natalChartMatchesProfile(exact, { ...current, birthTime: '09:45' })).toBe(false);
    expect(natalChartMatchesProfile(exact, { ...current, birthPlace: 'Казань, Россия' })).toBe(false);
    expect(natalChartMatchesProfile(exact, profile('unknown'))).toBe(false);
  });

  it('recalculates a partial-onboarding retry instead of restoring a stale exact chart', async () => {
    const approximate = canonicalChart('approximate', '08:45');
    mockApiFetch
      .mockResolvedValueOnce(response({ charts: [{ subject_type: 'self', is_primary: true, chart_data: canonicalChart('exact', '07:10') }] }))
      .mockResolvedValueOnce(response({ chart_data: approximate }));

    await expect(getOrCalculateChart(profile('approximate'))).resolves.toBe(approximate);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    const request = JSON.parse(String(mockApiFetch.mock.calls[1][1]?.body));
    expect(request).toMatchObject({
      birthTime: '08:45',
      birthTimeMode: 'approximate',
      birthTimeUncertaintyMinutes: 30,
    });
  });

  it('reports an incomplete saved self chart without an automatic POST or repair', async () => {
    mockApiFetch
      .mockResolvedValueOnce(response({ charts: [{ subject_type: 'self', is_primary: true, chart_data: { sun: {} } }] }));

    await expect(getOrCalculateChart(profile('unknown'))).rejects.toMatchObject({ code: 'CHART_REPAIR_REQUIRED', status: 409 });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch.mock.calls[0][1].method).toBe('GET');
  });

  it('honors the server repair flag when a complete-looking snapshot has no input hash', async () => {
    mockApiFetch.mockResolvedValueOnce(response({ charts: [{
      subject_type: 'self', is_primary: true, input_hash: null,
      chart_data: canonicalChart('exact', '08:45'), repair_required: true,
    }] }));

    await expect(getOrCalculateChart(profile('exact'))).rejects.toMatchObject({ code: 'CHART_REPAIR_REQUIRED', status: 409 });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch.mock.calls[0][1].method).toBe('GET');
  });
});
