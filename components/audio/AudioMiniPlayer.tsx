import React from 'react';
import { LoaderCircle, Pause, Play, RotateCcw, RotateCw, X } from 'lucide-react';
import { seekBy, seekTo, setPlaybackRate, stopPlayback, togglePlayback, useAudioPlayback } from '../../services/audioPlayback';

const RATES = [1, 1.25, 1.5, 0.85] as const;

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Pause, 15-second steps, a seek bar, speed and close for the track `trackKey`. */
export function AudioMiniPlayer({ trackKey, language }: { trackKey: string; language: 'ru' | 'en' }) {
  const playback = useAudioPlayback();
  if (playback.trackKey !== trackKey) return null;
  const ru = language === 'ru';
  const duration = playback.duration || 0;
  const nextRate = RATES[(RATES.indexOf(playback.rate as typeof RATES[number]) + 1) % RATES.length] ?? 1;

  return (
    <div className="audio-mini-player" role="group" aria-label={ru ? 'Плеер' : 'Player'}>
      <button type="button" className="audio-mini-player-close" onClick={stopPlayback} aria-label={ru ? 'Закрыть плеер' : 'Close the player'}>
        <X size={16} aria-hidden="true" />
      </button>
      <div className="audio-mini-player-controls">
        <button type="button" className="audio-mini-player-step" onClick={() => seekBy(-15)} aria-label={ru ? 'Назад на 15 секунд' : 'Back 15 seconds'}>
          <RotateCcw size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="audio-mini-player-play"
          onClick={togglePlayback}
          aria-label={playback.playing ? (ru ? 'Пауза' : 'Pause') : (ru ? 'Слушать' : 'Play')}
        >
          {playback.loading && !playback.playing
            ? <LoaderCircle className="audio-mini-player-spinner" size={22} aria-hidden="true" />
            : playback.playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
        </button>
        <button type="button" className="audio-mini-player-step" onClick={() => seekBy(15)} aria-label={ru ? 'Вперёд на 15 секунд' : 'Forward 15 seconds'}>
          <RotateCw size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="audio-mini-player-rate"
          onClick={() => setPlaybackRate(nextRate)}
          aria-label={ru ? `Скорость ${playback.rate}, переключить на ${nextRate}` : `Speed ${playback.rate}, switch to ${nextRate}`}
        >
          {`${String(playback.rate).replace('.', ru ? ',' : '.')}×`}
        </button>
      </div>
      <div className="audio-mini-player-timeline">
        <span>{clock(playback.currentTime)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(duration))}
          step={1}
          value={Math.min(Math.round(playback.currentTime), Math.round(duration) || 0)}
          aria-label={ru ? 'Перемотка' : 'Seek'}
          onChange={(event) => seekTo(Number(event.target.value))}
        />
        <span>{clock(duration)}</span>
      </div>
      {playback.error ? (
        <p className="audio-mini-player-error" role="alert">
          {playback.src === null
            ? (ru ? 'Голос телефона не ответил. Проверь в настройках Android, что синтез речи включён.' : 'The phone voice did not respond. Check text-to-speech in the device settings.')
            : (ru ? 'Не получилось включить звук. Проверь соединение и нажми ещё раз.' : 'Could not play the audio. Check the connection and tap again.')}
        </p>
      ) : null}
    </div>
  );
}
