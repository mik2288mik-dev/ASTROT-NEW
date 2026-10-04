import React, { useEffect, useState } from 'react';
import { Headphones, LockKeyhole } from 'lucide-react';
import { playSpeech, togglePlayback, useAudioPlayback } from '../../services/audioPlayback';
import { speechAvailable } from '../../services/speechEngine';
import { AudioMiniPlayer } from './AudioMiniPlayer';

type ListenForecastButtonProps = {
  /** Stable key of the reading, e.g. «forecast:day:2026-10-04». */
  trackKey: string;
  period: 'day' | 'week' | 'month';
  /** The text to read: built from the reading already on screen. */
  text: string;
  language: 'ru' | 'en';
  premium: boolean;
  /** Opens NEBO+ for people without it (omit when promotion is not allowed). */
  onRequestPremium?: () => void;
};

const LABELS = {
  day: { ru: 'Слушать прогноз', en: 'Listen to the forecast' },
  week: { ru: 'Слушать неделю', en: 'Listen to the week' },
  month: { ru: 'Слушать месяц', en: 'Listen to the month' },
} as const;

/**
 * «Слушать прогноз»: the phone's own voice reads the reading — free, offline,
 * with the mini player and lock-screen buttons. Hidden where no voice exists.
 */
export function ListenForecastButton({ trackKey, period, text, language, premium, onRequestPremium }: ListenForecastButtonProps) {
  const playback = useAudioPlayback();
  const [available, setAvailable] = useState(false);
  const active = playback.trackKey === trackKey;

  useEffect(() => {
    let alive = true;
    void speechAvailable(language).then((value) => { if (alive) setAvailable(value); });
    return () => { alive = false; };
  }, [language]);

  if (!available || !text.trim() || (!premium && !onRequestPremium)) return null;

  const start = () => {
    if (!premium) {
      onRequestPremium?.();
      return;
    }
    if (active) {
      togglePlayback();
      return;
    }
    playSpeech({ trackKey, title: LABELS[period][language], text, language });
  };

  return (
    <div className="listen-forecast">
      {!active ? (
        <button type="button" className="listen-forecast-button" onClick={start}>
          {premium ? <Headphones size={18} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
          <span>{LABELS[period][language]}</span>
          {!premium ? <small>NEBO+</small> : null}
        </button>
      ) : null}
      <AudioMiniPlayer trackKey={trackKey} language={language} />
    </div>
  );
}
