import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Voice input for text fields. Android app: the system speech recognizer
 * (NativeSpeech plugin). Web and Telegram: the Web Speech API where the
 * browser has it. Elsewhere the microphone button is simply not shown.
 */

type NativeSpeechPlugin = {
  isAvailable: () => Promise<{ available: boolean }>;
  recognize: (options: { language: string; prompt?: string }) => Promise<{ text: string }>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

const nativeSpeech = registerPlugin<NativeSpeechPlugin>('NativeSpeech');
let nativeAvailability: Promise<boolean> | null = null;

function webRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NativeSpeech');
}

export async function isDictationAvailable(): Promise<boolean> {
  if (isNativeAndroid()) {
    nativeAvailability ??= nativeSpeech.isAvailable().then((result) => result.available).catch(() => false);
    return nativeAvailability;
  }
  return webRecognitionConstructor() !== null;
}

export type DictationSession = { stop: () => void };
export type DictationHandlers = {
  language: 'ru' | 'en';
  prompt?: string;
  /** Final recognized text of one phrase. */
  onText: (text: string) => void;
  onEnd: (outcome: 'done' | 'cancelled' | 'denied' | 'error') => void;
};

export function startDictation(handlers: DictationHandlers): DictationSession {
  const locale = handlers.language === 'en' ? 'en-US' : 'ru-RU';
  if (isNativeAndroid()) {
    let active = true;
    void nativeSpeech.recognize({ language: locale, prompt: handlers.prompt })
      .then(({ text }) => {
        if (!active) return;
        if (text.trim()) handlers.onText(text.trim());
        handlers.onEnd('done');
      })
      .catch((error: { code?: string }) => {
        if (active) handlers.onEnd(error?.code === 'SPEECH_CANCELLED' ? 'cancelled' : 'error');
      });
    return { stop: () => { active = false; } };
  }

  const Recognition = webRecognitionConstructor();
  if (!Recognition) {
    handlers.onEnd('error');
    return { stop: () => undefined };
  }
  const recognition = new Recognition();
  recognition.lang = locale;
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let outcome: 'done' | 'cancelled' | 'denied' | 'error' = 'done';
  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal && result[0]?.transcript.trim()) handlers.onText(result[0].transcript.trim());
    }
  };
  recognition.onerror = (event) => {
    outcome = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'denied'
      : event.error === 'no-speech' || event.error === 'aborted' ? 'cancelled' : 'error';
  };
  recognition.onend = () => handlers.onEnd(outcome);
  try {
    recognition.start();
  } catch {
    handlers.onEnd('error');
  }
  return { stop: () => recognition.stop() };
}

/** Appends a dictated phrase to the current text with one space and a capital letter at sentence start. */
export function appendDictatedText(current: string, phrase: string, maxLength?: number): string {
  const trimmed = current.replace(/\s+$/u, '');
  const startsSentence = !trimmed || /[.!?…]$/u.test(trimmed);
  const piece = startsSentence ? `${phrase[0].toUpperCase()}${phrase.slice(1)}` : phrase;
  const next = trimmed ? `${trimmed} ${piece}` : piece;
  return maxLength ? next.slice(0, maxLength) : next;
}
