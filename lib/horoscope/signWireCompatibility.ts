import type { SignHoroscopeReadingV2 } from '../../types';

export const RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION = 'sign-horoscope-reading-v4' as const;

export type ReleasedAndroidSignHoroscopeReading = Omit<SignHoroscopeReadingV2, 'schemaVersion'> & {
  schemaVersion: typeof RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION;
};

export function isReleasedAndroidSignHoroscopeClient(userAgent?: string | null): boolean {
  return /\bDalvik\/[^\s]+.*\bAndroid\b/iu.test(String(userAgent || ''));
}

/**
 * The RuStore APK released before sign-horoscope-reading-v5 only accepts v4.
 * Keep v5 internally, but project the public response back to v4 for the
 * released native Android transport. Browser/web clients continue to receive v5.
 */
export function projectSignHoroscopeForWire(
  reading: SignHoroscopeReadingV2,
  userAgent?: string | null,
): SignHoroscopeReadingV2 | ReleasedAndroidSignHoroscopeReading {
  if (!isReleasedAndroidSignHoroscopeClient(userAgent)) return reading;
  return {
    ...reading,
    schemaVersion: RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION,
  };
}
