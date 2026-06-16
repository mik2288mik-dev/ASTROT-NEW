/**
 * Приветствие по времени суток (часовой пояс Москвы).
 * Заменяет захардкоженное «Доброе утро».
 */
export function getMoscowHour(date: Date = new Date()): number {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    hour: 'numeric',
    hour12: false,
  }).format(date);
  const hour = Number(raw);
  // Некоторые окружения возвращают 24 вместо 0 в полночь.
  return Number.isFinite(hour) ? hour % 24 : 0;
}

export function getDayGreeting(language: 'ru' | 'en', date: Date = new Date()): string {
  const hour = getMoscowHour(date);
  const part: 'morning' | 'day' | 'evening' | 'night' =
    hour >= 5 && hour < 12 ? 'morning'
    : hour >= 12 && hour < 18 ? 'day'
    : hour >= 18 && hour < 23 ? 'evening'
    : 'night';

  const map = {
    ru: { morning: 'Доброе утро,', day: 'Добрый день,', evening: 'Добрый вечер,', night: 'Доброй ночи,' },
    en: { morning: 'Good morning,', day: 'Good afternoon,', evening: 'Good evening,', night: 'Good night,' },
  } as const;

  return map[language === 'en' ? 'en' : 'ru'][part];
}
