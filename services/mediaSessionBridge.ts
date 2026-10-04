import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { findAmbientTrack, findMusicTrack } from '../lib/soundscapes/library';
import { getAmbientState, pauseAmbient, resumeAmbient, stopAmbient, subscribeAmbient } from './ambientPlayer';
import { getPlaybackState, seekBy, stopPlayback, subscribePlayback, togglePlayback } from './audioPlayback';

/**
 * Lock-screen controls for everything NEBO plays: the media notification of the
 * Android app (NativeMediaSession foreground service keeps sound alive with the
 * screen locked) and the browser Media Session elsewhere.
 */

type NativeMediaSession = {
  update: (input: { title: string; subtitle: string; playing: boolean }) => Promise<void>;
  stop: () => Promise<void>;
  addListener: (event: 'action', callback: (payload: { action: string }) => void) => Promise<PluginListenerHandle>;
};

const native = registerPlugin<NativeMediaSession>('NativeMediaSession');

function nativeAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NativeMediaSession');
  } catch {
    return false;
  }
}

type NowPlaying = { kind: 'track' | 'ambient'; title: string; subtitle: string; playing: boolean } | null;

function nowPlaying(language: 'ru' | 'en'): NowPlaying {
  const track = getPlaybackState();
  if (track.trackKey && (track.playing || track.loading || track.currentTime > 0) && track.currentTime < (track.duration || Infinity) - 0.5) {
    return { kind: 'track', title: track.title || 'NEBO', subtitle: 'NEBO', playing: track.playing || track.loading };
  }
  const ambient = getAmbientState();
  const scape = ambient.soundscape ? findAmbientTrack(ambient.soundscape) : null;
  const music = ambient.music ? findMusicTrack(ambient.music) : null;
  if (scape || music) {
    const titles = [scape?.title[language], music?.title[language]].filter(Boolean);
    return {
      kind: 'ambient',
      title: titles.join(' + '),
      subtitle: language === 'ru' ? 'NEBO · Звуки' : 'NEBO · Sounds',
      playing: !ambient.paused,
    };
  }
  return null;
}

function handle(action: string) {
  const current = nowPlaying('ru');
  if (!current) return;
  if (current.kind === 'track') {
    if (action === 'play' || action === 'pause') togglePlayback();
    else if (action === 'forward') seekBy(15);
    else if (action === 'back') seekBy(-15);
    else if (action === 'stop') stopPlayback();
    return;
  }
  if (action === 'play') resumeAmbient();
  else if (action === 'pause') pauseAmbient();
  else if (action === 'stop') stopAmbient();
}

let started = false;
let lastKey = '';

/** Call once at app start. Returns a cleanup function. */
export function startMediaSessionBridge(getLanguage: () => 'ru' | 'en'): () => void {
  if (started || typeof window === 'undefined') return () => undefined;
  started = true;
  const useNative = nativeAvailable();
  let listener: Promise<PluginListenerHandle> | null = null;
  if (useNative) listener = native.addListener('action', (payload) => handle(payload.action));

  const browserSession = !useNative && 'mediaSession' in navigator ? navigator.mediaSession : null;
  if (browserSession) {
    const bind = (name: MediaSessionAction, action: string) => {
      try { browserSession.setActionHandler(name, () => handle(action)); } catch { /* unsupported action */ }
    };
    bind('play', 'play');
    bind('pause', 'pause');
    bind('stop', 'stop');
    bind('seekforward', 'forward');
    bind('seekbackward', 'back');
  }

  const sync = () => {
    const current = nowPlaying(getLanguage());
    const key = current ? `${current.title}|${current.subtitle}|${current.playing}` : 'none';
    if (key === lastKey) return;
    lastKey = key;
    if (useNative) {
      if (current) void native.update(current).catch(() => undefined);
      else void native.stop().catch(() => undefined);
    } else if (browserSession) {
      browserSession.metadata = current && typeof MediaMetadata !== 'undefined'
        ? new MediaMetadata({ title: current.title, artist: current.subtitle })
        : null;
      browserSession.playbackState = current ? (current.playing ? 'playing' : 'paused') : 'none';
    }
  };

  const offTrack = subscribePlayback(sync);
  const offAmbient = subscribeAmbient(sync);
  return () => {
    offTrack();
    offAmbient();
    void listener?.then((handleRef) => handleRef.remove());
    if (useNative) void native.stop().catch(() => undefined);
    started = false;
    lastKey = '';
  };
}
