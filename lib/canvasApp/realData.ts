import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { formatDisplayDate } from '../date-utils';
import { isCanonicalNatalChart } from '../natalCalculationProof';
import { getArcana } from '../matrixArcana';
import { computeMatrix, reduceToArcana } from '../matrixOfDestiny';
import { buildNatalInterpretation } from '../natalInterpretation';
import { LIFE_PATH, lifePathNumber, parseBirthDate, PERSONAL_YEAR, personalYearNumber, pythagorasSquare, SQUARE_CELLS, squareSummary } from '../numerology';
import { buildBigThree, buildChartMoments, SIGN_NOMINATIVE_RU } from '../natalMoments';
import type { NatalUnifiedReading } from '../natalReading/unifiedReading';
import type { PersonalForecastPackage } from '../personalForecastContract';

/** The account's own data in the shape the canvas keeps for «me». */
export type CanvasRealData = {
  account: 'free' | 'plus';
  me: Record<string, unknown>;
  today?: Record<string, unknown>;
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
    me: {
      name,
      sex: profile.gender === 'female' ? 'f' : 'm',
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
