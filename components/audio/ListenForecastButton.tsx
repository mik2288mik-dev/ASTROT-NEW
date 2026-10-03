import React, { useState } from 'react';
import { Headphones, LoaderCircle, LockKeyhole } from 'lucide-react';
import { requestListen, type ListenSource } from '../../services/listenService';

type ForecastListenSource = Extract<ListenSource, { type: 'personal_forecast' }>;
import { playTrack, togglePlayback, unlockPlayback, useAudioPlayback } from '../../services/audioPlayback';
import { AudioMiniPlayer } from './AudioMiniPlayer';

type ListenForecastButtonProps = {
  source: ForecastListenSource;
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

/** «Слушать прогноз»: NEBO+ voice of the reading with a mini player. */
export function ListenForecastButton({ source, language, premium, onRequestPremium }: ListenForecastButtonProps) {
  const ru = language === 'ru';
  const trackKey = `forecast:${source.period}:${source.periodKey}`;
  const playback = useAudioPlayback();
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'error'>('idle');
  const active = playback.trackKey === trackKey;

  if (!premium && !onRequestPremium) return null;

  const start = async () => {
    if (!premium) {
      onRequestPremium?.();
      return;
    }
    if (active) {
      togglePlayback();
      return;
    }
    unlockPlayback();
    setPhase('preparing');
    try {
      const ticket = await requestListen(source);
      playTrack({ trackKey, src: ticket.src, title: LABELS[source.period][language], durationHint: ticket.durationSec });
      setPhase('idle');
    } catch {
      setPhase('error');
    }
  };

  return (
    <div className="listen-forecast">
      {!active ? (
        <button type="button" className="listen-forecast-button" onClick={() => { void start(); }} disabled={phase === 'preparing'}>
          {phase === 'preparing'
            ? <LoaderCircle className="audio-mini-player-spinner" size={18} aria-hidden="true" />
            : premium ? <Headphones size={18} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
          <span>
            {phase === 'preparing'
              ? (ru ? 'Готовим голос — несколько секунд' : 'Preparing the voice — a few seconds')
              : LABELS[source.period][language]}
          </span>
          {!premium ? <small>NEBO+</small> : null}
        </button>
      ) : null}
      {phase === 'error' ? (
        <p className="listen-forecast-error" role="alert">
          {ru ? 'Голос пока не готов. Попробуй ещё раз через минуту.' : 'The voice is not ready yet. Try again in a minute.'}
        </p>
      ) : null}
      <AudioMiniPlayer trackKey={trackKey} language={language} />
    </div>
  );
}
