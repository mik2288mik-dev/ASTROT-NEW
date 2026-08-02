import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('liquid glass application chrome', () => {
  it('uses the requested labels and recognizable navigation icons', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const icons = read('components/icons/UiIcons.tsx');

    expect(tabs).toContain("today: 'Diary'");
    expect(tabs).toContain("today: 'Дневник'");
    expect(tabs).toContain("id: 'diary'");
    expect(tabs).toContain('BookOpenText');
    expect(tabs).toContain('ZodiacWheelIcon');
    expect(tabs).toContain('Handshake');
    expect(tabs).not.toContain("id: 'today'");
    expect(icons).toContain('export function ZodiacWheelIcon');
  });

  it('keeps the fixed header pure white and applies live neutral glass to the bottom bar', () => {
    const styles = read('styles/liquidGlassChrome.css');
    const app = read('pages/_app.tsx');
    const topBar = read('components/lumia-ui/AppTopBar.tsx');
    const freshHeaders = read('components/fresh-ui/FreshHeaders.tsx');
    const dashboard = read('views/Dashboard.tsx');
    const application = read('App.tsx');

    expect(app.indexOf("import '../styles/liquidGlassChrome.css'")).toBeGreaterThan(
      app.indexOf("import '../styles/newspaperVisual.css'"),
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
    expect(dashboard).toContain('reserveSpace={false}');
    expect(application).toContain("title={profile.language === 'en' ? 'My charts' : 'Мои карты'}");
  });

  it('uses the exact same AppTopBar component on every primary application screen', () => {
    const primaryScreens = [
      'views/Dashboard.tsx',
      'views/v2/HoroscopeReader.tsx',
      'views/v2/UnionRoom.tsx',
      'views/v2/NatalMagazine.tsx',
      'views/v2/MatrixRoom.tsx',
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

  it('uses one draggable liquid lens with spring settling and preserved tab buttons', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const styles = read('styles/liquidGlassChrome.css');
    const homeStyles = read('styles/homeMvpLayout.css');
    const globals = read('styles/globals.css');

    expect(tabs).toContain('lumia-bottom-tab-liquid-lens');
    expect(tabs).toContain('useMotionValue');
    expect(tabs).toContain('onPointerMove={updateLiquidDrag}');
    expect(tabs).toContain('setPointerCapture(event.pointerId)');
    expect(tabs).toContain('const stretch = Math.min(Math.abs(velocityX) / 1800, 0.16)');
    expect(tabs).toContain("type: 'spring' as const");
    expect(tabs).toContain('items[nextIndex]?.onClick()');
    expect(tabs).toContain('aria-current={item.active');
    expect(styles).toContain('.lumia-bottom-tab-liquid-lens');
    expect(styles).toContain('.lumia-bottom-tab-bar.is-dragging');
    expect(styles).toContain('touch-action: pan-y');
    expect(styles).toContain('height: 3.55rem');
    expect(styles).toContain('blur(18px) saturate(1.90) contrast(1.04)');
    expect(styles).toContain('color: #4b5563');
    expect(styles).toContain('font-size: 8.75px');
    expect(styles).toContain('font-size: 8.25px');
    expect(styles).toContain('.lumia-bottom-tab-item:focus-visible');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(tabs).not.toContain('lumia-bottom-tab-active-pill');
    expect(styles).not.toContain('lumia-bottom-tab-active-pill');
    expect(homeStyles).not.toContain('lumia-bottom-tab-active-pill');
    expect(globals).not.toContain('lumia-bottom-tab-active-pill');
  });

  it('preserves safe-area clearance, minimum tap targets and a single shared mount', () => {
    const globals = read('styles/globals.css');
    const app = read('App.tsx');

    expect(globals).toContain('--lumia-bottom-tab-safe-bottom: max(env(safe-area-inset-bottom');
    expect(globals).toContain('--lumia-bottom-tab-clearance: calc(');
    expect(globals).toContain('.lumia-main-scroll.lumia-bottom-tab-scroll');
    expect(globals).toContain('scroll-padding-bottom: var(--lumia-bottom-tab-clearance)');
    expect(globals).toContain('min-height: 3.24rem');
    expect(app.match(/<LumiaBottomTabBar/g)).toHaveLength(1);
  });
});
