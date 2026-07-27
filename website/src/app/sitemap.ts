import type { MetadataRoute } from 'next';
import { getGuides, getIndexableCurrentHoroscopeRoutes } from '@/lib/content';
import { getStaticPages } from '@/lib/pages';
import { getLegalPage } from '@/lib/legal';
import { absoluteUrl, locales, localizedPath, siteIndexable } from '@/lib/site';
import { zodiacSlugs } from '@/lib/zodiac';

const legalSlugs = ['privacy','terms','subscription-terms','delete-account','cookies','contact'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteIndexable) return [];
  const urls: MetadataRoute.Sitemap = [{ url: absoluteUrl('/'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 }];

  for (const locale of locales) {
    urls.push({ url: absoluteUrl(localizedPath(locale)), lastModified: new Date(), changeFrequency: 'weekly', priority: 1 });
    for (const page of getStaticPages(locale)) {
      if (!page.noindex) urls.push({ url: absoluteUrl(localizedPath(locale, page.slug)), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.75 });
    }
    for (const slug of legalSlugs) {
      const page = getLegalPage(locale, slug);
      if (page && !page.noindex) urls.push({ url: absoluteUrl(localizedPath(locale, slug)), lastModified: new Date(), changeFrequency: 'yearly', priority: 0.35 });
    }
    urls.push({ url: absoluteUrl(localizedPath(locale, 'zodiac')), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 });
    for (const sign of zodiacSlugs) {
      urls.push({ url: absoluteUrl(localizedPath(locale, `zodiac/${sign}`)), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.72 });
    }
    urls.push({ url: absoluteUrl(localizedPath(locale, 'guides')), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 });
    const guides = await getGuides(locale);
    for (const guide of guides) {
      if (guide.frontmatter.indexing !== 'noindex') urls.push({
        url: absoluteUrl(localizedPath(locale, `guides/${guide.frontmatter.slug}`)),
        lastModified: new Date(guide.frontmatter.updatedAt || guide.frontmatter.publishedAt),
        changeFrequency: 'monthly',
        priority: 0.72,
      });
    }
    urls.push({ url: absoluteUrl(localizedPath(locale, 'horoscopes')), lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 });
  }

  const horoscopeRoutes = await getIndexableCurrentHoroscopeRoutes();
  for (const route of horoscopeRoutes) {
    urls.push({
      url: absoluteUrl(localizedPath(route.locale, `horoscopes/${route.period}/${route.sign}`)),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.65,
    });
  }

  return urls;
}
