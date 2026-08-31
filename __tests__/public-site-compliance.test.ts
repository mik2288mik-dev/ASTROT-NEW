import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const LEGAL_ROUTES = [
  ['privacy', 'Политика обработки персональных данных'],
  ['terms', 'Пользовательское соглашение'],
  ['personal-data-consent', 'Согласие на обработку персональных данных'],
  ['delete-account', 'Удаление аккаунта и данных'],
  ['support', 'Поддержка NEBO'],
  ['requisites', 'Реквизиты и контакты'],
] as const;

describe('NEBO public website release contract', () => {
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

  it('keeps legal readiness tied to operator facts without publishing hosting details', () => {
    const publicConfig = read('lib/publicSiteConfig.ts');
    const privacy = read('pages/privacy.tsx');

    [
      'NEXT_PUBLIC_SUPPORT_EMAIL',
      'NEXT_PUBLIC_PRIVACY_EMAIL',
      'NEXT_PUBLIC_DEVELOPER_NAME',
      'NEXT_PUBLIC_OPERATOR_ADDRESS',
      'NEXT_PUBLIC_OPERATOR_INN',
      'NEXT_PUBLIC_OPERATOR_OGRNIP',
      'NEXT_PUBLIC_LEGAL_PUBLICATION_DATE',
      'NEXT_PUBLIC_APP_LOG_RETENTION_DAYS',
      'NEXT_PUBLIC_BACKUP_RETENTION_DAYS',
      'NEXT_PUBLIC_SUPPORT_RETENTION_MONTHS',
      'NEXT_PUBLIC_MINIMUM_AGE',
    ].forEach((name) => expect(publicConfig).toContain(name));

    expect(publicConfig).not.toMatch(/HOSTING_PROVIDER|DATA_LOCATION|russianHosting/i);
    expect(privacy).not.toMatch(/Railway|хостинг|hosting/i);
  });

  it('keeps support copy aligned with the feedback form', () => {
    const support = read('pages/support.tsx');
    const privacy = read('pages/privacy.tsx');

    expect(support).toContain('Если нужен ответ, укажите email.');
    expect(support).not.toContain('По желанию можно приложить');
    expect(support).not.toContain('версию приложения и канал сборки');
    expect(privacy).not.toContain('разрешённая пользователем диагностика');
  });

  it('keeps preview legal pages unindexable and removes app-only external dependencies', () => {
    const shell = read('components/public-site/PublicSiteShell.tsx');
    const document = read('pages/_document.tsx');
    const config = read('next.config.js');

    expect(shell).toContain("const shouldNoindex = indexIntent === 'noindex' || noindex || PUBLIC_SITE_CONFIG.isLegalPreview");
    expect(shell).toContain("const robots = `${shouldNoindex ? 'noindex' : 'index'},${shouldFollow ? 'follow' : 'nofollow'}`");
    expect(shell).toContain('PUBLIC_SITE_CONFIG.isLegalPreview');
    expect(document).toContain('const loadTelegramAppDependencies = !publicDocument && !isUiPreviewBuild && !isMobileBuild');
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
    expect(shell).toContain('{includeCanonical ? <link key="canonical" rel="canonical" href={canonical} /> : null}');
    expect(shell).toContain('{includeCanonical ? <meta key="og:url" property="og:url" content={canonical} /> : null}');
    expect(publicConfig).toContain("const rustoreUrl = clean(process.env.NEXT_PUBLIC_RUSTORE_URL)");
    expect(publicConfig).not.toMatch(/rustore\.ru\/(?:catalog|app)\//);
    expect(robots).toContain('Sitemap: https://www.tvoi-goroskop.ru/sitemap.xml');
    LEGAL_ROUTES.forEach(([route]) => expect(sitemap).toContain(`<loc>https://www.tvoi-goroskop.ru/${route}</loc>`));
    expect([landing, shell].join('\n')).not.toMatch(/googletagmanager|analytics\.js|mc\.yandex|metrika/i);
  });

  it('keeps the app root out of search results while public build rewrites the root to the landing', () => {
    const appRoot = read('pages/index.tsx');
    const middleware = read('middleware.ts');

    expect(appRoot).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(middleware).toContain("request.nextUrl.pathname === '/'");
    expect(middleware).toContain("NextResponse.rewrite(new URL('/site', request.url), {");
  });

  it('makes application API and auth routes unreachable from the website service', () => {
    const middleware = read('middleware.ts');

    expect(middleware).toContain("process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1'");
    expect(middleware).toContain("{ error: 'NOT_FOUND' }");
    expect(middleware).toContain('status: 404');
    expect(middleware).toContain("matcher: ['/', '/site', '/api/:path*', '/auth/:path*']");
  });

  it('does not start application cron, database, or migrations in the website service', () => {
    const instrumentation = read('instrumentation.ts');
    const dockerfile = read('Dockerfile.website');

    expect(instrumentation).toContain("process.env.MEOU_PUBLIC_SITE === '1'");
    expect(instrumentation).toContain("process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1'");
    expect(dockerfile).toContain('MEOU_PUBLIC_SITE=1');
    expect(dockerfile).toContain('NEXT_PUBLIC_MEOU_PUBLIC_SITE=1');
  });

  it('uses the exact existing brand mark and the real forecast story', () => {
    const landing = read('pages/site.tsx');
    const shell = read('components/public-site/PublicSiteShell.tsx');
    const forecastStory = read('components/public-site/MeouForecastScrollStory.tsx');

    expect(shell).toContain('/assets/brand/personal-horoscope-mark.svg');
    expect(landing).toContain('<MeouForecastScrollStory />');
    expect(forecastStory).toContain('Сегодня один затянувшийся вопрос');
    expect(forecastStory).toContain('Сегодня чужая срочность');
  });
});
