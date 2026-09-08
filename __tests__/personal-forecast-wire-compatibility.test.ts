import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import * as dateFnsTz from 'date-fns-tz';
import {
  PERSONAL_FORECAST_CONTRACT_VERSION,
  isPersonalForecastPackage,
  slicePersonalForecastForAccess,
  type PersonalForecastAccessPayload,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import {
  LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION,
  RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION,
  projectPersonalForecastForWire,
  resolvePersonalForecastWireVersion,
} from '../lib/personalForecastWireCompatibility';
import { personalForecastFixture } from './personal-forecast-fixture';

// Exact validator source from the clean b7f1bb54174d8838eb870d2ff37def848bdfa84c
// build recorded in NEBO-rustore-release-1.0.4-vc7.apk.json. The fixture is kept
// outside TypeScript compilation and never imports the changing app voice.
const releasedValidatorSource = readFileSync(join(__dirname, 'fixtures/personalForecastContract-v29.source.txt'), 'utf8').replace(/\r\n/g, '\n');
const releasedValidator = {} as {
  PERSONAL_FORECAST_CONTRACT_VERSION: string;
  getPersonalForecastPackageValidationError: (
    value: unknown, options?: { redactedSectionIds?: string[] },
  ) => string | null;
};
runInNewContext(transpileModule(releasedValidatorSource, {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
}).outputText, {
  exports: releasedValidator,
  require(id: string) {
    if (id === 'date-fns-tz') return dateFnsTz;
    if (id === './appVoice') return {
      PERSONAL_FORECAST_VOICE_VERSION: '16',
      withPersonalForecastVoiceVersion: (base: string) => `${base}+forecast-voice.16`,
    };
    throw new Error(`Unexpected released validator import: ${id}`);
  },
});

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
    for (const version of [LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION, RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION, 'personal-forecast-feed-v30-nebo-human-voice', PERSONAL_FORECAST_CONTRACT_VERSION]) {
      expect(resolvePersonalForecastWireVersion(version)).toBe(version);
    }
    for (const version of ['', null, 'v24', '__proto__', 'constructor', [PERSONAL_FORECAST_CONTRACT_VERSION]]) {
      expect(resolvePersonalForecastWireVersion(version)).toBeNull();
    }
  });

  it('uses the unmodified validator shipped in vc7, without silently updating its expectations', () => {
    expect(createHash('sha256').update(releasedValidatorSource).digest('hex'))
      .toBe('f0a89b2333fba0cdbe698f354c93bfaa1fa37c57a3bb5d10a2fead99bb4416f2');
    expect(releasedValidator.PERSONAL_FORECAST_CONTRACT_VERSION).toBe(RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION);
  });

  it.each<PersonalForecastPeriod>(['day', 'week', 'month'])('passes the installed vc7 Premium %s validator with the complete unchanged reading', (period) => {
    const original = payload(period, true);
    original.forecast.meta.generationAttempts = 6;
    const before = JSON.stringify(original);
    // Accepting the request version alone cannot fix the released client.
    expect(releasedValidator.getPersonalForecastPackageValidationError(original.forecast)).toBe('PACKAGE_META_INVALID');
    const projected = projectPersonalForecastForWire(original, RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION);
    expect(releasedValidator.getPersonalForecastPackageValidationError(projected.forecast)).toBeNull();
    expect(projected.forecast.overview).toBe(original.forecast.overview);
    expect(projected.forecast.sections).toBe(original.forecast.sections);
    expect(projected.forecast.sections).toHaveLength(1);
    expect(projected.lockedSectionIds).toEqual([]);
    expect(projected.forecast.meta).toMatchObject({
      contractVersion: RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION,
      semanticVersion: RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION,
      promptVersion: 'personal-forecast-feed.v47-period-horoscope+forecast-voice.16',
      voiceVersion: '16', calculationVersion: 'personal-forecast-luna-raw-profile-brief-v12',
      generationAttempts: 6,
      currentGeneration: {
        contractVersion: original.forecast.meta.contractVersion,
        promptVersion: original.forecast.meta.promptVersion,
        generationAttempts: 6,
      },
    });
    expect(JSON.stringify(original)).toBe(before);
  });

  it('passes the installed vc7 Free Day validator and preserves authorized content exactly', () => {
    const original = payload('day', false);
    const projected = projectPersonalForecastForWire(original, RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION);
    expect(releasedValidator.getPersonalForecastPackageValidationError(projected.forecast, {
      redactedSectionIds: projected.lockedSectionIds,
    })).toBeNull();
    expect(projected.accessTier).toBe('free');
    expect(projected.periodLocked).toBe(false);
    expect(projected.lockedSectionIds).toEqual(original.lockedSectionIds);
    expect(projected.forecast.overview).toBe(original.forecast.overview);
    expect(projected.forecast.sections).toBe(original.forecast.sections);
    expect(projected.forecast.evidence).toBe(original.forecast.evidence);
  });

  it('keeps the deployed v30 reader supported after a future generator version changes', () => {
    const original = payload('day', true);
    const projected = projectPersonalForecastForWire(original, 'personal-forecast-feed-v30-nebo-human-voice');
    expect(projected.forecast.meta).toMatchObject({
      contractVersion: 'personal-forecast-feed-v30-nebo-human-voice',
      semanticVersion: 'personal-forecast-feed-v30-nebo-human-voice',
      promptVersion: 'personal-forecast-feed.v48-nebo-human-voice+forecast-voice.16',
      voiceVersion: '16', calculationVersion: 'personal-forecast-luna-raw-profile-brief-v12',
    });
    expect(projected.forecast.overview).toBe(original.forecast.overview);
    expect(projected.forecast.sections).toBe(original.forecast.sections);
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
    for (const version of [PERSONAL_FORECAST_CONTRACT_VERSION, LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION, RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION, 'personal-forecast-feed-v30-nebo-human-voice']) {
      expect(() => projectPersonalForecastForWire(payload(period, false), version))
        .toThrow('PERSONAL_FORECAST_PREMIUM_REQUIRED');
    }
  });
});
