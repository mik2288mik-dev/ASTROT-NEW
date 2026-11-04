import type { ChartListItem } from '../../services/storageService';
import { dayEase, dayFace } from '../../components/nebo/PeriodViews';
import { buildFutureMonth, natalPointsFromChart, type CalendarDay } from '../futureCalendar';
import { buildWeekTeaser } from '../futurePeriodTeaser';
import { buildLunarDays } from '../lunarCalendar';
import { sunSignFromDate } from '../synastry/compatScore';
import type { NativeNotificationSettings } from '../nativeNotificationPolicy';
import type { PurchasesSnapshot } from '../oneTimeProducts';
import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { formatDisplayDate } from '../date-utils';
import { isCanonicalNatalChart } from '../natalCalculationProof';
import { getArcana } from '../matrixArcana';
import { computeMatrix, reduceToArcana } from '../matrixOfDestiny';
import { buildNatalInterpretation } from '../natalInterpretation';
import { drawRunes, runeOfTheDay } from '../runes';
import { cardImage, cardOfTheDay, drawSpread, weekKeyOf } from '../tarot';
import { LIFE_PATH, lifePathNumber, parseBirthDate, PERSONAL_YEAR, personalDayNumber, personalYearNumber, pythagorasSquare, SQUARE_CELLS, squareSummary } from '../numerology';
import { buildBigThree, buildChartMoments, SIGN_NOMINATIVE_RU } from '../natalMoments';
import type { NatalUnifiedReading } from '../natalReading/unifiedReading';
import type { PersonalForecastPackage } from '../personalForecastContract';

/** The account's own data in the shape the canvas keeps for «me». */
export type CanvasRealData = {
  account: 'free' | 'plus';
  me: Record<string, unknown>;
  today?: Record<string, unknown>;
  signIdx: number;
  personalDay?: number;
  birthParts?: [number, number, number];
  runeSlug?: string;
  dayCard?: { name: string; meaning: string; img: string | null };
  dayShort?: string;
  retro?: { active: boolean; from?: string; to?: string };
  moonDays?: unknown[][];
  period?: CanvasPeriod;
  year?: { rows: string[][]; best: string[][] };
  yearAhead?: boolean;
  natalFull?: boolean;
  questionCredits?: number;
  personCredits?: number;
  posterCredits?: number;
  posterPreview?: string;
  notif?: NativeNotificationSettings | null;
  purchases?: string[][];
  friends?: Array<{ id: string; name: string; sign: string; last: string; match: string; unread: number }>;
  plusUntil?: string;
  birthShort?: string;
  people?: Array<{ key: string; signIdx: number; birth?: [number, number, number]; who: Record<string, unknown> }>;
};

const BODIES: ReadonlyArray<[string, string]> = [
  ['sun', 'Солнце'], ['moon', 'Луна'], ['mercury', 'Меркурий'], ['venus', 'Венера'], ['mars', 'Марс'],
  ['jupiter', 'Юпитер'], ['saturn', 'Сатурн'], ['uranus', 'Уран'], ['neptune', 'Нептун'], ['pluto', 'Плутон'],
];

function degreeLabel(value: number): string {
  const inSign = ((value % 30) + 30) % 30;
  const whole = Math.floor(inSign);
  return `${whole}°${String(Math.floor((inSign - whole) * 60)).padStart(2, '0')}′`;
}

const signRu = (sign: string): string => SIGN_NOMINATIVE_RU[sign] ?? sign;

function chartFields(chart: NatalChartDataV2): Record<string, unknown> {
  const nat = BODIES.flatMap(([key, label]) => {
    const position = chart.positions[key as keyof typeof chart.positions];
    if (!position) return [];
    return [[key, position.longitude, label, signRu(position.sign), degreeLabel(position.degree), position.house ? `${position.house} дом` : '']];
  });
  const ascendant = chart.angles.ascendant;
  const houses = [...(chart.houses ?? [])].sort((a, b) => a.house - b.house).map((house) => house.longitude);
  const sun = chart.positions.sun;
  // Without a birth time there are no real houses: the wheel starts from the Sun's sign.
  const start = ascendant?.longitude ?? (sun ? Math.floor(sun.longitude / 30) * 30 : 0);
  const cusps = houses.length === 12 ? houses : Array.from({ length: 12 }, (_, index) => (start + index * 30) % 360);
  const tiles = buildBigThree(chart);
  const big3 = ['sun', 'moon', 'ascendant'].map((key) => {
    const tile = tiles.find((item) => item.key === key);
    if (!tile) return ['', ''];
    const house = key === 'ascendant' ? null : chart.positions[key as 'sun' | 'moon']?.house;
    const detail = key === 'ascendant' ? (ascendant ? degreeLabel(ascendant.degree) : '') : house ? `${house} дом` : '';
    return [tile.signLabel, detail];
  });
  return {
    nat,
    cusps,
    asc: start,
    ascIdx: Math.floor(start / 30) % 12,
    big3,
    highlights: buildChartMoments(chart).slice(0, 3).map((moment) => [moment.headline, moment.body]),
  };
}

export function buildCanvasRealData(profile: UserProfile, chart: NatalChartData | null): CanvasRealData {
  const canonical = chart && isCanonicalNatalChart(chart) ? (chart as unknown as NatalChartDataV2) : null;
  const name = profile.name?.trim() || 'Ты';
  const birth = [
    profile.birthDate ? formatDisplayDate(profile.birthDate, 'ru').replace(/(\d{4}) г\./, '$1') : '',
    profile.birthTime,
    profile.birthPlace,
  ].filter(Boolean).join(' · ');
  const sunSign = canonical?.positions.sun ? signRu(canonical.positions.sun.sign) : '';
  return {
    account: profile.isPremium ? 'plus' : 'free',
    signIdx: canonical?.positions.sun ? signIndexOf(canonical.positions.sun.sign) : -1,
    personalDay: (() => {
      const parts = parseBirthDate(profile.birthDate);
      const now = new Date();
      return parts ? personalDayNumber(parts, now.getFullYear(), now.getMonth() + 1, now.getDate()) : undefined;
    })(),
    dayCard: (() => {
      const card = cardOfTheDay(String(profile.id ?? ''), new Date().toISOString().slice(0, 10));
      return { name: `${card.roman} · ${card.name}`, meaning: card.day, img: cardImage(card) };
    })(),
    runeSlug: runeOfTheDay(String(profile.id ?? ''), new Date().toISOString().slice(0, 10)).slug,
    dayShort: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    plusUntil: profile.premiumUntil ? new Date(profile.premiumUntil).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : undefined,
    birthParts: (() => { const parts = parseBirthDate(profile.birthDate); return parts ? [parts.day, parts.month, parts.year] as [number, number, number] : undefined; })(),
    birthShort: profile.birthDate ? profile.birthDate.split('-').reverse().join('.') : undefined,
    me: {
      name,
      sex: profile.gender === 'female' ? 'f' : 'm',
      buyLabel: 'Открыть всю карту',
      price: '490 ₽',
      sub: birth,
      over: [name, sunSign].filter(Boolean).join(' · '),
      // Without a chart nothing from the examples may stay on screen.
      ...(canonical ? chartFields(canonical) : { nat: [], big3: [['', ''], ['', ''], ['', '']], highlights: [], chartMissing: true }),
      ...(profile.birthDate ? dateFields(profile.birthDate) : {}),
    },
  };
}

type CanvasChapter = { title: string; sub: string; locked: boolean; paras: string[] };

const partsLabel = (count: number): string => `${count} ${count === 1 ? 'часть' : count < 5 ? 'части' : 'частей'}`;

/** The story list of the natal screen from the saved reading; closed topics stay visible with a lock. */
export function buildCanvasChapters(chart: NatalChartData | null, reading: NatalUnifiedReading | null, isPremium: boolean): { story: CanvasChapter[]; topics: CanvasChapter[] } | null {
  const canonical = chart && isCanonicalNatalChart(chart) ? (chart as unknown as NatalChartDataV2) : null;
  if (!canonical) return null;
  const locked: CanvasChapter[] = buildNatalInterpretation(canonical, 'ru')?.topics.map((topic) => ({ title: topic.title, sub: '', locked: true, paras: [] })) ?? [];
  const story: CanvasChapter = reading?.story.length
    ? { title: 'Какой ты на самом деле', sub: partsLabel(reading.story.length), locked: false, paras: reading.story.map((block) => block.text) }
    : { title: 'Рассказ о тебе', sub: 'Скоро будет готов', locked: false, paras: ['Рассказ ещё пишется. Загляни сюда чуть позже.'] };
  const topics: CanvasChapter[] = isPremium && reading?.topics.length
    ? reading.topics.map((topic) => ({ title: topic.title, sub: partsLabel(topic.blocks.length), locked: false, paras: topic.blocks.map((block) => block.text) }))
    : locked;
  return { story: isPremium ? [story] : [story, ...locked], topics };
}

const firstSentence = (text: string): string => text.split(/(?<=[.!?])\s/)[0]?.replace(/[.!]$/, '').trim() ?? '';

/** «Сегодня» from the day's personal forecast: its title, text, what to do and what to avoid. */
export function canvasDateLine(now = new Date()): string {
  const date = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return date.charAt(0).toUpperCase() + date.slice(1);
}

export function buildCanvasToday(forecast: PersonalForecastPackage): Record<string, unknown> {
  const blocks = [forecast.overview, ...forecast.sections].filter((section) => section.status === 'ready').flatMap((section) => section.contentBlocks ?? []);
  const pick = (role: string) => blocks.filter((block) => block.role === role).map((block) => firstSentence(block.text)).filter((text) => text.length > 0 && text.length <= 70).slice(0, 4);
  return {
    dateLine: canvasDateLine(),
    dayTitle: forecast.overview.title || firstSentence(forecast.overview.text),
    condition: '',
    horoText: forecast.overview.text,
    why: (forecast.overview.explanationAnchors ?? []).slice(0, 3).map((anchor) => [anchor.conclusion, anchor.explanation]),
    yes: pick('action'),
    no: pick('risk'),
  };
}

const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const digitsOf = (value: number | string): number[] => String(value).split('').map(Number);
const sumLine = (values: number[]): string => values.join(' + ');

/** Matrix and numbers: both come from the birth date alone. */
function dateFields(birthDate: string, now = new Date()): Record<string, unknown> {
  const matrix = computeMatrix(birthDate, 'ru');
  const birth = parseBirthDate(birthDate);
  if (!matrix || !birth) return {};
  const position = (key: string) => matrix.positions.find((item) => item.key === key)?.arcana ?? 0;
  const area = (key: string) => matrix.lifeAreas.find((item) => item.key === key)?.arcana ?? 0;
  const day = position('portrait'); const month = position('talents'); const year = position('karma');
  const base = position('comfort'); const center = position('self'); const personal = position('personalPurpose'); const social = position('socialPurpose');
  const talents = reduceToArcana(month + year);
  const past = reduceToArcana(base + day);
  const habit = reduceToArcana(base + center);
  const purpose = reduceToArcana(habit + reduceToArcana(year + center));
  const money = area('money'); const love = area('love');
  const arcana = getArcana(center);
  const dateText = formatDisplayDate(birthDate, 'ru').replace(/\s*\d{4}.*$/, '');
  const age = now.getFullYear() - birth.year - (now.getMonth() + 1 < birth.month || (now.getMonth() + 1 === birth.month && now.getDate() < birth.day) ? 1 : 0);

  const lifePath = lifePathNumber(birth);
  const lifeMeaning = LIFE_PATH[lifePath] ?? LIFE_PATH[reduceToArcana(lifePath)];
  const allDigits = [...digitsOf(birth.day), ...digitsOf(birth.month), ...digitsOf(birth.year)].filter((digit) => digit > 0);
  const digitSum = allDigits.reduce((sum, digit) => sum + digit, 0);
  const square = pythagorasSquare(birth);
  const thisYear = now.getFullYear();
  const personalYear = personalYearNumber(birth, thisYear);
  return {
    mxV: [day, month, year, base, center, personal, talents, social, past, habit, purpose, money, love],
    steps: [
      [`Считаем по дате ${dateText} ${birth.year}`, 'Начинаем с дня рождения'],
      ['Шаг 1 · День', `Точка слева: ${day}`],
      ['Шаг 2 · Месяц', `Точка сверху: ${month}`],
      ['Шаг 3 · Год', `${sumLine(digitsOf(birth.year))} → ${year}`],
      ['Шаг 4 · Сумма', `${sumLine([day, month, year])} → ${base}`],
      ['Шаг 5 · Центр', `${sumLine([day, month, year, base])} → ${center}`],
      ['Готово · классическая методика', 'Нажми на любой раздел, чтобы прочитать'],
    ],
    mxs: [
      [String(center), 'Характер', 'Кто ты, когда никто не смотрит', false],
      [`${personal}·${social}·${purpose}`, 'Предназначение', 'Цели: для себя, для людей и общая', false],
      [`${month}·${talents}`, 'Таланты', 'Что даётся легче, чем другим', true],
      [String(money), 'Деньги', 'Через что приходят и что мешает', true],
      [String(love), 'Любовь', 'Каким должен быть твой человек', true],
      [`${past}·${habit}`, 'Что тянется из прошлого', 'Привычки, которые повторяются', true],
      [`${year}·${base}`, 'Род', 'Что передалось по роду', true],
      ['0-80', 'Годы жизни', `Что для тебя главное сейчас, в ${age} лет`, true],
    ],
    mxCenter: { over: `Центр · ${center} · аркан ${arcana.name}`, title: cap(arcana.keyword), text: cap(arcana.essence) },
    num: {
      lp: String(lifePath),
      lpTitle: lifeMeaning?.title ?? '',
      calc1: `${sumLine(allDigits)} = ${digitSum}`,
      calc2: digitSum > 9 ? `${sumLine(digitsOf(digitSum))} = ${lifePath}` : '',
      lpText: lifeMeaning?.text ?? '',
      pyNums: square.working.join(' · '),
      pySummary: squareSummary(square),
      year: String(personalYear),
      yearOver: `Твой ${thisYear} · личный год`,
      yearTitle: `Личный год ${personalYear}`,
      yearText: PERSONAL_YEAR[personalYear] ?? '',
    },
    py: square.cells.map((cell) => [cell.count ? cell.digits : 'нет', SQUARE_CELLS[cell.n]?.title ?? '', cell.count]),
  };
}

const SIGN_KEYS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const canvasSignKey = (index: number): string => SIGN_KEYS[index] ?? 'Aries';

function signIndexOf(sign: string): number {
  return SIGN_KEYS.findIndex((key) => key.toLowerCase() === sign.toLowerCase());
}

/** People from «Мои карты», in the shape the canvas keeps for a chart. */
export function buildCanvasPeople(charts: readonly ChartListItem[]): NonNullable<CanvasRealData['people']> {
  return charts
    .filter((chart) => (chart.subject_type === 'saved_person' || !chart.is_primary) && !chart.archived_at)
    .map((chart) => {
      const canonical = isCanonicalNatalChart(chart.chart_data) ? (chart.chart_data as unknown as NatalChartDataV2) : null;
      const sunSign = canonical?.positions.sun?.sign ?? '';
      const name = chart.name?.trim() || 'Человек';
      const birth = [chart.birth_date ? formatDisplayDate(chart.birth_date, 'ru').replace(/(\d{4}) г\./, '$1') : '', chart.birth_time, chart.birth_place].filter(Boolean).join(' · ');
      return {
        key: `chart${chart.id}`,
        birth: (() => { const parts = parseBirthDate(chart.birth_date); return parts ? [parts.day, parts.month, parts.year] as [number, number, number] : undefined; })(),
        signIdx: sunSign ? signIndexOf(sunSign) : -1,
        who: {
          other: true, name, gen: name, acc: name, about: `про: ${name}`, sub: birth,
          over: [name, sunSign ? signRu(sunSign) : ''].filter(Boolean).join(' · '),
          title: `Карта: ${name}`, storyTitle: `Рассказ: ${name}`, buyLabel: 'Открыть с NEBO Plus', price: '', note: '',
          chReal: { story: [{ title: 'Весь рассказ', sub: '', locked: true, paras: [] }], topics: [] },
          ...(canonical ? chartFields(canonical) : { nat: [], big3: [['', ''], ['', ''], ['', '']], highlights: [] }),
          ...(chart.birth_date ? dateFields(chart.birth_date) : {}),
          // The highlights speak to «ты»: they belong to the person's own chart.
          highlights: [],
        },
      };
    });
}

const WEEK_KEYS = { tarot: 'nebo.tarot.week.v1', runes: 'nebo.runes.week.v1' } as const;

function weekUse(kind: keyof typeof WEEK_KEYS): number {
  try {
    const stored = JSON.parse(window.localStorage.getItem(WEEK_KEYS[kind]) || 'null') as { week?: string; used?: number } | null;
    return stored?.week === weekKeyOf(new Date()) && Number.isFinite(stored?.used) ? Number(stored?.used) : 0;
  } catch {
    return 0;
  }
}

function markWeekUse(kind: keyof typeof WEEK_KEYS): void {
  try { window.localStorage.setItem(WEEK_KEYS[kind], JSON.stringify({ week: weekKeyOf(new Date()), used: weekUse(kind) + 1 })); } catch { /* counted until the app closes */ }
}

/** Tarot and runes: the same decks, texts and weekly free spread as the old screens. */
export function buildCanvasOracle(openAccess: () => boolean) {
  return {
    needsPayment: (kind: keyof typeof WEEK_KEYS): boolean => !openAccess() && weekUse(kind) >= 1,
    tarot: () => {
      markWeekUse('tarot');
      const [past, now, next] = drawSpread();
      return {
        reading: [['Прошлое', `${past.roman} · ${past.name}`, past.past], ['Сейчас', `${now.roman} · ${now.name}`, now.now], ['Дальше', `${next.roman} · ${next.name}`, next.next]],
        meaning: now.day,
        advice: next.advice,
        cards: [past, now, next].map((card) => ({ name: card.name, img: cardImage(card) })),
      };
    },
    runes: () => {
      markWeekUse('runes');
      const [past, now, next] = drawRunes();
      return {
        cast: [['Что было', past.slug, past.past], ['Что сейчас', now.slug, now.now], ['Что дальше', next.slug, next.next]],
        meaning: now.day,
        advice: next.advice,
      };
    },
  };
}

/** «Покупки»: what this person really owns. */
export function buildCanvasPurchases(profile: UserProfile, snapshot: PurchasesSnapshot): string[][] {
  const dayText = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const rows: string[][] = [];
  if (profile.isPremium) rows.push(['plus', 'NEBO Plus', 'подписка', profile.premiumUntil ? `до ${dayText(profile.premiumUntil)}` : '']);
  if (snapshot.esoUntil && Date.parse(snapshot.esoUntil) > Date.now()) rows.push(['tarot', 'Таро, руны и числа на год', 'эзотерика', `до ${dayText(snapshot.esoUntil)}`]);
  if (snapshot.natalFull) rows.push(['natal', 'Натальная карта целиком', 'навсегда', 'открыта']);
  if (snapshot.yearAhead) rows.push(['calendar', 'Год вперёд', 'навсегда', 'открыт']);
  if (snapshot.questionCredits) rows.push(['chats', 'Вопросы о карте', 'не сгорают', `осталось: ${snapshot.questionCredits}`]);
  if (snapshot.personCredits) rows.push(['people', 'Разбор пары', 'не сгорает', `осталось: ${snapshot.personCredits}`]);
  if (snapshot.posterCredits) rows.push(['poster', 'Постер', 'можно сделать', `осталось: ${snapshot.posterCredits}`]);
  if (snapshot.spreadCredits > 0) rows.push(['tarot', 'Расклады таро и рун', 'не сгорают', `осталось: ${snapshot.spreadCredits}`]);
  snapshot.giftCodes.forEach((gift) => rows.push(['gift', `Подарок Plus · ${gift.months} мес.`, gift.code, gift.redeemed ? 'использован' : 'не использован']));
  return rows;
}

export type CanvasPeriod = {
  todayIndex: number;
  mood: number[];
  ticks: Array<[number, string]>;
  week: Array<{ dow: string; num: number; icon: string; text: string; state: 'past' | 'today' | 'future' }>;
  cells: Array<{ key: string; d: number; good: boolean; rx: boolean; quarter: string | null; today: boolean }>;
  events: string[][];
  days: Record<string, { date: string; title: string; text: string }>;
  text: Record<string, string>;
};

const WEEK_DOWS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTH_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const dayKeyLocal = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const longDate = (key: string): string => new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

/** Week and month from the same calendar as the old screens: transits to this person's chart and the real sky. */
export function buildCanvasPeriod(engine: typeof import('astronomy-engine'), profile: UserProfile, chart: NatalChartData | null): CanvasPeriod | null {
  const now = new Date();
  const todayKey = dayKeyLocal(now);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const startKey = dayKeyLocal(monday);
  const end = new Date(monday.getTime() + 34 * 86400000);
  const natal = natalPointsFromChart(chart);
  const all: CalendarDay[] = [];
  for (let y = monday.getFullYear(), m = monday.getMonth() + 1, guard = 0; guard < 3; guard += 1) {
    all.push(...buildFutureMonth(engine, y, m, natal, profile.birthTimezone || 'Europe/Moscow').days);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  const days = all.filter((day) => day.dayKey >= startKey && day.dayKey <= dayKeyLocal(end));
  if (days.length < 35) return null;
  const lunar = buildLunarDays(engine, new Date(`${startKey}T12:00:00Z`), 35);
  const sun = sunSignFromDate(profile.birthDate);
  const sunIndex = sun ? SIGN_KEYS.findIndex((key) => key.toLowerCase() === sun.toLowerCase()) : -1;
  const todayIndex = days.findIndex((day) => day.dayKey === todayKey);
  const eased = days.map((day, index) => Math.round(((dayEase(day, lunar[index], sunIndex >= 0 ? sunIndex : null) + 1.5) / 3) * 100));
  const weekDays = days.slice(0, 7);
  const teaser = buildWeekTeaser({ days: weekDays, fromKey: todayKey, toKey: weekDays[6].dayKey, hasNatal: Boolean(natal), language: 'ru' });
  const monthOf = (key: string) => Number(key.slice(5, 7)) - 1;
  const firstMonth = monthOf(days[0].dayKey);
  const lastMonth = monthOf(days[34].dayKey);
  const shortLabel = (key: string, withMonth: boolean) => `${Number(key.slice(8, 10))}${withMonth ? ` ${MONTH_SHORT[monthOf(key)]}` : ''}`;
  const dayMap: CanvasPeriod['days'] = {};
  days.forEach((day, index) => {
    const face = dayFace(day, lunar[index]);
    const details = [...day.sky, ...day.personal].map((event) => event.body).filter(Boolean);
    dayMap[day.dayKey] = {
      date: longDate(day.dayKey),
      title: face.title,
      text: details.join(' ') || `Луна ${day.moonSignIn ? `в ${day.moonSignIn}` : ''}. Особых событий на этот день нет.`,
    };
  });
  const events: string[][] = [];
  for (const day of days) {
    if (day.dayKey < todayKey) continue;
    for (const event of [...day.sky, ...day.personal]) events.push([String(Number(day.dayKey.slice(8, 10))), MONTH_SHORT[monthOf(day.dayKey)], event.headline, event.body]);
  }
  return {
    todayIndex,
    mood: eased,
    ticks: [0, 7, 14, 21, 28].map((index) => [index, shortLabel(days[index].dayKey, index === 0 || monthOf(days[index].dayKey) !== monthOf(days[index - 7].dayKey))]),
    week: weekDays.map((day, index) => {
      const face = dayFace(day, lunar[index]);
      return { dow: WEEK_DOWS[index], num: Number(day.dayKey.slice(8, 10)), icon: face.icon, text: face.title, state: day.dayKey < todayKey ? 'past' : day.dayKey === todayKey ? 'today' : 'future' };
    }),
    cells: days.map((day) => ({ key: day.dayKey, d: Number(day.dayKey.slice(8, 10)), good: day.tone === 'good', rx: day.mercuryRetrograde, quarter: day.moonQuarter ?? null, today: day.dayKey === todayKey })),
    events: events.slice(0, 12),
    days: dayMap,
    text: {
      weekRange: `${longDate(weekDays[0].dayKey).split(' ')[0]} - ${longDate(weekDays[6].dayKey)}`,
      weekTitle: teaser[0] ?? 'Твоя неделя',
      weekText: teaser.slice(1).join(' '),
      monthTitle: firstMonth === lastMonth ? MONTH_NOM[firstMonth] : `${MONTH_NOM[firstMonth]} - ${MONTH_NOM[lastMonth].toLowerCase()}`,
      weekLock: 'дальше в Plus',
      remind: `Напомнить ${longDate(todayKey)}`,
      weekMood: 'Настроение посчитано по транзитам к твоей карте и Луне.',
      monthMood: 'Видно, какие дни легче, а какие труднее.',
    },
  };
}

const MONTH_LABEL = (month: number, year: number): string => `${MONTH_NOM[month - 1]} ${year}`;

/** «Год вперёд»: twelve months from the same calendar of transits to this person's chart. */
export function buildCanvasYear(engine: typeof import('astronomy-engine'), profile: UserProfile, chart: NatalChartData | null): NonNullable<CanvasRealData['year']> {
  const natal = natalPointsFromChart(chart);
  const now = new Date();
  const rows: string[][] = [];
  const score: Record<string, Array<[string, number]>> = { love: [], work: [], money: [], hard: [] };
  for (let index = 0; index < 12; index += 1) {
    const at = new Date(now.getFullYear(), now.getMonth() + index, 1);
    const month = at.getMonth() + 1;
    const days = buildFutureMonth(engine, at.getFullYear(), month, natal, profile.birthTimezone || 'Europe/Moscow').days;
    const personal = days.flatMap((day) => day.personal);
    const sky = days.flatMap((day) => day.sky);
    const good = days.filter((day) => day.tone === 'good').length;
    const hard = days.filter((day) => day.tone === 'hard').length;
    const lead = personal.find((event) => event.tone === (good >= hard ? 'good' : 'hard')) ?? personal[0];
    const skyLead = sky.find((event) => event.kind !== 'moon') ?? sky[0];
    const texts = [lead?.body, skyLead && skyLead !== (lead as unknown) ? skyLead.body : null].filter(Boolean);
    const tone = good > hard + 2 ? 'good' : hard > good + 2 ? 'hard' : good + hard === 0 ? 'calm' : 'mix';
    rows.push([MONTH_LABEL(month, at.getFullYear()), lead?.headline ?? skyLead?.headline ?? 'Спокойный месяц', texts.map((text) => (/[.!?]$/.test(String(text)) ? text : `${text}.`)).join(' ') || 'Больших событий по твоей карте в этом месяце нет.', tone]);
    const label = MONTH_NOM[month - 1].toLowerCase();
    score.love.push([label, personal.filter((event) => event.planet === 'Venus' && event.tone === 'good').length]);
    score.work.push([label, personal.filter((event) => event.planet === 'Mars' && event.tone === 'good').length]);
    score.money.push([label, personal.filter((event) => event.planet === 'Jupiter' && event.tone === 'good').length]);
    score.hard.push([label, hard]);
  }
  const best = (list: Array<[string, number]>): string => {
    const top = list.filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([label]) => label);
    return top.join(', ') || 'нет ярких месяцев';
  };
  return { rows, best: [['Любовь', best(score.love)], ['Дела', best(score.work)], ['Деньги', best(score.money)], ['Осторожно', best(score.hard)]] };
}
