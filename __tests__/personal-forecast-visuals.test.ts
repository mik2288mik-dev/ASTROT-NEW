import mainManifest from '../lib/personalForecastVisuals/main.manifest.json';
import {
  buildForecastVisualRequests,
  forecastVisualStyle,
  getForecastVisualAssignment,
  getNewspaperVisualCounts,
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

  it('assigns at most one sparse sticker to the overview and none to text sections', () => {
    const manifestPaths = new Set(
      (mainManifest.items as Array<{ path: string }>).map((asset) => asset.path),
    );
    const samples = Array.from({ length: 120 }, (_, index) => resolvePersonalForecastVisuals({
      userId: `${userId}-${index}`,
      forecast: feed(),
    }));
    const shown = samples.find((sample) => !!sample.assignments.overview.path);
    const hidden = samples.find((sample) => !sample.assignments.overview.path);

    expect(shown).toBeDefined();
    expect(hidden).toBeDefined();
    expect(manifestPaths.has(shown!.assignments.overview.path as string)).toBe(true);
    for (const resolved of samples) {
      expect(sections.every((item) => resolved.assignments[item.id].path === null)).toBe(true);
      expect(Object.values(resolved.assignments).filter((assignment) => assignment.path).length)
        .toBeLessThanOrEqual(1);
      expect(resolved.visualFallback).toBe(!resolved.assignments.overview.path);
    }
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
});
