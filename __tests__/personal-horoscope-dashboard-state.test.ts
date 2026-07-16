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
    expect(dashboard).toContain('Готовим твой личный гороскоп');
    expect(dashboard).toContain('Гороскоп рассчитывается');
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
  it('uses a one-row native 85 percent snap carousel without controls', () => {
    const dashboard = read('views/Dashboard.tsx');
    const css = read('styles/globals.css');

    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*scroll-snap-type:\s*x mandatory/s);
    expect(css).toMatch(/\.home-spheres-track\s*\{[^}]*scroll-behavior:\s*smooth/s);
    expect(css).toMatch(/\.home-sphere-card,[\s\S]*?flex:\s*0 0 85%/s);
    expect(css).toContain('height: clamp(9rem, calc(42.5vw - 0.85rem), 11rem)');
    expect(css).toContain('scroll-snap-align: start');
    expect(css).toMatch(/\.home-spheres-track::\-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
    expect(dashboard).not.toContain('home-spheres-arrow');
    expect(dashboard).not.toContain('home-spheres-dots');
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
