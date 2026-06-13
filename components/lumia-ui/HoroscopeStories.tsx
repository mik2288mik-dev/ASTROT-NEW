import React, { useEffect, useMemo, useState } from 'react';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../types';
import { getCachedDailySignHoroscope, ensureDailySignHoroscope } from '../../services/astrologyService';
import { saveProfile } from '../../services/storageService';
import { getMoscowTodayKey } from '../../lib/date-utils';
import { getZodiacSign } from '../../constants';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { StoriesViewer, buildReadingSlides, type StorySlide } from './StoriesViewer';

const SIGN_KEYS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

const LOCAL_SIGN_KEY = 'lumia:selected-zodiac-sign';

function SignPicker({ language, onPick }: { language: 'ru' | 'en'; onPick: (sign: string) => void }) {
  return (
    <div className="pointer-events-auto">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
        {language === 'ru' ? 'Выбери свой знак' : 'Choose your sign'}
      </p>
      <h2 className="mt-2 font-lumiaHome text-[26px] font-bold leading-tight text-white">
        {language === 'ru' ? 'Чей гороскоп смотрим?' : 'Whose horoscope?'}
      </h2>
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {SIGN_KEYS.map((sign) => (
          <button
            key={sign}
            type="button"
            onClick={() => onPick(sign)}
            className="flex flex-col items-center gap-1.5 rounded-[16px] bg-white px-2 py-3 text-[#1E1230] active:scale-95"
          >
            <ZodiacIcon sign={sign} size={24} />
            <span className="text-[12px] font-semibold leading-none">{getZodiacSign(language, sign)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Horoscope as stories: sign picker = first slide (if no sign), then today's reading. */
export function HoroscopeStories({
  open,
  profile,
  chartData,
  language,
  onClose,
  onUpdateProfile,
}: {
  open: boolean;
  profile: UserProfile;
  chartData: NatalChartData | null;
  language: 'ru' | 'en';
  onClose: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
}) {
  const today = useMemo(() => getMoscowTodayKey(), []);
  const initialSign = useMemo(() => {
    const fromProfile = String(profile.selectedZodiacSign || chartData?.sun?.sign || '').trim();
    return SIGN_KEYS.find((s) => s.toLowerCase() === fromProfile.toLowerCase()) || null;
  }, [profile.selectedZodiacSign, chartData]);

  const [sign, setSign] = useState<string | null>(initialSign);
  const [reading, setReading] = useState<ForecastDailyReading | null>(null);

  useEffect(() => { if (open) setSign(initialSign); }, [open, initialSign]);

  useEffect(() => {
    if (!open || !sign) return;
    let alive = true;
    setReading(null);
    void getCachedDailySignHoroscope(sign, today, language)
      .then((cached) => cached || ensureDailySignHoroscope(sign, today, language))
      .then((r) => { if (alive) setReading(r); })
      .catch(() => { /* non-critical */ });
    return () => { alive = false; };
  }, [open, sign, today, language]);

  const choose = (picked: string) => {
    setSign(picked);
    try { window.localStorage.setItem(LOCAL_SIGN_KEY, picked); } catch { /* optional */ }
    const updated = { ...profile, selectedZodiacSign: picked };
    onUpdateProfile?.(updated);
    if (updated.id) void saveProfile(updated).catch(() => undefined);
  };

  const slides: StorySlide[] = useMemo(() => {
    if (!sign) {
      return [{ id: 'pick', content: <SignPicker language={language} onPick={choose} /> }];
    }
    const eyebrow = `${getZodiacSign(language, sign)} · ${language === 'ru' ? 'сегодня' : 'today'}`;
    if (reading) return buildReadingSlides(reading, eyebrow, language);
    return [{ id: 'loading', eyebrow, title: language === 'ru' ? 'Готовим прогноз…' : 'Preparing…', loading: true }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign, reading, language]);

  return <StoriesViewer open={open} slides={slides} onClose={onClose} accent="#7559CF" />;
}
