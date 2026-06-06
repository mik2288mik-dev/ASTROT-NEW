import React, { memo, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Lock, Sparkles } from 'lucide-react';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../types';
import { canAccessFeature } from '../lib/accessMatrix';
import { formatIsoWeekPeriodLabel, formatLumiaDate, getMoscowIsoWeekKey, getMoscowTodayKey } from '../lib/date-utils';
import { getZodiacSign } from '../constants';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import {
  ensureDailySignHoroscope,
  ensureWeeklySignHoroscope,
  getCachedDailySignHoroscope,
  getCachedWeeklySignHoroscope,
} from '../services/astrologyService';
import { saveProfile } from '../services/storageService';

interface HoroscopeProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalDaily?: () => void;
  onRequestPremium?: () => void;
  onBack?: () => void | Promise<void>;
  onBackgroundChange?: (state: { sign: string | null; tone: 'sign' } | null) => void;
}

const ZODIAC_SIGNS = [
  ['Aries', '21.03 - 19.04'], ['Taurus', '20.04 - 20.05'], ['Gemini', '21.05 - 20.06'],
  ['Cancer', '21.06 - 22.07'], ['Leo', '23.07 - 22.08'], ['Virgo', '23.08 - 22.09'],
  ['Libra', '23.09 - 22.10'], ['Scorpio', '23.10 - 21.11'], ['Sagittarius', '22.11 - 21.12'],
  ['Capricorn', '22.12 - 19.01'], ['Aquarius', '20.01 - 18.02'], ['Pisces', '19.02 - 20.03'],
] as const;
type ZodiacKey = (typeof ZODIAC_SIGNS)[number][0];
type HoroscopeMode = 'sign' | 'personal';
type SignPeriod = 'today' | 'week';
const LOCAL_SIGN_KEY = 'lumia:selected-zodiac-sign';

function normalizeSign(value?: string | null): ZodiacKey | null {
  return ZODIAC_SIGNS.find(([sign]) => sign.toLowerCase() === String(value || '').toLowerCase())?.[0] || null;
}

function readLocalSign(): ZodiacKey | null {
  try { return normalizeSign(window.localStorage.getItem(LOCAL_SIGN_KEY)); } catch { return null; }
}

function LoadingText() {
  return <div className="mt-6 space-y-3" aria-busy="true" aria-label="horoscope-loading-skeleton">
    <div className="h-4 w-5/6 animate-pulse rounded-full bg-black/10" /><div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
    <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/10" /><div className="h-3 w-2/3 animate-pulse rounded-full bg-black/10" />
  </div>;
}

function Reading({ reading }: { reading: ForecastDailyReading }) {
  return <div className="mt-6 space-y-4 pb-4">
    <h2 className="text-[20px] font-semibold leading-snug text-[#202024]">{reading.headline}</h2>
    {reading.summary ? <p className="text-[14px] leading-relaxed text-[#68646e]">{reading.summary}</p> : null}
    {reading.reading ? <p className="whitespace-pre-line text-[16px] leading-[1.68] text-[#3b3840]">{reading.reading}</p> : null}
    {reading.focus ? <div className="rounded-[18px] border border-black/10 bg-[#f7f6f4] px-4 py-3 text-[14px] leading-relaxed text-[#3b3840]">{reading.focus}</div> : null}
    {reading.advice?.slice(0, 2).map((item) => <div key={item} className="rounded-[18px] border border-black/10 px-4 py-3 text-[14px] leading-relaxed text-[#3b3840]">{item}</div>)}
  </div>;
}

function PersonalMode({ profile, chartData, chartId, onOpenChart, onOpenPersonalDaily, onRequestPremium }: HoroscopeProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const access = canAccessFeature('personal_daily', profile, { chartData, primaryChartId: chartId ?? null });
  const needsChart = access.status === 'needs_chart';
  const title = needsChart
    ? (language === 'en' ? 'Create a natal chart for your personal day' : 'Создай натальную карту, чтобы Lumia рассчитала личный день')
    : access.allowed
      ? (language === 'en' ? 'Your personal day is ready' : 'Твой личный день готов')
      : (language === 'en' ? 'Personal day is in Premium' : 'Личный день доступен в Premium');
  return <section className="mt-5 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_18px_44px_rgba(0,0,0,0.07)]">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202024] text-white">{access.allowed ? <Sparkles size={18} /> : <Lock size={18} />}</div>
    <h2 className="mt-4 text-[24px] font-semibold leading-tight text-[#202024]">{title}</h2>
    <p className="mt-3 text-[14px] leading-relaxed text-[#68646e]">
      {needsChart
        ? (language === 'en' ? 'A saved chart is required before Lumia can calculate your personal day.' : 'Для личного прогноза нужна сохранённая карта. Общий гороскоп по знаку остаётся доступен без неё.')
        : access.allowed
          ? (language === 'en' ? 'Main theme, people, action, risk, and a short chart-based explanation.' : 'Главное сегодня, люди, действие дня, риск и короткое объяснение по карте.')
          : (language === 'en' ? 'Your chart is ready. Activate Premium or an active trial to open the personal day.' : 'Карта уже готова. Для личного дня нужен активный Premium или trial.')}
    </p>
    <button type="button" onClick={needsChart ? onOpenChart : access.allowed ? onOpenPersonalDaily : onRequestPremium} className="mt-5 min-h-[46px] rounded-full bg-[#202024] px-5 text-[14px] font-semibold text-white">
      {needsChart ? (language === 'en' ? 'Create chart' : 'Создать карту') : access.allowed ? (language === 'en' ? 'Open personal day' : 'Открыть личный день') : (language === 'en' ? 'Open Premium' : 'Открыть Premium')}
    </button>
  </section>;
}

export const Horoscope = memo<HoroscopeProps>((props) => {
  const { profile, chartData, onUpdateProfile, onBack, onBackgroundChange } = props;
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const weekKey = useMemo(() => getMoscowIsoWeekKey(), []);
  const preferredSign = normalizeSign(profile.selectedZodiacSign) || normalizeSign(chartData?.sun?.sign);
  const [mode, setMode] = useState<HoroscopeMode>('sign');
  const [period, setPeriod] = useState<SignPeriod>('today');
  const [selectedSign, setSelectedSign] = useState<ZodiacKey | null>(() => preferredSign || readLocalSign());
  const [showPicker, setShowPicker] = useState(!selectedSign);
  const [reading, setReading] = useState<ForecastDailyReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => { onBackgroundChange?.(selectedSign ? { sign: selectedSign, tone: 'sign' } : null); return () => onBackgroundChange?.(null); }, [onBackgroundChange, selectedSign]);

  useEffect(() => {
    if (mode !== 'sign' || showPicker || !selectedSign) return;
    let cancelled = false;
    setReading(null); setError(false); setLoading(true);
    const load = async () => {
      try {
        const cached = period === 'today'
          ? await getCachedDailySignHoroscope(selectedSign, today, language)
          : await getCachedWeeklySignHoroscope(selectedSign, weekKey, language);
        if (cancelled) return;
        if (cached) {
          if (!cancelled) setReading(cached);
          return;
        }
        let next: ForecastDailyReading | null = null;
        for (let attempt = 0; attempt < 3 && !next; attempt += 1) {
          try {
            next = period === 'today'
              ? await ensureDailySignHoroscope(selectedSign, today, language)
              : await ensureWeeklySignHoroscope(selectedSign, weekKey, language);
          } catch (generationError: any) {
            if (generationError?.status !== 202 || attempt === 2) throw generationError;
            await new Promise((resolve) => window.setTimeout(resolve, 1200));
          }
        }
        if (!cancelled && next) setReading(next);
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load(); return () => { cancelled = true; };
  }, [language, mode, period, selectedSign, showPicker, today, weekKey]);

  const chooseSign = (sign: ZodiacKey) => {
    setSelectedSign(sign); setShowPicker(false); setReading(null);
    try { window.localStorage.setItem(LOCAL_SIGN_KEY, sign); } catch { /* optional local persistence */ }
    const updated = { ...profile, selectedZodiacSign: sign };
    onUpdateProfile?.(updated);
    if (updated.id) void saveProfile(updated).catch(() => undefined);
  };

  return <div className="min-h-full bg-[#faf9f7] px-4 pb-[var(--lumia-bottom-tab-clearance)] pt-[calc(max(env(safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px))+0.8rem)] font-sans">
    <div className="mx-auto w-full max-w-[25rem]">
      {onBack ? <button type="button" onClick={() => void onBack()} className="mb-4 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white px-3 text-[13px] font-semibold shadow-sm"><ArrowLeft size={16} />{language === 'en' ? 'Back' : 'Назад'}</button> : null}
      <h1 className="text-[36px] font-semibold leading-none text-[#202024]">{language === 'en' ? 'Horoscope' : 'Гороскоп'}</h1>
      <div className="mt-5 grid grid-cols-2 rounded-[16px] bg-black/5 p-1">
        <button type="button" onClick={() => setMode('sign')} className={`min-h-[42px] rounded-[13px] text-[14px] font-semibold ${mode === 'sign' ? 'bg-white shadow-sm' : 'text-[#6e6973]'}`}>{language === 'en' ? 'By sign' : 'По знаку'}</button>
        <button type="button" onClick={() => setMode('personal')} className={`min-h-[42px] rounded-[13px] text-[14px] font-semibold ${mode === 'personal' ? 'bg-white shadow-sm' : 'text-[#6e6973]'}`}>{language === 'en' ? 'Personal day' : 'Личный день'}</button>
      </div>

      {mode === 'personal' ? <PersonalMode {...props} /> : showPicker || !selectedSign ? <section className="mt-5 rounded-[24px] border border-black/10 bg-white p-5">
        <h2 className="text-[22px] font-semibold text-[#202024]">{language === 'en' ? 'Choose any sign' : 'Выбери любой знак'}</h2>
        <p className="mt-2 text-[14px] text-[#68646e]">{language === 'en' ? 'No natal chart is required.' : 'Натальная карта не нужна.'}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">{ZODIAC_SIGNS.map(([sign, dates]) => <button key={sign} type="button" onClick={() => chooseSign(sign)} className="rounded-[16px] border border-black/10 px-2 py-3 text-center"><ZodiacIcon sign={sign} size={25} /><span className="mt-1 block text-[12px] font-semibold">{getZodiacSign(language, sign)}</span><span className="mt-1 block text-[9px] text-[#8b8690]">{dates}</span></button>)}</div>
      </section> : <section className="mt-5 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_18px_44px_rgba(0,0,0,0.07)]">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b8690]">{period === 'today' ? formatLumiaDate(today, language) : formatIsoWeekPeriodLabel(weekKey, language)}</p><h2 className="mt-2 text-[28px] font-semibold text-[#202024]">{getZodiacSign(language, selectedSign)}</h2></div><ZodiacIcon sign={selectedSign} size={50} /></div>
        <div className="mt-5 grid grid-cols-2 rounded-[14px] bg-black/5 p-1"><button type="button" onClick={() => setPeriod('today')} className={`min-h-[38px] rounded-[11px] text-[13px] font-semibold ${period === 'today' ? 'bg-white shadow-sm' : ''}`}>{language === 'en' ? 'Today' : 'Сегодня'}</button><button type="button" onClick={() => setPeriod('week')} className={`min-h-[38px] rounded-[11px] text-[13px] font-semibold ${period === 'week' ? 'bg-white shadow-sm' : ''}`}>{language === 'en' ? 'Week' : 'Неделя'}</button></div>
        {loading ? <LoadingText /> : error ? <p className="mt-6 rounded-[16px] bg-black/5 p-4 text-[14px] text-[#68646e]">{language === 'en' ? 'Content is being prepared. Try again shortly.' : 'Контент готовится. Попробуй ещё раз чуть позже.'}</p> : reading ? <Reading reading={reading} /> : null}
        <button type="button" onClick={() => setShowPicker(true)} className="mt-3 min-h-[42px] rounded-full border border-black/10 px-4 text-[13px] font-semibold">{language === 'en' ? 'Another sign' : 'Другой знак'}</button>
      </section>}
    </div>
  </div>;
});
Horoscope.displayName = 'Horoscope';
