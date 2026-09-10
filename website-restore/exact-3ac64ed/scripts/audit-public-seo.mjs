import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagesDir = path.join(root, '.next', 'server', 'pages');
const sitemapSource = path.join(root, 'pages', 'sitemap.xml.ts');
const robotsPath = path.join(root, 'public', 'robots.txt');
const canonicalOrigin = 'https://www.tvoi-goroskop.ru';
const errorRoutes = new Set(['/404', '/500']);
const errors = [];
const warnings = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(html, re) {
  const match = html.match(re);
  return match ? decodeHtml(match[1] || '') : '';
}

function routeFromFile(file) {
  const rel = path.relative(pagesDir, file).replace(/\\/g, '/').replace(/\.html$/, '');
  if (rel === 'site') return '/';
  if (rel.endsWith('/index')) return `/${rel.slice(0, -6)}`.replace(/\/$/, '') || '/';
  return `/${rel}`;
}

function normalizeInternalHref(href) {
  if (!href || href.startsWith('#') || /^(?:mailto:|tel:|javascript:)/i.test(href)) return null;
  let pathname = href;
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      if (url.origin !== canonicalOrigin && url.hostname !== 'tvoi-goroskop.ru') return null;
      pathname = url.pathname;
    } catch {
      return null;
    }
  }
  pathname = pathname.split(/[?#]/, 1)[0] || '/';
  if (!pathname.startsWith('/')) return null;
  if (/\.(?:png|jpe?g|webp|avif|svg|ico|xml|txt|json|webmanifest|pdf|zip)$/i.test(pathname)) return null;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/assets/') || pathname.startsWith('/home/') || pathname.startsWith('/space/')) return null;
  pathname = pathname.replace(/\/{2,}/g, '/');
  if (pathname !== '/') pathname = pathname.replace(/\/+$/, '');
  if (pathname === '/site') return '/';
  return pathname;
}

if (!existsSync(pagesDir)) {
  console.error('[seo-audit] .next/server/pages not found');
  process.exit(1);
}

const htmlFiles = walk(pagesDir).filter((file) => file.endsWith('.html'));
const builtRoutes = new Set(htmlFiles.map(routeFromFile));
builtRoutes.add('/');
const indexable = [];
const titleMap = new Map();
const descriptionMap = new Map();
const canonicalMap = new Map();
let checkedInternalLinks = 0;
let checkedJsonLdBlocks = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const route = routeFromFile(file);
  const robots = first(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || first(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']robots["'][^>]*>/i);
  const noindex = /\bnoindex\b/i.test(robots);
  const title = first(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = first(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    || first(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const canonical = first(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || first(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  const h1s = [...html.matchAll(/<h1\b[^>]*>/gi)].length;

  if (errorRoutes.has(route)) {
    if (!noindex) errors.push(`${route}: системная error-page обязана иметь noindex`);
    continue;
  }

  if (/OWNER_REQUIRED:|React App|Vite App|Untitled Page/i.test(html) && !noindex) {
    errors.push(`${route}: служебный/placeholder текст на индексируемой странице`);
  }
  if (noindex) continue;

  indexable.push({ route, title, description, canonical, h1s });
  if (!title) errors.push(`${route}: отсутствует <title>`);
  if (!description) errors.push(`${route}: отсутствует meta description`);
  if (!canonical) errors.push(`${route}: отсутствует canonical`);
  if (h1s !== 1) errors.push(`${route}: H1 = ${h1s}, ожидается ровно 1`);
  if (!/<html\b[^>]*\blang=["']ru["']/i.test(html)) errors.push(`${route}: отсутствует html lang=ru`);
  if (title && (title.length < 20 || title.length > 85)) warnings.push(`${route}: длина title ${title.length}`);
  if (description && (description.length < 70 || description.length > 200)) warnings.push(`${route}: длина description ${description.length}`);
  if (canonical && !canonical.startsWith(canonicalOrigin)) errors.push(`${route}: canonical вне основного домена: ${canonical}`);
  if (canonical && /[?#]/.test(canonical)) errors.push(`${route}: canonical содержит query/hash: ${canonical}`);

  const requiredSocial = [
    ['og:title', /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i],
    ['og:description', /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i],
    ['og:url', /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["'][^>]*>/i],
    ['og:image', /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i],
  ];
  for (const [name, regex] of requiredSocial) {
    if (!first(html, regex)) errors.push(`${route}: отсутствует ${name}`);
  }

  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (jsonLdBlocks.length === 0) errors.push(`${route}: отсутствует JSON-LD`);
  for (const match of jsonLdBlocks) {
    checkedJsonLdBlocks += 1;
    try {
      JSON.parse(decodeHtml(match[1]).replace(/\\u003c/g, '<'));
    } catch {
      errors.push(`${route}: невалидный JSON-LD`);
    }
  }

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = normalizeInternalHref(decodeHtml(match[1]));
    if (!href) continue;
    checkedInternalLinks += 1;
    if (!builtRoutes.has(href)) errors.push(`${route}: битая внутренняя ссылка ${href}`);
  }

  for (const tagMatch of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(tagMatch[0])) errors.push(`${route}: изображение без alt`);
  }

  for (const [value, map, kind] of [[title, titleMap, 'title'], [description, descriptionMap, 'description'], [canonical, canonicalMap, 'canonical']]) {
    if (!value) continue;
    const seen = map.get(value);
    if (seen) errors.push(`${route}: дублирующий ${kind} с ${seen}`);
    else map.set(value, route);
  }
}

for (const page of indexable) {
  const expected = page.route === '/' ? canonicalOrigin : `${canonicalOrigin}${page.route}`;
  if (page.canonical !== expected) errors.push(`${page.route}: self-canonical ожидается ${expected}, получено ${page.canonical || 'EMPTY'}`);
}

if (!existsSync(robotsPath)) errors.push('robots.txt отсутствует');
else {
  const robots = readFileSync(robotsPath, 'utf8');
  if (!/User-agent:\s*\*/i.test(robots)) errors.push('robots.txt: нет User-agent: *');
  if (!robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`)) errors.push('robots.txt: неправильный Sitemap URL');
  if (/Disallow:\s*\/$/m.test(robots)) errors.push('robots.txt: весь сайт закрыт от индексации');
}

if (!existsSync(sitemapSource)) errors.push('pages/sitemap.xml.ts отсутствует');
else {
  const source = readFileSync(sitemapSource, 'utf8');
  if (!source.includes('Array.from(new Set(urls))')) errors.push('sitemap: нет дедупликации URL');
  if (!source.includes('isPublicLegalReady() ? LEGAL_PATHS : []')) errors.push('sitemap: юридические noindex-страницы могут попасть в sitemap');
}

const indexableCount = indexable.length;
if (indexableCount < 1000) errors.push(`индексируемых prerendered HTML страниц меньше 1000: ${indexableCount}`);

console.log(`[seo-audit] HTML: ${htmlFiles.length}; indexable: ${indexableCount}; unique titles: ${titleMap.size}; unique descriptions: ${descriptionMap.size}; unique canonicals: ${canonicalMap.size}; internal links: ${checkedInternalLinks}; JSON-LD: ${checkedJsonLdBlocks}`);
if (warnings.length) {
  console.warn(`[seo-audit] warnings (${warnings.length}):`);
  for (const item of warnings.slice(0, 40)) console.warn(`  - ${item}`);
  if (warnings.length > 40) console.warn(`  ... +${warnings.length - 40}`);
}
if (errors.length) {
  console.error(`[seo-audit] FAILED (${errors.length}):`);
  for (const item of errors.slice(0, 100)) console.error(`  - ${item}`);
  if (errors.length > 100) console.error(`  ... +${errors.length - 100}`);
  process.exit(1);
}
console.log('[seo-audit] PASS');
