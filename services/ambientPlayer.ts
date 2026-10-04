import { useSyncExternalStore } from 'react';
import { createMusic, createSoundscape, type SoundVoice } from '../lib/soundscapes/synth';
import { findAmbientTrack, findMusicTrack } from '../lib/soundscapes/library';
import { apiUrl } from './apiClient';

/**
 * Calm sounds and music for «Звуки». Real recordings stream from the server
 * and are cached on the device after the first play; synthesized ones are
 * made on the spot. One sound and one piece of music at a time, a pause, and
 * a timer that fades everything out.
 */

export type AmbientState = {
  /** Ambient track id (see lib/soundscapes/library). */
  soundscape: string | null;
  /** Music track id. */
  music: string | null;
  paused: boolean;
  loading: boolean;
  error: boolean;
  /** Epoch ms when the timer fades sound out; null — no timer. */
  endsAt: number | null;
  timerMinutes: number | null;
  supported: boolean;
};

type Voice = {
  setVolume: (value: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

const FADE_MS = 6_000;
const CACHE_NAME = 'nebo-sounds-v1';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let scapeVoice: Voice | null = null;
let musicVoice: Voice | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let fade: ReturnType<typeof setInterval> | null = null;
let level = 1;
const listeners = new Set<() => void>();

function audioSupported(): boolean {
  return typeof window !== 'undefined' && (typeof Audio !== 'undefined'
    || Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext));
}

let state: AmbientState = { soundscape: null, music: null, paused: false, loading: false, error: false, endsAt: null, timerMinutes: null, supported: false };

function emit(patch: Partial<AmbientState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** Must start from a tap: browsers allow sound only after a gesture. */
function context(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  master!.gain.value = level;
  return { ctx, master: master! };
}

function synthVoice(make: (audio: AudioContext) => SoundVoice): Voice {
  const audio = context();
  const voice = make(audio.ctx);
  voice.output.connect(audio.master);
  voice.output.gain.setValueAtTime(0, audio.ctx.currentTime);
  voice.output.gain.linearRampToValueAtTime(1, audio.ctx.currentTime + 2.5);
  return {
    setVolume: (value) => { if (master) master.gain.value = value; },
    pause: () => { void ctx?.suspend(); },
    resume: () => { void ctx?.resume(); },
    stop: () => {
      const now = audio.ctx.currentTime;
      voice.output.gain.cancelScheduledValues(now);
      voice.output.gain.setValueAtTime(voice.output.gain.value, now);
      voice.output.gain.linearRampToValueAtTime(0, now + 1.2);
      setTimeout(() => voice.stop(), 1300);
    },
  };
}

/** The cached copy when there is one, otherwise the network URL (and cache it quietly). */
async function playableSource(url: string): Promise<string> {
  if (typeof caches === 'undefined') return url;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) return URL.createObjectURL(await hit.blob());
    void fetch(url, { mode: 'cors' }).then((response) => (response.ok && response.status === 200 ? cache.put(url, response) : undefined)).catch(() => undefined);
  } catch {
    // Storage blocked: streaming still works.
  }
  return url;
}

function fileVoice(file: string, loop: boolean, onEnded?: () => void): Voice {
  const element = new Audio();
  element.preload = 'auto';
  element.loop = loop;
  element.volume = 0;
  let objectUrl: string | null = null;
  let stopped = false;
  let target = level;
  let ramp: ReturnType<typeof setInterval> | null = null;
  const rampTo = (value: number, ms: number, done?: () => void) => {
    if (ramp) clearInterval(ramp);
    const from = element.volume;
    const steps = Math.max(1, Math.round(ms / 50));
    let step = 0;
    ramp = setInterval(() => {
      step += 1;
      element.volume = Math.max(0, Math.min(1, from + (value - from) * (step / steps)));
      if (step >= steps) {
        if (ramp) clearInterval(ramp);
        ramp = null;
        done?.();
      }
    }, 50);
  };
  element.addEventListener('playing', () => emit({ loading: false, error: false }));
  element.addEventListener('waiting', () => emit({ loading: true }));
  element.addEventListener('error', () => emit({ loading: false, error: true }));
  if (onEnded) element.addEventListener('ended', onEnded);
  emit({ loading: true, error: false });
  void playableSource(apiUrl(`/api/audio/library/${file}`)).then((src) => {
    if (stopped) return;
    if (src.startsWith('blob:')) objectUrl = src;
    element.src = src;
    void element.play().then(() => rampTo(target, 2_500)).catch(() => emit({ loading: false }));
  });
  return {
    setVolume: (value) => { target = value; if (!ramp) element.volume = value; },
    pause: () => element.pause(),
    resume: () => { void element.play().catch(() => undefined); },
    stop: () => {
      stopped = true;
      rampTo(0, 1_200, () => {
        element.pause();
        element.removeAttribute('src');
        element.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
    },
  };
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  if (fade) clearInterval(fade);
  timer = null;
  fade = null;
}

function applyLevel(value: number) {
  level = value;
  scapeVoice?.setVolume(value);
  musicVoice?.setVolume(value);
}

/** Starts an ambient track by id (null stops it). */
export function playSoundscape(id: string | null): void {
  if (!audioSupported()) return;
  scapeVoice?.stop();
  scapeVoice = null;
  const track = id ? findAmbientTrack(id) : null;
  if (track) {
    applyLevel(1);
    scapeVoice = track.kind === 'file' ? fileVoice(track.file, true) : synthVoice((audio) => createSoundscape(audio, track.synth));
  }
  emit({ soundscape: track?.id ?? null, paused: false, error: false, loading: track?.kind === 'file' });
  if (!track && !musicVoice) stopAmbient();
}

/** Starts a music track by id (null stops it). A recorded piece moves on to the next one. */
export function playMusic(id: string | null): void {
  if (!audioSupported()) return;
  musicVoice?.stop();
  musicVoice = null;
  const track = id ? findMusicTrack(id) : null;
  if (track) {
    applyLevel(1);
    musicVoice = track.kind === 'file'
      ? fileVoice(track.file, false, () => playMusic(nextRecordedPiece(track.id)))
      : synthVoice((audio) => createMusic(audio, track.synth));
  }
  emit({ music: track?.id ?? null, paused: false, error: false });
  if (!track && !scapeVoice) stopAmbient();
}

let nextRecordedPiece: (id: string) => string | null = () => null;
export function setMusicQueue(next: (id: string) => string | null): void {
  nextRecordedPiece = next;
}

export function pauseAmbient(): void {
  scapeVoice?.pause();
  musicVoice?.pause();
  emit({ paused: true });
}

export function resumeAmbient(): void {
  if (ctx?.state === 'suspended') void ctx.resume();
  scapeVoice?.resume();
  musicVoice?.resume();
  emit({ paused: false });
}

/** Fades everything out after N minutes (null removes the timer). */
export function setAmbientTimer(minutes: number | null): void {
  clearTimer();
  applyLevel(1);
  if (!minutes) {
    emit({ endsAt: null, timerMinutes: null });
    return;
  }
  const endsAt = Date.now() + minutes * 60_000;
  timer = setTimeout(() => {
    let step = 0;
    fade = setInterval(() => {
      step += 1;
      applyLevel(Math.max(0, 1 - step / 60));
      if (step >= 60) stopAmbient();
    }, FADE_MS / 60);
  }, Math.max(0, minutes * 60_000 - FADE_MS));
  emit({ endsAt, timerMinutes: minutes });
}

export function stopAmbient(): void {
  clearTimer();
  scapeVoice?.stop();
  musicVoice?.stop();
  scapeVoice = null;
  musicVoice = null;
  if (ctx && ctx.state === 'running') setTimeout(() => { if (!scapeVoice && !musicVoice) void ctx?.suspend(); }, 1_500);
  level = 1;
  emit({ soundscape: null, music: null, paused: false, loading: false, endsAt: null, timerMinutes: null });
}

export function subscribeAmbient(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getAmbientState(): AmbientState {
  return state;
}

export function useAmbientState(): AmbientState {
  const snapshot = useSyncExternalStore(subscribeAmbient, () => state, () => state);
  return snapshot.supported === audioSupported() ? snapshot : { ...snapshot, supported: audioSupported() };
}
