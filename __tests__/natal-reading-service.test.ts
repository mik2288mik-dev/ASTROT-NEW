import {
  clearHumanReadingSessionCache,
  loadHumanDailyPreview,
  loadHumanDailySection,
  loadHumanBaseReport,
  loadHumanPaidSection,
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
    expect(HUMAN_FREE_SECTION_KEYS).toEqual([
      'base_portrait',
      'main_formula',
      'how_others_see_you',
      'emotional_world',
      'strengths',
      'growth_zones',
      'main_advice',
      'summary',
    ]);
    expect(HUMAN_PAID_SECTION_KEYS).toEqual([
      'work_business',
      'love_relationships',
      'money_stability',
      'family_home',
      'communication_conflicts',
      'energy_recovery',
      'friendship_social',
      'goals_actions',
      'shadow_patterns',
      'potential_purpose',
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

  it('does not spend Lumi unless allowLumiSpend is explicit', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      response(403, {
        code: 'HUMAN_SECTION_LOCKED',
        message: 'locked',
        lumiCost: 300,
        lumiBalance: 500,
      })
    );

    await expect(loadHumanPaidSection('123', 'work_business')).rejects.toMatchObject({
      code: 'HUMAN_SECTION_LOCKED',
      lumiCost: 300,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
  });

  it('loads daily overview as a free preview through the daily endpoint', async () => {
    const section = {
      key: 'daily_overview',
      title: 'Карта сегодня',
      access: 'free',
      content: 'Сегодня лучше выбрать одно понятное дело.',
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      response(200, {
        interpretation: { content: section },
        accessTier: 'free_preview',
        isPreview: true,
      })
    );

    await expect(loadHumanDailyPreview('123', 7, '2026-05-25')).resolves.toMatchObject({
      content: section,
      accessTier: 'free_preview',
      isPreview: true,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('sectionKey=daily_overview');
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
  });

  it('keeps paid daily sections locked for free users without explicit Lumi spend', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      response(403, {
        code: 'HUMAN_DAILY_LOCKED',
        message: 'locked',
        lumiCost: 35,
        lumiBalance: 20,
      })
    );

    await expect(loadHumanDailySection('123', 'daily_work_business', 7, '2026-05-25')).rejects.toMatchObject({
      code: 'HUMAN_DAILY_LOCKED',
      lumiCost: 35,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.method).toBe('GET');
  });
});
