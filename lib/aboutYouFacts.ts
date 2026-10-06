import type { NatalChartData, PlanetPosition } from '../types';
import { detectTransitAspects, type AspectTone } from './transitAspects';
import type { CurrentTransits, PlanetTransit } from './transits-calculator';
import { HOUSE_OPENINGS_RU, SIGN_STYLE_RU, bodySignMeaning } from './natalInterpretation/meanings';

/**
 * «Сегодня о тебе»: warm, checkable facts from the user's own birth data.
 * No life counters (days lived, age meters) — only things that are fun to know.
 */

const SIGN_KEYS = Object.keys(SIGN_STYLE_RU);
const SIGN_IN_RU = ['Овне', 'Тельце', 'Близнецах', 'Раке', 'Льве', 'Деве', 'Весах', 'Скорпионе', 'Стрельце', 'Козероге', 'Водолее', 'Рыбах'];
const SIGN_NOM_RU = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
const WEEKDAYS_NOM_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

type FactBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
const ROTATION: FactBody[] = ['sun', 'moon', 'venus', 'mars', 'mercury', 'jupiter', 'saturn'];
const BODY_RU: Record<FactBody, string> = {
  sun: 'Солнце', moon: 'Луна', mercury: 'Меркурий', venus: 'Венера', mars: 'Марс', jupiter: 'Юпитер', saturn: 'Сатурн',
};

export type ChartFact = { title: string; text: string; kicker?: string };

/** Fast planets: their aspects to the chart change from day to day. */
export const FAST_TRANSIT_BODIES = ['Moon', 'Sun', 'Mercury', 'Venus', 'Mars'] as const;

const TRANSIT_NAME_RU: Record<string, string> = { moon: 'Луна', sun: 'Солнце', mercury: 'Меркурий', venus: 'Венера', mars: 'Марс' };
const TRANSIT_THEME_RU: Record<string, string> = {
  moon: 'настроение дня', sun: 'энергия дня', mercury: 'общение', venus: 'тяга к приятному', mars: 'напор',
};
const NATAL_POSS_RU: Record<string, string> = {
  sun: 'твоё Солнце', moon: 'твоя Луна', mercury: 'твой Меркурий', venus: 'твоя Венера', mars: 'твой Марс',
  jupiter: 'твой Юпитер', saturn: 'твой Сатурн', uranus: 'твой Уран', neptune: 'твой Нептун', pluto: 'твой Плутон',
  rising: 'твой Асцендент', mc: 'твоя середина неба',
};
const NATAL_INS_RU: Record<string, string> = {
  sun: 'твоим самоощущением', moon: 'твоими чувствами и привычками', mercury: 'твоим мышлением и речью',
  venus: 'твоими симпатиями', mars: 'твоей решимостью', jupiter: 'твоими планами', saturn: 'твоей ответственностью',
  uranus: 'твоей тягой к переменам', neptune: 'твоими мечтами', pluto: 'твоими глубокими желаниями',
  rising: 'тем, как тебя видят другие', mc: 'твоими целями',
};
const TONE_WORD_RU: Record<AspectTone, string> = { support: 'поддержка', pressure: 'напряжение', accent: 'усиление' };
const TONE_TEXT_RU: Record<AspectTone, (theme: string, natal: string) => string> = {
  support: (theme, natal) => `Сегодня ${theme} в ладу с ${natal}. Хороший день, чтобы опереться на это и не усложнять.`,
  pressure: (theme, natal) => `Сегодня ${theme} спорит с ${natal}. Не спеши с резкими решениями, дай себе время.`,
  accent: (theme, natal) => `Сегодня ${theme} подчёркивает то, что связано с ${natal}. Это будет заметно, используй.`,
};

/**
 * «Фишка дня»: the tightest aspect of today's fast planets to the person's own chart.
 * `transits` is built for the day by the caller; null when no aspect is close enough today.
 */
export function transitFactOfDay(chart: NatalChartData | null | undefined, transits: CurrentTransits | null): ChartFact | null {
  if (!chart || !transits) return null;
  const aspects = detectTransitAspects(chart, transits, { limit: 60 })
    .filter((item) => item.transitPlanet in TRANSIT_THEME_RU && item.natalPlanet in NATAL_INS_RU);
  const pick = aspects[0];
  if (!pick) return null;
  return {
    kicker: 'Сегодня в твоей карте',
    title: `${TRANSIT_NAME_RU[pick.transitPlanet]} и ${NATAL_POSS_RU[pick.natalPlanet]}: ${TONE_WORD_RU[pick.tone]}`,
    text: TONE_TEXT_RU[pick.tone](TRANSIT_THEME_RU[pick.transitPlanet], NATAL_INS_RU[pick.natalPlanet]),
  };
}

const MOON_SIGN_TODAY_RU = [
  'хочется действовать быстро и напрямую', 'тянет к покою, вкусной еде и порядку', 'много разговоров, мыслей и новых идей',
  'важны дом, близкие и тёплое общение', 'хочется яркости, признания и щедрости', 'удобно наводить порядок и заниматься делами',
  'лучше получаются договорённости и компромиссы', 'чувства глубже обычного, не торопи выводы', 'тянет к движению, планам и новым местам',
  'собранность и серьёзный подход к делам', 'хочется свободы, друзей и необычных решений', 'чувствительность выше, лучше беречь силы',
];

/** Two facts about the Moon today; they differ every day. */
export function todayMoonFacts(astro: typeof import('astronomy-engine'), dayKey: string): BirthFact[] {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return [];
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const longitude = astro.Ecliptic(astro.GeoVector(astro.Body.Moon, date, true)).elon;
  const sign = Math.floor(longitude / 30) % 12;
  const angle = astro.MoonPhase(date);
  const percent = Math.round(((1 - Math.cos((angle * Math.PI) / 180)) / 2) * 100);
  const waxing = angle < 180;
  const phase = percent <= 4
    ? 'почти новолуние, тихое время'
    : percent >= 96
      ? 'почти полнолуние, эмоции на пике'
      : waxing ? 'Луна растёт, хорошо начинать новое' : 'Луна убывает, хорошо завершать и отдыхать';
  return [
    { value: `Луна в ${SIGN_IN_RU[sign]}`, caption: `сегодня ${MOON_SIGN_TODAY_RU[sign]}` },
    { value: `Луна ${percent}%`, caption: phase },
  ];
}

/** Ecliptic longitudes of today's fast planets (astronomy-engine), shaped like the server's transits. */
export function buildFastTransits(
  astro: typeof import('astronomy-engine'),
  dayKey: string,
): CurrentTransits | null {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const out: Record<string, PlanetTransit> = {};
  for (const name of FAST_TRANSIT_BODIES) {
    const longitude = astro.Ecliptic(astro.GeoVector(astro.Body[name], date, true)).elon;
    const key = name.toLowerCase();
    out[key] = { planet: key, sign: SIGN_KEYS[Math.floor(longitude / 30) % 12], degree: longitude % 30, longitude, retrograde: false, speedLongitude: 0 };
  }
  return { date: dayKey, ...out } as unknown as CurrentTransits;
}
export type BirthFact = { value: string; caption: string };

function signIndex(sign: string | undefined | null): number {
  if (!sign) return -1;
  const lower = sign.trim().toLowerCase();
  return SIGN_KEYS.findIndex((key) => key.toLowerCase() === lower);
}

export function dayIndex(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

function daysWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/** One fact of the chart, a different planet each day. */
export function chartFactOfDay(chart: NatalChartData | null | undefined, dayKey: string): ChartFact | null {
  if (!chart) return null;
  const housesReliable = chart.chartQuality?.housesReliable === true;
  const candidates = ROTATION
    .map((body) => ({ body, position: (chart as unknown as Record<string, PlanetPosition | null | undefined>)[body] ?? null }))
    .filter((item): item is { body: FactBody; position: PlanetPosition } => signIndex(item.position?.sign) >= 0);
  if (!candidates.length) return null;
  const pick = candidates[((dayIndex(dayKey) % candidates.length) + candidates.length) % candidates.length];
  const index = signIndex(pick.position.sign);
  const meaning = bodySignMeaning(pick.body, SIGN_KEYS[index], 'ru');
  if (!meaning) return null;
  const house = Number(pick.position.house);
  const opening = housesReliable && Number.isInteger(house) ? HOUSE_OPENINGS_RU[house] : null;
  return {
    title: `${BODY_RU[pick.body]} в ${SIGN_IN_RU[index]}${opening ? `, ${house} дом` : ''}`,
    text: opening ? `${meaning} Особенно заметно, ${opening.charAt(0).toLowerCase()}${opening.slice(1)}.` : meaning,
  };
}

function parseDate(dayKey: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim());
  return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : null;
}

/** Facts about the day of birth itself. `moonAtBirth` comes from the ephemeris (0..100). */
export function birthFacts(input: {
  birthDate: string;
  birthTime: string | null | undefined;
  birthTimeKnown: boolean;
  rising: string | null | undefined;
  risingReliable: boolean;
  moonAtBirth: number | null;
  todayKey: string;
}): BirthFact[] {
  const birth = parseDate(input.birthDate);
  const today = parseDate(input.todayKey);
  if (!birth || !today) return [];
  const facts: BirthFact[] = [];

  const weekday = new Date(Date.UTC(birth.y, birth.m - 1, birth.d)).getUTCDay();
  facts.push({ value: WEEKDAYS_NOM_RU[weekday], caption: 'день недели, на который пришёлся твой день рождения' });

  if (input.moonAtBirth !== null && Number.isFinite(input.moonAtBirth)) {
    const lit = Math.round(input.moonAtBirth);
    const phrase = lit <= 3 ? 'почти новолуние' : lit >= 97 ? 'почти полнолуние' : lit < 50 ? 'тонкая Луна' : 'яркая Луна';
    facts.push({ value: `Луна ${lit}%`, caption: `в момент твоего рождения, ${phrase}` });
  }

  const rising = signIndex(input.rising);
  if (input.birthTimeKnown && input.birthTime && input.risingReliable && rising >= 0) {
    facts.push({ value: input.birthTime.slice(0, 5), caption: `время рождения, от него твой Асцендент ${SIGN_NOM_RU[rising]}` });
  }

  const todayUtc = Date.UTC(today.y, today.m - 1, today.d);
  let next = Date.UTC(today.y, birth.m - 1, birth.d);
  if (next < todayUtc) next = Date.UTC(today.y + 1, birth.m - 1, birth.d);
  const days = Math.round((next - todayUtc) / 86_400_000);
  const nextWeekday = WEEKDAYS_RU[new Date(next).getUTCDay()];
  facts.push(days === 0
    ? { value: 'Сегодня', caption: 'твой день рождения, с праздником!' }
    : { value: `Через ${days} ${daysWord(days)}`, caption: `день рождения, в ${nextWeekday}` });
  return facts;
}

/** Local birth moment as a real instant, from the chart's time zone. */
export function birthInstant(birthDate: string, birthTime: string | null | undefined, timeZone: string | null | undefined): Date | null {
  const birth = parseDate(birthDate);
  if (!birth) return null;
  const [hh, mm] = (birthTime && /^\d{1,2}:\d{2}/.test(birthTime) ? birthTime : '12:00').split(':').map(Number);
  const guess = Date.UTC(birth.y, birth.m - 1, birth.d, hh, mm);
  if (!timeZone) return new Date(guess);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return new Date(guess - (shown - guess));
  } catch {
    return new Date(guess);
  }
}
