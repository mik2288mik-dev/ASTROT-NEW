import type { KnowledgeLanguage, KnowledgeSource } from './types';

export const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = [
  {
    id: 'nasa-moon-phases',
    title: { ru: 'Фазы Луны', en: 'Moon Phases' },
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/moon/moon-phases/',
    kind: 'astronomy',
  },
  {
    id: 'nasa-eclipses',
    title: { ru: 'Как происходят затмения', en: 'Eclipse Science' },
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/eclipses/',
    kind: 'astronomy',
  },
  {
    id: 'nasa-retrograde',
    title: { ru: 'Что означает ретроградное движение Меркурия', en: 'What does it mean for Mercury to be in retrograde?' },
    publisher: 'NASA / GSFC',
    url: 'https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question46.html',
    kind: 'astronomy',
  },
  {
    id: 'nasa-chiron',
    title: { ru: 'Хирон и кентавры', en: 'Chiron and the Centaurs' },
    publisher: 'NASA Technical Reports Server',
    url: 'https://ntrs.nasa.gov/citations/19970010415',
    kind: 'astronomy',
  },
  {
    id: 'iau-zodiac',
    title: { ru: 'Созвездия зодиака', en: 'Constellations of the zodiac' },
    publisher: 'International Astronomical Union',
    url: 'https://www.iau.org/IAU/Astronomy-FAQs/FAQs.aspx',
    kind: 'astronomy',
  },
  {
    id: 'iau-pluto',
    title: { ru: 'Определение планеты и статус Плутона', en: 'Definition of a Planet and Pluto' },
    publisher: 'International Astronomical Union',
    url: 'https://www.iau.org/static/resolutions/Resolution_GA26-5-6.pdf',
    kind: 'astronomy',
  },
  {
    id: 'swiss-ephemeris-houses',
    title: { ru: 'Системы домов в Swiss Ephemeris', en: 'House systems in Swiss Ephemeris' },
    publisher: 'Astrodienst / Swiss Ephemeris',
    url: 'https://www.astro.com/swisseph-download/doc/swisseph.pdf',
    kind: 'astrology-reference',
  },
  {
    id: 'astro-ascendant',
    title: { ru: 'Асцендент', en: 'Ascendant' },
    publisher: 'Astrodienst',
    url: 'https://www.astro.com/astrowiki/en/AC',
    kind: 'astrology-reference',
  },
  {
    id: 'astro-aspects',
    title: { ru: 'Аспекты и орбис', en: 'Aspects and orbs' },
    publisher: 'Astrodienst',
    url: 'https://www.astro.com/astrowiki/en/Aspect',
    kind: 'astrology-reference',
  },
  {
    id: 'astro-lilith',
    title: { ru: 'Лилит / Чёрная Луна', en: 'Lilith / Black Moon' },
    publisher: 'Astrodienst',
    url: 'https://www.astro.com/astrowiki/en/Lilith',
    kind: 'astrology-reference',
  },
  {
    id: 'astro-nodes',
    title: { ru: 'Лунные узлы', en: 'Moon’s Nodes' },
    publisher: 'Astrodienst',
    url: 'https://www.astro.com/astrowiki/en/Rahu',
    kind: 'astrology-reference',
  },
  {
    id: 'astro-solar-return',
    title: { ru: 'Карта солнечного возвращения', en: 'Solar Return Chart' },
    publisher: 'Astrodienst',
    url: 'https://www.astro.com/astrowiki/en/Solar_Return_Chart',
    kind: 'astrology-reference',
  },
  {
    id: 'astro-progressions',
    title: { ru: 'Вторичные прогрессии', en: 'Secondary Progressions' },
    publisher: 'Astrodienst',
    url: 'https://www.astro.com/astrowiki/en/Secondary_Directions',
    kind: 'astrology-reference',
  },
  {
    id: 'cambridge-astrology-history',
    title: { ru: 'Астрология раннего Нового времени', en: 'Early modern astrology' },
    publisher: 'University of Cambridge / Bodleian Library',
    url: 'https://casebooks.lib.cam.ac.uk/astrological-medicine/early-modern-astrology',
    kind: 'history',
  },
] as const;

export function getKnowledgeSources(
  sourceIds: readonly string[],
  language: KnowledgeLanguage,
): Array<KnowledgeSource & { localizedTitle: string }> {
  const byId = new Map(KNOWLEDGE_SOURCES.map((source) => [source.id, source]));
  return sourceIds.flatMap((sourceId) => {
    const source = byId.get(sourceId);
    return source ? [{ ...source, localizedTitle: source.title[language] }] : [];
  });
}
