/**
 * Этот файл теперь использует чистую JavaScript реализацию
 * без нативных зависимостей для деплоя на любых платформах
 */
import { calculateNatalChart as calculateNatalChartPureJS, getCoordinates } from './pure-js-astro-calculator';

/**
 * Экспорт функций из чистой JavaScript реализации
 * Теперь всё работает без нативных зависимостей!
 */
export { getCoordinates };

/**
 * Основная функция расчета натальной карты
 * Просто проксирует вызов к чистой JS реализации
 */
export async function calculateNatalChart(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string
): Promise<any> {
  return calculateNatalChartPureJS(name, birthDate, birthTime, birthPlace);
}
