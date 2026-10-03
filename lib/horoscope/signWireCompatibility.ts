import type { SignHoroscopeReadingV2 } from '../../types';

export const RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION = 'sign-horoscope-reading-v4' as const;

export type ReleasedAndroidSignHoroscopeReading = Omit<SignHoroscopeReadingV2, 'schemaVersion'> & {
  schemaVersion: typeof RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION;
};

export function isReleasedAndroidSignHoroscopeClient(userAgent?: string | null): boolean {
  return /\bDalvik\/[^\s]+.*\bAndroid\b/iu.test(String(userAgent || ''));
}

export function resolveSignHoroscopeWireVersion(value: unknown, userAgent?: string | null): string | null {
  if (value === undefined) return isReleasedAndroidSignHoroscopeClient(userAgent)
    ? RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION
    : 'sign-horoscope-reading-v5';
  return value === RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION || value === 'sign-horoscope-reading-v5'
    ? value : null;
}

/**
 * The RuStore APK released before sign-horoscope-reading-v5 only accepts v4.
 * Requests from that APK omit schemaVersion, so retain the native v4 default.
 * New Android readers explicitly request v5. Both receive the same fresh text.
 */
export function projectSignHoroscopeForWire(
  reading: SignHoroscopeReadingV2,
  userAgent?: string | null,
  schemaVersion?: unknown,
): SignHoroscopeReadingV2 | ReleasedAndroidSignHoroscopeReading {
  const wireVersion = resolveSignHoroscopeWireVersion(schemaVersion, userAgent);
  if (!wireVersion) throw new Error('SIGN_HOROSCOPE_FORMAT_UNSUPPORTED');
  if (wireVersion === reading.schemaVersion) return reading;
  return {
    ...reading,
    schemaVersion: RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION,
  };
}
