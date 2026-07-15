/** Public, non-personal snapshot of the current Moon and Mercury. */
import { getCurrentTransits } from '../transits-calculator';
import {
  calculateMoonPhaseFromLongitudes,
  type SkyTodaySnapshot,
} from '../skyToday';

export async function computeSkyToday(
  dateKey: string,
  now: Date = new Date(),
): Promise<SkyTodaySnapshot> {
  const transits = await getCurrentTransits(now);
  const mercury = transits.mercury;
  const sunLongitude = transits.sun.longitude;
  const moonLongitude = transits.moon.longitude;

  if (
    transits.source !== 'swisseph'
    || !mercury
    || typeof sunLongitude !== 'number'
    || typeof moonLongitude !== 'number'
  ) {
    throw new Error('SWISS_SKY_SNAPSHOT_UNAVAILABLE');
  }

  const phase = calculateMoonPhaseFromLongitudes(sunLongitude, moonLongitude);

  return {
    date: dateKey,
    moon: {
      sign: transits.moon.sign,
      degree: transits.moon.degree,
      phaseKey: phase.phaseKey,
      phaseLabel: phase.phaseLabel,
      illumination: phase.illumination,
    },
    mercury: {
      sign: mercury.sign,
      degree: mercury.degree,
      retrograde: mercury.retrograde,
      motionLabel: mercury.retrograde ? 'ретроградный' : 'прямой',
      speedLongitude: mercury.speedLongitude,
    },
    source: 'swisseph',
  };
}
