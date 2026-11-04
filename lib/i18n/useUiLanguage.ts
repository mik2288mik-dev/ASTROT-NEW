import { useSyncExternalStore } from 'react';
import { getUiLanguage, setUiLanguage, subscribeUiLanguage, uiLanguageVersion, type UiLanguage } from './index';

/** Redraws the component when the language changes or the translations arrive. */
export function useUiLanguage(): [UiLanguage, (language: UiLanguage) => void] {
  useSyncExternalStore(subscribeUiLanguage, uiLanguageVersion, () => 0);
  return [getUiLanguage(), setUiLanguage];
}
