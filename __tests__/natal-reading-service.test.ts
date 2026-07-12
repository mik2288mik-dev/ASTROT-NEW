import {
  clearHumanReadingSessionCache,
  loadHumanBaseReport,
  loadHumanDailySection,
  loadHumanDailyPackage,
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

function dailyPackage() {
  return {
    hero_title: 'Тише к сути',
    hero_hook: 'Пакет готов.',
    overview: 'Overview body',
    love: { hook: 'Love hook', body: 'Love body' },
    money: { hook: 'Money hook', body: 'Money body' },
    work: { hook: 'Work hook', body: 'Work body' },
    goals: { hook: 'Goals hook', body: 'Goals body' },
    family: { hook: 'Family hook', body: 'Family body' },
    friendship: { hook: 'Friend hook', body: 'Friend body' },
    energy: { hook: 'Energy hook', body: 'Energy body' },
    communication: { hook: 'Talk hook', body: 'Talk body' },
    meta: { free_section_key: 'love' },
  };
}

describe('natal reading service session cache', () => {
  beforeEach(() => {
    clearHumanReadingSessionCache();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps free and paid v2 section pools stable', () => {
    expect(HUMAN_FREE_SECTION_KEYS).toEqual([
      'base_portrait', 'strengths', 'growth_zones', 'main_advice',
    ]);
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

  it('does not request generation again after the daily package is cached in session', async () => {
    const daily = dailyPackage();
    const section = {
      key: 'daily_overview',
      title: 'Тема дня',
      access: 'free',
      content: 'Overview body',
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: section }, accessTier: 'free', dailyPackage: daily }));

    await expect(loadHumanDailyPackage('123', 7, '2026-05-25')).resolves.toBe(daily);
    await expect(loadHumanDailyPackage('123', 7, '2026-05-25')).resolves.toBe(daily);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
    expect((global.fetch as jest.Mock).mock.calls[1][1]?.method).toBe('POST');
  });

  it('polls GET after 202 instead of repeating concurrent POST requests', async () => {
    jest.useFakeTimers();
    const section = { key: 'daily_overview', title: 'Overview', access: 'free', content: 'Overview body' };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(202, { code: 'GENERATION_IN_PROGRESS', retryAfterMs: 10 }))
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: section }, accessTier: 'free', dailyPackage: dailyPackage() }));

    const pending = loadHumanDailySection('123', 'daily_overview', 7, '2026-05-25');
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toMatchObject({ content: section });
    expect((global.fetch as jest.Mock).mock.calls.map((call) => call[1]?.method)).toEqual(['GET', 'POST', 'GET', 'GET']);
    jest.useRealTimers();
  });

  it('returns a package that appears in cache during polling', async () => {
    jest.useFakeTimers();
    const daily = dailyPackage();
    const section = { key: 'daily_overview', title: 'Overview', access: 'free', content: 'Overview body' };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(202, { code: 'GENERATION_IN_PROGRESS', retryAfterMs: 10 }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: section }, accessTier: 'free', dailyPackage: daily }));

    const pending = loadHumanDailyPackage('123', 7, '2026-05-25');
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toBe(daily);
    expect((global.fetch as jest.Mock).mock.calls.map((call) => call[1]?.method)).toEqual(['GET', 'POST', 'GET']);
    jest.useRealTimers();
  });

  it('ends daily polling with a clear timeout code', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(202, { code: 'GENERATION_IN_PROGRESS', retryAfterMs: 10 }))
      .mockResolvedValue(response(404, { error: 'NOT_FOUND' }));

    const pending = loadHumanDailySection('123', 'daily_overview', 7, '2026-05-25');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'DAILY_PACKAGE_POLL_TIMEOUT' });
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(90_000);

    await assertion;
    expect((global.fetch as jest.Mock).mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
    jest.useRealTimers();
  });

  it('uses one in-flight promise for the same daily package key', async () => {
    const daily = dailyPackage();
    const section = { key: 'daily_overview', title: 'Overview', access: 'free', content: 'Overview body' };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: section }, accessTier: 'free', dailyPackage: daily }));

    const first = loadHumanDailyPackage('123', 7, '2026-05-25');
    const second = loadHumanDailyPackage('123', 7, '2026-05-25');

    await expect(first).resolves.toBe(daily);
    await expect(second).resolves.toBe(daily);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retry after an error starts a new daily request', async () => {
    const daily = dailyPackage();
    const section = { key: 'daily_overview', title: 'Overview', access: 'free', content: 'Overview body' };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(503, { code: 'CONTENT_GENERATION_UNAVAILABLE', message: 'failed' }))
      .mockResolvedValueOnce(response(404, { error: 'NOT_FOUND' }))
      .mockResolvedValueOnce(response(200, { interpretation: { content: section }, accessTier: 'free', dailyPackage: daily }));

    await expect(loadHumanDailyPackage('123', 7, '2026-05-25')).rejects.toMatchObject({ code: 'CONTENT_GENERATION_UNAVAILABLE' });
    await expect(loadHumanDailyPackage('123', 7, '2026-05-25')).resolves.toBe(daily);
    expect((global.fetch as jest.Mock).mock.calls.map((call) => call[1]?.method)).toEqual(['GET', 'POST', 'GET', 'POST']);
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
