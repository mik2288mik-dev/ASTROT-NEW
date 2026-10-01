/**
 * «Будущее»: a month calendar computed on the device with astronomy-engine.
 * Public sky events (Moon quarters, eclipses, Mercury retrograde) need no
 * chart; personal days are exact transits of the Sun, Venus, Mars, Jupiter
 * and Saturn to the person's natal Sun, Moon, Venus, Mars and Ascendant.
 * No AI and no server: the day reading itself is loaded only on request.
 */

type AstronomyEngine = typeof import('astronomy-engine');

const DAY_MS = 86_400_000;

export type MoonQuarter = 'new' | 'first' | 'full' | 'last';
export type DayTone = 'good' | 'hard' | null;
export type NatalPointKey = 'sun' | 'moon' | 'venus' | 'mars' | 'ascendant';
export type TransitPlanet = 'Sun' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn';
export type TransitAspect = 0 | 60 | 90 | 120 | 180;

export type NatalPoints = Partial<Record<NatalPointKey, number>>;

export type PersonalEvent = {
  dayKey: string;
  planet: TransitPlanet;
  point: NatalPointKey;
  aspect: TransitAspect;
  tone: Exclude<DayTone, null>;
  headline: string;
  body: string;
};

export type SkyEvent = {
  dayKey: string;
  kind: 'moon' | 'eclipse' | 'mercury-start' | 'mercury-end';
  quarter?: MoonQuarter;
  headline: string;
  body: string;
};

export type CalendarDay = {
  dayKey: string;
  day: number;
  weekday: number;
  moonQuarter: MoonQuarter | null;
  eclipse: boolean;
  mercuryRetrograde: boolean;
  /** Sign the Moon is in at local noon, e.g. «Рыбах». */
  moonSignIn: string;
  tone: DayTone;
  personal: PersonalEvent[];
  sky: SkyEvent[];
};

export type FutureMonth = {
  year: number;
  month: number;
  days: CalendarDay[];
  personalEvents: PersonalEvent[];
  skyEvents: SkyEvent[];
  summary: { headline: string; body: string; goodDays: number; hardDays: number; retrogradeDays: number };
};

const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GENITIVE_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function monthNameRu(month: number): string {
  const name = MONTHS_RU[month - 1] ?? '';
  return name ? `${name[0].toUpperCase()}${name.slice(1)}` : '';
}

export function formatDayRu(dayKey: string): string {
  const [, month, day] = dayKey.split('-').map(Number);
  return `${day} ${MONTHS_GENITIVE_RU[month - 1] ?? ''}`;
}

const SIGN_IN_RU = ['Овне', 'Тельце', 'Близнецах', 'Раке', 'Льве', 'Деве', 'Весах', 'Скорпионе', 'Стрельце', 'Козероге', 'Водолее', 'Рыбах'];

const QUARTER_ANGLE: Record<MoonQuarter, number> = { new: 0, first: 90, full: 180, last: 270 };
const QUARTER_COPY: Record<MoonQuarter, { headline: string; body: string }> = {
  new: { headline: 'Новолуние', body: 'Хорошее время задумать новое и записать планы' },
  first: { headline: 'Первая четверть', body: 'Время решений: сдвинуть то, что застряло' },
  full: { headline: 'Полнолуние', body: 'Эмоции громче обычного — не спеши с выводами' },
  last: { headline: 'Последняя четверть', body: 'Время разбирать завалы и отпускать лишнее' },
};

const POINT_GENITIVE: Record<NatalPointKey, string> = {
  sun: 'твоего Солнца', moon: 'твоей Луны', venus: 'твоей Венеры', mars: 'твоего Марса', ascendant: 'твоего Асцендента',
};
const POINT_ACCUSATIVE: Record<NatalPointKey, string> = {
  sun: 'твоё Солнце', moon: 'твою Луну', venus: 'твою Венеру', mars: 'твой Марс', ascendant: 'твой Асцендент',
};
const POINT_INSTRUMENTAL: Record<NatalPointKey, string> = {
  sun: 'твоим Солнцем', moon: 'твоей Луной', venus: 'твоей Венерой', mars: 'твоим Марсом', ascendant: 'твоим Асцендентом',
};
const PLANET_RU: Record<TransitPlanet, string> = {
  Sun: 'Солнце', Venus: 'Венера', Mars: 'Марс', Jupiter: 'Юпитер', Saturn: 'Сатурн',
};

const TRANSIT_COPY: Record<TransitPlanet, { good: string; hard: string }> = {
  Sun: { good: 'Лёгкий день: получается то, что давно начато', hard: 'Хочется одного, а нужно другое — день для компромиссов' },
  Venus: { good: 'Приятный день для встреч, покупок и подарков себе', hard: 'Не трать на эмоциях и не выясняй отношения сгоряча' },
  Mars: { good: 'Много энергии — хорошо для спорта и решительных дел', hard: 'Легко вспылить. Не спорь и не гони' },
  Jupiter: { good: 'Удачное время просить, договариваться и расширяться', hard: 'Не обещай лишнего — легко переоценить силы' },
  Saturn: { good: 'Хорошо для долгих дел и наведения порядка', hard: 'Дела тормозятся. Не дави — разбей задачу на шаги' },
};

const CONJUNCTION_TONE: Record<TransitPlanet, Exclude<DayTone, null>> = {
  Sun: 'good', Venus: 'good', Jupiter: 'good', Mars: 'hard', Saturn: 'hard',
};

/** Slow planets cross a natal point rarely; their aspects matter more and get wider coverage. */
const TRANSIT_PLANETS: readonly TransitPlanet[] = ['Sun', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const ASPECTS: readonly TransitAspect[] = [0, 60, 90, 120, 180];

function normalize(value: number): number {
  return ((value % 360) + 360) % 360;
}

function signedDistance(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

function dayKeyOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function noonUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function longitude(engine: AstronomyEngine, body: string, date: Date): number {
  return normalize(engine.Ecliptic(engine.GeoVector(body as Parameters<AstronomyEngine['GeoVector']>[0], date, true)).elon);
}

function transitCopy(planet: TransitPlanet, point: NatalPointKey, aspect: TransitAspect): { tone: Exclude<DayTone, null>; headline: string; body: string } {
  if (planet === 'Sun' && point === 'sun' && aspect === 0) {
    return { tone: 'good', headline: 'Солнце вернулось на место твоего рождения', body: 'Твой личный новый год: хороший момент подвести итоги и загадать планы' };
  }
  const tone = aspect === 0 ? CONJUNCTION_TONE[planet] : aspect === 60 || aspect === 120 ? 'good' : 'hard';
  const name = PLANET_RU[planet];
  const headline = aspect === 0
    ? `${name} рядом с ${POINT_INSTRUMENTAL[point]}`
    : tone === 'good'
      ? `${name} на стороне ${POINT_GENITIVE[point]}`
      : `${name} давит на ${POINT_ACCUSATIVE[point]}`;
  return { tone, headline, body: TRANSIT_COPY[planet][tone] };
}

function moonQuarters(engine: AstronomyEngine, start: Date, end: Date): Array<{ date: Date; quarter: MoonQuarter }> {
  const found: Array<{ date: Date; quarter: MoonQuarter }> = [];
  let cursor = new Date(start.getTime() - 3_600_000);
  for (let guard = 0; guard < 8; guard += 1) {
    const next = (Object.keys(QUARTER_ANGLE) as MoonQuarter[])
      .map((quarter) => ({ quarter, date: engine.SearchMoonPhase(QUARTER_ANGLE[quarter], cursor, 40)?.date ?? null }))
      .filter((item): item is { quarter: MoonQuarter; date: Date } => item.date instanceof Date)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    if (!next || next.date.getTime() >= end.getTime()) break;
    found.push(next);
    cursor = new Date(next.date.getTime() + 3_600_000);
  }
  return found;
}

export function buildFutureMonth(
  engine: AstronomyEngine,
  year: number,
  month: number,
  natal: NatalPoints | null,
  timezone = 'UTC',
): FutureMonth {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const localKey = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  };

  const days: CalendarDay[] = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const noon = noonUtc(year, month, day);
    const mercuryNow = longitude(engine, 'Mercury', noon);
    const mercuryLater = longitude(engine, 'Mercury', new Date(noon.getTime() + 3_600_000));
    return {
      dayKey: dayKeyOf(year, month, day),
      day,
      weekday: (noon.getUTCDay() + 6) % 7,
      moonQuarter: null,
      eclipse: false,
      mercuryRetrograde: signedDistance(mercuryLater, mercuryNow) < 0,
      moonSignIn: SIGN_IN_RU[Math.floor(longitude(engine, 'Moon', noon) / 30)],
      tone: null,
      personal: [],
      sky: [],
    };
  });
  const byKey = new Map(days.map((day) => [day.dayKey, day]));
  const skyEvents: SkyEvent[] = [];
  const pushSky = (event: SkyEvent) => {
    const day = byKey.get(event.dayKey);
    if (!day) return;
    day.sky.push(event);
    skyEvents.push(event);
  };

  for (const { date, quarter } of moonQuarters(engine, monthStart, monthEnd)) {
    const key = localKey(date);
    const day = byKey.get(key);
    if (day) day.moonQuarter = quarter;
    pushSky({ dayKey: key, kind: 'moon', quarter, ...QUARTER_COPY[quarter] });
  }

  const lunar = engine.SearchLunarEclipse(monthStart);
  if (lunar.kind !== 'penumbral' && lunar.peak.date < monthEnd) {
    const key = localKey(lunar.peak.date);
    const day = byKey.get(key);
    if (day) day.eclipse = true;
    pushSky({ dayKey: key, kind: 'eclipse', headline: lunar.kind === 'total' ? 'Полное лунное затмение' : 'Частичное лунное затмение', body: 'Сильные эмоции и неожиданные итоги — не принимай резких решений' });
  }
  const solar = engine.SearchGlobalSolarEclipse(monthStart);
  if (solar.peak.date < monthEnd) {
    const key = localKey(solar.peak.date);
    const day = byKey.get(key);
    if (day) day.eclipse = true;
    pushSky({ dayKey: key, kind: 'eclipse', headline: solar.kind === 'total' ? 'Полное солнечное затмение' : solar.kind === 'annular' ? 'Кольцеобразное солнечное затмение' : 'Частичное солнечное затмение', body: 'Хорошее время закрыть старое и начать с чистого листа' });
  }

  days.forEach((day, index) => {
    const previous = index === 0
      ? (() => {
          const noon = new Date(noonUtc(year, month, 1).getTime() - DAY_MS);
          return signedDistance(longitude(engine, 'Mercury', new Date(noon.getTime() + 3_600_000)), longitude(engine, 'Mercury', noon)) < 0;
        })()
      : days[index - 1].mercuryRetrograde;
    if (day.mercuryRetrograde && !previous) pushSky({ dayKey: day.dayKey, kind: 'mercury-start', headline: 'Меркурий разворачивается назад', body: 'Перепроверяй договорённости, билеты и сообщения перед отправкой' });
    if (!day.mercuryRetrograde && previous) pushSky({ dayKey: day.dayKey, kind: 'mercury-end', headline: 'Меркурий снова идёт прямо', body: 'Можно возвращаться к отложенным подписаниям и покупкам' });
  });

  const personalEvents: PersonalEvent[] = [];
  if (natal) {
    const points = (Object.keys(natal) as NatalPointKey[]).filter((key) => Number.isFinite(natal[key]));
    for (const planet of TRANSIT_PLANETS) {
      const samples = Array.from({ length: daysInMonth + 1 }, (_, index) => longitude(engine, planet, noonUtc(year, month, index + 1)));
      for (const point of points) {
        const natalLongitude = natal[point]!;
        for (const aspect of ASPECTS) {
          for (const target of aspect === 0 || aspect === 180 ? [aspect] : [aspect, -aspect]) {
            for (let index = 0; index < daysInMonth; index += 1) {
              const a = signedDistance(samples[index], natalLongitude + target);
              const b = signedDistance(samples[index + 1], natalLongitude + target);
              if (Math.sign(a) === Math.sign(b) || Math.abs(a) > 5 || Math.abs(b) > 5) continue;
              // The exact moment lies between the two noons; its local date is the day of the event.
              const moment = new Date(noonUtc(year, month, index + 1).getTime() + (Math.abs(a) / (Math.abs(a) + Math.abs(b))) * DAY_MS);
              const day = byKey.get(localKey(moment));
              if (!day) continue;
              if (day.personal.some((event) => event.planet === planet && event.point === point && event.aspect === aspect)) continue;
              const copy = transitCopy(planet, point, aspect);
              const event: PersonalEvent = { dayKey: day.dayKey, planet, point, aspect, ...copy };
              day.personal.push(event);
              personalEvents.push(event);
            }
          }
        }
      }
    }
    for (const day of days) {
      const good = day.personal.filter((event) => event.tone === 'good').length;
      const hard = day.personal.length - good;
      day.tone = day.personal.length ? (good >= hard ? 'good' : 'hard') : null;
    }
  }

  personalEvents.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  skyEvents.sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  const goodDays = days.filter((day) => day.tone === 'good').length;
  const hardDays = days.filter((day) => day.tone === 'hard').length;
  const retrogradeDays = days.filter((day) => day.mercuryRetrograde).length;
  const eclipse = days.some((day) => day.eclipse);
  const headline = retrogradeDays >= 10
    ? 'Месяц перепроверок'
    : eclipse
      ? 'Месяц перемен'
      : natal && goodDays > hardDays + 1
        ? 'Лёгкий месяц'
        : natal && hardDays > goodDays + 1
          ? 'Напряжённый месяц'
          : 'Ровный месяц';
  const parts: string[] = [];
  if (natal) parts.push(`Лёгких дней для тебя — ${goodDays}, напряжённых — ${hardDays}.`);
  if (retrogradeDays) parts.push(`Меркурий идёт назад ${retrogradeDays} ${retrogradeDays === 1 ? 'день' : retrogradeDays < 5 ? 'дня' : 'дней'}: не подписывай важное наспех.`);
  if (eclipse) parts.push('В месяце есть затмение — время, когда что-то заканчивается и начинается новое.');

  return {
    year,
    month,
    days,
    personalEvents,
    skyEvents,
    summary: { headline, body: parts.join(' '), goodDays, hardDays, retrogradeDays },
  };
}

/** How far ahead NEBO+ opens, by the bought plan; rolling from today. */
export function futureHorizonDays(entitlement: { productId?: string | null; period?: string | null; startsAt?: string | null; endsAt?: string | null } | null | undefined): number {
  const id = `${entitlement?.productId ?? ''} ${entitlement?.period ?? ''}`.toLowerCase();
  if (/year|annual|12m|p1y|365/.test(id)) return 365;
  if (/quarter|3m|p3m|90/.test(id)) return 90;
  if (/month|1m|p1m|30/.test(id)) return 30;
  const start = Date.parse(entitlement?.startsAt ?? '');
  const end = Date.parse(entitlement?.endsAt ?? '');
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const days = (end - start) / DAY_MS;
    if (days > 200) return 365;
    if (days > 60) return 90;
  }
  return 30;
}

/** Days a person may open one by one: today and tomorrow for free, the next 30 for NEBO+. */
export const FREE_OPEN_DAYS = 2;
export const PREMIUM_DAILY_DAYS = 30;

export function natalPointsFromChart(chart: unknown): NatalPoints | null {
  const value = chart as {
    positions?: Partial<Record<'sun' | 'moon' | 'venus' | 'mars', { longitude?: number }>>;
    angles?: { ascendant?: { longitude?: number } | null };
    chartQuality?: { ascendantReliable?: boolean };
  } | null;
  if (!value?.positions) return null;
  const points: NatalPoints = {};
  for (const key of ['sun', 'moon', 'venus', 'mars'] as const) {
    const longitudeValue = value.positions[key]?.longitude;
    if (typeof longitudeValue === 'number' && Number.isFinite(longitudeValue)) points[key] = longitudeValue;
  }
  const ascendant = value.angles?.ascendant?.longitude;
  if (value.chartQuality?.ascendantReliable && typeof ascendant === 'number') points.ascendant = ascendant;
  return Object.keys(points).length ? points : null;
}

export type DayGoal = 'meeting' | 'talk' | 'purchase' | 'rest';

export const DAY_GOALS: ReadonlyArray<{ id: DayGoal; label: string }> = [
  { id: 'meeting', label: 'Встреча' },
  { id: 'talk', label: 'Важный разговор' },
  { id: 'purchase', label: 'Покупка' },
  { id: 'rest', label: 'Отдых' },
];

/**
 * Days that suit a goal, with the reason. Plain rules over the same events
 * the calendar shows: Venus, the Sun or Jupiter on your side for meetings;
 * the same plus a direct Mercury for talks; Venus or Jupiter and a direct
 * Mercury for purchases; quiet days without events for rest. Days where hard
 * transits outweigh good ones never qualify.
 */
export function pickDays(month: FutureMonth, goal: DayGoal, fromKey: string): Array<{ dayKey: string; reason: string }> {
  const days = month.days.filter((day) => day.dayKey >= fromKey);
  const good = (day: CalendarDay, planets: TransitPlanet[]) => day.personal.find((event) => event.tone === 'good' && planets.includes(event.planet));
  // A day counts when its good transits outweigh the hard ones.
  const outweighed = (day: CalendarDay) => {
    const goodCount = day.personal.filter((event) => event.tone === 'good').length;
    return goodCount <= day.personal.length - goodCount;
  };
  const picks: Array<{ dayKey: string; reason: string }> = [];
  for (const day of days) {
    if (goal === 'meeting') {
      const event = good(day, ['Venus', 'Sun', 'Jupiter']);
      if (event && !outweighed(day)) picks.push({ dayKey: day.dayKey, reason: event.headline });
    } else if (goal === 'talk') {
      const event = good(day, ['Sun', 'Jupiter', 'Saturn', 'Venus']);
      if (event && !outweighed(day) && !day.mercuryRetrograde) picks.push({ dayKey: day.dayKey, reason: `${event.headline}, Меркурий идёт прямо` });
    } else if (goal === 'purchase') {
      const event = good(day, ['Venus', 'Jupiter']);
      if (event && !outweighed(day) && !day.mercuryRetrograde) picks.push({ dayKey: day.dayKey, reason: event.headline });
    } else if (!day.personal.length && !day.moonQuarter && !day.eclipse) {
      picks.push({ dayKey: day.dayKey, reason: `Спокойный день, Луна в ${day.moonSignIn}` });
    }
  }
  return goal === 'rest' ? picks.slice(0, 6) : picks;
}
