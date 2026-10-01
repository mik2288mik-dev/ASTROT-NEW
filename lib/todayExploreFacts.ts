import type { NatalChartData, PlanetPosition } from '../types';

type Language = 'ru' | 'en';

export type ExplorePlanetKey =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export type NatalTeaserFact = {
  headline: string;
  body: string;
  /** Sign whose sector the mini wheel highlights, when the fact is about one sign. */
  highlightSign: string | null;
  highlightPlanets: ExplorePlanetKey[];
};

export type ExploreWheelPoint = {
  planet: ExplorePlanetKey;
  longitude: number;
};

const PLANETS: readonly ExplorePlanetKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

const SIGN_IN_RU: Record<string, string> = {
  Aries: 'Овне', Taurus: 'Тельце', Gemini: 'Близнецах', Cancer: 'Раке',
  Leo: 'Льве', Virgo: 'Деве', Libra: 'Весах', Scorpio: 'Скорпионе',
  Sagittarius: 'Стрельце', Capricorn: 'Козероге', Aquarius: 'Водолее', Pisces: 'Рыбах',
};

const PLANET_RU: Record<ExplorePlanetKey, string> = {
  sun: 'Солнце', moon: 'Луна', mercury: 'Меркурий', venus: 'Венера', mars: 'Марс',
  jupiter: 'Юпитер', saturn: 'Сатурн', uranus: 'Уран', neptune: 'Нептун', pluto: 'Плутон',
};

const PLANET_EN: Record<ExplorePlanetKey, string> = {
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
};

type Element = 'fire' | 'earth' | 'air' | 'water';

const ELEMENT_OF: Record<string, Element> = {
  Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
  Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
  Gemini: 'air', Libra: 'air', Aquarius: 'air',
  Cancer: 'water', Scorpio: 'water', Pisces: 'water',
};

const ELEMENT_RU: Record<Element, string> = {
  fire: 'Огня', earth: 'Земли', air: 'Воздуха', water: 'Воды',
};

export function normalizeExploreSign(sign: unknown): string | null {
  if (typeof sign !== 'string') return null;
  const value = sign.trim().toLowerCase();
  return SIGNS.find((item) => item.toLowerCase() === value) ?? null;
}

function position(chart: NatalChartData, planet: ExplorePlanetKey): PlanetPosition | null {
  return (chart as unknown as Record<string, PlanetPosition | null | undefined>)[planet] ?? null;
}

function joinNames(names: string[], language: Language): string {
  if (names.length < 2) return names.join('');
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(', ')} ${language === 'ru' ? 'и' : 'and'} ${last}`;
}

function planetsWord(count: number): string {
  return count >= 5 ? 'планет' : 'планеты';
}

/** Longitudes for the decorative mini wheel; signs without a longitude are skipped. */
export function buildExploreWheel(chart: NatalChartData): {
  points: ExploreWheelPoint[];
  ascendant: number | null;
} {
  const points = PLANETS.flatMap((planet) => {
    const longitude = position(chart, planet)?.longitude;
    return typeof longitude === 'number' && Number.isFinite(longitude)
      ? [{ planet, longitude }]
      : [];
  });
  const rising = chart.rising?.longitude;
  return {
    points,
    ascendant: typeof rising === 'number' && Number.isFinite(rising) ? rising : null,
  };
}

/** Picks one true, checkable fact about the chart to tease the premium reading. */
export function buildNatalTeaserFact(
  chart: NatalChartData | null | undefined,
  language: Language,
): NatalTeaserFact | null {
  if (!chart) return null;
  const ru = language === 'ru';
  const placed = PLANETS.flatMap((planet) => {
    const sign = normalizeExploreSign(position(chart, planet)?.sign);
    return sign ? [{ planet, sign }] : [];
  });
  if (placed.length < 2) return null;
  const planetName = (planet: ExplorePlanetKey) => (ru ? PLANET_RU[planet] : PLANET_EN[planet]);

  const bySign = new Map<string, ExplorePlanetKey[]>();
  for (const { planet, sign } of placed) bySign.set(sign, [...(bySign.get(sign) ?? []), planet]);
  const stellium = [...bySign.entries()]
    .filter(([, planets]) => planets.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)[0];
  if (stellium) {
    const [sign, planets] = stellium;
    const names = joinNames(planets.map(planetName), language);
    return ru
      ? {
          headline: `У тебя ${planets.length} ${planetsWord(planets.length)} в ${SIGN_IN_RU[sign]}`,
          body: `${names} в одном знаке — так бывает не у всех. Разберём, что это даёт`,
          highlightSign: sign,
          highlightPlanets: planets,
        }
      : {
          headline: `You have ${planets.length} planets in ${sign}`,
          body: `${names} share one sign — not everyone has that. See what it gives you`,
          highlightSign: sign,
          highlightPlanets: planets,
        };
  }

  const byElement = new Map<Element, ExplorePlanetKey[]>();
  for (const { planet, sign } of placed) {
    const element = ELEMENT_OF[sign];
    byElement.set(element, [...(byElement.get(element) ?? []), planet]);
  }
  const leading = [...byElement.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (placed.length >= 6 && leading && leading[1].length * 2 >= placed.length) {
    const [element, planets] = leading;
    const share = planets.length * 2 === placed.length
      ? 'Половина планет'
      : `${planets.length} из ${placed.length} планет`;
    return ru
      ? {
          headline: `${share} — в знаках ${ELEMENT_RU[element]}`,
          body: 'Такой перевес заметен в характере. Разберём, в чём именно',
          highlightSign: null,
          highlightPlanets: planets,
        }
      : {
          headline: `${planets.length} of ${placed.length} planets are in ${element} signs`,
          body: 'A tilt like that shows in your character. See how exactly',
          highlightSign: null,
          highlightPlanets: planets,
        };
  }

  const sun = normalizeExploreSign(chart.sun?.sign);
  const moon = normalizeExploreSign(chart.moon?.sign);
  if (sun && moon && sun === moon) {
    return ru
      ? {
          headline: `Солнце и Луна — обе в ${SIGN_IN_RU[sun]}`,
          body: 'Голова и чувства у тебя хотят одного и того же. Разберём, где это помогает',
          highlightSign: sun,
          highlightPlanets: ['sun', 'moon'],
        }
      : {
          headline: `Sun and Moon are both in ${sun}`,
          body: 'Your head and your feelings want the same thing. See where that helps',
          highlightSign: sun,
          highlightPlanets: ['sun', 'moon'],
        };
  }
  if (!sun || !moon) return null;
  return ru
    ? {
        headline: `Солнце в ${SIGN_IN_RU[sun]}, Луна в ${SIGN_IN_RU[moon]}`,
        body: 'Характер и чувства у тебя устроены по-разному. Разберём, как они уживаются',
        highlightSign: null,
        highlightPlanets: ['sun', 'moon'],
      }
    : {
        headline: `Sun in ${sun}, Moon in ${moon}`,
        body: 'Your character and feelings work differently. See how they get along',
        highlightSign: null,
        highlightPlanets: ['sun', 'moon'],
      };
}
