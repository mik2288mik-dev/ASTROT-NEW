import type { NatalBodyKey, NatalChartDataV2 } from './natalChartV2Types';
import { BODY_LABELS, BODY_ROLES, HOUSE_AREAS_RU } from './natalInterpretation/meanings';
import { SIGN_LOCATIVE_RU, SIGN_NOMINATIVE_RU } from './natalMoments';

/**
 * «Профиль» tab: the classical structure of a chart, told as history.
 * Rulers, dignities and weekdays follow Ptolemy (Tetrabiblos, 2nd c.);
 * the reference list follows Agrippa (16th c.). Modern rulers are kept as a
 * separate, explicitly later layer.
 */

export type ClassicalPlanet = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
export type DignityKind = 'domicile' | 'exaltation' | 'detriment' | 'fall';

export const TRADITIONAL_RULER: Record<string, ClassicalPlanet> = {
  Aries: 'mars', Taurus: 'venus', Gemini: 'mercury', Cancer: 'moon', Leo: 'sun', Virgo: 'mercury',
  Libra: 'venus', Scorpio: 'mars', Sagittarius: 'jupiter', Capricorn: 'saturn', Aquarius: 'saturn', Pisces: 'jupiter',
};

export const MODERN_RULER: Partial<Record<string, { planet: NatalBodyKey; genitive: string; discovered: number; began: string }>> = {
  Scorpio: { planet: 'pluto', genitive: 'Плутона', discovered: 1930, began: 'начинался' },
  Aquarius: { planet: 'uranus', genitive: 'Урана', discovered: 1781, began: 'начинался' },
  Pisces: { planet: 'neptune', genitive: 'Нептуна', discovered: 1846, began: 'начинались' },
};

const EXALTATION: Record<ClassicalPlanet, string> = {
  sun: 'Aries', moon: 'Taurus', mercury: 'Virgo', venus: 'Pisces', mars: 'Capricorn', jupiter: 'Cancer', saturn: 'Libra',
};

const OPPOSITE: Record<string, string> = {
  Aries: 'Libra', Taurus: 'Scorpio', Gemini: 'Sagittarius', Cancer: 'Capricorn', Leo: 'Aquarius', Virgo: 'Pisces',
  Libra: 'Aries', Scorpio: 'Taurus', Sagittarius: 'Gemini', Capricorn: 'Cancer', Aquarius: 'Leo', Pisces: 'Virgo',
};

export const CLASSICAL_PLANETS: readonly ClassicalPlanet[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];

const WEEKDAY: Record<ClassicalPlanet, { day: string; origin: string }> = {
  sun: { day: 'Воскресенье', origin: 'По-английски Sunday, «день Солнца»' },
  moon: { day: 'Понедельник', origin: 'По-английски Monday, «день Луны»' },
  mars: { day: 'Вторник', origin: 'По-французски mardi, «день Марса»' },
  mercury: { day: 'Среда', origin: 'По-французски mercredi, «день Меркурия»' },
  jupiter: { day: 'Четверг', origin: 'По-французски jeudi, «день Юпитера»' },
  venus: { day: 'Пятница', origin: 'По-французски vendredi, «день Венеры»' },
  saturn: { day: 'Суббота', origin: 'По-английски Saturday, «день Сатурна»' },
};

/**
 * Agrippa's planetary correspondences (De Occulta Philosophia, 16th c.).
 * A sign inherits them from its traditional ruler; every list is several items
 * because the old books never gave a sign one stone. The number is the planet's
 * magic square, not a «lucky number».
 */
type PlanetSet = { metal: string; stones: string; colors: string; plants: string; trees: string; number: number };
const HISTORY: Record<ClassicalPlanet, PlanetSet> = {
  sun: { metal: 'золото', stones: 'рубин, топаз, хризолит, гиацинт', colors: 'жёлтый и золотой', plants: 'календула, пион, мелисса', trees: 'лавр, кедр, пальма', number: 6 },
  moon: { metal: 'серебро', stones: 'жемчуг, горный хрусталь, селенит, берилл', colors: 'светлый, бледный', plants: 'розмарин, иссоп', trees: 'олива, пальма', number: 9 },
  mercury: { metal: 'ртуть', stones: 'агат, изумруд, топаз', colors: 'переливчатый, блестящий', plants: 'майоран, петрушка', trees: 'лещина', number: 8 },
  venus: { metal: 'медь', stones: 'изумруд, сапфир, сердолик, лазурит, коралл', colors: 'белый сияющий', plants: 'роза, фиалка, тимьян', trees: 'мирт', number: 7 },
  mars: { metal: 'железо', stones: 'алмаз, кровавик, яшма, аметист', colors: 'красный, огненный', plants: 'крапива, горчица, чеснок', trees: 'лавр, кизил', number: 5 },
  jupiter: { metal: 'олово', stones: 'сапфир, берилл, изумруд, гиацинт, зелёная яшма', colors: 'светло-жёлтый, ясный', plants: 'базилик, мята, лилия', trees: 'дуб, бук, инжир, олива', number: 4 },
  saturn: { metal: 'свинец', stones: 'оникс, сапфир, халцедон, бурая яшма', colors: 'сине-свинцовый, тёмный', plants: 'мак, нарцисс, тмин', trees: 'сосна, кипарис', number: 3 },
};

const PLANET_DATIVE_PRONOUN: Record<ClassicalPlanet, string> = {
  sun: 'ему', moon: 'ей', mercury: 'ему', venus: 'ей', mars: 'ему', jupiter: 'ему', saturn: 'ему',
};

const PLANET_GENITIVE_RU: Record<ClassicalPlanet, string> = {
  sun: 'Солнца', moon: 'Луны', mercury: 'Меркурия', venus: 'Венеры', mars: 'Марса', jupiter: 'Юпитера', saturn: 'Сатурна',
};

const PLANET_INSTRUMENTAL_RU: Record<NatalBodyKey, string> = {
  sun: 'Солнцем', moon: 'Луной', mercury: 'Меркурием', venus: 'Венерой', mars: 'Марсом', jupiter: 'Юпитером',
  saturn: 'Сатурном', uranus: 'Ураном', neptune: 'Нептуном', pluto: 'Плутоном', chiron: 'Хироном',
  northNode: 'Северным узлом', southNode: 'Южным узлом',
};

export function dignityOf(planet: ClassicalPlanet, sign: string): DignityKind | null {
  const rules = Object.entries(TRADITIONAL_RULER).filter(([, ruler]) => ruler === planet).map(([ruled]) => ruled);
  if (rules.includes(sign)) return 'domicile';
  if (EXALTATION[planet] === sign) return 'exaltation';
  if (rules.some((ruled) => OPPOSITE[ruled] === sign)) return 'detriment';
  if (OPPOSITE[EXALTATION[planet]] === sign) return 'fall';
  return null;
}

export type ProfileRuler = {
  planet: ClassicalPlanet;
  planetLabel: string;
  ascendantSign: string;
  body: string;
};

export type ProfileWeekday = {
  source: 'sun' | 'moon';
  /** The planet that rules this weekday. */
  planet: ClassicalPlanet;
  caption: string;
  day: string;
  origin: string;
  planetLabel: string;
};

export type ProfileDignity = {
  planet: ClassicalPlanet;
  kind: DignityKind;
  strong: boolean;
  headline: string;
  body: string;
};

export type NatalProfile = {
  ruler: ProfileRuler | null;
  weekdays: ProfileWeekday[];
  dignities: ProfileDignity[];
  strongCount: number;
  classicVsModern: { headline: string; body: string };
  history: { sign: string; planetLabel: string } & PlanetSet;
};

function rulerBody(chart: NatalChartDataV2, planet: ClassicalPlanet, ascendant: string): string {
  const label = BODY_LABELS[planet].ru;
  const position = chart.positions?.[planet];
  const intro = `Асцендент в ${SIGN_LOCATIVE_RU[ascendant]}, а ${SIGN_NOMINATIVE_RU[ascendant]} управляется ${PLANET_INSTRUMENTAL_RU[planet]}. Значит, главная планета твоей карты, ${label}.`;
  if (!position) return intro;
  const dignity = dignityOf(planet, position.sign);
  const pronoun = planet === 'moon' || planet === 'venus' ? 'Она' : planet === 'sun' ? 'Оно' : 'Он';
  const where = `${pronoun} стоит в ${SIGN_LOCATIVE_RU[position.sign]}${position.house && chart.chartQuality?.housesReliable ? `, в ${position.house} доме` : ''}`;
  const strength = dignity === 'domicile'
    ? ', в своём собственном знаке'
    : dignity === 'exaltation' ? ', на пике силы' : '';
  const area = position.house && chart.chartQuality?.housesReliable && HOUSE_AREAS_RU[position.house]
    ? ` Через ${planet === 'moon' || planet === 'venus' ? 'неё' : 'него'} в первую очередь проявляется сфера «${HOUSE_AREAS_RU[position.house]}».`
    : '';
  return `${intro} ${where}${strength}.${area}`;
}

function dignityCopy(planet: ClassicalPlanet, sign: string, kind: DignityKind): ProfileDignity {
  const label = BODY_LABELS[planet].ru;
  const role = BODY_ROLES[planet].ru;
  const strong = kind === 'domicile' || kind === 'exaltation';
  const place = `${label} в ${SIGN_LOCATIVE_RU[sign]}`;
  const headline = kind === 'domicile'
    ? `${place}, в своём знаке`
    : kind === 'exaltation'
      ? `${place}, на пике`
      : `${place}, не дома`;
  const body = kind === 'domicile'
    ? `${label} показывает, ${role}. В своём знаке это работает в полную силу.`
    : kind === 'exaltation'
      ? `${label} показывает, ${role}. На пике это проявляется ярче, чем в любом другом знаке.`
      : `${label} показывает, ${role}. Здесь ${PLANET_DATIVE_PRONOUN[planet]} неуютно, это проявляется не по шаблону.`;
  return { planet, kind, strong, headline, body };
}

export function buildNatalProfile(chart: NatalChartDataV2): NatalProfile | null {
  const sunSign = chart.positions?.sun?.sign;
  const moonSign = chart.positions?.moon?.sign;
  if (!sunSign || !TRADITIONAL_RULER[sunSign]) return null;

  const ascendant = chart.chartQuality?.ascendantReliable ? chart.angles?.ascendant?.sign : null;
  const ruler = ascendant && TRADITIONAL_RULER[ascendant]
    ? {
        planet: TRADITIONAL_RULER[ascendant],
        planetLabel: BODY_LABELS[TRADITIONAL_RULER[ascendant]].ru,
        ascendantSign: ascendant,
        body: rulerBody(chart, TRADITIONAL_RULER[ascendant], ascendant),
      }
    : null;

  const sunRuler = TRADITIONAL_RULER[sunSign];
  const weekdays: ProfileWeekday[] = [{
    source: 'sun',
    planet: sunRuler,
    caption: `${BODY_LABELS[sunRuler].ru}, по знаку Солнца`,
    day: WEEKDAY[sunRuler].day,
    origin: `${SIGN_NOMINATIVE_RU[sunSign]}, знак ${PLANET_GENITIVE_RU[sunRuler]}. ${WEEKDAY[sunRuler].origin}`,
    planetLabel: BODY_LABELS[sunRuler].ru,
  }];
  if (moonSign && TRADITIONAL_RULER[moonSign] && TRADITIONAL_RULER[moonSign] !== sunRuler) {
    const moonRuler = TRADITIONAL_RULER[moonSign];
    weekdays.push({
      source: 'moon',
      planet: moonRuler,
      caption: `${BODY_LABELS[moonRuler].ru}, по знаку Луны`,
      day: WEEKDAY[moonRuler].day,
      origin: `Луна в знаке ${PLANET_GENITIVE_RU[moonRuler]}. ${WEEKDAY[moonRuler].origin}`,
      planetLabel: BODY_LABELS[moonRuler].ru,
    });
  }

  const dignities = CLASSICAL_PLANETS.flatMap((planet) => {
    const sign = chart.positions?.[planet]?.sign;
    if (!sign) return [];
    const kind = dignityOf(planet, sign);
    return kind ? [dignityCopy(planet, sign, kind)] : [];
  }).sort((a, b) => Number(b.strong) - Number(a.strong));

  const modern = MODERN_RULER[sunSign];
  const classicVsModern = modern
    ? {
        headline: `${SIGN_NOMINATIVE_RU[sunSign]} ${modern.began} не с ${modern.genitive}`,
        body: `В классической астрологии этим знаком управлял ${BODY_LABELS[sunRuler].ru}. ${BODY_LABELS[modern.planet].ru} открыли только в ${modern.discovered} году, и современная астрология добавила его вторым управителем. Обе версии живут до сих пор.`,
      }
    : {
        headline: `${SIGN_NOMINATIVE_RU[sunSign]}, без споров`,
        body: `И в древности, и сейчас управитель этого знака, ${BODY_LABELS[sunRuler].ru}. Есть знаки, где поздние планеты всё поменяли: Уран открыли в 1781 году, Нептун, в 1846-м, Плутон, в 1930-м. Тебя это не коснулось.`,
      };

  return {
    ruler,
    weekdays,
    dignities,
    strongCount: dignities.filter((item) => item.strong).length,
    classicVsModern,
    history: { sign: SIGN_NOMINATIVE_RU[sunSign] ?? sunSign, planetLabel: BODY_LABELS[sunRuler].ru, ...HISTORY[sunRuler] },
  };
}
