import { tr } from '../../lib/i18n';
export type HomeLanguage = 'ru' | 'en';

export function getHomeCopy(language: HomeLanguage) {
  return {
    tagline: language === 'en' ? tr('YOUR HOROSCOPE') : 'ТВОЙ ГОРОСКОП',
  };
}

export type HomeCopy = ReturnType<typeof getHomeCopy>;
