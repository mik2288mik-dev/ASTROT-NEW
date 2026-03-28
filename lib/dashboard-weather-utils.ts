/** Shared weather/moon copy for dashboard strip (single source, no duplicate widget logic). */

export function translateWeatherCondition(condition: string, language: string): string {
  if (language !== 'ru') return condition;
  const translations: Record<string, string> = {
    sunny: 'Солнечно',
    clear: 'Ясно',
    'partly cloudy': 'Переменная облачность',
    cloudy: 'Облачно',
    overcast: 'Пасмурно',
    mist: 'Туман',
    fog: 'Туман',
    'light rain': 'Небольшой дождь',
    'moderate rain': 'Умеренный дождь',
    'heavy rain': 'Сильный дождь',
    'patchy rain': 'Местами дождь',
    thundery: 'Гроза',
  };
  const lower = condition.toLowerCase();
  for (const [key, value] of Object.entries(translations)) {
    if (lower.includes(key)) return value;
  }
  return condition;
}

export function translateMoonPhaseLabel(phase: string, language: string): string {
  if (language !== 'ru') return phase;
  const translations: Record<string, string> = {
    'new moon': 'Новолуние',
    'waxing crescent': 'Растущий серп',
    'waxing gibbous': 'Растущая Луна',
    'first quarter': 'Первая четверть',
    'full moon': 'Полнолуние',
    'waning gibbous': 'Убывающая Луна',
    'last quarter': 'Последняя четверть',
  };
  const lower = phase.toLowerCase();
  for (const [key, value] of Object.entries(translations)) {
    if (lower.includes(key)) return value;
  }
  return phase;
}
