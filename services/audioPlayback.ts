import { useSyncExternalStore } from 'react';

/**
 * One audio element for the whole app, so a new track always replaces the
 * previous one. Screens subscribe to its state with `useAudioPlayback`.
 */

export type AudioPlaybackState = {
  /** Which track is loaded (a stable key chosen by the screen). */
  trackKey: string | null;
  title: string;
  src: string | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  loop: boolean;
  error: boolean;
  /** Epoch ms when the sleep timer fades the track out. */
  sleepAt: number | null;
};

const INITIAL: AudioPlaybackState = {
  trackKey: null,
  title: '',
  src: null,
  playing: false,
  loading: false,
  currentTime: 0,
  duration: 0,
  rate: 1,
  loop: false,
  error: false,
  sleepAt: null,
};

let state: AudioPlaybackState = INITIAL;
let element: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

function emit(patch: Partial<AudioPlaybackState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function audio(): HTMLAudioElement {
  if (element) return element;
  element = new Audio();
  element.preload = 'auto';
  element.addEventListener('playing', () => emit({ playing: true, loading: false, error: false }));
  element.addEventListener('pause', () => emit({ playing: false }));
  element.addEventListener('waiting', () => emit({ loading: true }));
  element.addEventListener('canplay', () => emit({ loading: false }));
  element.addEventListener('timeupdate', () => emit({ currentTime: element!.currentTime }));
  element.addEventListener('durationchange', () => emit({ duration: Number.isFinite(element!.duration) ? element!.duration : 0 }));
  element.addEventListener('ended', () => emit({ playing: false, currentTime: element!.loop ? 0 : element!.duration || 0 }));
  element.addEventListener('error', () => emit({ playing: false, loading: false, error: true }));
  return element;
}

const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let unlocked = false;

/**
 * Call synchronously inside a tap before any await: WebViews and Safari allow
 * sound only from a user gesture, and an element started once stays allowed.
 */
export function unlockPlayback(): void {
  if (unlocked || typeof window === 'undefined') return;
  const player = audio();
  if (state.src) return;
  unlocked = true;
  player.src = SILENCE;
  void player.play().then(() => player.pause()).catch(() => { unlocked = false; });
}

export function playTrack(input: { trackKey: string; src: string; title: string; loop?: boolean; durationHint?: number }): void {
  const player = audio();
  if (state.trackKey !== input.trackKey || state.src !== input.src) {
    player.src = input.src;
    player.loop = Boolean(input.loop);
    player.playbackRate = state.rate;
    emit({
      trackKey: input.trackKey,
      title: input.title,
      src: input.src,
      currentTime: 0,
      duration: input.durationHint || 0,
      loop: Boolean(input.loop),
      error: false,
    });
  }
  emit({ loading: true });
  void player.play().catch(() => emit({ playing: false, loading: false }));
}

export function togglePlayback(): void {
  const player = audio();
  if (player.paused) void player.play().catch(() => emit({ playing: false }));
  else player.pause();
}

export function pausePlayback(): void {
  element?.pause();
}

export function seekBy(seconds: number): void {
  const player = audio();
  const duration = Number.isFinite(player.duration) ? player.duration : state.duration;
  player.currentTime = Math.min(Math.max(0, player.currentTime + seconds), duration || player.currentTime + seconds);
}

export function seekTo(seconds: number): void {
  audio().currentTime = Math.max(0, seconds);
}

export function setPlaybackRate(rate: number): void {
  audio().playbackRate = rate;
  emit({ rate });
}

export function setPlaybackVolume(volume: number): void {
  audio().volume = Math.min(1, Math.max(0, volume));
}

let sleepTimer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function clearSleepTimer() {
  if (sleepTimer) clearTimeout(sleepTimer);
  if (fadeTimer) clearInterval(fadeTimer);
  sleepTimer = null;
  fadeTimer = null;
}

/** Sleep timer: after N minutes the volume fades over ten seconds and the track pauses. */
export function setSleepTimer(minutes: number | null): void {
  clearSleepTimer();
  if (element) element.volume = 1;
  if (!minutes) {
    emit({ sleepAt: null });
    return;
  }
  const sleepAt = Date.now() + minutes * 60_000;
  sleepTimer = setTimeout(() => {
    let step = 0;
    fadeTimer = setInterval(() => {
      step += 1;
      if (element) element.volume = Math.max(0, 1 - step / 20);
      if (step >= 20) {
        clearSleepTimer();
        element?.pause();
        if (element) element.volume = 1;
        emit({ sleepAt: null });
      }
    }, 500);
  }, Math.max(0, minutes * 60_000 - 10_000));
  emit({ sleepAt });
}

export function stopPlayback(): void {
  clearSleepTimer();
  if (element) {
    element.pause();
    element.removeAttribute('src');
    element.load();
  }
  emit({ ...INITIAL, rate: state.rate });
}

export function subscribePlayback(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPlaybackState(): AudioPlaybackState {
  return state;
}

export function useAudioPlayback(): AudioPlaybackState {
  return useSyncExternalStore(subscribePlayback, () => state, () => INITIAL);
}
