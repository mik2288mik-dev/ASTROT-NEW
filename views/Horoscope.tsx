import React, { memo, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type {
  ForecastDailyReading,
  NatalChartData,
  UserProfile,
} from '../types';
import {
  ensureDailySignHoroscope,
  getCachedDailySignHoroscope,
} from '../services/astrologyService';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getZodiacSign } from '../constants';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { useSwipeBack } from '../lib/useSwipeBack';

type HoroscopeTone = 'sign' | 'chart' | 'love' | 'work';
type HoroscopeBackgroundState = { sign: string | null; tone: HoroscopeTone };

interface HoroscopeProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onRequestPremium?: () => void;
  onBack?: () => void | Promise<void>;
  onBackgroundChange?: (state: HoroscopeBackgroundState | null) => void;
}

const ZODIAC_SIGNS = [
  ['Aries', '21.03 - 19.04'],
  ['Taurus', '20.04 - 20.05'],
  ['Gemini', '21.05 - 20.06'],
  ['Cancer', '21.06 - 22.07'],
  ['Leo', '23.07 - 22.08'],
  ['Virgo', '23.08 - 22.09'],
  ['Libra', '23.09 - 22.10'],
  ['Scorpio', '23.10 - 21.11'],
  ['Sagittarius', '22.11 - 21.12'],
  ['Capricorn', '22.12 - 19.01'],
  ['Aquarius', '20.01 - 18.02'],
  ['Pisces', '19.02 - 20.03'],
] as const;

type ZodiacKey = (typeof ZODIAC_SIGNS)[number][0];

function normalizeSign(sign?: string | null): ZodiacKey {
  const found = ZODIAC_SIGNS.find(([key]) => key.toLowerCase() === String(sign || '').toLowerCase());
  return (found?.[0] || 'Aries') as ZodiacKey;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function splitParagraphs(value?: string | null): string[] {
  return String(value || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function haptic(kind: 'select' | 'open' = 'select') {
  try {
    const webApp = (window as any)?.Telegram?.WebApp;
    if (kind === 'open') webApp?.HapticFeedback?.impactOccurred?.('light');
    else webApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* Telegram haptics are optional */
  }
}

function LoadingText() {
  return (
    <div className="mt-6 space-y-3" aria-busy="true">
      <div className="h-4 w-5/6 animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-2/3 animate-pulse rounded-full bg-black/10" />
    </div>
  );
}

function ReadingText({ reading }: { reading: ForecastDailyReading }) {
  const paragraphs = splitParagraphs(reading.reading || reading.summary || reading.headline);
  return (
    <div className="mt-6 max-h-[calc(100dvh-24rem)] overflow-y-auto pb-2 pr-1">
      {reading.headline ? (
        <p className="text-[18px] font-semibold leading-snug text-[#202024]">{reading.headline}</p>
      ) : null}
      {reading.summary ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[#68646e]">{reading.summary}</p>
      ) : null}
      <div className="mt-5 space-y-3">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-[16px] leading-[1.68] text-[#3b3840]">
            {paragraph}
          </p>
        ))}
      </div>
      {reading.advice?.length ? (
        <div className="mt-5 space-y-2">
          {reading.advice.slice(0, 3).map((item) => (
            <div key={item} className="rounded-[16px] border border-black/10 bg-white px-4 py-3 text-[14px] leading-relaxed text-[#3b3840]">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const Horoscope = memo<HoroscopeProps>(({
  profile,
  chartData,
  onBack,
  onBackgroundChange,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const initialSign = useMemo(() => normalizeSign(chartData?.sun?.sign), [chartData?.sun?.sign]);
  const [selectedSign, setSelectedSign] = useState<ZodiacKey>(initialSign);
  const [reading, setReading] = useState<ForecastDailyReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const zodiacLabel = getZodiacSign(language, selectedSign);

  useSwipeBack({
    onSwipeBack: () => {
      void onBack?.();
    },
    edgeWidth: 44,
    threshold: 72,
    enabled: !!onBack,
  });

  useEffect(() => {
    setSelectedSign(initialSign);
  }, [initialSign]);

  useEffect(() => {
    onBackgroundChange?.({ sign: selectedSign, tone: 'sign' });
    return () => onBackgroundChange?.(null);
  }, [onBackgroundChange, selectedSign]);

  useEffect(() => {
    let cancelled = false;
    setReading(null);
    setError(false);
    setLoading(true);

    const load = async () => {
      try {
        const cached = await getCachedDailySignHoroscope(selectedSign, today, language);
        if (cancelled) return;
        if (cached) {
          setReading(cached);
          return;
        }

        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const generated = await ensureDailySignHoroscope(selectedSign, today, language);
            if (!cancelled) setReading(generated);
            return;
          } catch (err: any) {
            lastError = err;
            if (err?.status !== 202 && err?.code !== 'GENERATION_IN_PROGRESS') break;
            await wait(1200);
          }
        }
        throw lastError;
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [language, selectedSign, today]);

  const chooseSign = (sign: ZodiacKey) => {
    haptic();
    setSelectedSign(sign);
  };

  return (
    <div className="min-h-full bg-white px-4 pb-8 pt-[calc(max(env(safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px))+0.8rem)] font-sans">
      <div className="mx-auto flex min-h-[calc(100dvh-1.6rem)] w-full max-w-[25rem] flex-col gap-4">
        {onBack ? (
          <button
            type="button"
            onClick={() => {
              haptic('open');
              void onBack();
            }}
            className="inline-flex min-h-[40px] w-fit items-center gap-2 rounded-full bg-white px-3 text-[13px] font-semibold text-[#202024] shadow-[0_8px_22px_rgba(0,0,0,0.06)]"
            aria-label={language === 'en' ? 'Back' : 'Назад'}
          >
            <ArrowLeft size={16} />
            {language === 'en' ? 'Back' : 'Назад'}
          </button>
        ) : null}

        <section className="relative flex flex-1 flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white p-5 shadow-[0_18px_44px_rgba(0,0,0,0.08)]">
          <div className="pointer-events-none absolute -right-8 top-20 opacity-[0.08]">
            <ZodiacIcon sign={selectedSign} size={188} strokeWidth={0.8} />
          </div>
          <div className="pointer-events-none relative h-8 w-[min(19rem,80vw)] overflow-hidden [mask-image:radial-gradient(190px_46px_at_35%_0%,white_0%,white_38%,transparent_82%)]">
            <div className="absolute left-0 top-2 h-px w-[82%] bg-gradient-to-r from-black/10 via-black/5 to-transparent blur-[1px]" />
            <span className="absolute left-[29%] top-0 h-2 w-2 rounded-full bg-[#d8d8dc]" />
            <span className="absolute left-[53%] top-2 h-1.5 w-1.5 rounded-full bg-[#d8d8dc]" />
          </div>

          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-semibold text-[#5d5963]">
              <Sparkles size={14} />
              {formatLumiaDate(today, language)}
            </p>
            <h1 className="mt-4 max-w-[min(82vw,22rem)] text-[clamp(2.35rem,10vw,3.35rem)] font-semibold leading-[0.98] text-[#202024]">
              {language === 'en' ? 'Horoscope Today' : 'Гороскоп сегодня'}
            </h1>
            <p className="mt-3 max-w-[min(82vw,21rem)] text-[14px] leading-relaxed text-[#68646e]">
              {zodiacLabel}
            </p>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            {ZODIAC_SIGNS.map(([sign]) => (
              <button
                key={sign}
                type="button"
                onClick={() => chooseSign(sign)}
                className={`min-h-[42px] rounded-[14px] border px-2 text-[12px] font-semibold ${
                  sign === selectedSign
                    ? 'border-[#202024] bg-[#202024] text-white'
                    : 'border-black/10 bg-white text-[#4b4850]'
                }`}
              >
                {getZodiacSign(language, sign)}
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            {loading && !reading ? (
              <LoadingText />
            ) : error && !reading ? (
              <div className="mt-6 rounded-[18px] border border-black/10 bg-white px-4 py-3 text-[14px] leading-relaxed text-[#5f5b64]">
                {language === 'en'
                  ? 'Check connection and open this sign again.'
                  : 'Проверь соединение и открой этот знак ещё раз.'}
              </div>
            ) : reading ? (
              <ReadingText reading={reading} />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
});

Horoscope.displayName = 'Horoscope';
