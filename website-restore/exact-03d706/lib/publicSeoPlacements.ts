import { PUBLIC_SEO_SIGNS, type PublicSeoSign } from './publicSeoContent';

export type PublicSeoPlanet = {
  key: string;
  slug: string;
  name: string;
  genitive: string;
  meaning: string;
  question: string;
};

export type PublicSeoHouse = {
  number: number;
  slug: string;
  name: string;
  meaning: string;
};

export const PUBLIC_SEO_PLANETS: readonly PublicSeoPlanet[] = [
  { key: 'sun', slug: 'solnce', name: 'Солнце', genitive: 'Солнца', meaning: 'личные цели, осознанный выбор и собственную позицию', question: 'как человек выбирает направление и берёт ответственность за решения' },
  { key: 'moon', slug: 'luna', name: 'Луна', genitive: 'Луны', meaning: 'привычные реакции, эмоциональный отклик и способы принимать и давать заботу', question: 'как человек реагирует автоматически и что помогает ему чувствовать себя устойчиво' },
  { key: 'mercury', slug: 'merkuriy', name: 'Меркурий', genitive: 'Меркурия', meaning: 'мышление, речь, обучение и обмен информацией', question: 'как человек воспринимает сведения, формулирует мысли и разговаривает' },
  { key: 'venus', slug: 'venera', name: 'Венера', genitive: 'Венеры', meaning: 'симпатии, вкус, близость и способ выстраивать взаимность', question: 'что человеку нравится, как он сближается и чего ждёт от взаимности' },
  { key: 'mars', slug: 'mars', name: 'Марс', genitive: 'Марса', meaning: 'действие, напор, конкуренцию и способ добиваться своего', question: 'как человек начинает действовать, отстаивает своё и расходует усилия' },
  { key: 'jupiter', slug: 'yupiter', name: 'Юпитер', genitive: 'Юпитера', meaning: 'расширение возможностей, обучение, убеждения и масштаб целей', question: 'где человек охотнее растёт, пробует больше и ищет широкий взгляд' },
  { key: 'saturn', slug: 'saturn', name: 'Сатурн', genitive: 'Сатурна', meaning: 'ограничения, ответственность, дисциплину и долгую работу', question: 'где человеку приходится строить опору, соблюдать рамки и доводить дело до конца' },
  { key: 'uranus', slug: 'uran', name: 'Уран', genitive: 'Урана', meaning: 'независимость, резкие изменения и отказ от привычного порядка', question: 'где человек сильнее нуждается в свободе и готов менять правила' },
  { key: 'neptune', slug: 'neptun', name: 'Нептун', genitive: 'Нептуна', meaning: 'воображение, идеалы, впечатлительность и размытые границы', question: 'где сильнее работают воображение, ожидания и склонность идеализировать' },
  { key: 'pluto', slug: 'pluton', name: 'Плутон', genitive: 'Плутона', meaning: 'контроль, крайние реакции, давление и глубокую перестройку привычных способов действовать', question: 'где особенно трудно оставаться равнодушным и легче уходить в крайности' },
] as const;

export const PUBLIC_SEO_HOUSES: readonly PublicSeoHouse[] = [
  { number: 1, slug: '1-dom', name: '1 доме', meaning: 'самопрезентация, первое впечатление, личная инициатива и способ входить в новые ситуации' },
  { number: 2, slug: '2-dom', name: '2 доме', meaning: 'личные ресурсы, деньги, вещи, чувство достаточности и отношение к тому, чем человек распоряжается' },
  { number: 3, slug: '3-dom', name: '3 доме', meaning: 'повседневное общение, обучение, короткие поездки, ближайшее окружение и обмен информацией' },
  { number: 4, slug: '4-dom', name: '4 доме', meaning: 'дом, семья, приватная жизнь, чувство опоры и то, что человек считает своим внутренним тылом' },
  { number: 5, slug: '5-dom', name: '5 доме', meaning: 'самовыражение, увлечения, романтический интерес, творчество и желание получать удовольствие от процесса' },
  { number: 6, slug: '6-dom', name: '6 доме', meaning: 'повседневная работа, обязанности, привычки, порядок и организация обычного дня' },
  { number: 7, slug: '7-dom', name: '7 доме', meaning: 'партнёрство, договорённости, близкие отношения и способ учитывать другого человека один на один' },
  { number: 8, slug: '8-dom', name: '8 доме', meaning: 'общие ресурсы, доверие, обязательства, риск, кризисные решения и то, чем приходится делиться' },
  { number: 9, slug: '9-dom', name: '9 доме', meaning: 'мировоззрение, дальние поездки, высшее обучение, языки и стремление увидеть более широкую картину' },
  { number: 10, slug: '10-dom', name: '10 доме', meaning: 'карьера, публичная роль, репутация, ответственность и долгосрочные цели, которые видят другие' },
  { number: 11, slug: '11-dom', name: '11 доме', meaning: 'друзья, сообщества, общие проекты, планы на будущее и участие в больших группах' },
  { number: 12, slug: '12-dom', name: '12 доме', meaning: 'уединение, закрытые процессы, восстановление, то, что человек не сразу показывает другим, и завершение старых дел' },
] as const;

export function findPublicSeoPlanet(slug: string): PublicSeoPlanet | null {
  return PUBLIC_SEO_PLANETS.find((planet) => planet.slug === slug) || null;
}

export function findPublicSeoHouse(slug: string): PublicSeoHouse | null {
  return PUBLIC_SEO_HOUSES.find((house) => house.slug === slug) || null;
}

export type PublicSeoPlanetSignPlacement = {
  planet: PublicSeoPlanet;
  sign: PublicSeoSign;
  slug: string;
  path: string;
};

export const PUBLIC_SEO_PLANET_SIGN_PREFIX = '/natalnaya-karta/planety-v-znakah';

export const PUBLIC_SEO_PLANET_SIGN_PLACEMENTS: readonly PublicSeoPlanetSignPlacement[] = PUBLIC_SEO_PLANETS.flatMap(
  (planet) => PUBLIC_SEO_SIGNS.map((sign) => ({
    planet,
    sign,
    slug: `${planet.slug}-v-${sign.slug}`,
    path: `${PUBLIC_SEO_PLANET_SIGN_PREFIX}/${planet.slug}-v-${sign.slug}`,
  })),
);

export function findPlanetSignPlacement(slug: string): PublicSeoPlanetSignPlacement | null {
  return PUBLIC_SEO_PLANET_SIGN_PLACEMENTS.find((item) => item.slug === slug) || null;
}

export type PublicSeoPlanetHousePlacement = {
  planet: PublicSeoPlanet;
  house: PublicSeoHouse;
  slug: string;
  path: string;
};

export const PUBLIC_SEO_PLANET_HOUSE_PREFIX = '/natalnaya-karta/planety-v-domah';

export const PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS: readonly PublicSeoPlanetHousePlacement[] = PUBLIC_SEO_PLANETS.flatMap(
  (planet) => PUBLIC_SEO_HOUSES.map((house) => ({
    planet,
    house,
    slug: `${planet.slug}-v-${house.slug}`,
    path: `${PUBLIC_SEO_PLANET_HOUSE_PREFIX}/${planet.slug}-v-${house.slug}`,
  })),
);

export function findPlanetHousePlacement(slug: string): PublicSeoPlanetHousePlacement | null {
  return PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS.find((item) => item.slug === slug) || null;
}

export function relatedPlanetSignPlacements(item: PublicSeoPlanetSignPlacement) {
  const samePlanet = PUBLIC_SEO_PLANET_SIGN_PLACEMENTS.filter((candidate) => candidate.planet.key === item.planet.key && candidate.slug !== item.slug).slice(0, 5);
  const sameSign = PUBLIC_SEO_PLANET_SIGN_PLACEMENTS.filter((candidate) => candidate.sign.key === item.sign.key && candidate.slug !== item.slug).slice(0, 5);
  return [...samePlanet, ...sameSign];
}

export function relatedPlanetHousePlacements(item: PublicSeoPlanetHousePlacement) {
  const samePlanet = PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS.filter((candidate) => candidate.planet.key === item.planet.key && candidate.slug !== item.slug).slice(0, 5);
  const sameHouse = PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS.filter((candidate) => candidate.house.number === item.house.number && candidate.slug !== item.slug).slice(0, 5);
  return [...samePlanet, ...sameHouse];
}
