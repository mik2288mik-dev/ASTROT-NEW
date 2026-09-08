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

describe('direct personal horoscope contract',()=>{
  test.each(['day','week','month'] as const)('keeps a complete %s reading without a closing section',period=>{
    const reading=personalForecastFixture(period);
    expect(isPersonalForecastPackage(reading)).toBe(true);
    expect(reading.sections).toEqual([]);
    expect(reading.overview.text.trim()).not.toBe('');
  });
  test.each(['promptVersion','voiceVersion','calculationVersion','semanticVersion','contractVersion'] as const)('rejects stale %s',key=>{
    const reading=personalForecastFixture(); reading.meta[key]='old'; expect(isPersonalForecastPackage(reading)).toBe(false);
  });
  test('does not accept a fabricated extra section',()=>{
    const reading=personalForecastFixture();reading.sections=[{...reading.overview,id:'extra',kind:'dynamic'}];expect(isPersonalForecastPackage(reading)).toBe(false);
  });
  test('gives Free the entire Today and locks Week and Month',()=>{
    const day=personalForecastFixture();expect(slicePersonalForecastForAccess(day,false).forecast.overview.text).toBe(day.overview.text);
    for(const period of ['week','month'] as const){const reading=personalForecastFixture(period);const free=slicePersonalForecastForAccess(reading,false);expect(free.periodLocked).toBe(true);expect(free.forecast.overview.text).toBe('');expect(slicePersonalForecastForAccess(reading,true).forecast).toEqual(reading);}
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


});
