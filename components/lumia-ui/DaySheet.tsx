import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { SignHoroscopeReadingV2 } from '../../types';
import { formatDisplayDate } from '../../lib/date-utils';
import { getCachedDailySignHoroscope, ensureDailySignHoroscope } from '../../services/astrologyService';
import { CosmicSheet } from './CosmicSheet';

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

  const [reading, setReading] = useState<SignHoroscopeReadingV2 | null>(null);
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

  return (
    <CosmicSheet
      open={open}
      title={heading}
      subtitle={dateKey ? formatDisplayDate(dateKey, language) : undefined}
      closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
      className="day-sheet-cosmic"
      contentClassName="day-sheet-cosmic-content"
      onClose={onClose}
    >
            {locked ? (
              <div className="day-sheet-state">
                <p>
                  {language === 'ru'
                    ? 'Гороскоп на любой день — в Premium. Сегодняшний всегда открыт.'
                    : 'Any-day horoscope is in Premium. Today is always free.'}
                </p>
                <button
                  type="button"
                  onClick={onRequestPremium}
                  className="day-sheet-primary-action"
                >
                  <Sparkles size={16} />
                  {language === 'ru' ? 'Открыть Premium' : 'Unlock Premium'}
                </button>
              </div>
            ) : isFuture ? (
              <p className="day-sheet-state">
                {language === 'ru'
                  ? 'Прогноз на этот день появится, когда он наступит.'
                  : 'The forecast appears once the day arrives.'}
              </p>
            ) : loading ? (
              <div className="day-sheet-loading" aria-busy="true">
                <div />
                <div />
                <div />
              </div>
            ) : reading ? (
              <div className="day-sheet-reading">
                {reading.headline ? (
                  <h4>{reading.headline}</h4>
                ) : null}
                <p>{reading.mood.text}</p>
                <div className="day-sheet-advice">{reading.advice.text}</div>
              </div>
            ) : (
              <p className="day-sheet-state">
                {language === 'ru' ? 'Контент готовится. Загляни чуть позже.' : 'Content is being prepared. Check back shortly.'}
              </p>
            )}
    </CosmicSheet>
  );
}
