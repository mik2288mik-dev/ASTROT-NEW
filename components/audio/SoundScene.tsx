import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square, X } from 'lucide-react';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { trapPaywallTabKey } from '../../lib/paywallDialogFocus';
import { findAmbientTrack, SOUND_GROUP_LABELS, SOUND_VIDEOS, tracksOfGroup, type SoundGroup } from '../../lib/soundscapes/library';
import { pauseAmbient, playSoundscape, resumeAmbient, stopAmbient, useAmbientState } from '../../services/ambientPlayer';
import { VideoBackground } from '../lumia-ui/VideoBackground';

/** Closing the scene only dismisses the video; the same background sound keeps playing. */
export function SoundScene({ group, language, onClose }: { group: SoundGroup; language: 'ru' | 'en'; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const ambient = useAmbientState();
  const [videoPaused, setVideoPaused] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ru = language === 'ru';
  const track = ambient.soundscape ? findAmbientTrack(ambient.soundscape) : null;
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const back = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      event.stopImmediatePropagation();
      close.current();
    };
    window.addEventListener(NATIVE_BACK_EVENT, back, true);
    return () => {
      window.removeEventListener(NATIVE_BACK_EVENT, back, true);
      document.body.style.overflow = previousOverflow;
      element?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={dialog} className="sound-scene" aria-labelledby="sound-scene-title" onKeyDown={(event) => { trapPaywallTabKey(event.currentTarget, event); }} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sound-scene-content">
        <div className="sound-scene-video">
          <VideoBackground id={SOUND_VIDEOS[group]} still={ambient.paused || videoPaused} />
          <button type="button" className="sound-scene-close" onClick={onClose} aria-label={ru ? 'Свернуть видео' : 'Close video'}><X size={22} aria-hidden="true" /></button>
          <div className="sound-scene-caption"><h2 id="sound-scene-title">{SOUND_GROUP_LABELS[group][language]}</h2><p>{track?.group === group ? track.title[language] : ''}</p></div>
        </div>
        <div className="sound-scene-controls">
          <button type="button" onClick={ambient.paused ? resumeAmbient : pauseAmbient}><span aria-hidden="true">{ambient.paused ? <Play size={18} /> : <Pause size={18} />}</span>{ambient.paused ? (ru ? 'Продолжить' : 'Resume') : (ru ? 'Пауза' : 'Pause')}</button>
          <button type="button" onClick={() => { stopAmbient(); onClose(); }}><Square size={16} aria-hidden="true" />{ru ? 'Выключить' : 'Stop'}</button>
          <button type="button" aria-pressed={!videoPaused} onClick={() => setVideoPaused((paused) => !paused)}>{videoPaused ? (ru ? 'Включить видео' : 'Play video') : (ru ? 'Пауза видео' : 'Pause video')}</button>
        </div>
        <div className="sound-scene-variants" role="group" aria-label={ru ? 'Вариант звука' : 'Sound variant'}>
          {tracksOfGroup(group).map((variant) => <button key={variant.id} type="button" aria-pressed={ambient.soundscape === variant.id} onClick={() => playSoundscape(variant.id)}>{variant.title[language]}</button>)}
        </div>
        {ambient.error ? <p className="sound-scene-error" role="alert">{ru ? 'Запись не загрузилась. Проверь интернет или выбери вариант без интернета.' : 'The recording did not load. Check the connection or choose an offline variant.'}</p> : null}
      </div>
    </dialog>
  );
}
