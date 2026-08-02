import { APP_VOICE_VERSION } from '../lib/appVoice';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildPersonalForecastCacheKey,
  buildPersonalForecastChartFingerprint,
  buildPersonalForecastInputHash,
  formatPersonalForecastDateLabel,
  getNextPersonalForecastPeriodKey,
  getPersonalForecastPeriodKey,
  isPersonalForecastPackage,
  resolvePersonalForecastWindow,
  slicePersonalForecastForAccess,
  type ForecastSection,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import { PERSONAL_FORECAST_SEMANTICS_VERSION } from '../lib/personalForecastSemantics';
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

describe('personal forecast V4 semantic contract', () => {
  test('accepts only supported semantic sections without mandatory rubrics', () => {
    const base = personalForecastFixture();
    expect(isPersonalForecastPackage(base)).toBe(true);
    expect(base.sections.every((section) => section.kind === 'dynamic')).toBe(true);
    expect(base.sections.some((section) => section.fixedKey)).toBe(false);

    expect(isPersonalForecastPackage({ ...base, sections: [] })).toBe(false);
    const tooMany = [
      ...base.sections,
      cloneSemanticSection(base.sections[0], 'extra-a'),
      cloneSemanticSection(base.sections[0], 'extra-b'),
      cloneSemanticSection(base.sections[0], 'extra-c'),
    ];
    expect(isPersonalForecastPackage({ ...base, sections: tooMany })).toBe(false);

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

  test('rejects stale calculation, semantic, contract, prompt, and voice versions', () => {
    const base = personalForecastFixture();
    expect(PERSONAL_FORECAST_CALCULATION_VERSION).toBe('personal-forecast-evidence-v4');
    expect(PERSONAL_FORECAST_CONTRACT_VERSION).toBe('personal-forecast-feed-v4');
    expect(PERSONAL_FORECAST_SEMANTICS_VERSION).toBe('personal-forecast-semantics-v1');
    expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain('personal-forecast-feed.v5.semantic-writer');
    expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain(`voice.${APP_VOICE_VERSION}`);

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
    expect(getPersonalForecastPeriodKey('year', instant, 'America/New_York')).toBe('2026');

    const week = resolvePersonalForecastWindow('week', '2026-W30', 'Europe/Moscow');
    expect(week.periodStart).toBe('2026-07-20');
    expect(week.periodEnd).toBe('2026-07-26');
    expect(getNextPersonalForecastPeriodKey('week', '2026-W30', 'Europe/Moscow')).toBe('2026-W31');
  });

  test('versions both cache identities with the V4 semantic contract', () => {
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
    expect(cacheKey).toMatch(/^personal-forecast-feed-v4:/);
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
