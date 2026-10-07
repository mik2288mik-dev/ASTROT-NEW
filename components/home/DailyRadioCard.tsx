import React, { useState } from 'react';
import { BookOpen, Headphones, LoaderCircle, LockKeyhole, Radio } from 'lucide-react';
import { playTrack, togglePlayback, unlockPlayback, useAudioPlayback } from '../../services/audioPlayback';
import { loadRadioText, requestListen } from '../../services/listenService';
import { AudioMiniPlayer } from '../audio/AudioMiniPlayer';

type DailyRadioCardProps = {
  todayKey: string;
  language: 'ru' | 'en';
  premium: boolean;
  /** Opens NEBO Premium for people without it. */
  onRequestPremium?: () => void;
};

/**
 * «Радио NEBO»: the whole day in one issue, like the morning news on the radio: the Moon and the sky, your
 * forecast, your sign, the question of the day. With NEBO Premium it is read by the studio voice, or can be read
 * as text. Without it the card says what is inside and opens NEBO Premium.
 */
export function DailyRadioCard({ todayKey, language, premium, onRequestPremium }: DailyRadioCardProps) {
  const ru = language === 'ru';
  const playback = useAudioPlayback();
  const trackKey = `radio:${todayKey}`;
  const active = playback.trackKey === trackKey;
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [loadingText, setLoadingText] = useState(false);

  const listen = async () => {
    if (!premium) {
      onRequestPremium?.();
      return;
    }
    if (active) {
      togglePlayback();
      return;
    }
    setError(false);
    // Must run inside the tap, before the network request.
    unlockPlayback();
    setPreparing(true);
    try {
      const ticket = await requestListen({ type: 'daily_radio', dayKey: todayKey });
      playTrack({ trackKey, src: ticket.src, title: ru ? 'Радио NEBO' : 'NEBO Radio', durationHint: ticket.durationSec });
    } catch {
      setError(true);
    } finally {
      setPreparing(false);
    }
  };

  const toggleReading = async () => {
    if (!premium) {
      onRequestPremium?.();
      return;
    }
    if (reading) {
      setReading(false);
      return;
    }
    setReading(true);
    if (text !== null) return;
    setError(false);
    setLoadingText(true);
    try {
      setText(await loadRadioText());
    } catch {
      setReading(false);
      setError(true);
    } finally {
      setLoadingText(false);
    }
  };

  return (
    <section className="radio-card" aria-labelledby="radio-card-title">
      <span className="radio-card-glow" aria-hidden="true" />
      <div className="radio-card-head">
        <span className="radio-card-icon" aria-hidden="true"><Radio size={22} strokeWidth={2} /></span>
        <div>
          <h2 id="radio-card-title">{ru ? 'Радио NEBO' : 'NEBO Radio'}</h2>
          <p>{ru ? 'Твой день вслух: гороскоп, Луна, вопрос дня' : 'Your day aloud: horoscope, the Moon, the question of the day'}</p>
        </div>
      </div>
      <ul className="radio-card-list">
        <li>{ru ? 'Небо сегодня и Луна' : 'The sky and the Moon today'}</li>
        <li>{ru ? 'Твой личный прогноз' : 'Your personal forecast'}</li>
        <li>{ru ? 'Гороскоп твоего знака' : 'Your sign’s horoscope'}</li>
        <li>{ru ? 'Вопрос дня' : 'The question of the day'}</li>
      </ul>
      <div className="radio-card-actions">
        <button type="button" className="radio-card-primary" onClick={() => { void listen(); }} disabled={preparing}>
          {preparing
            ? <LoaderCircle className="audio-mini-player-spinner" size={18} aria-hidden="true" />
            : premium ? <Headphones size={18} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
          <span>{preparing ? (ru ? 'Готовим эфир…' : 'Preparing the show…') : (ru ? 'Слушать эфир' : 'Listen')}</span>
        </button>
        <button type="button" className="radio-card-secondary" onClick={() => { void toggleReading(); }} aria-expanded={reading}>
          {premium ? <BookOpen size={17} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}
          <span>{reading ? (ru ? 'Свернуть' : 'Hide') : (ru ? 'Читать' : 'Read')}</span>
        </button>
      </div>
      {!premium ? (
        <div className="radio-card-sample" aria-label={ru ? 'Пример выпуска' : 'A sample issue'}>
          <small>{ru ? 'Так выглядит выпуск (пример)' : 'What an issue looks like (sample)'}</small>
          <p>{ru ? 'Привет. Это Радио NEBO, твой день вслух. Начнём с неба: Луна идёт к полнолунию, и настроение набирает силу.' : 'Hi. This is NEBO Radio, your day aloud. First, the sky: the Moon is heading to full, and moods are gathering strength.'}</p>
          <p>{ru ? 'Теперь про тебя лично. Сегодня лучше начать с главного дела, а мелочи оставить на вечер.' : 'Now about you. Today start with the main thing and leave the small stuff for the evening.'}</p>
          <p>{ru ? 'А вот что звёзды говорят твоему знаку, и вопрос дня: что у тебя сегодня на ужин?' : 'And what the stars say to your sign, then the question of the day: what is for dinner tonight?'}</p>
        </div>
      ) : null}
      {!premium ? (
        <p className="radio-card-note">{ru ? 'С NEBO Premium весь день расскажет живой голос диктора, или можно прочитать текстом.' : 'With NEBO Premium a natural narrator tells your whole day, or you can read it.'}</p>
      ) : null}
      {error ? <p className="radio-card-note is-error" role="alert">{ru ? 'Эфир пока не готов. Попробуй чуть позже.' : 'The show is not ready yet. Try again a bit later.'}</p> : null}
      {premium ? <AudioMiniPlayer trackKey={trackKey} language={language} /> : null}
      {reading ? (
        <div className="radio-card-text" aria-live="polite">
          {loadingText || text === null
            ? <p><LoaderCircle className="audio-mini-player-spinner" size={16} aria-hidden="true" /> {ru ? 'Собираем выпуск…' : 'Putting the issue together…'}</p>
            : text.split(/\n{2,}/).map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}
        </div>
      ) : null}
    </section>
  );
}
