import {
  PERSONAL_FORECAST_BACKGROUND_MANIFEST,
  buildForecastVisualRequests,
  forecastVisualStyle,
  getForecastVisualAssignment,
  resolveForecastVisualScreen,
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
  return {
    id,
    kind,
    visualTag,
    ...fields,
  };
}

const sections: ForecastVisualSectionInput[] = [
  section('love', 'fixed', 'love', { fixedKey: 'love', sourceTopicKey: 'love' }),
  section('mood', 'fixed', 'mood', { fixedKey: 'mood', sourceTopicKey: 'mood' }),
  section('astro:moon', 'astro_accent', 'moon', { sourceTopicKey: 'mood' }),
  section('home_family', 'fixed', 'home', {
    fixedKey: 'home_family',
    sourceTopicKey: 'home_family',
  }),
  section('friends', 'fixed', 'friends', {
    fixedKey: 'friends',
    sourceTopicKey: 'friends',
  }),
  section('dynamic:business', 'dynamic', 'business', { sourceTopicKey: 'business' }),
  section('work_money', 'fixed', 'work-money', {
    fixedKey: 'work_money',
    sourceTopicKey: 'work_money',
  }),
  section('dynamic:documents', 'dynamic', 'documents', {
    sourceTopicKey: 'documents_agreements',
  }),
  section('wishes', 'wishes', 'wishes', {
    fixedKey: 'wishes',
    sourceTopicKey: 'wishes',
  }),
];

function feed(
  period: ForecastVisualFeedInput['period'],
  periodKey: string,
): ForecastVisualFeedInput {
  return {
    period,
    periodKey,
    overview: section('overview', 'overview', 'overview', {
      sourceTopicKey: 'overview',
    }),
    sections,
  };
}

function screen(
  period: ForecastVisualFeedInput['period'],
  periodKey: string,
) {
  return resolvePersonalForecastVisuals({
    userId,
    forecast: feed(period, periodKey),
  });
}

describe('personal forecast V3 feed visual resolver', () => {
  it('builds one ordered request for overview and every continuous section', () => {
    const requests = buildForecastVisualRequests({
      userId,
      forecast: feed('day', '2026-07-27'),
    });

    expect(requests.map((request) => request.sectionId)).toEqual([
      'overview',
      ...sections.map((item) => item.id),
    ]);
    expect(requests.map((request) => request.sectionIndex)).toEqual(
      requests.map((_, index) => index),
    );
    expect(requests[2]).toMatchObject({
      sectionId: 'mood',
      kind: 'fixed',
      visualTag: 'mood',
    });
  });

  it('uses only the existing image bank and avoids repeats inside a normal feed', () => {
    const resolved = screen('day', '2026-07-27');
    const manifestPaths = new Set(PERSONAL_FORECAST_BACKGROUND_MANIFEST.map((asset) => asset.file));
    const paths = resolved.sectionIds
      .map((id) => resolved.assignments[id].path)
      .filter((path): path is string => !!path);

    expect(paths.every((path) => manifestPaths.has(path))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
    for (let index = 1; index < paths.length; index += 1) {
      expect(paths[index]).not.toBe(paths[index - 1]);
    }
    expect(resolved.sectionAssetIds.overview).toBe(
      resolved.assignments.overview.assetId,
    );
  });

  it('maps V3 visual tags to semantic real assets', () => {
    const resolved = screen('day', '2026-07-27');

    expect(resolved.assignments.overview.path).toContain('/foni/horoscope-general-');
    expect(resolved.assignments.love.path).toContain('/foni/horoscope-love-');
    expect(resolved.assignments.mood.path).toContain('/foni/horoscope-mood-');
    expect(resolved.assignments['astro:moon'].path).toBeNull();
    expect(resolved.assignments.home_family.path).toContain('/foni/horoscope-home-family-');
    expect(resolved.assignments.friends.path).toContain('/foni/horoscope-friends-');
  });

  it('is deterministic and can avoid the same section asset from the previous period', () => {
    const first = screen('day', '2026-07-27');
    expect(screen('day', '2026-07-27')).toEqual(first);

    const nextFeed = feed('day', '2026-07-28');
    const next = resolveForecastVisualScreen(
      buildForecastVisualRequests({ userId, forecast: nextFeed }),
      {
        previousSectionAssetPaths: {
          overview: first.assignments.overview.path,
          love: first.assignments.love.path,
        },
      },
    );
    expect(next.assignments.overview.path).not.toBe(first.assignments.overview.path);
    expect(next.assignments.love.path).not.toBe(first.assignments.love.path);
  });

  it('keeps period-specific overview art and deterministic responsive treatments', () => {
    const periodScreens = [
      screen('day', '2026-07-27'),
      screen('week', '2026-W31'),
      screen('month', '2026-07'),
      screen('year', '2026'),
    ];
    const heroPaths = periodScreens.map((value) => value.assignments.overview.path);
    expect(heroPaths.every(Boolean)).toBe(true);
    expect(new Set(heroPaths).size).toBe(4);

    const assignment = periodScreens[0].assignments.love;
    expect(assignment.crop.desktop.position).toMatch(/^\d+% \d+%$/);
    expect(assignment.crop.mobile.position).toMatch(/^\d+% \d+%$/);
    expect(assignment.crop.desktop.scale).toBeGreaterThanOrEqual(1);
    expect(assignment.crop.mobile.scale).toBeGreaterThan(
      assignment.crop.desktop.scale,
    );
    expect(typeof assignment.mirrorX).toBe('boolean');
    expect(assignment.overlay).toContain('linear-gradient');
    expect(assignment.overlayPreset).toBe('milky');
  });

  it('exports direct assignment lookup and section CSS variables with a safe fallback', () => {
    const resolved = screen('week', '2026-W31');
    const assignment = getForecastVisualAssignment(resolved, 'love');
    expect(assignment).toBe(resolved.assignments.love);
    expect(getForecastVisualAssignment(resolved, 'missing')).toBeNull();

    const style = forecastVisualStyle(assignment, 'week');
    expect(style['--forecast-section-image']).toContain('/foni/horoscope-love-');
    expect(style['--forecast-section-position']).toBe(
      assignment?.crop.desktop.position,
    );
    expect(style['--forecast-section-position-mobile']).toBe(
      assignment?.crop.mobile.position,
    );
    expect(style['--forecast-section-overlay']).toBe(assignment?.overlay);

    expect(forecastVisualStyle(null, 'week')).toMatchObject({
      '--forecast-section-fallback-accent': '#7ea9e8',
      '--forecast-section-fallback-soft': '#edf4ff',
    });
  });
});
