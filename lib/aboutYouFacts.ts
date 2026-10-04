import type { NatalChartData, PlanetPosition } from '../types';
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

export type ChartFact = { title: string; text: string };
export type BirthFact = { value: string; caption: string };

function signIndex(sign: string | undefined | null): number {
  if (!sign) return -1;
  const lower = sign.trim().toLowerCase();
  return SIGN_KEYS.findIndex((key) => key.toLowerCase() === lower);
}

function dayIndex(dayKey: string): number {
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
    text: opening ? `${meaning} Особенно заметно — ${opening.charAt(0).toLowerCase()}${opening.slice(1)}.` : meaning,
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
    facts.push({ value: `Луна ${lit}%`, caption: `в момент твоего рождения — ${phrase}` });
  }

  const rising = signIndex(input.rising);
  if (input.birthTimeKnown && input.birthTime && input.risingReliable && rising >= 0) {
    facts.push({ value: input.birthTime.slice(0, 5), caption: `время рождения — от него твой Асцендент ${SIGN_NOM_RU[rising]}` });
  }

  const todayUtc = Date.UTC(today.y, today.m - 1, today.d);
  let next = Date.UTC(today.y, birth.m - 1, birth.d);
  if (next < todayUtc) next = Date.UTC(today.y + 1, birth.m - 1, birth.d);
  const days = Math.round((next - todayUtc) / 86_400_000);
  const nextWeekday = WEEKDAYS_RU[new Date(next).getUTCDay()];
  facts.push(days === 0
    ? { value: 'Сегодня', caption: 'твой день рождения — с праздником!' }
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
