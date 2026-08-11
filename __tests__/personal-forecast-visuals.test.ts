import mainManifest from '../lib/personalForecastVisuals/main.manifest.json';
import {
  buildForecastVisualRequests,
  forecastVisualStyle,
  getForecastVisualAssignment,
  getNewspaperVisualCounts,
  resolveDiaryEditorialPauses,
  resolvePersonalForecastVisuals,
  type ForecastVisualFeedInput,
  type ForecastVisualSectionInput,
} from '../lib/personalForecastVisuals';

const userId = 'visual-user';

function section(
  id: string,
  kind: ForecastVisualSectionInput['kind'],
  visualTag: string,
  fields: Partial<ForecastVisualSectionInput> = {},
): ForecastVisualSectionInput {
  return { id, kind, visualTag, ...fields };
}

const sections: ForecastVisualSectionInput[] = [
  section('love', 'fixed', 'love', { fixedKey: 'love', sourceTopicKey: 'love' }),
  section('mood', 'fixed', 'mood', { fixedKey: 'mood', sourceTopicKey: 'mood' }),
  section('astro:moon', 'astro_accent', 'moon', { sourceTopicKey: 'mood' }),
  section('home_family', 'fixed', 'home', {
    fixedKey: 'home_family',
    sourceTopicKey: 'home_family',
  }),
  section('work_money', 'fixed', 'work-money', {
    fixedKey: 'work_money',
    sourceTopicKey: 'work_money',
  }),
];

function feed(periodKey = '2026-07-31'): ForecastVisualFeedInput {
  return {
    period: 'day',
    periodKey,
    overview: section('overview', 'overview', 'overview', { sourceTopicKey: 'overview' }),
    sections,
  };
}

describe('personal forecast editorial visual resolver', () => {
  it('keeps one ordered request for every section in the continuous feed', () => {
    const requests = buildForecastVisualRequests({ userId, forecast: feed() });
    expect(requests.map((request) => request.sectionId)).toEqual([
      'overview',
      ...sections.map((item) => item.id),
    ]);
    expect(requests.map((request) => request.sectionIndex)).toEqual(
      requests.map((_, index) => index),
    );
  });

  it('assigns one inline sticker to each forecast overview and none to text sections', () => {
    const manifestPaths = new Set(
      (mainManifest.items as Array<{ path: string }>).map((asset) => asset.path),
    );
    const samples = Array.from({ length: 120 }, (_, index) => resolvePersonalForecastVisuals({
      userId: `${userId}-${index}`,
      forecast: feed(),
    }));
    expect(samples.every((sample) => !!sample.assignments.overview.path)).toBe(true);
    for (const resolved of samples) {
      expect(manifestPaths.has(resolved.assignments.overview.path as string)).toBe(true);
      expect(sections.every((item) => resolved.assignments[item.id].path === null)).toBe(true);
      expect(Object.values(resolved.assignments).filter((assignment) => assignment.path).length)
        .toBe(1);
      expect(resolved.visualFallback).toBe(false);
    }
  });

  it('chooses a different sticker when another personal period is already visible', () => {
    const first = resolvePersonalForecastVisuals({ userId, forecast: feed('2026-08-11') });
    const second = resolvePersonalForecastVisuals({
      userId,
      forecast: { ...feed('2026-W33'), period: 'week' },
      excludeAssetIds: [first.assignments.overview.assetId!],
    });

    expect(second.assignments.overview.assetId).not.toBe(first.assignments.overview.assetId);
  });

  it('does not change the selected sticker on refresh', () => {
    const first = resolvePersonalForecastVisuals({ userId, forecast: feed() });
    const second = resolvePersonalForecastVisuals({ userId, forecast: feed() });
    expect(second).toEqual(first);
  });

  it('selects the overview sticker from the compiled semantic topic', () => {
    const semanticFeed: ForecastVisualFeedInput = {
      ...feed('2026-08-02'),
      overview: section('overview', 'overview', 'communication_decisions'),
    };
    const resolved = Array.from({ length: 120 }, (_, index) => resolvePersonalForecastVisuals({
      userId: `${userId}-semantic-${index}`,
      forecast: semanticFeed,
    })).find((sample) => !!sample.assignments.overview.path)!;
    const asset = (mainManifest.items as Array<{
      path: string;
      topics: string[];
    }>).find((item) => item.path === resolved.assignments.overview.path);

    expect(asset?.topics).toContain('communication');
  });

  it('uses the writer-selected story cue for the one forecast sticker', () => {
    const storyFeed: ForecastVisualFeedInput = {
      ...feed('2026-08-11'),
      overview: section('overview', 'overview', 'calculated', {
        visualCue: 'friends',
      }),
    };
    const resolved = Array.from({ length: 120 }, (_, index) => resolvePersonalForecastVisuals({
      userId: `${userId}-story-${index}`,
      forecast: storyFeed,
    })).find((sample) => !!sample.assignments.overview.path)!;
    const asset = (mainManifest.items as Array<{
      path: string;
      topics: string[];
    }>).find((item) => item.path === resolved.assignments.overview.path);

    expect(resolved.assignments.overview.cue).toBe('friends');
    expect(asset?.topics).toContain('friends');
  });

  it('uses a soft background treatment and keeps a safe fallback', () => {
    const resolved = Array.from({ length: 120 }, (_, index) => resolvePersonalForecastVisuals({
      userId: `${userId}-style-${index}`,
      forecast: feed(),
    })).find((sample) => !!sample.assignments.overview.path)!;
    const assignment = getForecastVisualAssignment(resolved, 'overview');
    const style = forecastVisualStyle(assignment, 'day');

    expect(style['--forecast-section-image']).toContain('/editorial-stickers/main/');
    expect(Number(style['--forecast-section-media-opacity'])).toBeGreaterThan(0);
    expect(Number(style['--forecast-section-media-opacity'])).toBeLessThan(0.6);
    expect(Number(style['--forecast-section-media-saturation'])).toBeLessThan(0.8);
    expect(Number(style['--forecast-section-media-brightness'])).toBeGreaterThan(1);
    expect(getForecastVisualAssignment(resolved, 'missing')).toBeNull();
    expect(forecastVisualStyle(null, 'week')).toMatchObject({
      '--forecast-section-fallback-accent': '#7ea9e8',
      '--forecast-section-fallback-soft': '#edf4ff',
    });
  });

  it('publishes the complete deterministic library counts', () => {
    expect(getNewspaperVisualCounts()).toEqual({
      main: 788,
      synastry: 200,
      zodiac: 12,
    });
  });

  it('places at most two unique inline visual pauses without changing section order', () => {
    const samples = Array.from({ length: 200 }, (_, index) => resolveDiaryEditorialPauses({
      userId: `pause-user-${index}`,
      period: 'day',
      periodKey: '2026-08-11',
      sections: [feed().overview, ...feed().sections],
    }));

    expect(samples.some((sample) => sample.length === 2)).toBe(true);
    for (const pauses of samples) {
      expect(pauses.length).toBeLessThanOrEqual(2);
      expect(new Set(pauses.map((pause) => pause.asset.id)).size).toBe(pauses.length);
      expect(pauses.map((pause) => pause.afterSectionId).every((id) => (
        [feed().overview, ...feed().sections].some((item) => item.id === id)
      ))).toBe(true);
    }
  });

  it('keeps week and month to one visual pause at most', () => {
    for (const period of ['week', 'month'] as const) {
      const pauses = resolveDiaryEditorialPauses({
        userId: 'long-reading-user',
        period,
        periodKey: `2026-${period}`,
        sections: [feed().overview, ...feed().sections],
      });
      expect(pauses.length).toBeLessThanOrEqual(1);
    }
  });
});
