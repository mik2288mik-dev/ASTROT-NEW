export type LumiaHomeLanguage = 'ru' | 'en';

export function getLumiaHomeCopy(language: LumiaHomeLanguage) {
  if (language === 'en') {
    return {
      tagline: 'YOUR PATH TO SELF',
      notifications: 'Notifications',
      settings: 'Settings',
      stories: {
        today: 'Today',
        love: 'Love',
        money: 'Money',
        work: 'Work',
        rhythm: 'Personal rhythm',
      },
      heroDate: 'May 10, Saturday',
      heroTitle: 'CLEAR THE NOISE —\nTHE DAY GETS LIGHTER',
      heroSummary: 'A day for finishing things,\ncaring for yourself, and financial clarity.',
      heroCta: "Take today's focus",
      pulseTitle: 'Daily pulse',
      pulse: {
        morning: 'Morning',
        morningText: 'steady',
        day: 'Day',
        dayText: 'productive',
        evening: 'Evening',
        eveningText: 'restore',
        moon: 'Moon in Virgo',
        peak: 'Peak time',
        peakText: '12:00-15:00',
        avoid: "Don't decide from anxiety",
      },
      forecast: {
        label: 'Daily forecast',
        title: 'Less rush.\nMore clarity.',
        body: 'Today is better for finishing,\nnot starting new things.',
        cta: 'Read forecast',
      },
      full: {
        label: 'Full day reading',
        title: 'Love, money,\nwork and personal\nrhythm — in one\nissue.',
        cta: 'Open full reading',
      },
      nav: {
        today: 'Today',
        chart: 'Map',
        lumia: 'LUMIA',
        union: 'Union',
        diary: 'Diary',
      },
    };
  }

  return {
    tagline: 'ТВОЙ ПУТЬ К СЕБЕ',
    notifications: 'Уведомления',
    settings: 'Настройки',
    stories: {
      today: 'Сегодня',
      love: 'Любовь',
      money: 'Деньги',
      work: 'Работа',
      rhythm: 'Личный ритм',
    },
    heroDate: '10 мая, суббота',
    heroTitle: 'НАВЕДИ ПОРЯДОК —\nСТАНЕТ ЛЕГЧЕ',
    heroSummary: 'День подходит для завершения дел,\nзаботы о себе и финансовой ясности.',
    heroCta: 'Принять фокус дня',
    pulseTitle: 'ПУЛЬС ДНЯ',
    pulse: {
      morning: 'Утро',
      morningText: 'спокойно',
      day: 'День',
      dayText: 'продуктивно',
      evening: 'Вечер',
      eveningText: 'восстановление',
      moon: 'Луна в Деве',
      peak: 'Пик дня',
      peakText: '12:00-15:00',
      avoid: 'Не решай из тревоги',
    },
    forecast: {
      label: 'ПРОГНОЗ ДНЯ',
      title: 'Меньше спешки.\nБольше ясности.',
      body: 'Сегодня важно завершать дела,\nа не начинать новые.',
      cta: 'Читать прогноз',
    },
    full: {
      label: 'ПОЛНЫЙ РАЗБОР ДНЯ',
      title: 'Любовь, деньги,\nработа и личный\nритм — в одном\nвыпуске.',
      cta: 'Открыть полный разбор',
    },
    nav: {
      today: 'Сегодня',
      chart: 'Карта',
      lumia: 'LUMIA',
      union: 'Союз',
      diary: 'Дневник',
    },
  };
}

export type LumiaHomeCopy = ReturnType<typeof getLumiaHomeCopy>;

export const LUMIA_HOME_PREVIEW_ITEMS = {
  ru: [
    { label: 'Любовь', imageSrc: '/natal-gateway/synastry-union-v2.webp' },
    { label: 'Деньги', imageSrc: '/natal-backgrounds/work-money.webp' },
    { label: 'Работа', imageSrc: '/natal-backgrounds/strengths.webp' },
    { label: 'Личный ритм', imageSrc: '/natal-backgrounds/daily.webp' },
  ],
  en: [
    { label: 'Love', imageSrc: '/natal-gateway/synastry-union-v2.webp' },
    { label: 'Money', imageSrc: '/natal-backgrounds/work-money.webp' },
    { label: 'Work', imageSrc: '/natal-backgrounds/strengths.webp' },
    { label: 'Personal rhythm', imageSrc: '/natal-backgrounds/daily.webp' },
  ],
} as const;
