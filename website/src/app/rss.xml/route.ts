import { getGuides } from '@/lib/content';
import { absoluteUrl, brands, locales, localizedPath } from '@/lib/site';

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[character] || character));
}

export async function GET() {
  const items: string[] = [];
  for (const locale of locales) {
    const guides = await getGuides(locale);
    for (const guide of guides.filter((item) => item.frontmatter.indexing !== 'noindex').slice(0, 20)) {
      const link = absoluteUrl(localizedPath(locale, `guides/${guide.frontmatter.slug}`));
      items.push(`<item><title>${escapeXml(guide.frontmatter.title)}</title><link>${link}</link><guid>${link}</guid><description>${escapeXml(guide.frontmatter.description)}</description><pubDate>${new Date(guide.frontmatter.publishedAt).toUTCString()}</pubDate><language>${locale}</language></item>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(brands.en)} Guides</title><link>${absoluteUrl('/')}</link><description>Guides from Your Horoscope</description>${items.join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } });
}
