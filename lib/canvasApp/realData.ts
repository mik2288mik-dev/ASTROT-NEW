import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { formatDisplayDate } from '../date-utils';
import { isCanonicalNatalChart } from '../natalCalculationProof';
import { buildNatalInterpretation } from '../natalInterpretation';
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
      ...(canonical ? chartFields(canonical) : {}),
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
