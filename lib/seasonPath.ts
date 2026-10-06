import { houseOfLongitude } from './skyMonitor';

type AstronomyEngine = typeof import('astronomy-engine');

/**
 * «Твоя осень» (or winter, spring, summer): where the Sun walks through the
 * user's own houses during the current season — real dates from the ephemeris.
 */

const DAY_MS = 86_400_000;

const SEASONS = [
  { name: 'зима', title: 'Твоя зима', months: [12, 1, 2] },
  { name: 'весна', title: 'Твоя весна', months: [3, 4, 5] },
  { name: 'лето', title: 'Твоё лето', months: [6, 7, 8] },
  { name: 'осень', title: 'Твоя осень', months: [9, 10, 11] },
] as const;

/** Short themes of each house — what a month there tends to be about. */
const HOUSE_THEME: Record<number, string> = {
  1: 'новый старт', 2: 'деньги и вещи', 3: 'общение и учёба', 4: 'дом и семья',
  5: 'радость и увлечения', 6: 'работа и режим', 7: 'отношения', 8: 'общие дела и доверие',
  9: 'поездки и новое', 10: 'карьера', 11: 'друзья и планы', 12: 'отдых и перезагрузка',
};

const HOUSE_STEP: Record<number, string> = {
  1: 'Солнце в твоём 1 доме, личный новый цикл, хорошо начинать своё',
  2: 'Фокус на деньгах и том, что тебе ценно',
  3: 'Больше разговоров, учёбы и коротких поездок',
  4: 'Время для дома, близких и уюта',
  5: 'Больше радости: увлечения, свидания, отдых',
  6: 'Порядок в делах, режиме и здоровье',
  7: 'В центре, отношения и партнёрство',
  8: 'Общие деньги, договорённости и доверие',
  9: 'Тянет учиться, путешествовать и пробовать новое',
  10: 'Работа и цели на виду, хорошо проявить себя',
  11: 'Друзья, команды и общие планы',
  12: 'Солнце уходит в зону отдыха, меньше встреч, больше сна',
};

export type SeasonStep = { date: Date; house: number; text: string };
export type SeasonPath = { title: string; headline: string; steps: SeasonStep[] };

function sunLongitude(engine: AstronomyEngine, date: Date): number {
  const value = engine.Ecliptic(engine.GeoVector(engine.Body.Sun, date, true)).elon;
  return ((value % 360) + 360) % 360;
}

function seasonOf(month: number) {
  return SEASONS.find((season) => (season.months as readonly number[]).includes(month)) ?? SEASONS[3];
}

export function buildSeasonPath(engine: AstronomyEngine, now: Date, cusps: readonly number[] | null): SeasonPath | null {
  if (!cusps) return null;
  const season = seasonOf(now.getMonth() + 1);
  const endMonth = season.months[2];
  const endYear = endMonth < now.getMonth() + 1 && season.name === 'зима' ? now.getFullYear() + 1 : now.getFullYear();
  const end = new Date(endYear, endMonth, 1); // first day after the season
  const startHouse = houseOfLongitude(sunLongitude(engine, now), cusps);
  if (!startHouse) return null;

  const steps: SeasonStep[] = [];
  let previous = startHouse;
  for (let time = now.getTime() + DAY_MS; time < end.getTime() + 20 * DAY_MS && steps.length < 3; time += DAY_MS) {
    const house = houseOfLongitude(sunLongitude(engine, new Date(time)), cusps);
    if (house && house !== previous) {
      steps.push({ date: new Date(time), house, text: HOUSE_STEP[house] });
      previous = house;
    }
  }
  const themes = [startHouse, ...steps.map((step) => step.house)]
    .map((house) => HOUSE_THEME[house])
    .filter((theme, index, list) => list.indexOf(theme) === index)
    .slice(0, 3);
  if (!themes.length) return null;
  // Themes already contain «и» («дом и семья»), so they are listed with commas only.
  const list = themes.join(', ');
  return {
    title: season.title,
    headline: `Для тебя эта ${season.name === 'лето' ? 'летняя пора' : season.name} - ${list}`,
    steps,
  };
}
