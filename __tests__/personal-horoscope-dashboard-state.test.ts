import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal horoscope Dashboard states', () => {
  it('App owns loading, ready, error, retry, and stale-request protection', () => {
    const app = read('App.tsx');

    expect(app).toContain("useState<DailyPackageStatus>('idle')");
    expect(app).toContain("setDailyPackageStatus('loading')");
    expect(app).toContain("setDailyPackageStatus('ready')");
    expect(app).toContain("setDailyPackageStatus('error')");
    expect(app).toContain('dailyPackageSessionRef.current.promise !== request');
    expect(app).toContain('const retryDailyPackage = useCallback');
    expect(app).toContain('dailyPackageStatus={dailyPackageStatus}');
    expect(app).toContain('onRetryDailyPackage={retryDailyPackage}');
  });

  it('keeps hero and all topic cards mounted while content is loading', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).not.toContain('showPersonalDaySurface');
    expect(dashboard).toContain('home-day-hero--${systemState}');
    expect(dashboard).toContain('aria-busy={isDailyLoading}');
    expect(dashboard).toContain('Считаем твой личный гороскоп');
    expect(dashboard).toContain('Идёт расчёт');
    expect(dashboard).toContain('Личный гороскоп пока не готов');
    expect(dashboard).toContain('Попробовать ещё раз');

    for (const topic of ['Любовь', 'Деньги', 'Работа', 'Цели', 'Дом и семья', 'Друзья', 'Силы', 'Разговоры']) {
      expect(dashboard).toContain(`'${topic}'`);
    }
  });

  it('shows one calm working mascot only during loading', () => {
    const dashboard = read('views/Dashboard.tsx');
    const stickerCss = read('styles/stickers.css');

    expect(dashboard).toContain("moods: ['thinking', 'calm']");
    expect(dashboard).toContain("themes: ['study', 'read', 'tech']");
    expect(dashboard).toContain('const stickerRequests = isDailyLoading ? LOADING_STICKER_REQUESTS : []');
    expect(dashboard).toContain('maxMaskots={isDailyLoading ? 1 : 0}');
    expect(dashboard).toMatch(/\{isDailyLoading \? \([\s\S]*?<StickerSlot surface="hero" \/>[\s\S]*?\) : null\}/);
    expect(stickerCss).toContain('.home-day-hero--loading .sticker-layer--hero .sticker');
  });
});

describe('personal horoscope topic carousel', () => {
  it('uses a one-row native carousel with a moderate left offset and no controls', () => {
    const dashboard = read('views/Dashboard.tsx');
    const globals = read('styles/globals.css');
    const base = read('styles/homeMvpLayout.css');
    const hierarchy = read('styles/homeContentHierarchy.css');
    const css = `${globals}\n${base}\n${hierarchy}`;

    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*scroll-snap-type:\s*x mandatory/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*scroll-behavior:\s*smooth/s);
    expect(hierarchy).toContain('padding-left: 22px');
    expect(base).toContain('flex: 0 0 min(79vw, 19.5rem)');
    expect(css).toContain('scroll-snap-align: start');
    expect(css).toMatch(/\.home-spheres-track::\-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
    expect(dashboard).not.toContain('home-spheres-arrow');
    expect(dashboard).not.toContain('home-spheres-dots');
  });
});

describe('approved Dashboard visual hierarchy', () => {
  it('shows the approved personal explanation as plain text inside the large hero', () => {
    const dashboard = read('views/Dashboard.tsx');
    const css = read('styles/homeMvpLayout.css');

    expect(dashboard).toContain('home-day-hero-basis');
    expect(dashboard).toContain('Здесь твой личный гороскоп — по дате рождения и положению планет сегодня.');
    expect(dashboard).not.toContain('home-day-hero-basis-icon');
    expect(css).toContain('Plain explanatory line: no badge, icon, border or nested card.');
    expect(css).toContain('min-height: clamp(25.5rem, calc(100svh - 19.5rem), 31rem)');
    expect(css).toContain('.home-day-hero.has-card-background .home-day-hero-date');
    expect(css).toContain('text-align: center');
  });

  it('puts three rounded personal questions before angular product promos', () => {
    const dashboard = read('views/Dashboard.tsx');
    const css = read('styles/homeContentHierarchy.css');

    expect(dashboard).toContain('Где сегодня у тебя преимущество?');
    expect(dashboard).toContain('Какой разговор решит больше, чем кажется?');
    expect(dashboard).toContain('Кто сегодня замечает тебя внимательнее остальных?');
    expect(dashboard.indexOf('home-daily-questions')).toBeLessThan(dashboard.indexOf('home-product-grid'));
    expect(css).toContain('.home-daily-question-card');
    expect(css).toContain('border-radius: 1.5rem');
    expect(css).toContain('.home-product-card.home-product-card--wide');
    expect(css).toContain('border-radius: 0.72rem');
  });

  it('separates natal, compatibility, and matrix into three wide rotating promos', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain("getUniversalCardBackground('natal'");
    expect(dashboard).toContain("getUniversalCardBackground('compatibility'");
    expect(dashboard).toContain("getUniversalCardBackground('matrix'");
    expect(dashboard).toContain('home-product-card--natal home-product-card--wide');
    expect(dashboard).toContain('home-product-card--compat home-product-card--wide');
    expect(dashboard).toContain('home-product-card--matrix home-product-card--wide');
    expect(dashboard).not.toContain('home-product-card-art');
    expect(dashboard).not.toContain('home-product-card-kicker');
  });

  it('keeps original chrome geometry and changes only the liquid-glass material', () => {
    const css = read('styles/homeMvpLayout.css');
    const topRule = css.match(/\.home-screen \.home-logo-bar\s*\{([^}]*)\}/s)?.[1] || '';

    expect(css).toContain('.home-screen.fresh-page::before');
    expect(css).toContain('display: none');
    expect(topRule).toContain('backdrop-filter: blur(22px) saturate(1.55)');
    expect(topRule).not.toContain('position:');
    expect(topRule).not.toContain('min-height:');
    expect(topRule).not.toContain('margin:');
    expect(css).toContain('.lumia-bottom-tab-bar');
    expect(css).toContain('backdrop-filter: blur(30px) saturate(1.6)');
    expect(css).not.toContain('.lumia-bottom-tab-shell {');
  });
});

describe('personal horoscope terminology', () => {
  it('uses the canonical product name in user-facing product surfaces', () => {
    const files = [
      'views/Dashboard.tsx',
      'views/DailyContentScreens.tsx',
      'views/v2/HoroscopeReader.tsx',
      'views/Paywall.tsx',
      'components/Dashboard/HomeFaq.tsx',
      'lib/dailyPresentationPatterns.ts',
      'constants.ts',
    ];
    const source = files.map(read).join('\n');

    expect(source).toContain('Личный гороскоп');
    expect(source).toContain('Personal Horoscope');
    expect(source).not.toMatch(/личн[а-яё]*\s+(?:разбор[а-яё]*|дн[а-яё]*)/iu);
    expect(source).not.toMatch(/personal\s+(?:readings?|day)/iu);
  });
});
