import { SIGN_TOPICS } from './knowledge/signs';
import {
  buildLocalPersonSnapshot,
  buildLocalSignCompatibility,
  type LocalPersonSnapshot,
} from './synastry/localSignText';
import type { SignCompatibilityResult } from './synastry/signCompatibility';
import type { ZodiacKey } from './zodiacKeys';
import { PUBLIC_SITE_CONFIG } from './publicSiteConfig';

export const PUBLIC_SEO_ORIGIN = 'https://www.tvoi-goroskop.ru';
export const PUBLIC_SEO_BRAND = PUBLIC_SITE_CONFIG.appName;

export type PublicSeoSection = {
  title: string;
  paragraphs: string[];
};

export type PublicSeoSign = {
  key: ZodiacKey;
  slug: string;
  name: string;
  genitive: string;
  prepositional: string;
  topicId: string;
  summary: string;
  shortAnswer: string;
  sections: PublicSeoSection[];
};

type SignMeta = Pick<
  PublicSeoSign,
  'key' | 'slug' | 'name' | 'genitive' | 'prepositional' | 'topicId'
>;

const SIGN_META: readonly SignMeta[] = [
  { key: 'Aries', slug: 'oven', name: 'Овен', genitive: 'Овна', prepositional: 'Овне', topicId: 'sign-aries' },
  { key: 'Taurus', slug: 'telec', name: 'Телец', genitive: 'Тельца', prepositional: 'Тельце', topicId: 'sign-taurus' },
  { key: 'Gemini', slug: 'bliznecy', name: 'Близнецы', genitive: 'Близнецов', prepositional: 'Близнецах', topicId: 'sign-gemini' },
  { key: 'Cancer', slug: 'rak', name: 'Рак', genitive: 'Рака', prepositional: 'Раке', topicId: 'sign-cancer' },
  { key: 'Leo', slug: 'lev', name: 'Лев', genitive: 'Льва', prepositional: 'Льве', topicId: 'sign-leo' },
  { key: 'Virgo', slug: 'deva', name: 'Дева', genitive: 'Девы', prepositional: 'Деве', topicId: 'sign-virgo' },
  { key: 'Libra', slug: 'vesy', name: 'Весы', genitive: 'Весов', prepositional: 'Весах', topicId: 'sign-libra' },
  { key: 'Scorpio', slug: 'skorpion', name: 'Скорпион', genitive: 'Скорпиона', prepositional: 'Скорпионе', topicId: 'sign-scorpio' },
  { key: 'Sagittarius', slug: 'strelec', name: 'Стрелец', genitive: 'Стрельца', prepositional: 'Стрельце', topicId: 'sign-sagittarius' },
  { key: 'Capricorn', slug: 'kozerog', name: 'Козерог', genitive: 'Козерога', prepositional: 'Козероге', topicId: 'sign-capricorn' },
  { key: 'Aquarius', slug: 'vodoley', name: 'Водолей', genitive: 'Водолея', prepositional: 'Водолее', topicId: 'sign-aquarius' },
  { key: 'Pisces', slug: 'ryby', name: 'Рыбы', genitive: 'Рыб', prepositional: 'Рыбах', topicId: 'sign-pisces' },
] as const;

const SIGN_SECTION_TITLES: Readonly<Record<ZodiacKey, readonly [string, string]>> = {
  Aries: ['Как читают этот знак', 'Инициатива без шума'],
  Taurus: ['Как читают этот знак', 'Устойчивый темп'],
  Gemini: ['Как читают этот знак', 'Гибкость мысли'],
  Cancer: ['Как читают этот знак', 'Забота с границами'],
  Leo: ['Как читают этот знак', 'Ответственность за своё'],
  Virgo: ['Как читают этот знак', 'Точность по делу'],
  Libra: ['Как читают этот знак', 'Решение с учётом сторон'],
  Scorpio: ['Как читают этот знак', 'Глубина без драмы'],
  Sagittarius: ['Как читают этот знак', 'Широкий взгляд с проверкой фактов'],
  Capricorn: ['Как читают этот знак', 'Ответственность и порядок'],
  Aquarius: ['Как читают этот знак', 'Независимость и общие правила'],
  Pisces: ['Как читают этот знак', 'Чувствительность с границами'],
};

function buildSign(meta: SignMeta): PublicSeoSign {
  const topic = SIGN_TOPICS.find((candidate) => candidate.id === meta.topicId);
  if (!topic) throw new Error(`Missing knowledge topic for ${meta.key}`);

  const copy = topic.copy.ru;
  return {
    ...meta,
    summary: copy.summary,
    shortAnswer: copy.shortAnswer,
    sections: copy.sections.map((section, index) => ({
      title: SIGN_SECTION_TITLES[meta.key][index] || section.title,
      paragraphs: [...section.paragraphs],
    })),
  };
}

/**
 * The twelve indexable sign pages reuse the product encyclopedia instead of
 * inventing evergreen horoscope copy inside the website layer.
 */
export const PUBLIC_SEO_SIGNS: readonly PublicSeoSign[] = SIGN_META.map(buildSign);

export function findPublicSeoSignBySlug(slug: string): PublicSeoSign | null {
  return PUBLIC_SEO_SIGNS.find((sign) => sign.slug === slug) || null;
}

export function findPublicSeoSignByKey(key: string): PublicSeoSign | null {
  return PUBLIC_SEO_SIGNS.find((sign) => sign.key.toLowerCase() === key.toLowerCase()) || null;
}

export type PublicSeoPair = {
  first: PublicSeoSign;
  second: PublicSeoSign;
  slug: string;
  path: string;
};

export const PUBLIC_SEO_PAIR_PREFIX = '/sovmestimost/znakov';

export function buildPublicSeoPair(
  firstInput: PublicSeoSign,
  secondInput: PublicSeoSign,
): PublicSeoPair {
  const firstIndex = PUBLIC_SEO_SIGNS.findIndex((sign) => sign.key === firstInput.key);
  const secondIndex = PUBLIC_SEO_SIGNS.findIndex((sign) => sign.key === secondInput.key);
  const [first, second] = firstIndex <= secondIndex
    ? [firstInput, secondInput]
    : [secondInput, firstInput];
  const slug = `${first.slug}-i-${second.slug}`;
  return { first, second, slug, path: `${PUBLIC_SEO_PAIR_PREFIX}/${slug}` };
}

/** 12 same-sign pairs plus 66 different-sign pairs: 78 canonical URLs. */
export const PUBLIC_SEO_PAIRS: readonly PublicSeoPair[] = PUBLIC_SEO_SIGNS.flatMap(
  (first, firstIndex) => PUBLIC_SEO_SIGNS
    .slice(firstIndex)
    .map((second) => buildPublicSeoPair(first, second)),
);

export type ParsedPublicSeoPair = {
  requestedFirst: PublicSeoSign;
  requestedSecond: PublicSeoSign;
  canonicalPair: PublicSeoPair;
  isCanonical: boolean;
};

export function parsePublicSeoPairSlug(slug: string): ParsedPublicSeoPair | null {
  const parts = slug.split('-i-');
  if (parts.length !== 2) return null;
  const requestedFirst = findPublicSeoSignBySlug(parts[0]);
  const requestedSecond = findPublicSeoSignBySlug(parts[1]);
  if (!requestedFirst || !requestedSecond) return null;

  const canonicalPair = buildPublicSeoPair(requestedFirst, requestedSecond);
  return {
    requestedFirst,
    requestedSecond,
    canonicalPair,
    isCanonical: canonicalPair.slug === slug,
  };
}

export type PublicSeoPairContent = {
  compatibility: SignCompatibilityResult;
  firstSnapshot: LocalPersonSnapshot;
  secondSnapshot: LocalPersonSnapshot | null;
};

const PUBLIC_RELATIONSHIP_OPENING = 'Отношения проверяются обычными днями: важно, насколько спокойно вы проживаете их вместе.';

function polishPublicPairText(value: string): string {
  return value
    .replace(/^В отношениях[^.]*\.\s*/, `${PUBLIC_RELATIONSHIP_OPENING} `)
    .replace(
      'Не додумывай остальное за человека: смотри, совпадают ли слова и повторяющиеся поступки.',
      'Остальное проверяй по человеку: смотри, совпадают ли слова и повторяющиеся поступки.',
    )
    .replace(
      'Не переделывайте друг друга — учитесь уважать чужой способ жить.',
      'Уважайте чужой способ жить и оставляйте друг другу право быть разными.',
    )
    .trim();
}

function polishPublicSnapshot(snapshot: LocalPersonSnapshot): LocalPersonSnapshot {
  return {
    ...snapshot,
    body: polishPublicPairText(snapshot.body),
    contextLine: polishPublicPairText(snapshot.contextLine),
  };
}

/**
 * Pair pages use the same deterministic sign-composition already shown in the
 * product. No score, event, biography, or relationship outcome is invented.
 */
export function buildPublicSeoPairContent(pair: PublicSeoPair): PublicSeoPairContent {
  const localCompatibility = buildLocalSignCompatibility(
    pair.first.key,
    pair.second.key,
    'ru',
    null,
    null,
    'relationship',
  );
  const localFirstSnapshot = buildLocalPersonSnapshot(
    pair.first.key,
    'ru',
    'relationship',
  );
  const localSecondSnapshot = pair.first.key === pair.second.key
    ? null
    : buildLocalPersonSnapshot(pair.second.key, 'ru', 'relationship');

  if (!localCompatibility || !localFirstSnapshot || (pair.first.key !== pair.second.key && !localSecondSnapshot)) {
    throw new Error(`Missing local sign compatibility content for ${pair.slug}`);
  }

  const compatibility = {
    ...localCompatibility,
    attraction: polishPublicPairText(localCompatibility.attraction),
    communication: polishPublicPairText(localCompatibility.communication),
  };
  const firstSnapshot = polishPublicSnapshot(localFirstSnapshot);
  const secondSnapshot = localSecondSnapshot
    ? polishPublicSnapshot(localSecondSnapshot)
    : null;

  return { compatibility, firstSnapshot, secondSnapshot };
}

export function pairNames(pair: PublicSeoPair): string {
  return `${pair.first.name} и ${pair.second.name}`;
}

export function pairNamesGenitive(pair: PublicSeoPair): string {
  return `${pair.first.genitive} и ${pair.second.genitive}`;
}

export function relatedPairsForSign(
  sign: PublicSeoSign,
  excludedSlug?: string,
): PublicSeoPair[] {
  return PUBLIC_SEO_PAIRS.filter((pair) => (
    pair.slug !== excludedSlug
    && (pair.first.key === sign.key || pair.second.key === sign.key)
  ));
}

export const PUBLIC_SEO_HUB_LINKS = [
  { href: '/lichnyy-goroskop', label: 'Личный гороскоп' },
  { href: '/natalnaya-karta', label: 'Натальная карта' },
  { href: '/goroskop', label: 'Гороскоп по знакам' },
  { href: '/sovmestimost', label: 'Совместимость' },
] as const;
