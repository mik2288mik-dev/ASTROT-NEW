import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import type { Locale } from './site';
import { zodiacSlugs, type ZodiacSlug } from './zodiac';

export type GuideFrontmatter = {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  indexing?: 'index' | 'noindex';
};

export type HoroscopeFrontmatter = {
  title: string;
  description: string;
  sign: ZodiacSlug;
  period: 'today' | 'week' | 'month';
  validFrom: string;
  validThrough: string;
  publishedAt: string;
  updatedAt?: string;
  indexing?: 'index' | 'noindex';
};

export type ContentDocument<T> = {
  frontmatter: T;
  html: string;
  excerpt: string;
};

const contentRoot = path.join(process.cwd(), 'content');

function readMarkdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name: string) => name.endsWith('.md'))
    .map((name: string) => path.join(directory, name));
}

async function parseMarkdown<T>(filePath: string): Promise<ContentDocument<T>> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const rendered = await remark().use(html, { sanitize: true }).process(parsed.content);
  const plain = parsed.content.replace(/[#*_>`\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    frontmatter: parsed.data as T,
    html: rendered.toString(),
    excerpt: plain.slice(0, 220),
  };
}

export async function getGuides(locale: Locale): Promise<Array<ContentDocument<GuideFrontmatter>>> {
  const files = readMarkdownFiles(path.join(contentRoot, locale, 'guides'));
  const documents = await Promise.all(files.map((file) => parseMarkdown<GuideFrontmatter>(file)));
  return documents.sort((a, b) => b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt));
}

export async function getGuide(locale: Locale, slug: string): Promise<ContentDocument<GuideFrontmatter> | undefined> {
  const guides = await getGuides(locale);
  return guides.find((guide) => guide.frontmatter.slug === slug);
}

export async function getHoroscopes(locale: Locale): Promise<Array<ContentDocument<HoroscopeFrontmatter>>> {
  const files = readMarkdownFiles(path.join(contentRoot, locale, 'horoscopes'));
  const documents = await Promise.all(files.map((file) => parseMarkdown<HoroscopeFrontmatter>(file)));
  return documents
    .filter((document) => zodiacSlugs.includes(document.frontmatter.sign))
    .sort((a, b) => b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt));
}

export async function getCurrentHoroscope(locale: Locale, period: string, sign: string): Promise<ContentDocument<HoroscopeFrontmatter> | undefined> {
  const now = new Date();
  const documents = await getHoroscopes(locale);
  return documents.find((document) => {
    const item = document.frontmatter;
    return item.period === period && item.sign === sign && new Date(item.validFrom) <= now && new Date(item.validThrough) >= now;
  });
}

export async function getCurrentHoroscopeRoutes(): Promise<Array<{ locale: Locale; period: string; sign: string }>> {
  const locales: Locale[] = ['ru', 'en', 'es'];
  const routes: Array<{ locale: Locale; period: string; sign: string }> = [];
  for (const locale of locales) {
    const documents = await getHoroscopes(locale);
    const now = new Date();
    for (const document of documents) {
      const item = document.frontmatter;
      if (new Date(item.validFrom) <= now && new Date(item.validThrough) >= now) {
        routes.push({ locale, period: item.period, sign: item.sign });
      }
    }
  }
  return routes;
}

export async function getIndexableCurrentHoroscopeRoutes(): Promise<Array<{ locale: Locale; period: string; sign: string }>> {
  const locales: Locale[] = ['ru', 'en', 'es'];
  const routes: Array<{ locale: Locale; period: string; sign: string }> = [];
  for (const locale of locales) {
    const documents = await getHoroscopes(locale);
    const now = new Date();
    for (const document of documents) {
      const item = document.frontmatter;
      if (item.indexing !== 'noindex' && new Date(item.validFrom) <= now && new Date(item.validThrough) >= now) {
        routes.push({ locale, period: item.period, sign: item.sign });
      }
    }
  }
  return routes;
}
