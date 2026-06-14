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

function SignPicker({
  language,
  current,
  onPick,
}: {
  language: 'ru' | 'en';
  current: string | null;
  onPick: (sign: string) => void;
}) {
  return (
    <div className="pointer-events-auto">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mono-muted">
        {language === 'ru' ? 'Гороскоп' : 'Horoscope'}
      </p>
      <h2 className="mt-2 font-lumiaHome text-[26px] font-bold leading-tight text-mono-ink">
        {language === 'ru' ? 'Чей гороскоп смотрим?' : 'Whose horoscope?'}
      </h2>
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {SIGN_KEYS.map((sign) => {
          const active = !!current && sign.toLowerCase() === current.toLowerCase();
          return (
            <button
              key={sign}
              type="button"
              onClick={() => onPick(sign)}
              className={`flex flex-col items-center gap-1.5 rounded-[18px] px-2 py-3.5 transition-transform active:scale-95 ${
                active ? 'bg-mono-black text-white' : 'bg-mono-white border border-mono-line'
              }`}
            >
              <ZodiacIcon sign={sign} size={28} stroke={active ? '#ffffff' : '#111111'} strokeWidth={1.6} />
              <span className={`text-[12px] font-semibold leading-none ${active ? 'text-white' : 'text-mono-ink'}`}>
                {getZodiacSign(language, sign)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Horoscope as stories: sign picker is always slide 1, then today's reading. */
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
  const [advanceSeq, setAdvanceSeq] = useState(0);

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
    setAdvanceSeq((s) => s + 1);
  };

  const slides: StorySlide[] = useMemo(() => {
    const picker: StorySlide = { id: 'pick', content: <SignPicker language={language} current={sign} onPick={choose} /> };
    if (!sign) return [picker];
    const eyebrow = `${getZodiacSign(language, sign)} · ${language === 'ru' ? 'сегодня' : 'today'}`;
    const readingSlides = reading
      ? buildReadingSlides(reading, eyebrow, language)
      : [{ id: 'loading', eyebrow, title: language === 'ru' ? 'Готовим прогноз…' : 'Preparing…', loading: true } as StorySlide];
    return [picker, ...readingSlides];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign, reading, language]);

  return (
    <StoriesViewer open={open} slides={slides} onClose={onClose} advanceSignal={advanceSeq} accent="#111111" variant="mono" />
  );
}
