import type { MetadataRoute } from 'next';
import { absoluteUrl, siteIndexable } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: siteIndexable
      ? [{ userAgent: '*', allow: '/', disallow: ['/api/'] }]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
