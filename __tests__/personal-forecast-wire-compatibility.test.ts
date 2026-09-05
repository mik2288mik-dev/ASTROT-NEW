import {
  PERSONAL_FORECAST_CONTRACT_VERSION,
  isPersonalForecastPackage,
  slicePersonalForecastForAccess,
  type PersonalForecastAccessPayload,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import {
  LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION,
  projectPersonalForecastForWire,
  resolvePersonalForecastWireVersion,
} from '../lib/personalForecastWireCompatibility';
import { personalForecastFixture } from './personal-forecast-fixture';

function payload(period: PersonalForecastPeriod, premium: boolean): PersonalForecastAccessPayload {
  return {
    ...slicePersonalForecastForAccess(personalForecastFixture(period), premium),
    accessTier: premium ? 'premium' : 'free',
    source: 'cache',
  };
}

describe('released APK personal forecast wire compatibility', () => {
  it('defaults only an absent version to v25 and rejects unknown or ambiguous negotiation', () => {
    expect(resolvePersonalForecastWireVersion(undefined)).toBe(LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION);
    for (const version of [LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION, PERSONAL_FORECAST_CONTRACT_VERSION]) {
      expect(resolvePersonalForecastWireVersion(version)).toBe(version);
    }
    for (const version of ['', null, 'v24', [PERSONAL_FORECAST_CONTRACT_VERSION]]) {
      expect(resolvePersonalForecastWireVersion(version)).toBeNull();
    }
  });

  it.each<PersonalForecastPeriod>(['day', 'week', 'month'])('preserves every Premium %s sentence once and the real generation identity', (period) => {
    const original = payload(period, true);
    original.forecast.meta.generationAttempts = 5;
    const before = JSON.stringify(original);
    const projected = projectPersonalForecastForWire(original, LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION);
    const forecast = projected.forecast;
    expect([forecast.overview, ...forecast.sections].map((section) => section.text).join(' '))
      .toBe([original.forecast.overview, ...original.forecast.sections].map((section) => section.text).join(' '));
    expect(forecast.sections).toHaveLength(period === 'day' ? 3 : 1);
    expect(forecast.meta).toMatchObject({
      contractVersion: LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION,
      promptVersion: 'personal-forecast-feed.v42-reference-four-part+forecast-voice.9',
      voiceVersion: '9',
      calculationVersion: 'personal-forecast-luna-raw-profile-brief-v7',
      generationAttempts: 2,
      currentGeneration: {
        contractVersion: original.forecast.meta.contractVersion,
        semanticVersion: original.forecast.meta.semanticVersion,
        promptVersion: original.forecast.meta.promptVersion,
        voiceVersion: original.forecast.meta.voiceVersion,
        calculationVersion: original.forecast.meta.calculationVersion,
        generationAttempts: 5,
      },
    });
    expect(projected.lockedSectionIds).toEqual([]);
    expect(JSON.stringify(original)).toBe(before);
    expect(projectPersonalForecastForWire(original, PERSONAL_FORECAST_CONTRACT_VERSION)).toBe(original);
    // Negotiation must not weaken the new client's validator.
    expect(isPersonalForecastPackage(original.forecast)).toBe(true);
    expect(isPersonalForecastPackage(forecast)).toBe(false);
  });

  it('keeps the whole Free Day and closing visible; legacy padding is empty, locked and contains no evidence', () => {
    const original = payload('day', false);
    const projected = projectPersonalForecastForWire(original, LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION);
    const sections = [projected.forecast.overview, ...projected.forecast.sections];
    const visible = sections.filter((section) => !projected.lockedSectionIds.includes(section.id));
    expect(visible.map((section) => section.text)).toEqual([
      original.forecast.overview.text, original.forecast.sections[0].text,
    ]);
    expect(projected.lockedSectionIds).toHaveLength(2);
    for (const section of sections.filter((item) => projected.lockedSectionIds.includes(item.id))) {
      expect(section).toMatchObject({
        text: '', contentBlocks: [], semanticFactIds: [], semanticFingerprint: '', explanationAnchors: [],
        lockedPreview: { lead: 'NEBO', blurred: '', teaser: 'NEBO' },
      });
    }
    expect(projected.forecast.meta.freeSelection.sectionIds).toEqual([original.forecast.sections[0].id]);
  });

  it('preserves punctuation and sentence order when Day sentences end inside quotation marks', () => {
    const original = payload('day', true);
    original.forecast.overview.text = 'Иногда приятно услышать «да!» В ответ может захотеться сказать «спасибо». Даже короткий разговор способен порадовать.';
    const projected = projectPersonalForecastForWire(original, LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION);
    const body = [projected.forecast.overview, ...projected.forecast.sections.slice(0, 2)];
    expect(body.map((section) => section.text)).toEqual([
      'Иногда приятно услышать «да!»',
      'В ответ может захотеться сказать «спасибо».',
      'Даже короткий разговор способен порадовать.',
    ]);
    expect(body.map((section) => section.text).join(' ')).toBe(original.forecast.overview.text);
  });

  it.each<PersonalForecastPeriod>(['week', 'month'])('never serializes a Free %s package or its private brief', (period) => {
    for (const version of [PERSONAL_FORECAST_CONTRACT_VERSION, LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION]) {
      expect(() => projectPersonalForecastForWire(payload(period, false), version))
        .toThrow('PERSONAL_FORECAST_PREMIUM_REQUIRED');
    }
  });
});
