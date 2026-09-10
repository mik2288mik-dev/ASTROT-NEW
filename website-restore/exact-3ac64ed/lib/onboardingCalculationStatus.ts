import type { BirthTimeMode } from './birthTime';

export function onboardingCalculationStatus(
  elapsedSeconds: number,
  timeMode: Exclude<BirthTimeMode, 'range'>,
): string {
  if (elapsedSeconds < 10) return 'Сохраняем данные и начинаем расчёт.';
  if (elapsedSeconds < 45) {
    return timeMode === 'exact'
      ? 'Расчёт продолжается — сервису нужно чуть больше времени.'
      : 'Всё ещё считаем: для примерного или неизвестного времени проверяем несколько моментов.';
  }
  return 'Расчёт всё ещё идёт. Не закрывай экран — при ошибке введённые данные сохранятся.';
}
