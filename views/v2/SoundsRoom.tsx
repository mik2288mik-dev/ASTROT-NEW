import React, { useEffect, useState } from 'react';
import { Headphones, LoaderCircle, Lock, Pause, Play, Square } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { AssetSlot } from '../../components/lumia-ui/AssetSlot';
import { AudioMiniPlayer } from '../../components/audio/AudioMiniPlayer';
import { hasActivePremium } from '../../lib/accessMatrix';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { MUSIC_PIECES, SOUNDSCAPES, type MusicPiece, type Soundscape } from '../../lib/soundscapes/synth';
import { SLEEP_STORIES, type SleepStory } from '../../lib/sleepStories';
import { playMusic, playSoundscape, setAmbientTimer, stopAmbient, useAmbientState } from '../../services/ambientPlayer';
import { pausePlayback, playTrack, setSleepTimer, togglePlayback, unlockPlayback, useAudioPlayback } from '../../services/audioPlayback';
import { requestListen } from '../../services/listenService';
import { estimateSpeechSeconds } from '../../lib/tts/openaiSpeech';

const SOUND_LABELS: Record<Soundscape, { ru: string; en: string }> = {
  rain: { ru: 'Дождь', en: 'Rain' },
  cafe: { ru: 'Кафе', en: 'Café' },
  forest: { ru: 'Лес', en: 'Forest' },
  sea: { ru: 'Море', en: 'Sea' },
  fire: { ru: 'Камин', en: 'Fireplace' },
};

const MUSIC_LABELS: Record<MusicPiece, { title: { ru: string; en: string }; note: { ru: string; en: string } }> = {
  morning: { title: { ru: 'Тихое утро', en: 'Quiet morning' }, note: { ru: 'светлые долгие аккорды', en: 'bright, long chords' } },
  evening: { title: { ru: 'Вечерний свет', en: 'Evening light' }, note: { ru: 'мягко и немного грустно', en: 'soft and a little wistful' } },
  waves: { title: { ru: 'Медленные волны', en: 'Slow waves' }, note: { ru: 'очень медленно, для засыпания', en: 'very slow, for falling asleep' } },
};

export const SOUND_IMAGES: Record<Soundscape, string> = {
  rain: '/assets/sounds/rain.webp',
  cafe: '/assets/sounds/cafe.webp',
  forest: '/assets/sounds/forest.webp',
  sea: '/assets/sounds/sea.webp',
  fire: '/assets/sounds/fire.webp',
};

const BREATH = { inhale: 4, exhale: 6 };
const PAUSE_SECONDS = 180;

function clock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** «Пауза на 3 минуты»: a slow breathing rhythm with a calm sound. */
function BreathingPause({ language, soundscape, onSoundChange }: { language: 'ru' | 'en'; soundscape: Soundscape; onSoundChange: (value: Soundscape) => void }) {
  const ru = language === 'ru';
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const done = startedAt !== null && elapsed >= PAUSE_SECONDS;
  useEffect(() => {
    if (done) setStartedAt(null);
  }, [done]);

  const cycle = BREATH.inhale + BREATH.exhale;
  const inCycle = elapsed % cycle;
  const inhaling = inCycle < BREATH.inhale;
  const left = inhaling ? BREATH.inhale - inCycle : cycle - inCycle;

  const start = () => {
    lumiaSelectionHaptic();
    playSoundscape(soundscape);
    setAmbientTimer(PAUSE_SECONDS / 60);
    setStartedAt(Date.now());
    setNow(Date.now());
  };
  const stop = () => {
    lumiaSelectionHaptic();
    stopAmbient();
    setStartedAt(null);
  };

  return (
    <section className="sounds-pause" aria-labelledby="sounds-pause-title">
      <h2 id="sounds-pause-title">{ru ? 'Пауза на 3 минуты' : 'A 3-minute pause'}</h2>
      <p>{ru ? 'Вдох на четыре счёта, выдох на шесть. Просто следи за кругом.' : 'Breathe in for four, out for six. Just follow the circle.'}</p>
      <div className={`sounds-breath${startedAt ? (inhaling ? ' is-inhale' : ' is-exhale') : ''}`} aria-live="polite">
        <span className="sounds-breath-circle" aria-hidden="true" />
        <span className="sounds-breath-label">
          {startedAt
            ? <><strong>{inhaling ? (ru ? 'Вдох' : 'Breathe in') : (ru ? 'Выдох' : 'Breathe out')}</strong><small>{Math.ceil(left)}</small></>
            : <strong>{ru ? 'Начнём?' : 'Shall we start?'}</strong>}
        </span>
      </div>
      {startedAt ? <p className="sounds-pause-left">{ru ? `Осталось ${clock(PAUSE_SECONDS - elapsed)}` : `${clock(PAUSE_SECONDS - elapsed)} left`}</p> : null}
      <div className="sounds-chips" role="radiogroup" aria-label={ru ? 'Звук для паузы' : 'Sound for the pause'}>
        {SOUNDSCAPES.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={soundscape === kind}
            className={`sounds-chip${soundscape === kind ? ' is-active' : ''}`}
            onClick={() => { onSoundChange(kind); if (startedAt) playSoundscape(kind); }}
          >
            {SOUND_LABELS[kind][language]}
          </button>
        ))}
      </div>
      <button type="button" className="sounds-primary" onClick={startedAt ? stop : start}>
        {startedAt ? (ru ? 'Закончить' : 'Finish') : (ru ? 'Начать паузу' : 'Start the pause')}
      </button>
    </section>
  );
}

type SoundsRoomProps = {
  profile: UserProfile;
  onBack: () => void;
  onRequestPremium?: () => void;
};

/** «Звуки»: breathing pause, calm sounds with a timer, music and stories for sleep. */
export function SoundsRoom({ profile, onBack, onRequestPremium }: SoundsRoomProps) {
  const ru = profile.language !== 'en';
  const language: 'ru' | 'en' = ru ? 'ru' : 'en';
  const premium = hasActivePremium(profile);
  const ambient = useAmbientState();
  const playback = useAudioPlayback();
  const [pauseSound, setPauseSound] = useState<Soundscape>('rain');
  const [storyPhase, setStoryPhase] = useState<{ id: string; state: 'preparing' | 'error' } | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);

  const playStory = async (story: SleepStory) => {
    lumiaSelectionHaptic();
    if (!story.free && !premium) {
      onRequestPremium?.();
      return;
    }
    const trackKey = `story:${story.id}:${language}`;
    if (playback.trackKey === trackKey) {
      togglePlayback();
      return;
    }
    unlockPlayback();
    stopAmbient();
    setStoryPhase({ id: story.id, state: 'preparing' });
    try {
      const ticket = await requestListen({ type: 'sleep_story', id: story.id, language });
      playTrack({ trackKey, src: ticket.src, title: story.title[language], durationHint: ticket.durationSec });
      setStoryPhase(null);
    } catch {
      setStoryPhase({ id: story.id, state: 'error' });
    }
  };

  if (!ambient.supported) {
    return (
      <div className="fresh-page sounds-room">
        <AppTopBar title={ru ? 'Звуки' : 'Sounds'} onBack={onBack} />
        <p className="sounds-note">{ru ? 'Это устройство не умеет воспроизводить звуки в приложении.' : 'This device cannot play sounds in the app.'}</p>
      </div>
    );
  }

  const timerOptions: Array<number | null> = [5, 10, 20, null];

  return (
    <div className="fresh-page sounds-room">
      <AppTopBar title={ru ? 'Звуки' : 'Sounds'} onBack={onBack} />
      <BreathingPause language={language} soundscape={pauseSound} onSoundChange={setPauseSound} />

      <section className="sounds-section" aria-labelledby="sounds-scapes-title">
        <h2 id="sounds-scapes-title">{ru ? 'Спокойные звуки' : 'Calm sounds'}</h2>
        <div className="sounds-grid">
          {SOUNDSCAPES.map((kind) => {
            const active = ambient.soundscape === kind;
            return (
              <button
                key={kind}
                type="button"
                className={`sounds-tile${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => { lumiaSelectionHaptic(); if (!active) pausePlayback(); playSoundscape(active ? null : kind); }}
              >
                <AssetSlot src={SOUND_IMAGES[kind]} className="sounds-tile-art" />
                <span>{SOUND_LABELS[kind][language]}</span>
                {active ? <Pause className="sounds-tile-state" size={16} aria-hidden="true" /> : <Play className="sounds-tile-state" size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="sounds-section" aria-labelledby="sounds-music-title">
        <h2 id="sounds-music-title">{ru ? 'Спокойная музыка' : 'Calm music'}</h2>
        <p className="sounds-note">{ru ? 'Мелодия каждый раз складывается заново — можно включить вместе со звуком.' : 'The melody is composed anew each time — you can mix it with a sound.'}</p>
        <ul className="sounds-list">
          {MUSIC_PIECES.map((piece) => {
            const active = ambient.music === piece;
            return (
              <li key={piece}>
                <button type="button" className={`sounds-row${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => { lumiaSelectionHaptic(); if (!active) pausePlayback(); playMusic(active ? null : piece); }}>
                  <span className="sounds-row-icon" aria-hidden="true">{active ? <Pause size={16} /> : <Play size={16} />}</span>
                  <span className="sounds-row-copy"><strong>{MUSIC_LABELS[piece].title[language]}</strong><small>{MUSIC_LABELS[piece].note[language]}</small></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {ambient.soundscape || ambient.music ? (
        <section className="sounds-timer" aria-label={ru ? 'Таймер' : 'Timer'}>
          <span>{ambient.endsAt ? (ru ? `Выключится в ${new Date(ambient.endsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : `Stops at ${new Date(ambient.endsAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`) : (ru ? 'Таймер' : 'Timer')}</span>
          <div className="sounds-chips">
            {timerOptions.map((minutes) => (
              <button
                key={String(minutes)}
                type="button"
                className={`sounds-chip${ambient.timerMinutes === minutes ? ' is-active' : ''}`}
                aria-pressed={ambient.timerMinutes === minutes}
                onClick={() => setAmbientTimer(minutes)}
              >
                {minutes ? (ru ? `${minutes} мин` : `${minutes} min`) : (ru ? 'Без таймера' : 'No timer')}
              </button>
            ))}
          </div>
          <button type="button" className="sounds-stop" onClick={stopAmbient}><Square size={14} aria-hidden="true" />{ru ? 'Выключить' : 'Stop'}</button>
        </section>
      ) : null}

      <section className="sounds-section" aria-labelledby="sounds-stories-title">
        <h2 id="sounds-stories-title">{ru ? 'Истории для сна и для успокоения' : 'Stories for sleep and calm'}</h2>
        <ul className="sounds-stories">
          {SLEEP_STORIES.map((story) => {
            const locked = !story.free && !premium;
            const trackKey = `story:${story.id}:${language}`;
            const playing = playback.trackKey === trackKey;
            const phase = storyPhase?.id === story.id ? storyPhase.state : null;
            return (
              <li key={story.id} className={`sounds-story${playing ? ' is-active' : ''}`}>
                <button type="button" className="sounds-story-main" onClick={() => { void playStory(story); }} disabled={phase === 'preparing'}>
                  <span className="sounds-row-icon" aria-hidden="true">
                    {phase === 'preparing' ? <LoaderCircle className="audio-mini-player-spinner" size={16} /> : locked ? <Lock size={15} /> : playing && playback.playing ? <Pause size={16} /> : <Headphones size={16} />}
                  </span>
                  <span className="sounds-row-copy">
                    <strong>{story.title[language]}</strong>
                    <small>{story.teaser[language]}</small>
                    <em>{`${Math.round(estimateSpeechSeconds(story.text[language], 'sleep') / 60)} ${ru ? 'мин' : 'min'} · ${story.voiceLabel[language]}${story.kind === 'calm' ? (ru ? ' · днём' : ' · daytime') : ''}${locked ? ' · NEBO+' : ''}`}</em>
                  </span>
                </button>
                {phase === 'error' ? <p className="listen-forecast-error" role="alert">{ru ? 'Голос пока не готов. Попробуй ещё раз через минуту.' : 'The voice is not ready yet. Try again in a minute.'}</p> : null}
                {playing ? (
                  <>
                    <AudioMiniPlayer trackKey={trackKey} language={language} />
                    <div className="sounds-chips sounds-sleep-timer" aria-label={ru ? 'Таймер сна' : 'Sleep timer'}>
                      {[15, 30, null].map((minutes) => (
                        <button
                          key={String(minutes)}
                          type="button"
                          className={`sounds-chip${(minutes === null ? playback.sleepAt === null : playback.sleepAt !== null && sleepMinutes === minutes) ? ' is-active' : ''}`}
                          aria-pressed={minutes === null ? playback.sleepAt === null : playback.sleepAt !== null && sleepMinutes === minutes}
                          onClick={() => { setSleepMinutes(minutes); setSleepTimer(minutes); }}
                        >
                          {minutes ? (ru ? `Уснуть через ${minutes} мин` : `Sleep in ${minutes} min`) : (ru ? 'До конца истории' : 'Till the end')}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="sounds-note sounds-note--bottom">{ru ? 'Звуки и музыка складываются прямо в телефоне — работают без интернета.' : 'Sounds and music are made right on the phone — they work offline.'}</p>
    </div>
  );
}
