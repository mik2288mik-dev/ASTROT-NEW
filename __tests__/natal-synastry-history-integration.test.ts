import fs from 'fs';
import path from 'path';

const events: string[] = [];
const mockUpsertByChart = jest.fn();
const mockUpsertByUser = jest.fn();
const mockPersistNatalReadingHistory = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    content_interpretations: {
      upsertByChart: (...args: unknown[]) => mockUpsertByChart(...args),
      upsertByUser: (...args: unknown[]) => mockUpsertByUser(...args),
    },
  },
}));

jest.mock('../lib/astrologyHistoryPersistence', () => ({
  persistNatalReadingHistory: (...args: unknown[]) => mockPersistNatalReadingHistory(...args),
}));

import { saveReading, type ReadingContext } from '../lib/natalReading/apiHelper';

const ROOT = path.resolve(__dirname, '..');

function context(): ReadingContext {
  return {
    user: { id: '42' },
    profile: {
      id: '42',
      name: 'User',
      birthDate: '1990-01-01',
      birthTime: '',
      birthPlace: 'Moscow',
      language: 'ru',
      theme: 'light',
      isSetup: true,
      isPremium: false,
      isAdmin: false,
      loginStreak: 0,
      chartSlots: 1,
    },
    chartId: 7,
    chartData: {
      sun: { planet: 'Sun', sign: 'Aries', description: '' },
      moon: { planet: 'Moon', sign: 'Taurus', description: '' },
      rising: { planet: 'Ascendant', sign: 'Gemini', description: '' },
      mercury: null,
      venus: null,
      mars: null,
      element: 'Fire',
      rulingPlanet: 'Mars',
      summary: '',
      birthTimeQuality: 'unknown',
    },
  };
}

describe('natal and synastry history integration', () => {
  beforeEach(() => {
    events.length = 0;
    jest.clearAllMocks();
    mockUpsertByChart.mockImplementation(async () => {
      events.push('content-saved');
      return { id: 11, content: { title: 'Saved' } };
    });
    mockPersistNatalReadingHistory.mockImplementation(async () => {
      events.push('history-appended');
    });
  });

  it('appends natal history only after the chart-scoped content save succeeds', async () => {
    await saveReading(context(), {
      accessTier: 'free',
      contentVariant: 'anchor',
      cacheKey: 'natal.anchor.v1',
      promptVersion: 'natal.prompt.v1',
    }, { title: 'Saved' });

    expect(events).toEqual(['content-saved', 'history-appended']);
    expect(mockPersistNatalReadingHistory).toHaveBeenCalledWith(expect.objectContaining({
      userId: '42',
      chartId: 7,
      rawBirthTime: '',
      cacheKey: 'natal.anchor.v1',
      content: { title: 'Saved' },
    }));
  });

  it('does not append natal history when the content save fails', async () => {
    mockUpsertByChart.mockRejectedValueOnce(new Error('save failed'));

    await expect(saveReading(context(), {
      accessTier: 'free',
      contentVariant: 'anchor',
      cacheKey: 'natal.anchor.v1',
      promptVersion: 'natal.prompt.v1',
    }, { title: 'Unsaved' })).rejects.toThrow('save failed');

    expect(mockPersistNatalReadingHistory).not.toHaveBeenCalled();
  });

  it('records extended synastry for a persisted chart pair and never substitutes noon', () => {
    const route = fs.readFileSync(
      path.join(ROOT, 'pages/api/content/synastry/extended.ts'),
      'utf8',
    );
    expect(route).not.toContain("resolvedPartnerTime || '12:00'");
    expect(route).toContain('if (primaryChartId && partnerChartRecord?.id && userChartData && partnerChartData)');
    expect(route).toContain('persistSavedSynastryHistory({');
    expect(route).toContain('counterpartChartId: partnerChartRecord.id');
    expect(route).toContain('counterpartBirthTime: partnerChartRecord.birth_time');
  });

  it('covers the natal routes used by the current chart screen without inventing noon', () => {
    for (const file of [
      'pages/api/content/natal/anchor.ts',
      'pages/api/content/natal/full.ts',
      'pages/api/content/natal/living.ts',
      'pages/api/content/natal/planet-insight.ts',
    ]) {
      const route = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(route).toContain('persistNatalReadingHistory({');
      expect(route).not.toContain("user.birth_time || '12:00'");
    }
  });
});
