const FULL_MOON_UTC = Date.parse('2026-10-26T04:12:00Z');
const RX_START_UTC = Date.parse('2026-10-24T10:00:00Z');
const RX_END_UTC = Date.parse('2026-11-13T18:00:00Z');
const SYNODIC_MS = 29.530588853 * 86_400_000;

jest.mock('../lib/swisseph-calculator', () => ({
  calculatePlanetaryTransitsAt: (date: Date) => {
    const t = date.getTime();
    // Простая модель: Солнце стоит на 0°, элонгация Луны растёт равномерно, 180° — в FULL_MOON_UTC.
    const elongation = (((180 + ((t - FULL_MOON_UTC) / SYNODIC_MS) * 360) % 360) + 360) % 360;
    return {
      sun: { longitude: 0 },
      moon: { longitude: elongation },
      mercury: { retrograde: t >= RX_START_UTC && t < RX_END_UTC },
    };
  },
}));

import { getUpcomingSkyEvents } from '../lib/skyEvents';

describe('upcoming sky events', () => {
  it('assigns moon phases and Mercury stations to Moscow calendar days', async () => {
    const events = await getUpcomingSkyEvents(new Date('2026-10-20T06:00:00Z'));
    expect(events).toEqual([
      { dayKey: '2026-10-24', kind: 'mercury_rx_start' },
      { dayKey: '2026-10-26', kind: 'full_moon' },
    ]);
    // Новолуние ~11 октября 09:40 UTC — это 11-е и по Москве.
    const october = await getUpcomingSkyEvents(new Date('2026-10-02T06:00:00Z'));
    expect(october).toEqual([{ dayKey: '2026-10-11', kind: 'new_moon' }]);
  });

  it('sees the end of the retrograde when it falls inside the window', async () => {
    const events = await getUpcomingSkyEvents(new Date('2026-11-05T06:00:00Z'));
    expect(events).toContainEqual({ dayKey: '2026-11-13', kind: 'mercury_rx_end' });
  });
});
