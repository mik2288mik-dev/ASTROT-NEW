import { HOUSE_TOPICS } from './knowledge/houses';

export type PublicSeoHouse = {
  house: number;
  slug: string;
  title: string;
  summary: string;
  shortAnswer: string;
  sections: { title: string; paragraphs: string[] }[];
  path: string;
};

const HOUSE_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

export const PUBLIC_SEO_HOUSES: readonly PublicSeoHouse[] = HOUSE_NUMBERS.map((house) => {
  const topic = HOUSE_TOPICS.find((candidate) => candidate.id === `house-${house}`);
  if (!topic) throw new Error(`Missing house knowledge topic: ${house}`);
  const copy = topic.copy.ru;
  const slug = `${house}-dom`;
  return {
    house,
    slug,
    title: copy.title,
    summary: copy.summary,
    shortAnswer: copy.shortAnswer,
    sections: copy.sections.map((section) => ({ title: section.title, paragraphs: [...section.paragraphs] })),
    path: `/natalnaya-karta/doma/${slug}`,
  };
});

export function findPublicSeoHouseBySlug(slug: string): PublicSeoHouse | null {
  return PUBLIC_SEO_HOUSES.find((house) => house.slug === slug) || null;
}
