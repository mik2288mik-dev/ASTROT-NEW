import { fromZonedTime } from 'date-fns-tz';
import type { NatalChartDataV2 } from './natalChartV2Types';
import type { PersonalForecastWindow } from './personalForecastContract';
import { calculatePlanetaryTransitsAt } from './swisseph-calculator';
import { ASPECT_DEFS } from './transitAspects';

/**
 * What actually happens for this person on this date, ranked and already put
 * into plain words. The day forecast is written from this brief, so the writer
 * retells calculated events instead of choosing a topic on its own.
 */

const TRANSIT_KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
type TransitKey = (typeof TRANSIT_KEYS)[number];

const TRANSIT_RU: Record<TransitKey, { name: string; about: string; lasts: string; weight: number }> = {
  moon: { name: 'Луна', about: 'настроение и то, на что ты обращаешь внимание', lasts: 'только сегодня', weight: 1.25 },
  sun: { name: 'Солнце', about: 'на что уходят силы и внимание', lasts: 'несколько дней', weight: 1 },
  mercury: { name: 'Меркурий', about: 'разговоры, переписка, документы и дорога', lasts: 'несколько дней', weight: 1.05 },
  venus: { name: 'Венера', about: 'симпатии, отношения, покупки и удовольствия', lasts: 'несколько дней', weight: 1.1 },
  mars: { name: 'Марс', about: 'энергия, скорость, раздражение и споры', lasts: 'около недели', weight: 1.15 },
  jupiter: { name: 'Юпитер', about: 'возможности, щедрость и желание взять больше', lasts: 'несколько недель', weight: 0.85 },
  saturn: { name: 'Сатурн', about: 'обязательства, сроки и чувство ответственности', lasts: 'несколько недель', weight: 0.85 },
  uranus: { name: 'Уран', about: 'неожиданные изменения планов', lasts: 'несколько месяцев', weight: 0.6 },
  neptune: { name: 'Нептун', about: 'неясность и мечты, в деталях легко ошибиться', lasts: 'несколько месяцев', weight: 0.6 },
  pluto: { name: 'Плутон', about: 'давление и желание всё держать под контролем', lasts: 'несколько месяцев', weight: 0.6 },
};

const NATAL_RU: Record<string, { name: string; about: string; weight: number }> = {
  sun: { name: 'твоё Солнце', about: 'уверенность в себе и то, чего ты хочешь', weight: 1.2 },
  moon: { name: 'твоя Луна', about: 'чувства и потребность в спокойствии', weight: 1.2 },
  mercury: { name: 'твой Меркурий', about: 'то, как ты думаешь и говоришь', weight: 1 },
  venus: { name: 'твоя Венера', about: 'то, как ты любишь и тратишь деньги', weight: 1.05 },
  mars: { name: 'твой Марс', about: 'то, как ты действуешь и злишься', weight: 1.05 },
  jupiter: { name: 'твой Юпитер', about: 'вера в удачу и размах', weight: 0.6 },
  saturn: { name: 'твой Сатурн', about: 'чувство долга и страх ошибиться', weight: 0.7 },
  uranus: { name: 'твой Уран', about: 'тяга к переменам', weight: 0.3 },
  neptune: { name: 'твой Нептун', about: 'мечты и воображение', weight: 0.3 },
  pluto: { name: 'твой Плутон', about: 'то, что ты держишь под контролем', weight: 0.3 },
  ascendant: { name: 'твой Асцендент', about: 'то, как тебя видят другие', weight: 1 },
  mc: { name: 'вершина твоей карты', about: 'твои цели и то, как тебя видят другие', weight: 0.8 },
};

const ASPECT_RU: Record<string, { name: string; effect: string }> = {
  conjunction: { name: 'соединение', effect: 'усиливает эту тему, она будет заметной' },
  sextile: { name: 'секстиль', effect: 'помогает, если сделать первый шаг самому' },
  trine: { name: 'трин', effect: 'помогает сам собой, всё идёт легче обычного' },
  square: { name: 'квадрат', effect: 'мешает, здесь возможны трение и раздражение' },
  opposition: { name: 'оппозиция', effect: 'тянет в разные стороны, часто через другого человека' },
};

const HOUSE_AREA: Record<number, string> = {
  1: 'ты сам: внешний вид, самочувствие, как ты себя подаёшь',
  2: 'твои деньги: доходы, траты, покупки',
  3: 'разговоры и переписка, короткие поездки, мелкие дела, учёба',
  4: 'дом: быт, ремонт, семейные дела, отдых дома',
  5: 'удовольствия: свидания, флирт, хобби, дети, развлечения',
  6: 'будни: домашние дела, самочувствие, сон и режим',
  7: 'близкий человек рядом: пара, важные разговоры один на один',
  8: 'общие деньги и близость: кредиты, долги, налоги, доверие',
  9: 'большие планы: дальние поездки, учёба, новые знания',
  10: 'твои цели и то, как тебя видят другие',
  11: 'друзья и планы на будущее: компании, знакомые, совместные идеи',
  12: 'отдых и уединение: сон, тишина, то, что лучше делать без лишних глаз',
};

const SIGN_IN_RU = ['в Овне', 'в Тельце', 'в Близнецах', 'в Раке', 'во Льве', 'в Деве', 'в Весах', 'в Скорпионе', 'в Стрельце', 'в Козероге', 'в Водолее', 'в Рыбах'];

const RETROGRADE_RU: Partial<Record<TransitKey, string>> = {
  mercury: 'Меркурий идёт назад: планы, переписку и документы чаще приходится перепроверять',
  venus: 'Венера идёт назад: возвращаются старые симпатии и вопросы про деньги, с крупными покупками лучше не спешить',
  mars: 'Марс идёт назад: начатое буксует, а раздражение копится быстрее',
};

const normalize = (value: number): number => ((value % 360) + 360) % 360;
const gapOf = (a: number, b: number): number => {
  const gap = Math.abs(normalize(a) - normalize(b));
  return gap > 180 ? 360 - gap : gap;
};

function houseOf(longitude: number, natal: NatalChartDataV2): number | null {
  if (!natal.chartQuality?.housesAvailable || (natal.houses?.length ?? 0) !== 12) return null;
  const cusps = [...natal.houses].sort((a, b) => a.house - b.house);
  for (let index = 0; index < 12; index += 1) {
    const from = normalize(cusps[index].longitude);
    const to = normalize(cusps[(index + 1) % 12].longitude);
    const span = normalize(to - from);
    if (normalize(longitude - from) < span) return cusps[index].house;
  }
  return null;
}

function moonPhase(moon: number, sun: number): string {
  const angle = normalize(moon - sun);
  if (angle < 15 || angle >= 345) return 'новолуние: хорошо начинать, но без спешки с результатом';
  if (angle < 80) return 'Луна растёт: сил и желания начинать становится больше';
  if (angle < 100) return 'первая четверть: начатое просит первого усилия';
  if (angle < 165) return 'Луна растёт к полнолунию: дела набирают ход';
  if (angle < 195) return 'полнолуние: эмоций больше обычного, многое становится очевидным';
  if (angle < 260) return 'Луна убывает: хорошо заканчивать, разбирать и подводить итоги';
  if (angle < 280) return 'последняя четверть: пора убрать лишнее из дел и планов';
  return 'Луна на исходе: сил меньше, лучше доделывать, а новое отложить на несколько дней';
}

export type PersonalDayBrief = ReturnType<typeof buildPersonalDayBrief>;

export function buildPersonalDayBrief(natal: NatalChartDataV2, window: PersonalForecastWindow) {
  const date = window.periodStart.slice(0, 10);
  const at = (hour: number) => calculatePlanetaryTransitsAt(fromZonedTime(`${date}T${String(hour).padStart(2, '0')}:00:00`, window.timezone));
  const noon = at(12);
  const moonByHour = [7, 9, 11, 13, 15, 17, 19, 21, 23].map((hour) => ({ hour, longitude: at(hour).moon.longitude }));
  const timeKnown = natal.chartQuality?.birthTimeMode !== 'unknown';

  const targets: Array<{ key: string; longitude: number; house: number | null }> = [];
  for (const key of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const) {
    if (key === 'moon' && !timeKnown) continue;
    const position = natal.positions?.[key];
    if (position && Number.isFinite(position.longitude)) targets.push({ key, longitude: position.longitude, house: position.house ?? null });
  }
  if (natal.chartQuality?.ascendantReliable && natal.angles?.ascendant) targets.push({ key: 'ascendant', longitude: natal.angles.ascendant.longitude, house: 1 });
  if (natal.chartQuality?.anglesAvailable && natal.angles?.mc) targets.push({ key: 'mc', longitude: natal.angles.mc.longitude, house: 10 });

  const found = TRANSIT_KEYS.flatMap((transit) => {
    const longitude = noon[transit].longitude;
    return targets.flatMap((target) => {
      const gap = gapOf(longitude, target.longitude);
      const def = ASPECT_DEFS.map((item) => ({ item, orb: Math.abs(gap - item.angle) })).filter(({ item, orb }) => orb <= item.orb).sort((a, b) => a.orb - b.orb)[0];
      if (!def) return [];
      const tightness = 1 - def.orb / def.item.orb;
      const score = (0.35 + tightness) * TRANSIT_RU[transit].weight * NATAL_RU[target.key].weight;
      return [{ transit, target, type: def.item.type, tone: def.item.tone, orb: Number(def.orb.toFixed(1)), angle: def.item.angle, score }];
    });
  }).sort((a, b) => b.score - a.score);

  // A slow planet is background: it stays for weeks, so it never crowds out what is specific to this day.
  const slow = new Set<TransitKey>(['jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
  const chosen = [...found.filter((item) => !slow.has(item.transit)).slice(0, 3), ...found.filter((item) => slow.has(item.transit)).slice(0, 1)];

  const events = chosen.map((item) => {
    const peak = item.transit === 'moon'
      ? [...moonByHour].sort((a, b) => Math.abs(gapOf(a.longitude, item.target.longitude) - item.angle) - Math.abs(gapOf(b.longitude, item.target.longitude) - item.angle))[0].hour
      : null;
    return {
      what: `${TRANSIT_RU[item.transit].name}: ${ASPECT_RU[item.type].name}, ${NATAL_RU[item.target.key].name}`,
      planet_is_about: TRANSIT_RU[item.transit].about,
      it_touches_in_you: NATAL_RU[item.target.key].about,
      ...(item.target.house ? { area_of_life: HOUSE_AREA[item.target.house] } : {}),
      effect: ASPECT_RU[item.type].effect,
      tone: item.tone === 'pressure' ? 'трудно' : item.tone === 'support' ? 'легко' : 'сильно',
      lasts: TRANSIT_RU[item.transit].lasts,
      ...(peak !== null ? { strongest_around: `${peak}:00` } : {}),
      exactness_degrees: item.orb,
    };
  });

  const moonHouses = moonByHour.map(({ hour, longitude }) => ({ hour, house: houseOf(longitude, natal) }));
  // The day starts where the Moon stands in the morning, so a later move is a real change of topic.
  const moonHouse = moonHouses[0].house;
  const moonMove = moonHouses.find((item, index) => index > 0 && item.house !== null && item.house !== moonHouses[index - 1].house);
  const moonSigns = moonByHour.map(({ hour, longitude }) => ({ hour, sign: Math.floor(normalize(longitude) / 30) }));
  const signMove = moonSigns.find((item, index) => index > 0 && item.sign !== moonSigns[index - 1].sign);
  const sunHouse = houseOf(noon.sun.longitude, natal);

  return {
    birth_time_known: timeKnown,
    moon: {
      sign: SIGN_IN_RU[moonSigns[0].sign],
      phase: moonPhase(noon.moon.longitude, noon.sun.longitude),
      ...(moonHouse ? { area_of_life_today: HOUSE_AREA[moonHouse] } : {}),
      ...(moonMove?.house ? { area_changes_around: `${moonMove.hour}:00`, next_area_of_life: HOUSE_AREA[moonMove.house] } : {}),
      ...(signMove ? { sign_changes_around: `${signMove.hour}:00`, next_sign: SIGN_IN_RU[signMove.sign] } : {}),
    },
    ...(sunHouse ? { area_of_life_this_month: HOUSE_AREA[sunHouse] } : {}),
    main_events: events,
    retrograde: (['mercury', 'venus', 'mars'] as const).filter((key) => noon[key].retrograde).map((key) => RETROGRADE_RU[key]),
  };
}
