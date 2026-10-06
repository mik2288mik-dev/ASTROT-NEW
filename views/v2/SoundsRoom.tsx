import React, { useState } from 'react';
import { Headphones, LoaderCircle, Lock, Pause, Play, Square } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { VideoBackground } from '../../components/lumia-ui/VideoBackground';
import { AssetSlot } from '../../components/lumia-ui/AssetSlot';
import { AudioMiniPlayer } from '../../components/audio/AudioMiniPlayer';
import { hasActivePremium } from '../../lib/accessMatrix';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  MUSIC_TRACKS,
  SOUND_GROUP_LABELS,
  SOUND_GROUPS,
  findAmbientTrack,
  tracksOfGroup,
  type SoundGroup,
} from '../../lib/soundscapes/library';
import { SLEEP_STORIES, type SleepStory } from '../../lib/sleepStories';
import { videoBackgroundPoster, type VideoBackgroundId } from '../../lib/videoBackgrounds';
import { playMusic, playSoundscape, setAmbientTimer, setMusicQueue, stopAmbient, useAmbientState } from '../../services/ambientPlayer';
import { pausePlayback, playTrack, setSleepTimer, togglePlayback, unlockPlayback, useAudioPlayback } from '../../services/audioPlayback';
import { requestListen } from '../../services/listenService';
import { estimateSpeechSeconds } from '../../lib/tts/openaiSpeech';

export const SOUND_IMAGES: Record<SoundGroup, string> = {
  rain: videoBackgroundPoster('sounds-rain'),
  forest: videoBackgroundPoster('sounds-forest'),
  stream: videoBackgroundPoster('sounds-stream'),
  sea: videoBackgroundPoster('sounds-sea'),
  fire: videoBackgroundPoster('sounds-fire'),
  cafe: videoBackgroundPoster('sounds-cafe'),
  night: videoBackgroundPoster('sounds-night'),
};

const SOUND_VIDEOS: Record<SoundGroup, VideoBackgroundId> = {
  rain: 'sounds-rain',
  forest: 'sounds-forest',
  stream: 'sounds-stream',
  sea: 'sounds-sea',
  fire: 'sounds-fire',
  cafe: 'sounds-cafe',
  night: 'sounds-night',
};

const STORY_VIDEOS: Record<string, VideoBackgroundId> = {
  'sea-house': 'sleep-sea-house',
  'night-train': 'sleep-night-train',
  'garden-rain': 'sleep-garden-rain',
};

const RECORDED_MUSIC = MUSIC_TRACKS.filter((track) => track.kind === 'file').map((track) => track.id);
// A recorded piece flows into the next one, like a calm playlist.
setMusicQueue((id) => {
  const index = RECORDED_MUSIC.indexOf(id);
  return index === -1 ? null : RECORDED_MUSIC[(index + 1) % RECORDED_MUSIC.length];
});

function groupOf(trackId: string | null): SoundGroup | null {
  return trackId ? findAmbientTrack(trackId)?.group ?? null : null;
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
  const activeGroup = groupOf(ambient.soundscape);
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
      <section className="sounds-section" aria-labelledby="sounds-scapes-title">
        <h2 id="sounds-scapes-title">{ru ? 'Спокойные звуки' : 'Calm sounds'}</h2>
        <div className="sounds-grid">
          {SOUND_GROUPS.map((group) => {
            const active = activeGroup === group;
            return (
              <button
                key={group}
                type="button"
                className={`sounds-tile${active ? ' is-active has-video' : ''}`}
                aria-pressed={active}
                onClick={() => { lumiaSelectionHaptic(); if (!active) pausePlayback(); playSoundscape(active ? null : tracksOfGroup(group)[0].id); }}
              >
                {active ? <VideoBackground id={SOUND_VIDEOS[group]} scrim="bottom" /> : null}
                <AssetSlot src={SOUND_IMAGES[group]} fit="cover" className="sounds-tile-art" />
                <span>{SOUND_GROUP_LABELS[group][language]}</span>
                {active && ambient.loading
                  ? <LoaderCircle className="sounds-tile-state audio-mini-player-spinner" size={16} aria-hidden="true" />
                  : active ? <Pause className="sounds-tile-state" size={16} aria-hidden="true" /> : <Play className="sounds-tile-state" size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {activeGroup ? (
          <div className="sounds-variants" role="radiogroup" aria-label={ru ? 'Вариант звука' : 'Sound variant'}>
            {tracksOfGroup(activeGroup).map((track) => (
              <button
                key={track.id}
                type="button"
                role="radio"
                aria-checked={ambient.soundscape === track.id}
                className={`sounds-chip${ambient.soundscape === track.id ? ' is-active' : ''}`}
                onClick={() => { lumiaSelectionHaptic(); playSoundscape(track.id); }}
              >
                {track.title[language]}
              </button>
            ))}
          </div>
        ) : null}
        {ambient.error ? (
          <p className="listen-forecast-error" role="alert">
            {ru ? 'Запись не загрузилась. Проверь интернет или выбери вариант «без интернета».' : 'The recording did not load. Check the connection or pick an offline variant.'}
          </p>
        ) : null}
        <p className="sounds-note">{ru ? 'Настоящие записи загружаются один раз и потом играют без интернета.' : 'Real recordings download once and then play offline.'}</p>
      </section>

      <section className="sounds-section" aria-labelledby="sounds-music-title">
        <h2 id="sounds-music-title">{ru ? 'Спокойная музыка' : 'Calm music'}</h2>
        <p className="sounds-note">{ru ? 'Фортепианная классика идёт подряд, как плейлист. Можно включить вместе со звуком.' : 'Piano classics play one after another. You can mix them with a sound.'}</p>
        <ul className="sounds-list">
          {MUSIC_TRACKS.map((track) => {
            const active = ambient.music === track.id;
            return (
              <li key={track.id}>
                <button type="button" className={`sounds-row${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => { lumiaSelectionHaptic(); if (!active) pausePlayback(); playMusic(active ? null : track.id); }}>
                  <span className="sounds-row-icon" aria-hidden="true">{active ? <Pause size={16} /> : <Play size={16} />}</span>
                  <span className="sounds-row-copy"><strong>{track.title[language]}</strong><small>{track.note[language]}</small></span>
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
                <button type="button" className={`sounds-story-main${playing && STORY_VIDEOS[story.id] ? ' video-hero' : ''}`} onClick={() => { void playStory(story); }} disabled={phase === 'preparing'}>
                  {playing && STORY_VIDEOS[story.id] ? <VideoBackground id={STORY_VIDEOS[story.id]} /> : null}
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
