import { PUBLIC_SEO_SIGNS, type PublicSeoSign } from './publicSeoContent';
import { PUBLIC_SEO_HOUSES, type PublicSeoHouse } from './publicSeoHouses';
import { PUBLIC_SEO_PLANETS, type PublicSeoPlanet } from './publicSeoPlacements';

export type PublicSeoChartObject = {
  key: string;
  slug: string;
  name: string;
  genitive: string;
  meaning: string;
  question: string;
  kind: 'planet' | 'point';
};

export const PUBLIC_SEO_POINTS: readonly PublicSeoChartObject[] = [
  { key: 'north-node', slug: 'severnyy-uzel', name: 'Северный узел', genitive: 'Северного узла', meaning: 'направление роста, непривычные задачи и опыт, который приходится осваивать', question: 'где человеку чаще приходится выходить за рамки привычного и учиться новому', kind: 'point' },
  { key: 'south-node', slug: 'yuzhnyy-uzel', name: 'Южный узел', genitive: 'Южного узла', meaning: 'знакомые реакции, накопленный опыт и то, что даётся привычно, но может удерживать в старых схемах', question: 'где человек действует по знакомому шаблону и может слишком полагаться на уже освоенное', kind: 'point' },
  { key: 'chiron', slug: 'hiron', name: 'Хирон', genitive: 'Хирона', meaning: 'чувствительные места, противоречивый опыт и способы находить практичный выход из сложной ситуации', question: 'где особенно заметны противоречия и приходится искать нестандартный способ с ними обходиться', kind: 'point' },
  { key: 'lilith', slug: 'lilit', name: 'Лилит', genitive: 'Лилит', meaning: 'крайние желания, соблазн действовать резко и ситуации, где особенно легко потерять чувство меры', question: 'где человеку сложнее сохранять нейтральность и легче уходить в крайность', kind: 'point' },
] as const;

export const PUBLIC_SEO_CHART_OBJECTS: readonly PublicSeoChartObject[] = [
  ...PUBLIC_SEO_PLANETS.map((planet: PublicSeoPlanet) => ({ ...planet, kind: 'planet' as const })),
  ...PUBLIC_SEO_POINTS,
];

export type PublicSeoAspect = {
  key: string;
  slug: string;
  name: string;
  action: string;
  reading: string;
};

export const PUBLIC_SEO_ASPECTS: readonly PublicSeoAspect[] = [
  { key: 'conjunction', slug: 'soedinenie', name: 'соединение', action: 'смешивает функции двух объектов и заставляет их работать почти в одной точке', reading: 'Главный вопрос — как две разные функции уживаются вместе: помогают друг другу или одна постоянно перетягивает внимание.' },
  { key: 'opposition', slug: 'oppoziciya', name: 'оппозиция', action: 'ставит две функции напротив друг друга и делает разницу между ними особенно заметной', reading: 'Такой аспект часто читают через поиск баланса: нельзя всё время жить только одной стороной и игнорировать вторую.' },
  { key: 'trine', slug: 'trin', name: 'трин', action: 'даёт функциям простой способ поддерживать друг друга без постоянного внутреннего спора', reading: 'Это не автоматический бонус: сильная сторона заметнее, когда человек действительно ей пользуется, а не считает само собой разумеющейся.' },
  { key: 'square', slug: 'kvadrat', name: 'квадрат', action: 'создаёт трение между двумя функциями и чаще требует конкретного способа их согласовать', reading: 'Напряжение здесь полезнее читать не как проблему, а как место, где особенно быстро становится видно, что именно не работает.' },
  { key: 'sextile', slug: 'sekstil', name: 'секстиль', action: 'даёт двум функциям возможность сотрудничать, если человек сам включает эту связку в действие', reading: 'В отличие от более автоматичных сочетаний, секстиль сильнее раскрывается через практику и повторяющиеся решения.' },
] as const;

export type PublicSeoAspectPlacement = {
  first: PublicSeoChartObject;
  second: PublicSeoChartObject;
  aspect: PublicSeoAspect;
  slug: string;
  path: string;
};

export const PUBLIC_SEO_ASPECT_PREFIX = '/natalnaya-karta/aspekty';

export const PUBLIC_SEO_ASPECT_PLACEMENTS: readonly PublicSeoAspectPlacement[] = PUBLIC_SEO_CHART_OBJECTS.flatMap(
  (first, firstIndex) => PUBLIC_SEO_CHART_OBJECTS.slice(firstIndex + 1).flatMap((second) =>
    PUBLIC_SEO_ASPECTS.map((aspect) => ({
      first,
      second,
      aspect,
      slug: `${aspect.slug}-${first.slug}-${second.slug}`,
      path: `${PUBLIC_SEO_ASPECT_PREFIX}/${aspect.slug}-${first.slug}-${second.slug}`,
    })),
  ),
);

export function findPublicSeoAspectPlacement(slug: string): PublicSeoAspectPlacement | null {
  return PUBLIC_SEO_ASPECT_PLACEMENTS.find((item) => item.slug === slug) || null;
}

export function relatedPublicSeoAspects(item: PublicSeoAspectPlacement): PublicSeoAspectPlacement[] {
  const sameObjects = PUBLIC_SEO_ASPECT_PLACEMENTS.filter((candidate) =>
    candidate.slug !== item.slug
    && candidate.first.key === item.first.key
    && candidate.second.key === item.second.key,
  );
  const sameFirst = PUBLIC_SEO_ASPECT_PLACEMENTS.filter((candidate) =>
    candidate.slug !== item.slug && (candidate.first.key === item.first.key || candidate.second.key === item.first.key),
  ).slice(0, 5);
  return [...sameObjects, ...sameFirst].slice(0, 10);
}

export type PublicSeoPointSignPlacement = {
  point: PublicSeoChartObject;
  sign: PublicSeoSign;
  slug: string;
  path: string;
};

export const PUBLIC_SEO_POINT_SIGN_PREFIX = '/natalnaya-karta/tochki-v-znakah';
export const PUBLIC_SEO_POINT_SIGN_PLACEMENTS: readonly PublicSeoPointSignPlacement[] = PUBLIC_SEO_POINTS.flatMap((point) =>
  PUBLIC_SEO_SIGNS.map((sign) => ({ point, sign, slug: `${point.slug}-v-${sign.slug}`, path: `${PUBLIC_SEO_POINT_SIGN_PREFIX}/${point.slug}-v-${sign.slug}` })),
);
export function findPublicSeoPointSignPlacement(slug: string): PublicSeoPointSignPlacement | null {
  return PUBLIC_SEO_POINT_SIGN_PLACEMENTS.find((item) => item.slug === slug) || null;
}

export type PublicSeoPointHousePlacement = {
  point: PublicSeoChartObject;
  house: PublicSeoHouse;
  slug: string;
  path: string;
};

export const PUBLIC_SEO_POINT_HOUSE_PREFIX = '/natalnaya-karta/tochki-v-domah';
export const PUBLIC_SEO_POINT_HOUSE_PLACEMENTS: readonly PublicSeoPointHousePlacement[] = PUBLIC_SEO_POINTS.flatMap((point) =>
  PUBLIC_SEO_HOUSES.map((house) => ({ point, house, slug: `${point.slug}-v-${house.slug}`, path: `${PUBLIC_SEO_POINT_HOUSE_PREFIX}/${point.slug}-v-${house.slug}` })),
);
export function findPublicSeoPointHousePlacement(slug: string): PublicSeoPointHousePlacement | null {
  return PUBLIC_SEO_POINT_HOUSE_PLACEMENTS.find((item) => item.slug === slug) || null;
}

export type PublicSeoHouseSignPlacement = {
  house: PublicSeoHouse;
  sign: PublicSeoSign;
  slug: string;
  path: string;
};

export const PUBLIC_SEO_HOUSE_SIGN_PREFIX = '/natalnaya-karta/doma-v-znakah';
export const PUBLIC_SEO_HOUSE_SIGN_PLACEMENTS: readonly PublicSeoHouseSignPlacement[] = PUBLIC_SEO_HOUSES.flatMap((house) =>
  PUBLIC_SEO_SIGNS.map((sign) => ({ house, sign, slug: `${house.slug}-v-${sign.slug}`, path: `${PUBLIC_SEO_HOUSE_SIGN_PREFIX}/${house.slug}-v-${sign.slug}` })),
);
export function findPublicSeoHouseSignPlacement(slug: string): PublicSeoHouseSignPlacement | null {
  return PUBLIC_SEO_HOUSE_SIGN_PLACEMENTS.find((item) => item.slug === slug) || null;
}

export function relatedPointSignPlacements(item: PublicSeoPointSignPlacement) {
  return PUBLIC_SEO_POINT_SIGN_PLACEMENTS.filter((candidate) => candidate.slug !== item.slug && (candidate.point.key === item.point.key || candidate.sign.key === item.sign.key)).slice(0, 10);
}
export function relatedPointHousePlacements(item: PublicSeoPointHousePlacement) {
  return PUBLIC_SEO_POINT_HOUSE_PLACEMENTS.filter((candidate) => candidate.slug !== item.slug && (candidate.point.key === item.point.key || candidate.house.house === item.house.house)).slice(0, 10);
}
export function relatedHouseSignPlacements(item: PublicSeoHouseSignPlacement) {
  return PUBLIC_SEO_HOUSE_SIGN_PLACEMENTS.filter((candidate) => candidate.slug !== item.slug && (candidate.house.house === item.house.house || candidate.sign.key === item.sign.key)).slice(0, 10);
}
