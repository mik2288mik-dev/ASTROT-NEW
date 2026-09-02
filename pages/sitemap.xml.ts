import type { GetServerSideProps } from 'next';
import { PUBLIC_SEO_ORIGIN, PUBLIC_SEO_PAIRS, PUBLIC_SEO_SIGNS } from '../lib/publicSeoContent';
import {
  PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS,
  PUBLIC_SEO_PLANET_SIGN_PLACEMENTS,
} from '../lib/publicSeoPlacements';

const CORE_PATHS = [
  '/',
  '/lichnyy-goroskop',
  '/natalnaya-karta',
  '/natalnaya-karta/planety-v-znakah',
  '/natalnaya-karta/planety-v-domah',
  '/goroskop',
  '/sovmestimost',
  '/sovmestimost/znakov',
  '/privacy',
  '/terms',
  '/personal-data-consent',
  '/delete-account',
  '/support',
  '/requisites',
] as const;

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[char] || char));
}

function toAbsolute(path: string) {
  return path === '/' ? `${PUBLIC_SEO_ORIGIN}/` : `${PUBLIC_SEO_ORIGIN}${path}`;
}

function buildSitemap() {
  const urls = [
    ...CORE_PATHS,
    ...PUBLIC_SEO_SIGNS.map((sign) => `/goroskop/${sign.slug}`),
    ...PUBLIC_SEO_PAIRS.map((pair) => pair.path),
    ...PUBLIC_SEO_PLANET_SIGN_PLACEMENTS.map((item) => item.path),
    ...PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS.map((item) => item.path),
  ];
  const unique = Array.from(new Set(urls));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map((path) => `  <url><loc>${escapeXml(toAbsolute(path))}</loc></url>`).join('\n')}\n</urlset>`;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(buildSitemap());
  res.end();
  return { props: {} };
};

export default function SitemapXml() {
  return null;
}
