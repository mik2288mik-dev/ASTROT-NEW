import type { SignHoroscopeReadingV2 } from '../types';
import {
  isReleasedAndroidSignHoroscopeClient,
  projectSignHoroscopeForWire,
  RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION,
} from '../lib/horoscope/signWireCompatibility';

const reading: SignHoroscopeReadingV2 = {
  schemaVersion: 'sign-horoscope-reading-v5',
  sign: 'Aries',
  period: 'day',
  periodKey: '2026-09-16',
  headline: 'Всё складывается проще',
  text: 'Обычные дела идут без лишней суеты, а хороший разговор может приятно ускорить то, что давно хотелось решить.',
};

describe('released Android sign horoscope wire compatibility', () => {
  it('recognizes the released native Android transport', () => {
    expect(isReleasedAndroidSignHoroscopeClient(
      'Dalvik/2.1.0 (Linux; U; Android 13; M2101K9AG Build/TKQ1.221013.002)',
    )).toBe(true);
    expect(isReleasedAndroidSignHoroscopeClient(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36',
    )).toBe(false);
  });

  it('projects only schemaVersion for the released Android APK', () => {
    const projected = projectSignHoroscopeForWire(
      reading,
      'Dalvik/2.1.0 (Linux; U; Android 13; device Build/test)',
    );

    expect(projected).toEqual({
      ...reading,
      schemaVersion: RELEASED_ANDROID_SIGN_HOROSCOPE_SCHEMA_VERSION,
    });
    expect(projected.sign).toBe(reading.sign);
    expect(projected.period).toBe(reading.period);
    expect(projected.periodKey).toBe(reading.periodKey);
    expect(projected.headline).toBe(reading.headline);
    expect(projected.text).toBe(reading.text);
  });

  it('keeps v5 unchanged for browser clients', () => {
    const projected = projectSignHoroscopeForWire(
      reading,
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152 Safari/537.36',
    );

    expect(projected).toBe(reading);
    expect(projected.schemaVersion).toBe('sign-horoscope-reading-v5');
  });
});
