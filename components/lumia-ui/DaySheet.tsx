import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import type { ForecastDailyReading } from '../../types';
import { formatLumiaDate } from '../../lib/date-utils';
import { getCachedDailySignHoroscope, ensureDailySignHoroscope } from '../../services/astrologyService';

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
    // Only an unlocked past/today day shows a real reading.
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

  const heading = locked
    ? (language === 'ru' ? 'День под замком' : 'Locked day')
    : isFuture
    ? (language === 'ru' ? 'День впереди' : 'Day ahead')
    : (language === 'ru' ? 'Гороскоп на день' : 'Daily horoscope');

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[88dvh] w-full max-w-[30rem] flex-col overflow-y-auto rounded-t-[24px] bg-white px-5 pt-3 font-sans"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
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
              <div className="mt-4">
                <p className="text-[14px] leading-relaxed text-[#50465E]">
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
            ) : isFuture ? (
              <p className="mt-4 rounded-[16px] bg-black/[0.04] p-4 text-[14px] leading-relaxed text-[#50465E]">
                {language === 'ru'
                  ? 'Прогноз на этот день появится, когда он наступит.'
                  : 'The forecast appears once the day arrives.'}
              </p>
            ) : loading ? (
              <div className="mt-4 space-y-2" aria-busy="true">
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-black/10" />
                <div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-black/10" />
              </div>
            ) : reading ? (
              <div className="mt-4">
                {reading.headline ? (
                  <h4 className="font-lumiaHomeDisplay text-[18px] font-bold leading-snug text-[#1E1230]">{reading.headline}</h4>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
