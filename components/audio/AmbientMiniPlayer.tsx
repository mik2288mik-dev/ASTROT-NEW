import React from 'react';
import { Headphones, LoaderCircle, Pause, Play, Square } from 'lucide-react';
import { findAmbientTrack, findMusicTrack, SOUND_VIDEOS } from '../../lib/soundscapes/library';
import { videoBackgroundPoster } from '../../lib/videoBackgrounds';
import { pauseAmbient, resumeAmbient, stopAmbient, useAmbientState } from '../../services/ambientPlayer';

/** Shared controls for the existing sound/music voices; navigating never creates a new player. */
export function AmbientMiniPlayer({ language, onOpen }: { language: 'ru' | 'en'; onOpen: () => void }) {
  const ambient = useAmbientState();
  const sound = ambient.soundscape ? findAmbientTrack(ambient.soundscape) : null;
  const music = ambient.music ? findMusicTrack(ambient.music) : null;
  if (!sound && !music) return null;
  const ru = language === 'ru';
  const title = sound?.title[language] ?? music!.title[language];
  const secondary = ambient.error ? (ru ? 'Запись не загрузилась' : 'Recording did not load')
      : ambient.paused ? (ru ? 'На паузе' : 'Paused')
        : ambient.loading ? (ru ? 'Загружается…' : 'Loading…')
          : sound && music ? music.title[language] : (ru ? 'Звуки' : 'Sounds');
  return (
    <section className="ambient-mini-player" aria-label={ru ? 'Фоновый плеер' : 'Background player'}>
      <button type="button" className="ambient-mini-player-track" onClick={onOpen} aria-label={`${ru ? 'Открыть Звуки' : 'Open Sounds'}: ${title}${sound && music ? ` + ${music.title[language]}` : ''}`}>
        {sound ? <img src={videoBackgroundPoster(SOUND_VIDEOS[sound.group])} alt="" /> : <span className="ambient-mini-player-art"><Headphones size={22} aria-hidden="true" /></span>}
        <span className="ambient-mini-player-copy"><strong>{title}</strong><small>{secondary}</small></span>
      </button>
      <button type="button" className="ambient-mini-player-toggle" onClick={ambient.paused ? resumeAmbient : pauseAmbient} aria-label={ambient.paused ? (ru ? 'Продолжить звук и музыку' : 'Resume sound and music') : (ru ? 'Пауза звука и музыки' : 'Pause sound and music')}>
        {ambient.loading && !ambient.paused ? <LoaderCircle className="audio-mini-player-spinner" size={20} aria-hidden="true" /> : ambient.paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}
      </button>
      <button type="button" className="ambient-mini-player-stop" onClick={stopAmbient} aria-label={ru ? 'Выключить звук и музыку' : 'Stop sound and music'}><Square size={18} aria-hidden="true" /></button>
    </section>
  );
}
