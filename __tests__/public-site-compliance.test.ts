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
  });

  it('exposes every required legal route from the footer', () => {
    const shell = read('components/public-site/PublicSiteShell.tsx');

    LEGAL_ROUTES.forEach(([route]) => expect(shell).toContain(`href="/${route}"`));
    expect(shell).not.toMatch(/<form\b/i);
    expect(shell).not.toContain('Google Analytics');
    expect(shell).not.toContain('metrika');
  });

  it('ships confirmed operator details and never shows internal legal placeholders', () => {
    const publicConfig = read('lib/publicSiteConfig.ts');
    const shell = read('components/public-site/PublicSiteShell.tsx');
    const supportForm = read('components/public-site/SupportForm.tsx');
    const publicPages = LEGAL_ROUTES.map(([route]) => read(`pages/${route}.tsx`)).join('\n');
    const publicSources = [publicConfig, shell, supportForm, publicPages].join('\n');

    expect(publicConfig).toContain('Индивидуальный предприниматель Кобытев Михаил Сергеевич');
    expect(publicConfig).toContain('504215768509');
    expect(publicConfig).toContain('326508100461369');
    expect(publicConfig).toContain('applicationHostingProvider');
    expect(publicConfig).not.toContain('russianHostingProvider');
    expect(publicSources).not.toContain(['kopikm', '@yandex.ru'].join(''));
    expect(publicSources).not.toMatch(/OWNER_REQUIRED|черновик не готов|release gate/i);
  });

  it('uses one real support form without exposing the destination mailbox', () => {
    const page = read('pages/support.tsx');
    const form = read('components/public-site/SupportForm.tsx');
    const endpoint = read('pages/api/site-support.ts');

    expect(page).toContain('<SupportForm />');
    expect(form).toContain('Отправить в поддержку');
    expect(form).toContain("fetch('/api/site-support'");
    expect(form).toContain('aria-invalid');
    expect(form).toContain('role="status"');
    expect(endpoint).toContain("serverValue('SUPPORT_INBOX_EMAIL')");
    expect(endpoint).toContain("serverValue('SUPPORT_EMAIL_FROM')");
    expect(endpoint).toContain('RESEND_API_KEY');
    expect(endpoint).toContain('isSameOrigin(req)');
    expect(endpoint).toContain('allowRequest(getClientKey(req))');
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
    expect(landing).toContain("'@type': 'Organization'");
    expect(landing).toContain("'@type': 'WebSite'");
    expect(shell).toContain('{includeCanonical ? <link rel="canonical" href={canonical} /> : null}');
    expect(shell).toContain('<meta property="og:url" content={canonical} />');
    expect(shell).toContain('/assets/brand/meou-social-cover-v3.png');
    expect(publicConfig).toContain("const rustoreUrl = clean(process.env.NEXT_PUBLIC_RUSTORE_URL)");
    expect(publicConfig).toContain("url.searchParams.set('utm_source', 'available_in_rustore')");
    expect(publicConfig).toContain("url.searchParams.set('mt_sub1', ANDROID_PACKAGE_ID)");
    expect(publicConfig).not.toMatch(/rustore\.ru\/(?:catalog|app)\//);
    expect(robots).toContain('Sitemap: https://www.tvoi-goroskop.ru/sitemap.xml');
    LEGAL_ROUTES.forEach(([route]) => expect(sitemap).toContain(`<loc>https://www.tvoi-goroskop.ru/${route}</loc>`));
    expect([landing, shell].join('\n')).not.toMatch(/googletagmanager|analytics\.js|mc\.yandex|metrika/i);
  });

  it('keeps the app root out of search results while the public build rewrites root to the landing', () => {
    const appRoot = read('pages/index.tsx');
    const middleware = read('middleware.ts');

    expect(appRoot).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(middleware).toContain("request.nextUrl.pathname === '/'");
    expect(middleware).toContain("NextResponse.rewrite(new URL('/site', request.url))");
  });

  it('keeps application API and auth routes unreachable while allowing only the support endpoint', () => {
    const middleware = read('middleware.ts');

    expect(middleware).toContain("process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1'");
    expect(middleware).toContain("request.nextUrl.pathname === '/api/site-support'");
    expect(middleware).toContain('return NextResponse.next()');
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
