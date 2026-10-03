import { useSyncExternalStore } from 'react';
import { createMusic, createSoundscape, type MusicPiece, type Soundscape, type SoundVoice } from '../lib/soundscapes/synth';

/**
 * Calm sounds and music for «Звуки»: one AudioContext, one sound and one piece
 * of music at a time, and a timer that fades everything out.
 */

export type AmbientState = {
  soundscape: Soundscape | null;
  music: MusicPiece | null;
  /** Epoch ms when the timer fades sound out; null — no timer. */
  endsAt: number | null;
  timerMinutes: number | null;
  supported: boolean;
};

const FADE_SECONDS = 6;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let scapeVoice: SoundVoice | null = null;
let musicVoice: SoundVoice | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function audioSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}

let state: AmbientState = { soundscape: null, music: null, endsAt: null, timerMinutes: null, supported: false };

function emit(patch: Partial<AmbientState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** Must be called from a tap: browsers start sound only after a gesture. */
function context(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  master!.gain.cancelScheduledValues(ctx.currentTime);
  master!.gain.setValueAtTime(0.9, ctx.currentTime);
  return { ctx, master: master! };
}

function fadeIn(voice: SoundVoice, audio: AudioContext) {
  voice.output.gain.setValueAtTime(0, audio.currentTime);
  voice.output.gain.linearRampToValueAtTime(1, audio.currentTime + 2.5);
}

function stopVoice(voice: SoundVoice | null) {
  if (!voice || !ctx) return;
  voice.output.gain.cancelScheduledValues(ctx.currentTime);
  voice.output.gain.setValueAtTime(voice.output.gain.value, ctx.currentTime);
  voice.output.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
  setTimeout(() => voice.stop(), 1300);
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

export function playSoundscape(kind: Soundscape | null): void {
  if (!audioSupported()) return;
  stopVoice(scapeVoice);
  scapeVoice = null;
  if (kind) {
    const audio = context();
    scapeVoice = createSoundscape(audio.ctx, kind);
    scapeVoice.output.connect(audio.master);
    fadeIn(scapeVoice, audio.ctx);
  }
  emit({ soundscape: kind });
  if (!kind && !musicVoice) stopAmbient();
}

export function playMusic(piece: MusicPiece | null): void {
  if (!audioSupported()) return;
  stopVoice(musicVoice);
  musicVoice = null;
  if (piece) {
    const audio = context();
    musicVoice = createMusic(audio.ctx, piece);
    musicVoice.output.connect(audio.master);
    fadeIn(musicVoice, audio.ctx);
  }
  emit({ music: piece });
  if (!piece && !scapeVoice) stopAmbient();
}

/** Fades everything out after N minutes (null removes the timer). */
export function setAmbientTimer(minutes: number | null): void {
  clearTimer();
  if (!minutes) {
    emit({ endsAt: null, timerMinutes: null });
    return;
  }
  const endsAt = Date.now() + minutes * 60_000;
  timer = setTimeout(() => {
    if (ctx && master) {
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_SECONDS);
    }
    timer = setTimeout(stopAmbient, FADE_SECONDS * 1000 + 200);
  }, Math.max(0, minutes * 60_000 - FADE_SECONDS * 1000));
  emit({ endsAt, timerMinutes: minutes });
}

export function stopAmbient(): void {
  clearTimer();
  scapeVoice?.stop();
  musicVoice?.stop();
  scapeVoice = null;
  musicVoice = null;
  if (ctx && ctx.state === 'running') void ctx.suspend();
  emit({ soundscape: null, music: null, endsAt: null, timerMinutes: null });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAmbientState(): AmbientState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  return snapshot.supported === audioSupported() ? snapshot : { ...snapshot, supported: audioSupported() };
}
