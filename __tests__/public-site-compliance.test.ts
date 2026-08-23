import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const LEGAL_ROUTES = [
  ['privacy', 'Политика обработки персональных данных'],
  ['terms', 'Пользовательское соглашение'],
  ['personal-data-consent', 'Согласие на обработку персональных данных'],
  ['delete-account', 'Удаление аккаунта и данных'],
  ['support', 'Поддержка MEOU'],
  ['requisites', 'Реквизиты и контакты'],
] as const;

describe('MEOU public website release contract', () => {
  it.each(LEGAL_ROUTES)('publishes /%s through the shared legal shell', (route, title) => {
    const source = read(`pages/${route}.tsx`);
    expect(source).toContain('<LegalPage');
    expect(source).toContain(`title="${title}"`);
    expect(source).toContain(`path="/${route}"`);
    expect(source).toContain('PUBLIC_SITE_CONFIG');
  });

  it('exposes every required legal route from the footer', () => {
    const shell = read('components/public-site/PublicSiteShell.tsx');

    LEGAL_ROUTES.forEach(([route]) => expect(shell).toContain(`href="/${route}"`));
    expect(shell).not.toMatch(/<form\b/i);
    expect(shell).not.toContain('Google Analytics');
    expect(shell).not.toContain('metrika');
  });

  it('fails an indexable production build when owner/legal/localisation facts are missing', () => {
    const config = read('next.config.js');

    [
      'NEXT_PUBLIC_SUPPORT_EMAIL',
      'NEXT_PUBLIC_PRIVACY_EMAIL',
      'NEXT_PUBLIC_DEVELOPER_NAME',
      'NEXT_PUBLIC_OPERATOR_INN',
      'NEXT_PUBLIC_OPERATOR_OGRNIP',
      'NEXT_PUBLIC_RUSSIAN_HOSTING_PROVIDER',
      'NEXT_PUBLIC_RUSSIAN_DATA_LOCATION',
      'NEXT_PUBLIC_TRANSACTIONAL_EMAIL_PROVIDER',
      'NEXT_PUBLIC_SUPPORT_MAIL_PROVIDER',
      'NEXT_PUBLIC_GEOCODING_PROVIDER',
      'NEXT_PUBLIC_APP_LOG_RETENTION_DAYS',
      'NEXT_PUBLIC_BACKUP_RETENTION_DAYS',
      'NEXT_PUBLIC_MINIMUM_AGE',
      'NEXT_PUBLIC_DATA_LOCALIZATION_CONFIRMED',
      'NEXT_PUBLIC_CROSS_BORDER_NOTIFICATIONS_CONFIRMED',
    ].forEach((name) => expect(config).toContain(`['${name}'`));

    expect(config).toContain('Public website legal configuration is incomplete');
    expect(config).toContain("NEXT_PUBLIC_LEGAL_PREVIEW === '1'");
  });

  it('keeps preview legal pages unindexable and removes app-only external dependencies', () => {
    const shell = read('components/public-site/PublicSiteShell.tsx');
    const document = read('pages/_document.tsx');
    const config = read('next.config.js');

    expect(shell).toContain("'noindex,nofollow'");
    expect(shell).toContain('PUBLIC_SITE_CONFIG.isLegalPreview');
    expect(document).toContain('const loadTelegramAppDependencies = !publicDocument && !isUiPreviewBuild');
    expect(config).toContain("{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }");
    expect(config).toContain("process.env.NODE_ENV === 'development'");
    expect(config).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(config).toContain(": \"script-src 'self' 'unsafe-inline'\"");
  });

  it('ships one canonical SEO surface without fake store URL or trackers', () => {
    const landing = read('pages/site.tsx');
    const shell = read('components/public-site/PublicSiteShell.tsx');
    const publicConfig = read('lib/publicSiteConfig.ts');
    const robots = read('public/robots.txt');
    const sitemap = read('public/sitemap.xml');

    expect(landing).toContain("'@type': 'SoftwareApplication'");
    expect(landing).toContain("'@type': 'WebSite'");
    expect(shell).toContain('{includeCanonical ? <link rel="canonical" href={canonical} /> : null}');
    expect(shell).toContain('<meta property="og:url" content={canonical} />');
    expect(publicConfig).toContain("const rustoreUrl = clean(process.env.NEXT_PUBLIC_RUSTORE_URL)");
    expect(publicConfig).not.toMatch(/rustore\.ru\/(?:catalog|app)\//);
    expect(robots).toContain('Sitemap: https://tvoi-goroskop.ru/sitemap.xml');
    LEGAL_ROUTES.forEach(([route]) => expect(sitemap).toContain(`<loc>https://tvoi-goroskop.ru/${route}</loc>`));
    expect([landing, shell].join('\n')).not.toMatch(/googletagmanager|analytics\.js|mc\.yandex|metrika/i);
  });

  it('keeps the app root out of search results while public build rewrites the root to the landing', () => {
    const appRoot = read('pages/index.tsx');
    const middleware = read('middleware.ts');

    expect(appRoot).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(middleware).toContain("request.nextUrl.pathname === '/'");
    expect(middleware).toContain("NextResponse.rewrite(new URL('/site', request.url))");
  });

  it('makes application API and auth routes unreachable from the website service', () => {
    const middleware = read('middleware.ts');

    expect(middleware).toContain("process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1'");
    expect(middleware).toContain("{ error: 'NOT_FOUND' }");
    expect(middleware).toContain('status: 404');
    expect(middleware).toContain("matcher: ['/', '/api/:path*', '/auth/:path*']");
  });

  it('does not start application cron, database, or migrations in the website service', () => {
    const instrumentation = read('instrumentation.ts');
    const dockerfile = read('Dockerfile.website');

    expect(instrumentation).toContain("process.env.MEOU_PUBLIC_SITE === '1'");
    expect(instrumentation).toContain("process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1'");
    expect(dockerfile).toContain('MEOU_PUBLIC_SITE=1');
    expect(dockerfile).toContain('NEXT_PUBLIC_MEOU_PUBLIC_SITE=1');
  });

  it('uses the exact existing brand mark and real project imagery', () => {
    const landing = read('pages/site.tsx');
    const shell = read('components/public-site/PublicSiteShell.tsx');

    expect(shell).toContain('/assets/brand/personal-horoscope-mark.svg');
    expect(landing).toContain('/home/cards/today-hero.webp');
    expect(landing).toContain('/home/cards/natal-map.webp');
    expect(landing).toContain('/home/cards/compatibility.webp');
  });
});
