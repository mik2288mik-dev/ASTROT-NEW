/**
 * «Небо сегодня» — какие планеты ретроградны прямо сейчас.
 * Серверный расчёт через swisseph (calculatePlanetaryTransitsAt).
 * Ретроградность геоцентрическая и от места наблюдателя не зависит —
 * достаточно момента времени. Кэшируется на сутки (по ключу даты).
 */
import { calculatePlanetaryTransitsAt } from '../swisseph-calculator';

export type RetrogradePlanet = {
  key: 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
  nameRu: string;
  nameEn: string;
  sign: string; // English sign name (e.g. "Pisces")
};

export type SkyTodayResult = {
  date: string; // ключ даты, под который посчитано
  retrograde: RetrogradePlanet[];
};

const PLANET_NAMES: Record<RetrogradePlanet['key'], { ru: string; en: string }> = {
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
};

let cache: { key: string; result: SkyTodayResult } | null = null;

export function computeSkyToday(dateKey: string, now: Date = new Date()): SkyTodayResult {
  if (cache && cache.key === dateKey) return cache.result;

  const transits = calculatePlanetaryTransitsAt(now);
  // Солнце и Луна не бывают ретроградными — проверяем Меркурий…Сатурн.
  const candidates: Array<[RetrogradePlanet['key'], { retrograde?: boolean; sign?: string } | null | undefined]> = [
    ['mercury', transits.mercury],
    ['venus', transits.venus],
    ['mars', transits.mars],
    ['jupiter', transits.jupiter],
    ['saturn', transits.saturn],
  ];

  const retrograde: RetrogradePlanet[] = [];
  for (const [key, pos] of candidates) {
    if (pos?.retrograde) {
      retrograde.push({
        key,
        nameRu: PLANET_NAMES[key].ru,
        nameEn: PLANET_NAMES[key].en,
        sign: pos.sign || '',
      });
    }
  }

  const result: SkyTodayResult = { date: dateKey, retrograde };
  cache = { key: dateKey, result };
  return result;
}
