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
  it('uses a one-row native carousel with extra left breathing room and no controls', () => {
    const dashboard = read('views/Dashboard.tsx');
    const globals = read('styles/globals.css');
    const polish = read('styles/homeMvpLayout.css');
    const css = `${globals}\n${polish}`;

    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*scroll-snap-type:\s*x mandatory/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*scroll-behavior:\s*smooth/s);
    expect(polish).toContain('padding: 0.05rem 16px 0.55rem 32px');
    expect(polish).toContain('flex: 0 0 min(79vw, 19.5rem)');
    expect(css).toContain('scroll-snap-align: start');
    expect(css).toMatch(/\.home-spheres-track::\-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
    expect(dashboard).not.toContain('home-spheres-arrow');
    expect(dashboard).not.toContain('home-spheres-dots');
  });
});

describe('approved Dashboard visual hierarchy', () => {
  it('shows the personal calculation basis inside the large hero', () => {
    const dashboard = read('views/Dashboard.tsx');
    const css = read('styles/homeMvpLayout.css');

    expect(dashboard).toContain('home-day-hero-basis');
    expect(dashboard).toContain('Твоя карта рождения + положение планет сегодня');
    expect(css).toContain('min-height: clamp(25.5rem, calc(100svh - 19.5rem), 31rem)');
    expect(css).toContain('.home-day-hero.has-card-background .home-day-hero-date');
    expect(css).toContain('text-align: center');
  });

  it('separates natal, compatibility, and matrix from the illustrated daily cards', () => {
    const dashboard = read('views/Dashboard.tsx');
    const css = read('styles/homeMvpLayout.css');

    expect(dashboard).toContain('home-product-card--natal');
    expect(dashboard).toContain('home-product-card--compat');
    expect(dashboard).toContain('home-product-card--matrix');
    expect(dashboard).not.toContain("getUniversalCardBackground");
    expect(css).toContain('Natal chart: calm structural atlas, no animals.');
    expect(css).toContain('Compatibility: paired forms and two strong colours, no cats.');
    expect(css).toContain('Matrix: modular numeric/structural world, no animals.');
  });

  it('uses crisp liquid glass for top and bottom chrome without the old fog', () => {
    const css = read('styles/homeMvpLayout.css');

    expect(css).toContain('.home-screen.fresh-page::before');
    expect(css).toContain('display: none');
    expect(css).toContain('.home-screen .home-logo-bar');
    expect(css).toContain('backdrop-filter: blur(24px) saturate(1.55)');
    expect(css).toContain('.lumia-bottom-tab-bar');
    expect(css).toContain('backdrop-filter: blur(30px) saturate(1.6)');
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
