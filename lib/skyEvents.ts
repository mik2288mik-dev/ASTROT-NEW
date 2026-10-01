/**
 * Ближайшие события неба для уведомлений: полнолуние, новолуние, разворот Меркурия.
 * Считается по Swiss Ephemeris на московские сутки (основная аудитория) и кэшируется на день.
 */
import type { SkyEventKind } from './nativePushCopy';
import type { NativeSkyEvent } from './nativeNotificationPolicy';

const MSK_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;
let cache: { key: string; events: NativeSkyEvent[] } | null = null;

function mskDayKey(utcMs: number): string {
  return new Date(utcMs + MSK_OFFSET_MS).toISOString().slice(0, 10);
}

export async function getUpcomingSkyEvents(now = new Date(), days = 16): Promise<NativeSkyEvent[]> {
  const todayKey = mskDayKey(now.getTime());
  if (cache?.key === `${todayKey}:${days}`) return cache.events;
  const { calculatePlanetaryTransitsAt } = await import('./swisseph-calculator');
  // Полночь по Москве сегодня, в UTC.
  const startUtc = Date.parse(`${todayKey}T00:00:00Z`) - MSK_OFFSET_MS;
  const samples = Array.from({ length: days + 1 }, (_, index) => {
    const at = startUtc + index * DAY_MS;
    const chart = calculatePlanetaryTransitsAt(new Date(at));
    const elongation = (((chart.moon.longitude - chart.sun.longitude) % 360) + 360) % 360;
    return { at, elongation, mercuryRx: !!chart.mercury?.retrograde };
  });
  const events: NativeSkyEvent[] = [];
  // Событие попадает в сутки, если случилось между их началом и началом следующих.
  for (let i = 0; i < samples.length - 1; i++) {
    const from = samples[i];
    const to = samples[i + 1];
    const dayKey = mskDayKey(from.at);
    const push = (kind: SkyEventKind) => events.push({ dayKey, kind });
    if (from.elongation < 180 && to.elongation >= 180) push('full_moon');
    if (to.elongation < from.elongation) push('new_moon');
    if (!from.mercuryRx && to.mercuryRx) push('mercury_rx_start');
    if (from.mercuryRx && !to.mercuryRx) push('mercury_rx_end');
  }
  cache = { key: `${todayKey}:${days}`, events };
  return events;
}
