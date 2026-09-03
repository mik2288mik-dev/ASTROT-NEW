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
  });

  it('keeps legal readiness tied to real operator facts without exposing a home address', () => {
    const publicConfig = read('lib/publicSiteConfig.ts');
    const privacy = read('pages/privacy.tsx');
    const consent = read('pages/personal-data-consent.tsx');
    const requisites = read('pages/requisites.tsx');
    [
      'NEXT_PUBLIC_SUPPORT_EMAIL',
      'NEXT_PUBLIC_PRIVACY_EMAIL',
      'NEXT_PUBLIC_DEVELOPER_NAME',
      'NEXT_PUBLIC_OPERATOR_INN',
      'NEXT_PUBLIC_OPERATOR_OGRNIP',
      'NEXT_PUBLIC_LEGAL_PUBLICATION_DATE',
      'NEXT_PUBLIC_APP_LOG_RETENTION_DAYS',
      'NEXT_PUBLIC_BACKUP_RETENTION_DAYS',
      'NEXT_PUBLIC_SUPPORT_RETENTION_MONTHS',
      'NEXT_PUBLIC_MINIMUM_AGE',
    ].forEach((name) => expect(publicConfig).toContain(name));
    expect(publicConfig).not.toContain('NEXT_PUBLIC_OPERATOR_ADDRESS');
    expect([privacy, consent, requisites].join('\n')).not.toContain('operatorAddress');
    expect(publicConfig).not.toMatch(/HOSTING_PROVIDER|DATA_LOCATION|russianHosting/i);
    expect(privacy).not.toMatch(/Railway|хостинг|hosting/i);
  });

  it('keeps preview legal pages unindexable and public pages independent from app-only scripts', () => {
    const shell = read('components/public-site/PublicSiteShell.tsx');
    const document = read('pages/_document.tsx');
    const config = read('next.config.js');
    expect(shell).toContain("const shouldNoindex = indexIntent === 'noindex' || noindex || PUBLIC_SITE_CONFIG.isLegalPreview");
    expect(shell).toContain("const robots = `${shouldNoindex ? 'noindex' : 'index'},${shouldFollow ? 'follow' : 'nofollow'}`");
    expect(document).toContain('const loadTelegramAppDependencies = !publicDocument && !isUiPreviewBuild && !isMobileBuild');
    expect(config).toContain("{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }");
  });

  it('ships canonical metadata, dynamic sitemap and no fake store URL', () => {
    const landing = read('pages/site.tsx');
    const shell = read('components/public-site/PublicSiteShell.tsx');
    const publicConfig = read('lib/publicSiteConfig.ts');
    const robots = read('public/robots.txt');
    const sitemap = read('pages/sitemap.xml.ts');
    expect(landing).toContain("'@type': 'SoftwareApplication'");
    expect(landing).toContain("'@type': 'WebSite'");
    expect(shell).toContain('rel="canonical"');
    expect(shell).toContain('property="og:url"');
    expect(publicConfig).toContain("const rustoreUrl = clean(process.env.NEXT_PUBLIC_RUSTORE_URL)");
    expect(publicConfig).not.toMatch(/rustore\.ru\/(?:catalog|app)\//);
    expect(robots).toContain('Sitemap: https://www.tvoi-goroskop.ru/sitemap.xml');
    expect(sitemap).toContain('Array.from(new Set(urls))');
    expect(sitemap).toContain('isPublicLegalReady() ? LEGAL_PATHS : []');
    expect(sitemap).toContain('PUBLIC_SEO_ASPECT_PLACEMENTS');
    expect(sitemap).toContain('PUBLIC_SEO_HOUSE_SIGN_PLACEMENTS');
  });

  it('keeps application root out of search while the public build rewrites root to landing', () => {
    const appRoot = read('pages/index.tsx');
    const middleware = read('middleware.ts');
    expect(appRoot).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(middleware).toContain("request.nextUrl.pathname === '/'");
    expect(middleware).toContain("NextResponse.rewrite(new URL('/site', request.url), {");
  });

  it('makes API/auth unreachable and does not start app cron/database in website service', () => {
    const middleware = read('middleware.ts');
    const instrumentation = read('instrumentation.ts');
    const dockerfile = read('Dockerfile.website');
    expect(middleware).toContain("process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1'");
    expect(middleware).toContain("{ error: 'NOT_FOUND' }");
    expect(middleware).toContain('status: 404');
    expect(instrumentation).toContain("process.env.MEOU_PUBLIC_SITE === '1'");
    expect(dockerfile).toContain('MEOU_PUBLIC_SITE=1');
    expect(dockerfile).toContain('NEXT_PUBLIC_MEOU_PUBLIC_SITE=1');
  });

  it('uses a dark-safe brand wordmark and no legacy cloud PNG in the website shell', () => {
    const shell = read('components/public-site/PublicSiteShell.tsx');
    expect(shell).toContain('>NEBO</span>');
    expect(shell).not.toContain('nebo-cloud-logo.png');
  });

  it('keeps 404 and 500 out of the index', () => {
    const notFound = read('pages/404.tsx');
    const serverError = read('pages/500.tsx');
    expect(notFound).toContain('noindex');
    expect(serverError).toContain('noindex');
    expect(notFound).toContain('canonical={false}');
    expect(serverError).toContain('canonical={false}');
  });

  it('runs the SEO quality gate after every production website build', () => {
    const buildScript = read('scripts/build-website.mjs');
    const audit = read('scripts/audit-public-seo.mjs');
    expect(buildScript).toContain('scripts/audit-public-seo.mjs');
    expect(audit).toContain('unique titles');
    expect(audit).toContain('unique descriptions');
    expect(audit).toContain('unique canonicals');
    expect(audit).toContain("new Set(['/404', '/500'])");
  });
});
