import {
  clearHumanReadingSessionCache,
  loadHumanBaseReport,
  loadHumanDailySection,
  loadHumanPaidSection,
  prefetchHumanBaseReport,
  ensureHumanBaseReport,
  getHumanBaseReportCached,
} from '../services/natalReadingService';
import { HUMAN_FREE_SECTION_KEYS, HUMAN_PAID_SECTION_KEYS } from '../lib/natalHumanShared';
import type { NatalInterpretationReport } from '../types';

function response(status: number, payload: any): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

function baseReport(): NatalInterpretationReport {
  return {
    userName: 'Лина',
    birthData: { birthDate: '2000-01-01', birthTime: '12:00', birthPlace: 'Москва' },
    calculatedAt: '2026-05-21T00:00:00.000Z',
    shortCard: { title: 'Главное', keywords: ['Фокус'], text: 'Текст', advice: 'Совет' },
    freeSections: [],
    paidSections: [],
    premiumSections: [],
  };
}

describe('natal reading service session cache', () => {
  beforeEach(() => {
    clearHumanReadingSessionCache();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps free and paid v2 section pools stable', () => {
    expect(HUMAN_FREE_SECTION_KEYS).toEqual(['base_portrait']);
    expect(HUMAN_PAID_SECTION_KEYS).toEqual([
      'work_business', 'love_relationships', 'money_stability', 'family_home', 'communication_conflicts',
      'energy_recovery', 'friendship_social', 'goals_actions', 'shadow_patterns', 'potential_purpose',
    ]);
  });

  it('does not repeat human-base GET/POST after a report is in memory', async () => {
    const report = baseReport();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: report } }));

    await expect(loadHumanBaseReport('123')).resolves.toBe(report);
    await expect(loadHumanBaseReport('123')).resolves.toBe(report);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
    expect((global.fetch as jest.Mock).mock.calls[1][1]?.method).toBe('POST');
  });


  it('uses the same chart-scoped cache key for prefetch, ensure, and synchronous reads', async () => {
    const report = baseReport();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: report } }));

    await expect(prefetchHumanBaseReport('123', 42)).resolves.toBe(report);
    expect(getHumanBaseReportCached('123', 42)).toBe(report);
    await expect(ensureHumanBaseReport('123', 42)).resolves.toBe(report);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('chartId=42');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('chartId=42');
    expect(getHumanBaseReportCached('123')).toBeNull();
  });


  it('does not unlock paid sections without Premium', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      response(403, {
        code: 'PREMIUM_REQUIRED',
        message: 'locked',
        premiumRequired: true,
      })
    );

    await expect(loadHumanPaidSection('123', 'work_business')).rejects.toMatchObject({
      code: 'PREMIUM_REQUIRED',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
  });

  it('opens daily_overview for free users without Premium', async () => {
    const section = {
      key: 'daily_overview',
      title: 'Тема дня',
      access: 'free',
      content: 'Сегодня лучше выбрать одно понятное дело.',
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: section }, accessTier: 'free' }));

    await expect(loadHumanDailySection('123', 'daily_overview', 7, '2026-05-25')).resolves.toMatchObject({
      content: section,
      accessTier: 'free',
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
    expect((global.fetch as jest.Mock).mock.calls[1][1]?.method).toBe('POST');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1]?.body).accessTier).toBeUndefined();
  });

  it('opens cached premium daily section from GET without POST', async () => {
    const section = {
      key: 'daily_love',
      title: 'Daily love',
      access: 'premium',
      content: 'Cached daily love text.',
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      response(200, { interpretation: { content: section }, accessTier: 'premium' })
    );

    await expect(loadHumanDailySection('123', 'daily_love', 7, '2026-05-25', { accessTier: 'premium' })).resolves.toMatchObject({
      content: section,
      accessTier: 'premium',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
  });

  it('unwraps direct fallback daily payload from POST', async () => {
    const section = {
      key: 'daily_money',
      title: 'Daily money',
      access: 'premium',
      content: 'Fallback money text.',
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: section, source: 'fallback_unsaved', accessTier: 'premium' }));

    await expect(loadHumanDailySection('123', 'daily_money', 7, '2026-05-25', { accessTier: 'premium' })).resolves.toMatchObject({
      content: section,
      accessTier: 'premium',
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[1][1]?.method).toBe('POST');
  });

  it('keeps paid daily sections locked for free users without Premium', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(
        response(403, {
          code: 'PREMIUM_REQUIRED',
          message: 'locked',
          premiumRequired: true,
        })
      );

    await expect(loadHumanDailySection('123', 'daily_work_business', 7, '2026-05-25')).rejects.toMatchObject({
      code: 'PREMIUM_REQUIRED',
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
    expect((global.fetch as jest.Mock).mock.calls[1][1]?.method).toBe('POST');
  });
});
