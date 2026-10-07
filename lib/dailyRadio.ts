/**
 * «Радио NEBO»: the day's issue for one person, built from the server's own stored content. The same text is
 * voiced by the studio voice and shown for reading. Pieces that are not ready are simply left out.
 */
import { db } from './db';
import { birthProfileRepository } from './birthProfileRepository';
import { buildPersonalForecastPrewarmProfile } from './personalForecastPrewarm';
import { getCompatibleStalePersonalForecast } from './personalForecastCache';
import { getMoscowTodayKey } from './date-utils';
import { normalizeZodiacKey } from './horoscope/signDaily';
import { getSignHoroscopeCacheSnapshot } from './horoscope/signCache';
import { computeSkyToday } from './horoscope/skyToday';
import { getSkyTodayNarrative } from './skyToday';
import { questionForDay } from './dailyQuestion';
import { resolveNotificationSign } from './nativeNotificationPolicy';
import { buildForecastListenScript } from './tts/forecastListenScript';
import { buildDailyRadioScript } from './tts/dailyRadioScript';

const SIGN_LABELS: Record<string, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};

export async function composeDailyRadio(userId: string): Promise<{ dayKey: string; text: string }> {
  const dayKey = getMoscowTodayKey();
  const [user, birthSettings] = await Promise.all([
    db.users.get(userId, { hydratePrimaryChart: false }),
    birthProfileRepository.get(userId),
  ]);
  const profile = buildPersonalForecastPrewarmProfile(userId, user, birthSettings);

  let forecast: string | null = null;
  if (profile) {
    const cached = await getCompatibleStalePersonalForecast({ userId, profile, accessTier: 'premium', period: 'day', periodKey: dayKey });
    if (cached && cached.forecast.meta.status === 'ready') {
      // The forecast script opens with «Привет. Твой прогноз на сегодня.»; the issue has its own opening.
      forecast = buildForecastListenScript({ forecast: cached.forecast, name: null, language: 'ru' }).replace(/^[^.]*\.[^.]*\.\s*/u, '');
    }
  }

  let sky: string | null = null;
  try {
    const narrative = getSkyTodayNarrative(await computeSkyToday(dayKey), 'ru');
    sky = `${narrative.moonLabel}. ${narrative.moonDescription} ${narrative.mercuryPosition}. ${narrative.mercuryDescription}`;
  } catch {
    sky = null;
  }

  const rawBirth = (user as { birth_date?: unknown } | null)?.birth_date;
  const signName = resolveNotificationSign(
    (user as { selected_zodiac_sign?: string } | null)?.selected_zodiac_sign,
    rawBirth instanceof Date ? rawBirth.toISOString().slice(0, 10) : rawBirth,
  );
  const signKey = signName ? normalizeZodiacKey(signName) : null;
  const signSnapshot = signKey ? await getSignHoroscopeCacheSnapshot('day', signKey, dayKey, 'ru') : null;

  const text = buildDailyRadioScript({
    dayKey,
    name: profile?.name ?? null,
    forecast,
    sign: signSnapshot && signKey
      ? { label: SIGN_LABELS[String(signKey).toLowerCase()] || String(signKey), headline: signSnapshot.reading.headline, text: signSnapshot.reading.text }
      : null,
    sky,
    question: questionForDay(dayKey),
  });
  return { dayKey, text };
}
