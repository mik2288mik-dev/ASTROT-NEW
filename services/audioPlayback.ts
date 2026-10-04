import { useSyncExternalStore } from 'react';
import { createSpeechSession, SPEECH_CHARS_PER_SECOND, splitIntoSentences, type SpeechSession } from './speechEngine';

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

/**
 * Reading text with the device's own voice behaves like a track: the same
 * mini player, pause, 15-second steps (by sentences), speed and lock-screen buttons.
 */
type SpeechTrack = {
  session: SpeechSession;
  sentences: string[];
  /** Start second of every sentence at rate 1. */
  starts: number[];
  total: number;
  index: number;
  playing: boolean;
  sentenceStartedAt: number;
  ticker: ReturnType<typeof setInterval> | null;
};

let speech: SpeechTrack | null = null;

function speechSecond(track: SpeechTrack, index: number): number {
  return (track.starts[index] ?? track.total) / state.rate;
}

function stopSpeechTicker(track: SpeechTrack) {
  if (track.ticker) clearInterval(track.ticker);
  track.ticker = null;
}

function disposeSpeech() {
  if (!speech) return;
  stopSpeechTicker(speech);
  speech.session.dispose();
  speech = null;
}

function startSpeechAt(track: SpeechTrack, index: number) {
  track.index = Math.max(0, Math.min(index, track.sentences.length - 1));
  track.playing = true;
  track.sentenceStartedAt = Date.now();
  track.session.play(track.index, state.rate);
  stopSpeechTicker(track);
  track.ticker = setInterval(() => {
    if (!track.playing) return;
    const next = track.index + 1 < track.sentences.length ? speechSecond(track, track.index + 1) : track.total / state.rate;
    const now = speechSecond(track, track.index) + (Date.now() - track.sentenceStartedAt) / 1000;
    emit({ currentTime: Math.min(now, next) });
  }, 500);
  emit({ playing: true, loading: false, error: false, currentTime: speechSecond(track, track.index) });
}

function haltSpeech(track: SpeechTrack) {
  track.playing = false;
  stopSpeechTicker(track);
  track.session.halt();
  emit({ playing: false });
}

/** Reads text aloud with the phone's voice. Tap-safe: no network involved. */
export function playSpeech(input: { trackKey: string; title: string; text: string; language: 'ru' | 'en' }): void {
  if (state.trackKey === input.trackKey && speech) {
    if (!speech.playing) startSpeechAt(speech, speech.index);
    return;
  }
  element?.pause();
  disposeSpeech();
  const sentences = splitIntoSentences(input.text);
  if (!sentences.length) return;
  const starts: number[] = [];
  let chars = 0;
  for (const sentence of sentences) {
    starts.push(chars / SPEECH_CHARS_PER_SECOND);
    chars += sentence.length + 1;
  }
  const track: SpeechTrack = {
    session: null as unknown as SpeechSession,
    sentences,
    starts,
    total: chars / SPEECH_CHARS_PER_SECOND,
    index: 0,
    playing: false,
    sentenceStartedAt: Date.now(),
    ticker: null,
  };
  track.session = createSpeechSession(sentences, input.language, {
    onSentence: (index) => {
      if (speech !== track) return;
      track.index = index;
      track.sentenceStartedAt = Date.now();
      emit({ currentTime: speechSecond(track, index), playing: true, loading: false });
    },
    onEnd: () => {
      if (speech !== track) return;
      track.playing = false;
      stopSpeechTicker(track);
      track.index = 0;
      emit({ playing: false, currentTime: track.total / state.rate });
    },
    onError: () => {
      if (speech !== track) return;
      haltSpeech(track);
      emit({ error: true });
    },
  });
  speech = track;
  emit({ trackKey: input.trackKey, title: input.title, src: null, currentTime: 0, duration: track.total / state.rate, loop: false, error: false });
  startSpeechAt(track, 0);
}

function speechIndexAt(track: SpeechTrack, seconds: number): number {
  const at = seconds * state.rate;
  let index = 0;
  while (index + 1 < track.starts.length && track.starts[index + 1] <= at) index += 1;
  return index;
}

export function playTrack(input: { trackKey: string; src: string; title: string; loop?: boolean; durationHint?: number }): void {
  disposeSpeech();
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
  if (speech) {
    if (speech.playing) haltSpeech(speech);
    else startSpeechAt(speech, speech.index);
    return;
  }
  const player = audio();
  if (player.paused) void player.play().catch(() => emit({ playing: false }));
  else player.pause();
}

export function pausePlayback(): void {
  if (speech?.playing) haltSpeech(speech);
  element?.pause();
}

export function seekBy(seconds: number): void {
  if (speech) {
    seekTo(state.currentTime + seconds);
    return;
  }
  const player = audio();
  const duration = Number.isFinite(player.duration) ? player.duration : state.duration;
  player.currentTime = Math.min(Math.max(0, player.currentTime + seconds), duration || player.currentTime + seconds);
}

export function seekTo(seconds: number): void {
  if (speech) {
    const index = speechIndexAt(speech, Math.max(0, seconds));
    if (speech.playing) startSpeechAt(speech, index);
    else {
      speech.index = index;
      emit({ currentTime: speechSecond(speech, index) });
    }
    return;
  }
  audio().currentTime = Math.max(0, seconds);
}

export function setPlaybackRate(rate: number): void {
  if (speech) {
    const track = speech;
    emit({ rate, duration: track.total / rate });
    if (track.playing) startSpeechAt(track, track.index);
    else emit({ currentTime: speechSecond(track, track.index) });
    return;
  }
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
    if (speech) {
      clearSleepTimer();
      pausePlayback();
      emit({ sleepAt: null });
      return;
    }
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
  disposeSpeech();
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
