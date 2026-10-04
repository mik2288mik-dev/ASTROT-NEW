import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Reading text aloud with the device's own voice: the Android speech engine in
 * the app (NativeTts plugin), the browser's speechSynthesis elsewhere. Free and
 * offline. Text is read sentence by sentence so the player can pause, skip and
 * change speed.
 */

type NativeTts = {
  isAvailable: (input: { language: string }) => Promise<{ available: boolean }>;
  speak: (input: { sentences: string[]; startIndex: number; language: string; rate: number; session: string }) => Promise<void>;
  stop: () => Promise<void>;
  addListener: (event: 'start' | 'done' | 'error', callback: (payload: { session: string; index: number }) => void) => Promise<PluginListenerHandle>;
};

const native = registerPlugin<NativeTts>('NativeTts');

function nativeAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NativeTts');
  } catch {
    return false;
  }
}

function browserSynthesis(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null;
}

/** Calm reading speed of Russian text, characters per second at rate 1. */
export const SPEECH_CHARS_PER_SECOND = 14;
const MAX_CHUNK = 280;

/** Splits text into short sentences for a smooth, controllable reading. */
export function splitIntoSentences(text: string): string[] {
  const result: string[] = [];
  for (const paragraph of text.split(/\n{2,}/u).map((item) => item.replace(/\s+/gu, ' ').trim()).filter(Boolean)) {
    for (const sentence of paragraph.match(/[^.!?…]+[.!?…]*["»)]*\s*/gu) ?? [paragraph]) {
      let rest = sentence.trim();
      while (rest.length > MAX_CHUNK) {
        const cut = Math.max(rest.lastIndexOf(', ', MAX_CHUNK), rest.lastIndexOf(' ', MAX_CHUNK));
        const at = cut > 40 ? cut + 1 : MAX_CHUNK;
        result.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) result.push(rest);
    }
  }
  return result;
}

let availability: Partial<Record<string, Promise<boolean>>> = {};

export function speechAvailable(language: 'ru' | 'en'): Promise<boolean> {
  if (!availability[language]) {
    availability[language] = nativeAvailable()
      ? native.isAvailable({ language }).then((result) => result.available).catch(() => false)
      : Promise.resolve(browserSynthesis() !== null);
  }
  return availability[language]!;
}

/** For tests. */
export function resetSpeechAvailability(): void {
  availability = {};
}

export type SpeechCallbacks = {
  /** A sentence started (index into the sentences). */
  onSentence: (index: number) => void;
  onEnd: () => void;
  onError: () => void;
};

export type SpeechSession = {
  play: (fromIndex: number, rate: number) => void;
  /** Stops reading; play() continues later. */
  halt: () => void;
  /** Stops and releases the session. */
  dispose: () => void;
};

let sessionCounter = 0;

export function createSpeechSession(sentences: readonly string[], language: 'ru' | 'en', callbacks: SpeechCallbacks): SpeechSession {
  if (nativeAvailable()) {
    let session = '';
    const handles = Promise.all([
      native.addListener('start', (payload) => { if (payload.session === session) callbacks.onSentence(payload.index); }),
      native.addListener('done', (payload) => { if (payload.session === session && payload.index === sentences.length - 1) callbacks.onEnd(); }),
      native.addListener('error', (payload) => { if (payload.session === session) callbacks.onError(); }),
    ]);
    return {
      play: (fromIndex, rate) => {
        sessionCounter += 1;
        session = `nebo${Date.now()}${sessionCounter}`;
        void native.speak({ sentences: [...sentences], startIndex: fromIndex, language, rate, session }).catch(() => callbacks.onError());
      },
      halt: () => {
        session = '';
        void native.stop().catch(() => undefined);
      },
      dispose: () => {
        session = '';
        void native.stop().catch(() => undefined);
        void handles.then((list) => list.forEach((handle) => handle.remove()));
      },
    };
  }

  const synthesis = browserSynthesis();
  let generation = 0;
  const voice = () => synthesis?.getVoices().find((item) => item.lang.toLowerCase().startsWith(language)) ?? null;
  return {
    play: (fromIndex, rate) => {
      if (!synthesis) {
        callbacks.onError();
        return;
      }
      generation += 1;
      const current = generation;
      synthesis.cancel();
      for (let index = fromIndex; index < sentences.length; index += 1) {
        const utterance = new SpeechSynthesisUtterance(sentences[index]);
        utterance.lang = language === 'en' ? 'en-US' : 'ru-RU';
        utterance.rate = rate;
        const chosen = voice();
        if (chosen) utterance.voice = chosen;
        utterance.onstart = () => { if (current === generation) callbacks.onSentence(index); };
        if (index === sentences.length - 1) utterance.onend = () => { if (current === generation) callbacks.onEnd(); };
        utterance.onerror = (event) => {
          if (current === generation && event.error !== 'canceled' && event.error !== 'interrupted') callbacks.onError();
        };
        synthesis.speak(utterance);
      }
    },
    halt: () => {
      generation += 1;
      synthesis?.cancel();
    },
    dispose: () => {
      generation += 1;
      synthesis?.cancel();
    },
  };
}
