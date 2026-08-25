import {
  PERSONAL_FORECAST_VOICE_VERSION,
} from '../lib/appVoice';
import {
  PERSONAL_FORECAST_CACHE_VERSION,
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  buildPersonalForecastBirthProfileFingerprint,
  buildPersonalForecastCacheKey,
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
import { personalForecastFixture } from './personal-forecast-fixture';

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
  const sections = base.sections;
  return {
    ...base,
    period,
    periodKey: key,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(window, 'en'),
    sections,
    visual: {
      ...base.visual,
      sectionAssetIds: Object.fromEntries(
        [base.overview, ...sections].map((section) => [section.id, null]),
      ),
    },
    meta: {
      ...base.meta,
      freeSelection: period === 'day'
        ? base.meta.freeSelection
        : { strongestSectionId: null, rotatedSectionId: null, sectionIds: [] },
    },
  };
}

function replaceSectionText(section: ForecastSection, text: string): void {
  section.text = text;
  section.contentBlocks = [{
    ...section.contentBlocks[0],
    text,
  }];
  section.explanationAnchors[0].conclusion = text;
  section.lockedPreview = buildForecastLockedPreview(text, section.premiumTeaser);
}

describe('personal forecast direct-reading contract', () => {
  test('enforces one forecast paragraph and one separate closing for every period', () => {
    const base = personalForecastFixture();
    expect(isPersonalForecastPackage(base)).toBe(true);
    expect(base.sections).toHaveLength(1);
    expect(base.sections.every((section) => section.kind === 'dynamic')).toBe(true);
    expect(base.sections.some((section) => section.fixedKey)).toBe(false);

    expect(getPersonalForecastPackageValidationError({
      ...base,
      sections: [],
      visual: { sectionAssetIds: { overview: null } },
      meta: {
        ...base.meta,
        freeSelection: { strongestSectionId: null, rotatedSectionId: null, sectionIds: [] },
      },
    })).toBe('PACKAGE_PERIOD_STRUCTURE_INVALID');

    const extraToday = {
      ...base,
      sections: [...base.sections, structuredClone(base.sections[0])],
      visual: {
        sectionAssetIds: {
          ...base.visual.sectionAssetIds,
          [base.sections[0].id]: null,
        },
      },
    };
    expect(getPersonalForecastPackageValidationError(extraToday)).toBe(
      'PACKAGE_PERIOD_STRUCTURE_INVALID',
    );

    for (const period of ['week', 'month'] as const) {
      const cohesive = forecastForPeriod(period);
      expect(isPersonalForecastPackage(cohesive)).toBe(true);
      expect(getPersonalForecastPackageValidationError({
        ...cohesive,
        sections: [],
        visual: { sectionAssetIds: { overview: null } },
      })).toBe('PACKAGE_PERIOD_STRUCTURE_INVALID');
    }
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

  test('accepts prose presentation metadata and remains compatible without it', () => {
    const styled = structuredClone(personalForecastFixture());
    replaceSectionText(
      styled.overview,
      'A careful conversation rewards plain wording, good timing, and one precise decision today.',
    );
    replaceSectionText(styled.sections[0], 'A short answer can still be kind.');
    styled.overview.presentationStyle = 'prose';
    styled.sections[0].presentationStyle = 'prose';
    expect(isPersonalForecastPackage(styled)).toBe(true);

    const legacyShape = structuredClone(styled);
    delete legacyShape.overview.presentationStyle;
    for (const section of legacyShape.sections) delete section.presentationStyle;
    expect(isPersonalForecastPackage(legacyShape)).toBe(true);

    const invalid = structuredClone(styled);
    invalid.sections[0].presentationStyle = 'banner' as 'prose';
    expect(getPersonalForecastPackageValidationError(invalid)).toBe(
      `PACKAGE_SECTION_INVALID:${invalid.sections[0].id}`,
    );

    const specialOverview = structuredClone(styled);
    specialOverview.overview.presentationStyle = 'pull_quote';
    expect(getPersonalForecastPackageValidationError(specialOverview)).toBe(
      'PACKAGE_PRESENTATION_INVALID',
    );
  });

  test('accepts a free block label without exposing implementation evidence', () => {
    const base = structuredClone(personalForecastFixture());
    base.sections[0].contentBlocks[0].role = 'work_money' as any;
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
    expect(PERSONAL_FORECAST_CALCULATION_VERSION).toMatch(/^personal-forecast-luna-raw-profile-brief-v\d+$/);
    expect(PERSONAL_FORECAST_CACHE_VERSION).toMatch(/^personal-forecast-cache-v\d+-approved-three-part$/);
    expect(PERSONAL_FORECAST_CONTRACT_VERSION).toMatch(/^personal-forecast-feed-v\d+-approved-three-part$/);
    expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain('approved-three-part');
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

  test('versions both cache identities with the Luna raw birth-profile contract', () => {
    const birthProfile = {
      name: 'Mira',
      birthDate: '1990-01-01',
      birthTime: '12:00',
      birthPlace: 'Moscow',
    };
    const birthProfileFingerprint = buildPersonalForecastBirthProfileFingerprint(birthProfile);
    const shared = {
      userId: 'u1',
      birthProfileFingerprint,
      generationTier: 'premium' as const,
      period: 'day' as const,
      periodKey: '2026-07-26',
      timezone: 'Europe/Moscow',
      language: 'en' as const,
      modelId: 'gpt-5.4-mini',
    };
    const cacheKey = buildPersonalForecastCacheKey(shared);
    const inputHash = buildPersonalForecastInputHash(shared);
    expect(cacheKey.startsWith(`${PERSONAL_FORECAST_CONTRACT_VERSION}:`)).toBe(true);
    expect(inputHash).toMatch(/^[a-z0-9]+$/);
    expect(buildPersonalForecastCacheKey({ ...shared, modelId: 'gpt-5.4' })).not.toBe(cacheKey);
    expect(buildPersonalForecastInputHash({ ...shared, language: 'ru' })).not.toBe(inputHash);
    expect(buildPersonalForecastCacheKey({ ...shared, generationTier: 'free' })).not.toBe(cacheKey);
    expect(buildPersonalForecastInputHash({ ...shared, generationTier: 'free' })).not.toBe(inputHash);

    for (const patch of [
      { name: 'Mira Two' },
      { birthDate: '1991-01-01' },
      { birthTime: '13:00' },
      { birthPlace: 'Kazan' },
    ]) {
      const changedFingerprint = buildPersonalForecastBirthProfileFingerprint({
        ...birthProfile,
        ...patch,
      });
      expect(changedFingerprint).not.toBe(birthProfileFingerprint);
      expect(buildPersonalForecastCacheKey({
        ...shared,
        birthProfileFingerprint: changedFingerprint,
      })).not.toBe(cacheKey);
      expect(buildPersonalForecastInputHash({
        ...shared,
        birthProfileFingerprint: changedFingerprint,
      })).not.toBe(inputHash);
    }

    expect(buildPersonalForecastBirthProfileFingerprint({
      ...birthProfile,
      name: '  Mira  ',
      birthPlace: '  Moscow ',
    })).toBe(birthProfileFingerprint);
  });


  test('accepts the one closing section in Today Free selection', () => {
    const base = personalForecastFixture();
    expect(isPersonalForecastPackage(base)).toBe(true);

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
    expect(sliced.lockedSectionIds).toEqual([]);
    expect(sliced.forecast.overview.text).not.toBe('');
    expect(sliced.forecast.sections[0].text).not.toBe('');
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
