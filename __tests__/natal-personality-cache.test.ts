const mockApiFetch = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
jest.mock('../services/sessionService', () => ({
  getTelegramInitDataHeaders: () => ({}),
}));

import {
  clearHumanReadingSessionCache,
  ensureHumanBaseReport,
} from '../services/natalReadingService';
import type { NatalPermanentFreeReport } from '../lib/natalReading/permanentReport';

const report = {
  schemaVersion: 'natal-permanent-free-v3',
  contractVersion: 'natal-permanent-report-v7',
  tier: 'free',
  evidenceIds: ['natal.position.sun'],
  hook: { text: 'Ты быстро видишь, где разговор теряет смысл.', evidenceIds: ['natal.position.sun'] },
  userName: 'Мира',
  birthData: { birthDate: '1990-01-01', birthTime: '12:00', birthPlace: 'Москва' },
  calculatedAt: '2026-08-13T00:00:00.000Z',
  freeSections: [],
  paidSections: [],
  premiumSections: [],
  shortCard: { title: 'Портрет', keywords: [], text: 'Текст', advice: '' },
} as NatalPermanentFreeReport;

function response(status: number, payload: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe('natal personality report client cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearHumanReadingSessionCache();
  });

  it('reopens the same fingerprint and report version without another generation POST', async () => {
    mockApiFetch
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: report } }));
    const identity = {
      chartFingerprint: 'calculated-chart-fingerprint',
      reportVersion: 'natal-permanent-report-v7',
    };

    const first = await ensureHumanBaseReport('user-1', 42, 'ru', identity);
    const reopened = await ensureHumanBaseReport('user-1', 42, 'ru', identity);

    expect(first).toBe(report);
    expect(reopened).toBe(report);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mockApiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it('does not reuse memory when the chart fingerprint changes', async () => {
    mockApiFetch
      .mockResolvedValueOnce(response(404, {}))
      .mockResolvedValueOnce(response(200, { interpretation: { content: report } }))
      .mockResolvedValueOnce(response(404, {}))
      .mockResolvedValueOnce(response(200, { interpretation: { content: report } }));

    await ensureHumanBaseReport('user-1', 42, 'ru', {
      chartFingerprint: 'chart-a', reportVersion: 'natal-permanent-report-v7',
    });
    await ensureHumanBaseReport('user-1', 42, 'ru', {
      chartFingerprint: 'chart-b', reportVersion: 'natal-permanent-report-v7',
    });

    expect(mockApiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2);
  });

  it('does not reuse memory when the report version changes', async () => {
    mockApiFetch
      .mockResolvedValueOnce(response(404, {}))
      .mockResolvedValueOnce(response(200, { interpretation: { content: report } }))
      .mockResolvedValueOnce(response(404, {}))
      .mockResolvedValueOnce(response(200, { interpretation: { content: report } }));

    await ensureHumanBaseReport('user-1', 42, 'ru', {
      chartFingerprint: 'chart-a', reportVersion: 'natal-permanent-report-v7',
    });
    await ensureHumanBaseReport('user-1', 42, 'ru', {
      chartFingerprint: 'chart-a', reportVersion: 'natal-permanent-report-v8',
    });

    expect(mockApiFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2);
  });
});
