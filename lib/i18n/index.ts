/**
 * Interface language (RU / EN / ES). It is a device setting: the server and all AI generation stay in Russian
 * until the Google Play launch (see services/apiClient.ts, which always sends Russian to the server).
 *
 * - tr('English text') gives the Spanish text when the app is in Spanish, for code that already picks RU or EN.
 * - trf('Text {0}', value) does the same for text with values inside.
 * - t('Русский текст') gives the English or Spanish text outside the page, such as share messages.
 * - Everything else written in Russian is translated on screen by domTranslator.ts, which never runs in Russian.
 * Any missing phrase falls back to the source text, so a gap never breaks a screen.
 */
import { buildTranslate, startDomTranslator, type Translate } from './domTranslator';

export type UiLanguage = 'ru' | 'en' | 'es';
export const UI_LANGUAGES: readonly UiLanguage[] = ['ru', 'en', 'es'];
export const UI_LANGUAGE_KEY = 'nebo.lang';

type Dictionaries = { esFromEn: Record<string, string>; enFromRu: Record<string, string>; esFromRu: Record<string, string> };

const EVENT = 'nebo-language-change';
let current: UiLanguage = 'ru';
let dictionaries: Dictionaries | null = null;
let initialised = false;
let version = 0;

function readStored(): UiLanguage | null {
  try {
    const value = window.localStorage.getItem(UI_LANGUAGE_KEY) as UiLanguage | null;
    return value && UI_LANGUAGES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

/** Russian users do not download the translations: they load only when another language is on. */
async function ensureDictionaries() {
  if (dictionaries) return;
  const module = await import('./strings');
  dictionaries = { esFromEn: module.ES_FROM_EN, enFromRu: module.EN_FROM_RU, esFromRu: module.ES_FROM_RU };
}

function notify() {
  version += 1;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

let translator: ReturnType<typeof startDomTranslator> | null = null;

function translatorFor(language: UiLanguage): Translate {
  if (!dictionaries) return () => null;
  if (language === 'en') return buildTranslate(dictionaries.enFromRu);
  // In Spanish, English text from tables that have no Spanish yet is translated too.
  return buildTranslate({ ...dictionaries.esFromEn, ...dictionaries.esFromRu });
}

/** Keeps the page in step with the language. Russian switches it off and puts the original text back. */
function syncTranslator() {
  if (typeof document === 'undefined') return;
  if (current === 'ru') {
    translator?.stop();
    translator = null;
    return;
  }
  if (!dictionaries) return;
  const translate = translatorFor(current);
  if (translator) translator.retranslate(translate);
  else translator = startDomTranslator(document.body, translate);
}

/** Call once on the client, before the first screen. */
export function initUiLanguage() {
  if (typeof window === 'undefined' || initialised) return;
  initialised = true;
  const stored = readStored();
  if (!stored || stored === 'ru') return;
  document.documentElement.lang = stored;
  current = stored;
  notify();
  void ensureDictionaries().then(() => { syncTranslator(); notify(); }).catch(() => undefined);
}

export function getUiLanguage(): UiLanguage {
  return current;
}

export function setUiLanguage(language: UiLanguage) {
  try { window.localStorage.setItem(UI_LANGUAGE_KEY, language); } catch { /* storage may be unavailable */ }
  document.documentElement.lang = language;
  current = language;
  notify();
  if (language === 'ru') {
    syncTranslator();
    return;
  }
  void ensureDictionaries().then(() => {
    // The person may have switched again while the translations were loading.
    if (current === language) syncTranslator();
    notify();
  }).catch(() => undefined);
}

/** An account that chose English before the language became a device setting keeps it on this device. */
export function adoptAccountLanguage(language: string | null | undefined) {
  if (typeof window === 'undefined' || language !== 'en' || readStored()) return;
  setUiLanguage('en');
}

export function subscribeUiLanguage(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export const uiLanguageVersion = () => version;

/** English source text → Spanish, only while the app is in Spanish. */
export function tr(english: string): string {
  if (current !== 'es') return english;
  return dictionaries?.esFromEn[english] ?? english;
}

/** tr() for text with values inside: trf('Day {0} of {1}', day, total). */
export function trf(english: string, ...values: Array<string | number | null | undefined>): string {
  return tr(english).replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ''));
}

/** Russian source text → the current language. */
export function t(russian: string): string {
  if (current === 'ru') return russian;
  if (current === 'es') return dictionaries?.esFromRu[russian] ?? dictionaries?.enFromRu[russian] ?? russian;
  return dictionaries?.enFromRu[russian] ?? russian;
}
