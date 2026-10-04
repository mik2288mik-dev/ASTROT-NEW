import { useEffect, useState } from 'react';
import { approximateObserver } from '../../lib/skyPalette';

export type SkyNow = {
  /** Sun altitude above the horizon, degrees, for the phone's own time zone. */
  sunAltitude: number;
  /** Moon phase angle 0..360 (0 new, 180 full). */
  moonPhase: number;
  /** Lit share of the Moon, 0..100. */
  moonIllumination: number;
};

let engine: Promise<typeof import('astronomy-engine')> | null = null;

function compute(astro: typeof import('astronomy-engine'), date: Date): SkyNow {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const place = approximateObserver(zone, date.getTimezoneOffset());
  const observer = new astro.Observer(place.latitude, place.longitude, 0);
  const equator = astro.Equator(astro.Body.Sun, date, observer, true, true);
  const horizon = astro.Horizon(date, observer, equator.ra, equator.dec, 'normal');
  return {
    sunAltitude: horizon.altitude,
    moonPhase: astro.MoonPhase(date),
    moonIllumination: Math.round(astro.Illumination(astro.Body.Moon, date).phase_fraction * 100),
  };
}

/**
 * The real sky right now: colour by the Sun's height, the Moon in its true
 * phase. Recomputed every five minutes; null until the engine has loaded.
 */
export function useSkyNow(): SkyNow | null {
  const [sky, setSky] = useState<SkyNow | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    engine ??= import('astronomy-engine');
    void engine
      .then((astro) => {
        if (!active) return;
        const update = () => setSky(compute(astro, new Date()));
        update();
        timer = setInterval(update, 5 * 60_000);
      })
      .catch(() => { engine = null; });
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return sky;
}
