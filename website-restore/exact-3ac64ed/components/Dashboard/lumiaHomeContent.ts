export type HomeLanguage = 'ru' | 'en';

export function getHomeCopy(language: HomeLanguage) {
  return {
    tagline: language === 'en' ? 'YOUR HOROSCOPE' : 'ТВОЙ ГОРОСКОП',
  };
}

export type HomeCopy = ReturnType<typeof getHomeCopy>;
