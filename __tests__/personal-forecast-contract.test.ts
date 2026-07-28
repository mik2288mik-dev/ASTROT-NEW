import { APP_VOICE_VERSION } from '../lib/appVoice';
import {
  FIXED_FORECAST_SECTION_KEYS,
  FORECAST_WISHES_TITLES,
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  buildPersonalForecastCacheKey,
  buildPersonalForecastChartFingerprint,
  buildPersonalForecastInputHash,
  filterPersonalForecastCrossPeriodLinksForCurrentTargets,
  getNextPersonalForecastPeriodKey,
  getPersonalForecastPeriodKey,
  getPreviousPersonalForecastPeriodKey,
  isPersonalForecastPackage,
  resolvePersonalForecastWindow,
  slicePersonalForecastForAccess,
  type ForecastSection,
  type PersonalForecastPackage,
} from '../lib/personalForecastContract';
import {
  chartFixture,
  personalForecastFixture,
} from './personal-forecast-fixture';

function dynamicSection(
  source: ForecastSection,
  id: string,
  title: string,
  text: string,
): ForecastSection {
  let expandedText = text;
  const continuation =
    ' It connects the conclusion with an ordinary practical choice and a clear, conditional reason from the supplied period calculation.';
  while (expandedText.length < 250) expandedText += continuation;
  expandedText = expandedText.slice(0, 320);
  return {
    ...source,
    id,
    sourceTopicKey: id.replace(/^dynamic:/, '') as ForecastSection['sourceTopicKey'],
    title,
    text: expandedText,
    visualTag: id,
    premiumTeaser: `The complete ${title} section explains the calculated direction in detail.`,
    lockedPreview: buildForecastLockedPreview(
      expandedText,
      `The complete ${title} section explains the calculated direction in detail.`,
    ),
    explanationAnchors: source.explanationAnchors.map((anchor) => ({
      ...anchor,
      id: `anchor:${id}`,
    })),
  };
}

function forecastForPeriod(
  period: PersonalForecastPackage['period'],
): PersonalForecastPackage {
  const base = personalForecastFixture();
  if (period === 'day') return base;
  const periodKey = period === 'week' ? '2026-W30' : period === 'month' ? '2026-07' : '2026';
  const window = resolvePersonalForecastWindow(period, periodKey, base.timezone);
  return {
    ...base,
    period,
    periodKey,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    dateLabel: period.toUpperCase(),
    sections: base.sections.map((section) => (
      section.fixedKey === 'wishes'
        ? { ...section, title: FORECAST_WISHES_TITLES.en[period] }
        : section
    )),
    meta: {
      ...base.meta,
      freeSelection: {
        strongestSectionId: null,
        rotatedSectionId: null,
        sectionIds: [],
      },
    },
  };
}

describe('personal forecast V3 contract', () => {
  it('keeps the exact fixed order and accepts only two to four dynamic sections', () => {
    expect(FIXED_FORECAST_SECTION_KEYS).toEqual([
      'mood',
      'love',
      'home_family',
      'friends',
      'work_money',
      'wishes',
    ]);

    const base = personalForecastFixture();
    expect(isPersonalForecastPackage(base)).toBe(true);
    expect(
      base.sections
        .filter((section) => section.kind === 'fixed' || section.kind === 'wishes')
        .map((section) => section.fixedKey),
    ).toEqual(FIXED_FORECAST_SECTION_KEYS);

    const dynamics = base.sections.filter((section) => section.kind === 'dynamic');
    const withoutOneDynamic = {
      ...base,
      sections: base.sections.filter((section) => section.id !== dynamics[1].id),
    };
    expect(isPersonalForecastPackage(withoutOneDynamic)).toBe(false);

    const third = dynamicSection(
      dynamics[0],
      'dynamic:creativity',
      'Creative Project',
      'Creative work benefits from a defined scope and a measurable finish.',
    );
    const fourth = dynamicSection(
      dynamics[0],
      'dynamic:relocation',
      'Relocation',
      'A relocation decision needs verified costs and a concrete schedule.',
    );
    const withFourDynamics = {
      ...base,
      sections: [...base.sections, third, fourth],
    };
    expect(isPersonalForecastPackage(withFourDynamics)).toBe(true);

    const fifth = dynamicSection(
      dynamics[0],
      'dynamic:documents_agreements',
      'Documents',
      'Document terms require exact wording before any final agreement.',
    );
    expect(isPersonalForecastPackage({
      ...base,
      sections: [...withFourDynamics.sections, fifth],
    })).toBe(false);

    const wrongFixedOrder = {
      ...base,
      sections: [
        base.sections[1],
        base.sections[0],
        ...base.sections.slice(2),
      ],
    };
    expect(isPersonalForecastPackage(wrongFixedOrder)).toBe(false);
  });

  it('rejects explanation anchors that reference evidence outside the package', () => {
    const missing = personalForecastFixture();
    const love = missing.sections.find((section) => section.id === 'love');
    expect(love).toBeDefined();
    love!.explanationAnchors[0].evidenceIds = ['missing'];
    expect(isPersonalForecastPackage(missing)).toBe(false);
  });

  it('rejects malformed wire metadata, evidence, visuals, links, and previews', () => {
    const base = personalForecastFixture();
    expect(isPersonalForecastPackage({
      ...base,
      periodStart: '2026-07-25',
    })).toBe(false);
    expect(isPersonalForecastPackage({
      ...base,
      evidence: {
        ...base.evidence,
        e1: { ...base.evidence.e1, id: 'other' },
      },
    })).toBe(false);
    expect(isPersonalForecastPackage({
      ...base,
      visual: { sectionAssetIds: { missing: '/asset.svg' } },
    })).toBe(false);
    expect(isPersonalForecastPackage({
      ...base,
      suggestedCrossPeriodLinks: [{
        id: 'bad-link',
        fromSectionId: 'dynamic:business',
        targetPeriod: 'month',
        targetSectionId: 'dynamic:business',
        continuationAt: 'not-a-date',
        label: 'Invalid',
      }],
    })).toBe(false);

    const love = base.sections.find((section) => section.id === 'love')!;
    expect(isPersonalForecastPackage({
      ...base,
      sections: base.sections.map((section) => (
        section.id === 'love'
          ? {
              ...love,
              lockedPreview: {
                ...love.lockedPreview,
                blurred: `${love.lockedPreview.blurred} injected premium text`,
              },
            }
          : section
      )),
    })).toBe(false);
  });

  it('rejects a package produced by a stale forecast calculation algorithm', () => {
    const current = personalForecastFixture();
    expect(PERSONAL_FORECAST_CALCULATION_VERSION)
      .toBe('personal-forecast-evidence-v3');
    expect(current.meta.calculationVersion).toBe(PERSONAL_FORECAST_CALCULATION_VERSION);
    expect(isPersonalForecastPackage({
      ...current,
      meta: {
        ...current.meta,
        calculationVersion: 'personal-forecast-evidence-stale',
      },
    })).toBe(false);
  });

  it('uses timezone-aware day, ISO week, month and year keys', () => {
    const instant = new Date('2026-12-31T22:30:00.000Z');
    expect(getPersonalForecastPeriodKey('day', instant, 'Europe/Moscow')).toBe('2027-01-01');
    expect(getPersonalForecastPeriodKey('month', instant, 'Europe/Moscow')).toBe('2027-01');
    expect(getPersonalForecastPeriodKey('year', instant, 'Europe/Moscow')).toBe('2027');
    expect(getPersonalForecastPeriodKey('week', instant, 'Europe/Moscow')).toMatch(/^2026-W53$|^2027-W01$/);
  });

  it('resolves full period boundaries and adjacent period keys', () => {
    const month = resolvePersonalForecastWindow('month', '2026-02', 'Europe/Moscow');
    expect(month.periodStart).toBe('2026-02-01');
    expect(month.periodEnd).toBe('2026-02-28');
    expect(getNextPersonalForecastPeriodKey('month', '2026-02', 'Europe/Moscow')).toBe('2026-03');
    expect(getPreviousPersonalForecastPeriodKey('month', '2026-02', 'Europe/Moscow')).toBe('2026-01');
  });

  it('versions cache and input identities by chart, period, language, model and voice', () => {
    const base = {
      userId: '42',
      chartId: 7,
      chartData: chartFixture,
      period: 'day' as const,
      periodKey: '2026-07-26',
      timezone: 'Europe/Moscow',
      language: 'ru' as const,
      modelId: 'gpt-4.1',
    };
    const variants = [
      base,
      { ...base, periodKey: '2026-07-27' },
      { ...base, language: 'en' as const },
      { ...base, modelId: 'gpt-4.1-mini' },
      {
        ...base,
        chartData: {
          ...chartFixture,
          calculationVersion: 'changed',
        },
      },
    ];
    const cacheKeys = variants.map(buildPersonalForecastCacheKey);
    const inputHashes = variants.map(buildPersonalForecastInputHash);

    expect(new Set(cacheKeys).size).toBe(variants.length);
    expect(new Set(inputHashes).size).toBe(variants.length);
    expect(cacheKeys[0]).toMatch(/^personal-forecast-feed-v3:/);
    expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain(`voice.${APP_VOICE_VERSION}`);
    expect(buildPersonalForecastChartFingerprint(chartFixture)).toBe(
      buildPersonalForecastChartFingerprint(chartFixture),
    );
  });

  it('includes birth-time and chart-quality metadata in the chart fingerprint', () => {
    const exactChart = {
      ...chartFixture,
      birthTimeQuality: 'exact' as const,
      chartQuality: {
        birthTimeQuality: 'exact' as const,
        ascendantReliable: true,
        housesReliable: true,
        houseBasedPersonalization: true,
        notes: ['Exact recorded time'],
      },
    };
    const variants = [
      exactChart,
      { ...exactChart, birthTimeQuality: 'approximate' as const },
      {
        ...exactChart,
        chartQuality: {
          ...exactChart.chartQuality,
          birthTimeQuality: 'approximate' as const,
        },
      },
      {
        ...exactChart,
        chartQuality: {
          ...exactChart.chartQuality,
          ascendantReliable: false,
        },
      },
      {
        ...exactChart,
        chartQuality: {
          ...exactChart.chartQuality,
          housesReliable: false,
        },
      },
      {
        ...exactChart,
        chartQuality: {
          ...exactChart.chartQuality,
          houseBasedPersonalization: false,
        },
      },
      {
        ...exactChart,
        chartQuality: {
          ...exactChart.chartQuality,
          notes: ['Approximate recorded time'],
        },
      },
    ];

    expect(new Set(variants.map(buildPersonalForecastChartFingerprint)).size).toBe(variants.length);
  });

  it('requires an exact valid pair of Free selections for Today', () => {
    const base = personalForecastFixture();
    const withSelection = (freeSelection: unknown) => ({
      ...base,
      meta: {
        ...base.meta,
        freeSelection,
      },
    });

    expect(isPersonalForecastPackage(base)).toBe(true);
    expect(isPersonalForecastPackage(withSelection({
      strongestSectionId: 'love',
      rotatedSectionId: 'love',
      sectionIds: ['love', 'love'],
    }))).toBe(false);
    expect(isPersonalForecastPackage(withSelection({
      strongestSectionId: 'love',
      rotatedSectionId: 'mood',
      sectionIds: ['love'],
    }))).toBe(false);
    expect(isPersonalForecastPackage(withSelection({
      strongestSectionId: 'love',
      rotatedSectionId: 'mood',
      sectionIds: ['mood', 'love'],
    }))).toBe(false);
    expect(isPersonalForecastPackage(withSelection({
      strongestSectionId: 'wishes',
      rotatedSectionId: 'mood',
      sectionIds: ['wishes', 'mood'],
    }))).toBe(false);
    expect(isPersonalForecastPackage(withSelection({
      strongestSectionId: 'overview',
      rotatedSectionId: 'mood',
      sectionIds: ['overview', 'mood'],
    }))).toBe(false);
    expect(isPersonalForecastPackage(withSelection({
      strongestSectionId: 'mood',
      rotatedSectionId: 'love',
      sectionIds: ['mood', 'love'],
    }))).toBe(false);
    expect(isPersonalForecastPackage(withSelection({
      strongestSectionId: null,
      rotatedSectionId: 'mood',
      sectionIds: ['love', 'mood'],
    }))).toBe(false);
    expect(isPersonalForecastPackage(withSelection({
      strongestSectionId: 'love',
      rotatedSectionId: 42,
      sectionIds: ['love', 42],
    }))).toBe(false);
  });

  it('requires an empty Free selection outside Today', () => {
    const month = forecastForPeriod('month');
    expect(isPersonalForecastPackage(month)).toBe(true);

    expect(isPersonalForecastPackage({
      ...month,
      meta: {
        ...month.meta,
        freeSelection: {
          strongestSectionId: 'love',
          rotatedSectionId: null,
          sectionIds: [],
        },
      },
    })).toBe(false);
    expect(isPersonalForecastPackage({
      ...month,
      meta: {
        ...month.meta,
        freeSelection: {
          strongestSectionId: null,
          rotatedSectionId: null,
          sectionIds: ['love'],
        },
      },
    })).toBe(false);
  });

  it('keeps a continuation link only when it opens the current target period', () => {
    const base = personalForecastFixture();
    const forecast: PersonalForecastPackage = {
      ...base,
      suggestedCrossPeriodLinks: [{
        id: 'day:love:week:0',
        fromSectionId: 'love',
        targetPeriod: 'week',
        targetSectionId: 'love',
        continuationAt: '2026-07-26T21:00:00.000Z',
        label: 'Continue this topic in Week',
      }],
    };

    expect(isPersonalForecastPackage(forecast)).toBe(true);
    expect(filterPersonalForecastCrossPeriodLinksForCurrentTargets(
      forecast,
      new Date('2026-07-26T12:00:00.000Z'),
    ).suggestedCrossPeriodLinks).toEqual([]);
    expect(filterPersonalForecastCrossPeriodLinksForCurrentTargets(
      forecast,
      new Date('2026-07-27T12:00:00.000Z'),
    ).suggestedCrossPeriodLinks).toHaveLength(1);
  });

  it('opens Today overview, wishes and the selected Free sections without losing previews', () => {
    const full = personalForecastFixture();
    const sliced = slicePersonalForecastForAccess(full, false);
    const openIds = new Set([
      'overview',
      'wishes',
      ...full.meta.freeSelection.sectionIds,
    ]);

    expect(sliced.periodLocked).toBe(false);
    expect(sliced.lockedSectionIds).toEqual(
      [full.overview, ...full.sections]
        .filter((section) => !openIds.has(section.id))
        .map((section) => section.id),
    );
    for (const section of [sliced.forecast.overview, ...sliced.forecast.sections]) {
      if (openIds.has(section.id)) {
        expect(section.text).toBeTruthy();
      } else {
        const original = [full.overview, ...full.sections]
          .find((candidate) => candidate.id === section.id)!;
        expect(section.text).toBe('');
        expect(section.explanationAnchors).toEqual([]);
        expect(section.lockedPreview).toEqual(original.lockedPreview);
        expect(section.lockedPreview.lead).toBeTruthy();
        expect(section.lockedPreview.blurred).toBeTruthy();
        expect(section.lockedPreview.teaser).toBeTruthy();
      }
    }
  });

  it('locks every non-day section for Free and keeps every section open for Premium', () => {
    const full = forecastForPeriod('month');
    const free = slicePersonalForecastForAccess(full, false);
    const premium = slicePersonalForecastForAccess(full, true);
    const allIds = [full.overview, ...full.sections].map((section) => section.id);

    expect(free.periodLocked).toBe(true);
    expect(free.lockedSectionIds).toEqual(allIds);
    for (const section of [free.forecast.overview, ...free.forecast.sections]) {
      const original = [full.overview, ...full.sections]
        .find((candidate) => candidate.id === section.id)!;
      expect(section.text).toBe('');
      expect(section.title).toBe(original.title);
      expect(section.premiumTeaser).toBe(original.premiumTeaser);
      expect(section.lockedPreview).toEqual(original.lockedPreview);
      expect(section.explanationAnchors).toEqual([]);
      expect(section.inlineAstroAccent).toBeNull();
    }
    expect(free.forecast.suggestedCrossPeriodLinks).toEqual([]);
    expect(free.forecast.evidence).toEqual({});

    expect(premium.periodLocked).toBe(false);
    expect(premium.lockedSectionIds).toEqual([]);
    expect(premium.forecast).toBe(full);
  });
});
