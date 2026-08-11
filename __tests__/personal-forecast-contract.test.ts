import {
  APP_VOICE_VERSION,
  PERSONAL_FORECAST_VOICE_VERSION,
} from '../lib/appVoice';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildPersonalForecastCacheKey,
  buildPersonalForecastChartFingerprint,
  buildPersonalForecastInputHash,
  formatPersonalForecastDateLabel,
  getPersonalForecastPackageValidationError,
  getNextPersonalForecastPeriodKey,
  getPersonalForecastPeriodKey,
  isPersonalForecastPackage,
  resolvePersonalForecastWindow,
  slicePersonalForecastForAccess,
  type ForecastSection,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import { chartFixture, personalForecastFixture } from './personal-forecast-fixture';

function forecastForPeriod(period: PersonalForecastPeriod): PersonalForecastPackage {
  const base = personalForecastFixture();
  const key = period === 'day'
    ? '2026-07-26'
    : period === 'week'
      ? '2026-W30'
      : period === 'month'
        ? '2026-07'
        : '2026';
  const window = resolvePersonalForecastWindow(period, key, base.timezone);
  return {
    ...base,
    period,
    periodKey: key,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(window, 'en'),
    meta: {
      ...base.meta,
      freeSelection: period === 'day'
        ? base.meta.freeSelection
        : { strongestSectionId: null, rotatedSectionId: null, sectionIds: [] },
    },
  };
}

function cloneSemanticSection(source: ForecastSection, suffix: string): ForecastSection {
  const id = `semantic:${suffix}`;
  const anchorId = `anchor:${id}`;
  return {
    ...source,
    id,
    title: `Subject ${suffix}`,
    semanticFingerprint: `semantic:${suffix}`,
    semanticFactIds: [`fact:${suffix}`],
    contentBlocks: source.contentBlocks.map((block, index) => ({
      ...block,
      id: `${id}:${block.role}:${index + 1}`,
      semanticFactId: `fact:${suffix}`,
      explanationAnchorId: index === 0 ? anchorId : null,
    })),
    explanationAnchors: source.explanationAnchors.map((anchor) => ({
      ...anchor,
      id: anchorId,
    })),
  };
}

describe('personal forecast direct-reading contract', () => {
  test('accepts a reading with no optional advice section and has no section-count ceiling', () => {
    const base = personalForecastFixture();
    expect(isPersonalForecastPackage(base)).toBe(true);
    expect(base.sections.every((section) => section.kind === 'dynamic')).toBe(true);
    expect(base.sections.some((section) => section.fixedKey)).toBe(false);

    expect(isPersonalForecastPackage({
      ...base,
      sections: [],
      visual: { sectionAssetIds: { overview: null } },
      meta: {
        ...base.meta,
        freeSelection: { strongestSectionId: null, rotatedSectionId: null, sectionIds: [] },
      },
    })).toBe(true);
    const tooMany = [
      ...base.sections,
      cloneSemanticSection(base.sections[0], 'extra-a'),
      cloneSemanticSection(base.sections[0], 'extra-b'),
      cloneSemanticSection(base.sections[0], 'extra-c'),
    ];
    const expanded = {
      ...base,
      sections: tooMany,
      evidence: {
        ...base.evidence,
        ...Object.fromEntries(['extra-a', 'extra-b', 'extra-c'].map((suffix) => [
          `fact:${suffix}`,
          { ...base.evidence.e1, id: `fact:${suffix}` },
        ])),
      },
      visual: {
        sectionAssetIds: {
          ...base.visual.sectionAssetIds,
          ...Object.fromEntries(tooMany.slice(base.sections.length).map((section) => [section.id, null])),
        },
      },
    };
    expect(isPersonalForecastPackage(expanded)).toBe(true);

    const duplicate = structuredClone(base);
    duplicate.sections[1].semanticFingerprint = duplicate.sections[0].semanticFingerprint;
    expect(isPersonalForecastPackage(duplicate)).toBe(false);
  });

  test('requires block identities and evidence-backed explanation anchors', () => {
    const base = personalForecastFixture();
    const missingEvidence = structuredClone(base);
    missingEvidence.sections[0].explanationAnchors[0].evidenceIds = ['missing'];
    expect(isPersonalForecastPackage(missingEvidence)).toBe(false);

    const changedText = structuredClone(base);
    changedText.sections[0].contentBlocks[0].text = 'Different text that is not reflected in the section projection.';
    expect(isPersonalForecastPackage(changedText)).toBe(false);

    const changedFact = structuredClone(base);
    changedFact.sections[0].contentBlocks[0].semanticFactId = 'fact:not-approved';
    expect(isPersonalForecastPackage(changedFact)).toBe(false);
  });

  test('accepts a free block label with UI astro evidence', () => {
    const base = structuredClone(personalForecastFixture());
    base.sections[0].contentBlocks[0].role = 'work_money' as any;
    base.sections[0].contentBlocks[0].astro_evidence = 'Mars square natal Mercury';
    expect(isPersonalForecastPackage(base)).toBe(true);
  });

  test('reports the rule that rejected a complete package', () => {
    const base = personalForecastFixture();
    const missingEvidence = structuredClone(base);
    missingEvidence.sections[0].explanationAnchors[0].evidenceIds = ['missing'];

    expect(getPersonalForecastPackageValidationError(base)).toBeNull();
    expect(getPersonalForecastPackageValidationError(missingEvidence)).toBe(
      'PACKAGE_SECTION_INVALID:semantic:communication',
    );
    expect(getPersonalForecastPackageValidationError({
      ...base,
      visual: { sectionAssetIds: { missing: null } },
    })).toBe('PACKAGE_VISUAL_INVALID');
  });

  test('does not reject grounded content through a style blacklist', () => {
    const clicheEvidence = structuredClone(personalForecastFixture());
    clicheEvidence.evidence.e1.meaning = 'Это может проявляться сильнее, поэтому не спеши.';
    expect(getPersonalForecastPackageValidationError(clicheEvidence)).toBeNull();

    const clicheExplanation = structuredClone(personalForecastFixture());
    clicheExplanation.sections[0].explanationAnchors[0].explanation =
      'Не спеши: активная тема может проявляться сильнее.';
    expect(getPersonalForecastPackageValidationError(clicheExplanation)).toBeNull();
  });

  test('rejects stale calculation, semantic, contract, prompt, and voice versions', () => {
    const base = personalForecastFixture();
    expect(PERSONAL_FORECAST_CALCULATION_VERSION).toBe('personal-forecast-luna-natal-profile-v1');
    expect(PERSONAL_FORECAST_CONTRACT_VERSION).toBe('personal-forecast-feed-v13');
    expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain('personal-forecast-feed.v26.luna-continuous-feed');
    expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain(`voice.${APP_VOICE_VERSION}`);
    expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain(
      `forecast-voice.${PERSONAL_FORECAST_VOICE_VERSION}`,
    );

    for (const patch of [
      { calculationVersion: 'legacy' },
      { semanticVersion: 'legacy' },
      { contractVersion: 'legacy' },
      { promptVersion: 'legacy' },
      { voiceVersion: 'legacy' },
    ]) {
      expect(isPersonalForecastPackage({
        ...base,
        meta: { ...base.meta, ...patch },
      })).toBe(false);
    }
  });

  test('uses timezone-aware period keys and exact windows', () => {
    const instant = new Date('2026-01-01T22:30:00.000Z');
    expect(getPersonalForecastPeriodKey('day', instant, 'Europe/Moscow')).toBe('2026-01-02');
    expect(getPersonalForecastPeriodKey('month', instant, 'America/New_York')).toBe('2026-01');

    const week = resolvePersonalForecastWindow('week', '2026-W30', 'Europe/Moscow');
    expect(week.periodStart).toBe('2026-07-20');
    expect(week.periodEnd).toBe('2026-07-26');
    expect(getNextPersonalForecastPeriodKey('week', '2026-W30', 'Europe/Moscow')).toBe('2026-W31');
  });

  test('versions both cache identities with the Luna natal-profile contract', () => {
    const shared = {
      userId: 'u1',
      chartId: 7,
      chartData: chartFixture,
      period: 'day' as const,
      periodKey: '2026-07-26',
      timezone: 'Europe/Moscow',
      language: 'en' as const,
      modelId: 'gpt-5.4-mini',
    };
    const cacheKey = buildPersonalForecastCacheKey(shared);
    const inputHash = buildPersonalForecastInputHash(shared);
    expect(cacheKey).toMatch(/^personal-forecast-feed-v13:/);
    expect(inputHash).toMatch(/^[a-z0-9]+$/);
    expect(buildPersonalForecastCacheKey({ ...shared, modelId: 'gpt-5.4' })).not.toBe(cacheKey);
    expect(buildPersonalForecastInputHash({ ...shared, language: 'ru' })).not.toBe(inputHash);
  });

  test('includes birth-time reliability in the chart fingerprint', () => {
    const exact = buildPersonalForecastChartFingerprint(chartFixture);
    const unknown = buildPersonalForecastChartFingerprint({
      ...chartFixture,
      birthTimeQuality: 'unknown',
      chartQuality: {
        ...chartFixture.chartQuality,
        birthTimeQuality: 'unknown',
        housesReliable: false,
        ascendantReliable: false,
        houseBasedPersonalization: false,
        notes: [],
      },
    });
    expect(unknown).not.toBe(exact);
  });

  test('fingerprints every saved natal field used by the Luna context', () => {
    const baseChart = {
      ...chartFixture,
      sun: { ...chartFixture.sun, retrograde: false },
      chiron: { ...chartFixture.sun, planet: 'Chiron', sign: 'Virgo', retrograde: false },
      mc: { ...chartFixture.rising, sign: 'Cancer', stableSign: true },
      aspects: [{ type: 'trine', angle: 120, orb: 1.2, from: 'Sun', to: 'Moon' }],
    };
    const base = buildPersonalForecastChartFingerprint(baseChart as never);

    expect(buildPersonalForecastChartFingerprint({
      ...baseChart,
      chiron: { ...baseChart.chiron, sign: 'Libra' },
    } as never)).not.toBe(base);
    expect(buildPersonalForecastChartFingerprint({
      ...baseChart,
      sun: { ...baseChart.sun, retrograde: true },
    } as never)).not.toBe(base);
    expect(buildPersonalForecastChartFingerprint({
      ...baseChart,
      mc: { ...baseChart.mc, sign: 'Leo' },
    } as never)).not.toBe(base);
    expect(buildPersonalForecastChartFingerprint({
      ...baseChart,
      aspects: [{ ...baseChart.aspects[0], orb: 2.4 }],
    } as never)).not.toBe(base);
  });

  test('accepts one or two valid Free sections for Today', () => {
    const base = personalForecastFixture();
    expect(isPersonalForecastPackage(base)).toBe(true);

    const one = {
      ...base,
      meta: {
        ...base.meta,
        freeSelection: {
          strongestSectionId: 'semantic:communication',
          rotatedSectionId: null,
          sectionIds: ['semantic:communication'],
        },
      },
    };
    expect(isPersonalForecastPackage(one)).toBe(true);

    expect(isPersonalForecastPackage({
      ...base,
      meta: {
        ...base.meta,
        freeSelection: {
          strongestSectionId: 'semantic:communication',
          rotatedSectionId: 'semantic:communication',
          sectionIds: ['semantic:communication', 'semantic:communication'],
        },
      },
    })).toBe(false);
  });

  test('requires an empty Free selection outside Today', () => {
    const month = forecastForPeriod('month');
    expect(isPersonalForecastPackage(month)).toBe(true);
    expect(isPersonalForecastPackage({
      ...month,
      meta: { ...month.meta, freeSelection: personalForecastFixture().meta.freeSelection },
    })).toBe(false);
  });

  test('opens Today overview and selected sections while redacting every other section', () => {
    const base = personalForecastFixture();
    const sliced = slicePersonalForecastForAccess(base, false);
    expect(sliced.periodLocked).toBe(false);
    expect(sliced.lockedSectionIds).toEqual(['semantic:workload']);
    expect(sliced.forecast.overview.text).not.toBe('');
    expect(sliced.forecast.sections[0].text).not.toBe('');
    expect(sliced.forecast.sections[2].text).toBe('');
    expect(sliced.forecast.sections[2].contentBlocks).toEqual([]);
    expect(isPersonalForecastPackage(sliced.forecast, {
      redactedSectionIds: sliced.lockedSectionIds,
    })).toBe(true);
  });

  test('locks every non-day section for Free and keeps Premium complete', () => {
    const month = forecastForPeriod('month');
    const free = slicePersonalForecastForAccess(month, false);
    expect(free.periodLocked).toBe(true);
    expect(free.lockedSectionIds).toHaveLength(month.sections.length + 1);
    expect(free.forecast.overview.text).toBe('');
    expect(free.forecast.evidence).toEqual({});

    const premium = slicePersonalForecastForAccess(month, true);
    expect(premium.periodLocked).toBe(false);
    expect(premium.lockedSectionIds).toEqual([]);
    expect(premium.forecast).toEqual(month);
  });
});
