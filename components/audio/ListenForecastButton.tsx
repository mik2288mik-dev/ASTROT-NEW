import React, { useEffect, useState } from 'react';
import { Headphones, LoaderCircle, LockKeyhole } from 'lucide-react';
import { playSpeech, playTrack, togglePlayback, unlockPlayback, useAudioPlayback } from '../../services/audioPlayback';
import { speechAvailable } from '../../services/speechEngine';
import { requestListen } from '../../services/listenService';
import { AudioMiniPlayer } from './AudioMiniPlayer';

type ListenForecastButtonProps = {
  /** Stable key of the reading, e.g. «forecast:day:2026-10-04». */
  trackKey: string;
  period: 'day' | 'week' | 'month';
  /** Key of the reading's period, e.g. «2026-10-04», «2026-W40», «2026-10». */
  periodKey: string;
  /** The text to read: built from the reading already on screen. */
  text: string;
  language: 'ru' | 'en';
  premium: boolean;
  /** Opens NEBO Premium for people without it (omit when promotion is not allowed). */
  onRequestPremium?: () => void;
};

const LABELS = {
  day: { ru: 'Слушать прогноз', en: 'Listen to the forecast' },
  week: { ru: 'Слушать неделю', en: 'Listen to the week' },
  month: { ru: 'Слушать месяц', en: 'Listen to the month' },
} as const;

/**
 * «Слушать прогноз». NEBO Premium hears a natural studio voice (OpenAI, voiced once
 * on the server and cached); everyone else hears the phone's own voice, free
 * and offline. If the studio voice fails, the phone's voice reads instead.
 */
export function ListenForecastButton({ trackKey, period, periodKey, text, language, premium, onRequestPremium }: ListenForecastButtonProps) {
  const playback = useAudioPlayback();
  const [deviceVoice, setDeviceVoice] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const active = playback.trackKey === trackKey;
  const title = LABELS[period][language];

  useEffect(() => {
    let alive = true;
    void speechAvailable(language).then((value) => { if (alive) setDeviceVoice(value); });
    return () => { alive = false; };
  }, [language]);

  if (!text.trim()) return null;
  // Without NEBO Premium and without a phone voice there is nothing to play; offer NEBO Premium if allowed.
  if (!premium && !deviceVoice && !onRequestPremium) return null;

  const readWithDeviceVoice = () => playSpeech({ trackKey, title, text, language });

  const start = async () => {
    if (active) {
      togglePlayback();
      return;
    }
    if (!premium) {
      if (deviceVoice) readWithDeviceVoice();
      else onRequestPremium?.();
      return;
    }
    // Must run inside the tap, before the network request.
    unlockPlayback();
    setPreparing(true);
    try {
      const ticket = await requestListen({ type: 'personal_forecast', period, periodKey });
      playTrack({ trackKey, src: ticket.src, title, durationHint: ticket.durationSec });
    } catch {
      if (deviceVoice) readWithDeviceVoice();
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="listen-forecast">
      {!active ? (
        <button type="button" className="listen-forecast-button" onClick={() => { void start(); }} disabled={preparing}>
          {preparing
            ? <LoaderCircle className="audio-mini-player-spinner" size={18} aria-hidden="true" />
            : !premium && !deviceVoice ? <LockKeyhole size={16} aria-hidden="true" /> : <Headphones size={18} aria-hidden="true" />}
          <span>{preparing ? (language === 'ru' ? 'Готовлю голос…' : 'Preparing the voice…') : title}</span>
          {!premium && !deviceVoice ? <small>Premium</small> : null}
        </button>
      ) : null}
      <AudioMiniPlayer trackKey={trackKey} language={language} />
    </div>
  );
}
