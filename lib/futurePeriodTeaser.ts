import { formatDayRu, type CalendarDay, type PersonalEvent, type SkyEvent } from './futureCalendar';

/**
 * Opening lines of the week and month cards in «Будущее» for people without
 * NEBO+. They are built from the person's own calendar (sky events and, when a
 * chart is saved, transits to it), so the free preview is real and costs no AI.
 * The full AI reading opens with NEBO+.
 */

const MONTHS_IN_RU = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const PROPER_NOUNS = /^(Солнц|Лун|Меркури|Венер|Марс|Юпитер|Сатурн)/u;

/** Lowercases the first letter after a dash or colon, but keeps planet names capitalised. */
function lowerFirst(text: string): string {
  if (!text || PROPER_NOUNS.test(text)) return text;
  return `${text[0].toLowerCase()}${text.slice(1)}`;
}

/** The sky event that matters most for planning: eclipse, Mercury, then the Moon. */
function strongestSkyEvent(events: readonly SkyEvent[]): SkyEvent | null {
  const rank = (event: SkyEvent) => (
    event.kind === 'eclipse' ? 0 : event.kind === 'mercury-start' ? 1 : event.kind === 'mercury-end' ? 2 : event.quarter === 'full' || event.quarter === 'new' ? 3 : 4
  );
  return [...events].sort((a, b) => rank(a) - rank(b) || a.dayKey.localeCompare(b.dayKey))[0] ?? null;
}

function skyLineRu(event: SkyEvent): string {
  return `${formatDayRu(event.dayKey)}, ${lowerFirst(event.headline)}: ${lowerFirst(event.body)}.`;
}

function personalLineRu(event: PersonalEvent): string {
  return `Ближайший личный день, ${formatDayRu(event.dayKey)}: ${lowerFirst(event.headline)}.`;
}

export type FutureTeaserInput = {
  /** Calendar days of the period (several months are fine), sorted by date. */
  days: readonly CalendarDay[];
  /** First day that is still ahead, YYYY-MM-DD. */
  fromKey: string;
  /** Last day of the period, YYYY-MM-DD. */
  toKey: string;
  /** Whether transits to a saved chart were calculated. */
  hasNatal: boolean;
  language: 'ru' | 'en';
};

function periodDays(input: FutureTeaserInput): CalendarDay[] {
  return input.days.filter((day) => day.dayKey >= input.fromKey && day.dayKey <= input.toKey);
}

export function buildWeekTeaser(input: FutureTeaserInput): string[] {
  const days = periodDays(input);
  if (!days.length) return [];
  const good = days.filter((day) => day.tone === 'good').length;
  const hard = days.filter((day) => day.tone === 'hard').length;
  const sky = strongestSkyEvent(days.flatMap((day) => day.sky));
  const retrograde = days.some((day) => day.mercuryRetrograde);
  const firstPersonal = days.flatMap((day) => day.personal)[0] ?? null;
  const lines: string[] = [];

  if (input.language === 'en') {
    if (input.hasNatal) {
      lines.push(good || hard
        ? `By your chart this week has ${good} easy and ${hard} tense ${good + hard === 1 ? 'day' : 'days'}.`
        : 'By your chart the week is even: no sharp turns.');
    }
    if (sky) lines.push(`${Number(sky.dayKey.slice(8))} ${MONTHS_EN[Number(sky.dayKey.slice(5, 7)) - 1]}: a notable day in the sky.`);
    else if (retrograde) lines.push('Mercury is retrograde: double-check plans and messages.');
    return lines.slice(0, 2);
  }

  if (input.hasNatal) {
    lines.push(good || hard
      ? `По твоей карте на этой неделе ${good} ${pluralRu(good, 'лёгкий день', 'лёгких дня', 'лёгких дней')} и ${hard} ${pluralRu(hard, 'напряжённый', 'напряжённых', 'напряжённых')}.`
      : 'По твоей карте неделя ровная: без резких поворотов, можно спокойно делать своё.');
  }
  if (firstPersonal) lines.push(personalLineRu(firstPersonal));
  if (sky) lines.push(skyLineRu(sky));
  else if (retrograde) lines.push('Меркурий идёт назад, перепроверяй договорённости и сообщения перед отправкой.');
  if (!lines.length) {
    const moonSigns = new Set(days.map((day) => day.moonSignIn)).size;
    lines.push(`Луна за неделю пройдёт через ${moonSigns} ${pluralRu(moonSigns, 'знак', 'знака', 'знаков')}, настроение будет меняться чаще, чем планы.`);
  }
  return lines.slice(0, 3);
}

export function buildMonthTeaser(input: FutureTeaserInput & { month: number }): string[] {
  const days = periodDays(input);
  if (!days.length) return [];
  const personal = days.flatMap((day) => day.personal);
  const personalDays = new Set(personal.map((event) => event.dayKey)).size;
  const sky = strongestSkyEvent(days.flatMap((day) => day.sky));
  const retrogradeDays = days.filter((day) => day.mercuryRetrograde).length;
  const lines: string[] = [];

  if (input.language === 'en') {
    if (input.hasNatal) lines.push(`${personalDays} ${personalDays === 1 ? 'day stands' : 'days stand'} out for you in ${MONTHS_EN[input.month - 1]} by your chart.`);
    if (retrogradeDays) lines.push(`Mercury is retrograde for ${retrogradeDays} ${retrogradeDays === 1 ? 'day' : 'days'} of the month.`);
    else if (sky) lines.push(`${Number(sky.dayKey.slice(8))} ${MONTHS_EN[input.month - 1]}: a notable day in the sky.`);
    return lines.slice(0, 2);
  }

  const monthIn = MONTHS_IN_RU[input.month - 1];
  if (input.hasNatal) {
    lines.push(personalDays
      ? `В ${monthIn} у тебя ${personalDays} ${pluralRu(personalDays, 'важный день', 'важных дня', 'важных дней')} по карте, дальше разберём, что с ними делать.`
      : `В ${monthIn} по твоей карте нет резких дней, хороший месяц, чтобы спокойно довести начатое.`);
  }
  if (personal[0]) lines.push(personalLineRu(personal[0]));
  if (retrogradeDays) lines.push(`Меркурий идёт назад ${retrogradeDays} ${pluralRu(retrogradeDays, 'день', 'дня', 'дней')}: важное лучше не подписывать наспех.`);
  else if (sky) lines.push(skyLineRu(sky));
  return lines.slice(0, 3);
}

/**
 * First sentences of a ready reading for the card preview: two or three
 * sentences, never cut in the middle of a word.
 */
export function readingOpeningLines(text: string, maxSentences = 3, maxChars = 260): string {
  const prose = text.replace(/\s+/gu, ' ').trim();
  if (!prose) return '';
  const sentences = prose.match(/[^.!?…]+[.!?…]+(?:\s|$)/gu) ?? [prose];
  let result = '';
  for (const sentence of sentences.slice(0, maxSentences)) {
    const next = `${result}${sentence}`.trim();
    if (result && next.length > maxChars) break;
    result = `${next} `;
  }
  return result.trim();
}
