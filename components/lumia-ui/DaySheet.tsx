import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Sparkles } from 'lucide-react';
import type { ForecastDailyReading } from '../../types';
import { formatLumiaDate } from '../../lib/date-utils';
import { getDayFavorability } from '../../lib/horoscope/dayFavorability';
import { getCachedDailySignHoroscope, ensureDailySignHoroscope } from '../../services/astrologyService';
import { RadialGauge } from '../Dashboard/home/gauges';

type DaySheetProps = {
  /** ISO key of the open day, or null when the sheet is closed. */
  dateKey: string | null;
  todayKey: string;
  sign: string;
  language: 'ru' | 'en';
  isPremium: boolean;
  onClose: () => void;
  onRequestPremium: () => void;
};

// Small moon illumination dial reused across the sheet bodies.
function MoonDial({ illumination, label }: { illumination: number; label: string }) {
  return (
    <RadialGauge value={illumination} size={68} stroke={7} color="#7B5CF6" track="#ECE6F4">
      <span className="text-[16px] leading-none">🌙</span>
      <span className="mt-[3px] text-[9px] font-semibold leading-none text-[#7B5CF6]">{label}</span>
    </RadialGauge>
  );
}

function ReadingBody({
  loading,
  reading,
  favIllum,
  moonLabel,
  language,
}: {
  loading: boolean;
  reading: ForecastDailyReading | null;
  favIllum: number;
  moonLabel: string;
  language: 'ru' | 'en';
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-4 rounded-[18px] bg-[#F6F3FB] p-3">
        <MoonDial illumination={favIllum} label={moonLabel} />
        <p className="flex-1 text-[13px] leading-snug text-[#50465E]">
          {language === 'ru' ? 'Луна сегодня подсказывает темп дня' : 'The Moon sets today’s pace'}
        </p>
      </div>
      {loading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-4 w-4/5 animate-pulse rounded-full bg-black/10" />
          <div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-black/10" />
        </div>
      ) : reading ? (
        <div className="mt-4">
          {reading.headline ? (
            <h4 className="font-lumiaHomeDisplay text-[18px] font-bold leading-snug text-[#1E1230]">
              {reading.headline}
            </h4>
          ) : null}
          {reading.summary ? (
            <p className="mt-2 text-[14px] leading-relaxed text-[#50465E]">{reading.summary}</p>
          ) : null}
          {reading.advice?.slice(0, 2).map((item) => (
            <div key={item} className="mt-2 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3 text-[13px] leading-relaxed text-[#3D3D3D]">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-[14px] bg-black/[0.04] p-4 text-[13px] text-[#68646e]">
          {language === 'ru' ? 'Контент готовится. Загляни чуть позже.' : 'Content is being prepared. Check back shortly.'}
        </p>
      )}
    </div>
  );
}

function FutureBody({
  score,
  illumination,
  moonLabel,
  moonMeaning,
  language,
}: {
  score: number;
  illumination: number;
  moonLabel: string;
  moonMeaning: string;
  language: 'ru' | 'en';
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-col items-center rounded-[20px] bg-[#F6F3FB] p-5">
        <RadialGauge value={score} size={120} stroke={12} color="#7B5CF6" track="#E7E0F2">
          <span className="font-lumiaHomeDisplay text-[30px] font-bold leading-none text-[#1E1230]">{score}%</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9A93A3]">
            {language === 'ru' ? 'благоприятность' : 'favorability'}
          </span>
        </RadialGauge>
        <p className="mt-3 text-[13px] font-semibold text-[#7B5CF6]">{moonLabel} · {illumination}%</p>
        <p className="mt-1 text-center text-[13px] leading-relaxed text-[#50465E]">{moonMeaning}</p>
      </div>
      <p className="mt-3 text-center text-[12px] leading-relaxed text-[#9A93A3]">
        {language === 'ru'
          ? 'Полный гороскоп на этот день раскроется, когда он наступит.'
          : 'The full horoscope unlocks once the day arrives.'}
      </p>
    </div>
  );
}

function LockedBody({
  score,
  moonLabel,
  language,
  onRequestPremium,
}: {
  score: number;
  moonLabel: string;
  language: 'ru' | 'en';
  onRequestPremium: () => void;
}) {
  return (
    <div className="mt-4">
      <div className="relative overflow-hidden rounded-[20px] bg-[#F6F3FB] p-5">
        <div className="flex items-center gap-4">
          <RadialGauge value={score} size={88} stroke={10} color="#7B5CF6" track="#E7E0F2">
            <Lock size={20} className="text-[#7B5CF6]" />
          </RadialGauge>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#7B5CF6]">{moonLabel}</p>
            {/* Blurred teaser lines */}
            <div className="mt-2 space-y-1.5 blur-[4px]" aria-hidden="true">
              <div className="h-3 w-full rounded-full bg-black/15" />
              <div className="h-3 w-4/5 rounded-full bg-black/10" />
              <div className="h-3 w-2/3 rounded-full bg-black/10" />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[13px] leading-relaxed text-[#50465E]">
        {language === 'ru'
          ? 'Гороскоп на любой день — в Premium. Сегодняшний всегда открыт.'
          : 'Any-day horoscope is in Premium. Today is always free.'}
      </p>
      <button
        type="button"
        onClick={onRequestPremium}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#7B5CF6] py-3.5 text-[14px] font-bold text-white"
      >
        <Sparkles size={16} />
        {language === 'ru' ? 'Открыть Premium' : 'Unlock Premium'}
      </button>
    </div>
  );
}

export function DaySheet({
  dateKey,
  todayKey,
  sign,
  language,
  isPremium,
  onClose,
  onRequestPremium,
}: DaySheetProps) {
  const open = !!dateKey;
  const isToday = dateKey === todayKey;
  const isFuture = !!dateKey && dateKey > todayKey;
  const locked = !!dateKey && !isPremium && !isToday;

  const [reading, setReading] = useState<ForecastDailyReading | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only fetch a real reading for an unlocked past/today day.
    if (!dateKey || locked || isFuture || !sign) {
      setReading(null);
      return;
    }
    let alive = true;
    setReading(null);
    setLoading(true);
    void getCachedDailySignHoroscope(sign, dateKey, language)
      .then((cached) => cached || ensureDailySignHoroscope(sign, dateKey, language))
      .then((r) => { if (alive) setReading(r); })
      .catch(() => { if (alive) setReading(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [dateKey, locked, isFuture, sign, language]);

  const fav = dateKey ? getDayFavorability(sign, dateKey) : null;

  const heading = locked
    ? (language === 'ru' ? 'День под замком' : 'Locked day')
    : isFuture
    ? (language === 'ru' ? 'День впереди' : 'Day ahead')
    : (language === 'ru' ? 'Гороскоп на день' : 'Daily horoscope');

  return (
    <AnimatePresence>
      {open && fav && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[25rem] rounded-t-[28px] bg-white px-5 pt-3 font-sans"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9A93A3]">
                  {dateKey ? formatLumiaDate(dateKey, language) : ''}
                </p>
                <h3 className="mt-1 font-lumiaHomeDisplay text-[22px] font-bold text-[#1E1230]">{heading}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[#1E1230]"
              >
                <X size={18} />
              </button>
            </div>

            {locked ? (
              <LockedBody score={fav.score} moonLabel={fav.moonLabel} language={language} onRequestPremium={onRequestPremium} />
            ) : isFuture ? (
              <FutureBody
                score={fav.score}
                illumination={fav.illumination}
                moonLabel={fav.moonLabel}
                moonMeaning={fav.moonMeaning}
                language={language}
              />
            ) : (
              <ReadingBody
                loading={loading}
                reading={reading}
                favIllum={fav.illumination}
                moonLabel={fav.moonShort}
                language={language}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
