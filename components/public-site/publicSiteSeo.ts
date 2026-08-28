import { PUBLIC_SITE_CONFIG } from '../../lib/publicSiteConfig';

export type PublicSiteJsonLd = Record<string, unknown>;
export type PublicSiteJsonLdInput = PublicSiteJsonLd | PublicSiteJsonLd[];

export type PublicSiteSocialImage = {
  path: string;
  width: number;
  height: number;
  alt: string;
  type?: string;
};

const CANONICAL_BASE_URL = 'https://www.tvoi-goroskop.ru';

export const PUBLIC_SITE_SEO = {
  baseUrl: CANONICAL_BASE_URL,
  siteName: PUBLIC_SITE_CONFIG.appName,
  applicationName: 'NEBO гороскоп натальная карта',
  language: 'ru-RU',
  openGraphLocale: 'ru_RU',
  organizationId: `${CANONICAL_BASE_URL}/#organization`,
  websiteId: `${CANONICAL_BASE_URL}/#website`,
  applicationId: `${CANONICAL_BASE_URL}/#application`,
  logoPath: '/assets/brand/nebo-app-icon-512.png',
  manifestPath: '/site.webmanifest',
  navigation: [
    { href: '/lichnyy-goroskop', label: 'Личный гороскоп' },
    { href: '/natalnaya-karta', label: 'Натальная карта' },
    { href: '/goroskop', label: 'Гороскопы' },
    { href: '/sovmestimost', label: 'Совместимость' },
    { href: '/support', label: 'Поддержка' },
  ],
  defaultSocialImage: {
    path: '/home/cards/today-hero.webp',
    width: 1400,
    height: 788,
    alt: `${PUBLIC_SITE_CONFIG.appName}: персональный прогноз, натальная карта и совместимость`,
    type: 'image/webp',
  } satisfies PublicSiteSocialImage,
} as const;

export function normalizePublicPath(value: string): string {
  const raw = String(value || '/').trim();
  let path = raw;

  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = '/';
    }
  }

  path = path.split(/[?#]/, 1)[0] || '/';
  path = `/${path.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
  if (path !== '/') path = path.replace(/\/+$/, '');

  return path || '/';
}

export function publicCanonicalUrl(path: string): string {
  const normalizedPath = normalizePublicPath(path);
  return normalizedPath === '/' ? PUBLIC_SITE_SEO.baseUrl : `${PUBLIC_SITE_SEO.baseUrl}${normalizedPath}`;
}

export function publicAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      const configuredOrigin = getConfiguredOrigin();
      const isPublicOrigin =
        url.hostname === 'tvoi-goroskop.ru'
        || url.hostname === 'www.tvoi-goroskop.ru'
        || url.origin === configuredOrigin;

      if (!isPublicOrigin) return path;
      return `${publicCanonicalUrl(url.pathname)}${url.search}${url.hash}`;
    } catch {
      return path;
    }
  }

  return publicCanonicalUrl(path);
}

export function createBreadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; path: string }>,
): PublicSiteJsonLd {
  const currentUrl = items.length > 0
    ? publicCanonicalUrl(items[items.length - 1].path)
    : PUBLIC_SITE_SEO.baseUrl;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${currentUrl}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: publicCanonicalUrl(item.path),
    })),
  };
}

export function preparePublicPageJsonLd({
  path,
  description,
  jsonLd,
}: {
  path: string;
  description: string;
  jsonLd?: PublicSiteJsonLdInput;
}): PublicSiteJsonLd[] {
  if (normalizePublicPath(path) === '/') {
    return [createHomeJsonLd(description, jsonLd)];
  }

  if (!jsonLd) return [];
  const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return blocks.map((block) => normalizePublicUrls(block) as PublicSiteJsonLd);
}

export function serializePublicJsonLd(jsonLd: PublicSiteJsonLd): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}

function createHomeJsonLd(
  description: string,
  jsonLd?: PublicSiteJsonLdInput,
): PublicSiteJsonLd {
  const nodes = flattenJsonLd(jsonLd).map(
    (node) => normalizePublicUrls(node) as PublicSiteJsonLd,
  );
  const organization = nodes.find((node) => hasSchemaType(node, 'Organization'));
  const website = nodes.find((node) => hasSchemaType(node, 'WebSite'));
  const application = nodes.find((node) => hasSchemaType(node, 'SoftwareApplication'));
  const remainingNodes = nodes.filter(
    (node) =>
      !hasSchemaType(node, 'Organization')
      && !hasSchemaType(node, 'WebSite')
      && !hasSchemaType(node, 'SoftwareApplication'),
  );

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        ...organization,
        '@type': 'Organization',
        '@id': PUBLIC_SITE_SEO.organizationId,
        name: PUBLIC_SITE_SEO.siteName,
        url: PUBLIC_SITE_SEO.baseUrl,
        logo: publicAssetUrl(PUBLIC_SITE_SEO.logoPath),
      },
      {
        ...website,
        '@type': 'WebSite',
        '@id': PUBLIC_SITE_SEO.websiteId,
        name: PUBLIC_SITE_SEO.siteName,
        url: PUBLIC_SITE_SEO.baseUrl,
        inLanguage: PUBLIC_SITE_SEO.language,
        description,
        publisher: { '@id': PUBLIC_SITE_SEO.organizationId },
      },
      {
        ...application,
        '@type': 'SoftwareApplication',
        '@id': PUBLIC_SITE_SEO.applicationId,
        name: PUBLIC_SITE_SEO.applicationName,
        url: PUBLIC_SITE_SEO.baseUrl,
        applicationCategory: application?.applicationCategory || 'LifestyleApplication',
        operatingSystem: application?.operatingSystem || 'Android',
        inLanguage: PUBLIC_SITE_SEO.language,
        description,
        publisher: { '@id': PUBLIC_SITE_SEO.organizationId },
        isPartOf: { '@id': PUBLIC_SITE_SEO.websiteId },
      },
      ...remainingNodes,
    ],
  };
}

function flattenJsonLd(jsonLd?: PublicSiteJsonLdInput): PublicSiteJsonLd[] {
  if (!jsonLd) return [];
  const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  const nodes: PublicSiteJsonLd[] = [];

  for (const block of blocks) {
    const graph = block['@graph'];
    if (Array.isArray(graph)) {
      for (const node of graph) {
        if (isRecord(node)) nodes.push(withoutContext(node));
      }
      continue;
    }

    nodes.push(withoutContext(block));
  }

  return nodes;
}

function withoutContext(value: PublicSiteJsonLd): PublicSiteJsonLd {
  const { '@context': _context, ...node } = value;
  return node;
}

function hasSchemaType(node: PublicSiteJsonLd, expected: string): boolean {
  const type = node['@type'];
  return type === expected || (Array.isArray(type) && type.includes(expected));
}

function normalizePublicUrls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizePublicUrls);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, normalizePublicUrls(child)]),
    );
  }
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return value;

  try {
    const url = new URL(value);
    const configuredOrigin = getConfiguredOrigin();
    const isPublicOrigin =
      url.hostname === 'tvoi-goroskop.ru'
      || url.hostname === 'www.tvoi-goroskop.ru'
      || url.origin === configuredOrigin;

    if (!isPublicOrigin) return value;
    const canonical = publicCanonicalUrl(url.pathname);
    const rootWithFragment = url.pathname === '/' && url.hash ? `${canonical}/` : canonical;
    return `${rootWithFragment}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

function getConfiguredOrigin(): string | undefined {
  try {
    return new URL(PUBLIC_SITE_CONFIG.baseUrl).origin;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is PublicSiteJsonLd {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
