type AstronomyEngine = typeof import('astronomy-engine');

const DAY_MS = 86_400_000;

/** Local calendar day of a moment, YYYY-MM-DD. */
export function localDayKey(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function mercuryLongitude(engine: AstronomyEngine, date: Date): number {
  return engine.Ecliptic(engine.GeoVector(engine.Body.Mercury, date, true)).elon;
}

function isMercuryRetrograde(engine: AstronomyEngine, date: Date): boolean {
  const now = mercuryLongitude(engine, date);
  const later = mercuryLongitude(engine, new Date(date.getTime() + 3_600_000));
  const delta = ((later - now + 540) % 360) - 180;
  return delta < 0;
}

export type UpcomingSky = {
  /** Day of the next new moon (today included), local. */
  newMoonKey: string | null;
  /** Day Mercury turns retrograde, when it is still ahead; null while it is retrograde already. */
  mercuryRetroKey: string | null;
};

export function findUpcomingSky(engine: AstronomyEngine, now: Date, timezone: string, horizonDays = 45): UpcomingSky {
  const startOfToday = new Date(`${localDayKey(now, timezone)}T00:00:00Z`);
  let newMoonKey: string | null = null;
  try {
    const found = engine.SearchMoonPhase(0, new Date(startOfToday.getTime() - DAY_MS / 2), 40);
    if (found) newMoonKey = localDayKey(found.date, timezone);
  } catch {
    newMoonKey = null;
  }

  let mercuryRetroKey: string | null = null;
  if (!isMercuryRetrograde(engine, now)) {
    for (let day = 1; day <= horizonDays; day += 1) {
      const sample = new Date(now.getTime() + day * DAY_MS);
      if (isMercuryRetrograde(engine, sample)) {
        mercuryRetroKey = localDayKey(sample, timezone);
        break;
      }
    }
  }
  return { newMoonKey, mercuryRetroKey };
}
