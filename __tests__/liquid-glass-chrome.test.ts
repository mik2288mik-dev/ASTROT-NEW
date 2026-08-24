import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('application chrome', () => {
  it('uses the requested five-button navigation and recognizable icons', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const icons = read('components/icons/UiIcons.tsx');

    expect(tabs).toContain('data-nav-id="personal"');
    expect(tabs).toContain('data-nav-id="zodiac"');
    expect(tabs).not.toContain('today-bottom-nav-quick-links');
    expect(tabs).toContain('data-nav-id="compatibility"');
    expect(tabs).toContain('today-bottom-nav-hub');
    expect(tabs).toContain('today-bottom-nav-services');
    expect(tabs).toContain("export type LumiaNavigationSheetId = 'profile'");
    expect(tabs).toContain('<MoonStar aria-hidden="true"');
    expect(tabs).toContain('<Users aria-hidden="true"');
    expect(icons).toContain('export function ZodiacWheelIcon');
  });

  it('keeps the fixed header pure white and lets Today replace bottom glass with a hairline shell', () => {
    const styles = read('styles/liquidGlassChrome.css');
    const todayStyles = read('styles/todayHome.css');
    const app = read('pages/_app.tsx');
    const topBar = read('components/lumia-ui/AppTopBar.tsx');
    const freshHeaders = read('components/fresh-ui/FreshHeaders.tsx');
    const dashboard = read('views/Dashboard.tsx');
    const application = read('App.tsx');

    expect(app.indexOf("import '../styles/liquidGlassChrome.css'")).toBeGreaterThan(
      app.indexOf("import '../styles/newspaperVisual.css'"),
    );
    expect(app.indexOf("import '../styles/todayHome.css'")).toBeGreaterThan(
      app.indexOf("import '../styles/liquidGlassChrome.css'"),
    );
    expect(styles).toContain('--app-glass-filter: blur(30px) saturate(1.68) contrast(1.025)');
    expect(styles).not.toContain('brightness(');
    expect(styles).toContain('rgba(255, 255, 255, 0.36)');
    expect(styles).not.toContain('rgba(235, 244, 255');
    expect(styles).not.toContain('rgba(220, 234, 251');
    expect(styles).toContain('.lumia-bottom-tab-bar');
    expect(styles).toContain('.fresh-page::before');
    expect(styles).toContain('.app-top-bar');
    expect(styles).toContain('backdrop-filter: var(--app-glass-filter)');
    expect(styles).toContain('background: var(--app-canvas) !important');
    expect(styles).toContain('position: fixed');
    expect(styles).toContain('.forecast-feed-page::before');
    expect(styles).not.toContain('will-change: backdrop-filter');
    expect(styles).toContain('@supports not');
    expect(styles).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(topBar).toContain('className="home-logo-bar app-top-bar"');
    expect(topBar).not.toContain('className?: string');
    expect(topBar).toContain('app-top-bar-spacer');
    expect(topBar).toContain('reserveSpace = true');
    expect(freshHeaders).not.toContain('FreshInnerHeader');
    expect(dashboard).toContain('<AppTopBar');
    expect(dashboard).not.toContain('reserveSpace={false}');
    expect(todayStyles).toContain('.forecast-feed-page .app-top-bar');
    expect(todayStyles).toContain('background: #fff !important');
    expect(application).toContain("title={profile.language === 'en' ? 'My charts' : 'Мои карты'}");
  });

  it('uses the exact same AppTopBar component on every primary application screen', () => {
    const primaryScreens = [
      'views/Dashboard.tsx',
      'views/v2/HoroscopeReader.tsx',
      'views/v2/UnionRoom.tsx',
      'views/v2/NatalMagazine.tsx',
      'views/v2/MatrixRoom.tsx',
      'views/v2/AstrologyEncyclopedia.tsx',
      'views/v2/ServiceScreen.tsx',
      'views/Settings.tsx',
    ];
    const obsoleteHeaderStyles = [
      'styles/globals.css',
      'styles/zodiacReader.css',
      'styles/natalEditorial.css',
      'styles/compatibilityEditorial.css',
      'styles/settingsEditorial.css',
      'styles/readingBackgrounds.css',
      'styles/newspaperVisual.css',
      'styles/liquidGlassChrome.css',
    ].map(read).join('\n');

    primaryScreens.forEach((screen) => {
      const source = read(screen);
      expect(source).toContain('AppTopBar');
      expect(source).toContain('<AppTopBar');
      expect(source).not.toContain('FreshInnerHeader');
    });

    expect(obsoleteHeaderStyles).not.toContain('.fresh-inner-header');
    expect(obsoleteHeaderStyles).not.toContain('.fresh-inner-title');
    expect(obsoleteHeaderStyles).not.toContain('.fresh-inner-sub');
    expect(obsoleteHeaderStyles).not.toContain('.fresh-back-btn');
  });

  it('keeps profile actions on content headers and a Back-only utility header in Settings', () => {
    const application = read('App.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');
    const personality = read('views/PersonalityReport.tsx');
    const settings = read('views/Settings.tsx');

    [matrix, personality].forEach((screen) => {
      expect(screen).toContain('EditorialProfileButton');
      expect(screen).toContain('rightAction={(');
      expect(screen).toContain('onClick={onOpenProfile}');
    });
    expect(settings).toContain('<AppTopBar');
    expect(settings).toContain("onBack={settingsScreen === 'root'");
    expect(settings).toContain('settingsDetailBusy');
    expect(settings).not.toContain('EditorialProfileButton');
    expect(settings).not.toContain('rightAction={(');
    expect(application).toContain('<MatrixRoom');
    expect(application).toContain('onOpenProfile={openProfileSheet}');
    expect(application).toContain("title={profile.language === 'en' ? 'My charts'");
  });

  it('replaces the draggable liquid lens with a thin static navigation line', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const styles = read('styles/todayHome.css');

    expect(tabs).not.toContain('lumia-bottom-tab-liquid-lens');
    expect(tabs).not.toContain('useMotionValue');
    expect(tabs).not.toContain('onPointerMove');
    expect(styles).toContain('.today-bottom-navigation::before');
    expect(styles).toContain('height: 1px;');
    expect(styles).toContain('border-radius: 0;');
    expect(styles).toContain('box-shadow: none;');
    expect(styles).toContain('touch-action: manipulation;');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('preserves safe-area clearance, minimum tap targets and a single shared mount', () => {
    const globals = read('styles/globals.css');
    const todayStyles = read('styles/todayHome.css');
    const app = read('App.tsx');

    expect(globals).toContain('--lumia-bottom-tab-safe-bottom: max(env(safe-area-inset-bottom');
    expect(todayStyles).toContain('--lumia-bottom-tab-clearance: calc(');
    expect(globals).toContain('.lumia-main-scroll.lumia-bottom-tab-scroll');
    expect(globals).toContain('scroll-padding-bottom: var(--lumia-bottom-tab-clearance)');
    expect(todayStyles).toContain('min-height: 44px');
    expect(app.match(/<LumiaBottomTabBar/g)).toHaveLength(1);
  });
});
