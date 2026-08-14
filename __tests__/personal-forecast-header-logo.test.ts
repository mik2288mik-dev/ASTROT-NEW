import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal forecast header and shared drawer mark', () => {
  it('uses the personal forecast title while keeping the selected period dynamic', () => {
    const topBar = read('components/lumia-ui/AppTopBar.tsx');
    const dashboard = read('views/Dashboard.tsx');

    expect(topBar).toContain("? 'Личный гороскоп'");
    expect(topBar).toContain("? 'Personal horoscope'");
    expect(topBar).toContain('app-top-bar-title--personal-forecast');
    expect(topBar).toContain('app-top-bar-context--period');
    expect(dashboard).toContain('subtitle={activePeriodTitle}');
    expect(dashboard).toContain('activeDateValue');
  });

  it('uses the mark traced from the supplied production icon without the rounded tile', () => {
    const styles = read('styles/personalForecastHeaderLogo.css');
    const mark = read('public/assets/brand/personal-horoscope-mark.svg');

    expect(styles).toContain("url('/assets/brand/personal-horoscope-mark.svg')");
    expect(styles).toContain('width: 46px;');
    expect(styles).toContain('height: 35px;');
    expect(mark).toContain('Geometry traced from the supplied production app icon');
    expect(mark).toContain('viewBox="0 0 672 511"');
    expect(mark).toContain('<path');
    expect(mark).not.toContain('<circle');
    expect(mark).not.toContain('<ellipse');
  });

  it('mounts one global drawer trigger and bridges it to the existing drawer on every app view', () => {
    const nextApp = read('pages/_app.tsx');
    const trigger = read('components/lumia-ui/UniversalDrawerTrigger.tsx');
    const drawer = read('components/lumia-ui/LumiaSideDrawer.tsx');
    const styles = read('styles/personalForecastHeaderLogo.css');

    expect(nextApp).toContain("import { UniversalDrawerTrigger }");
    expect(nextApp).toContain('<UniversalDrawerTrigger />');
    expect(trigger).toContain("const DRAWER_TOGGLE_EVENT = 'lumia:toggle-side-drawer'");
    expect(trigger).toContain("const BLOCKED_VIEWS = new Set(['onboarding', 'paywall', 'admin'])");
    expect(trigger).toContain('lumia-universal-drawer-button');
    expect(drawer).toContain('const effectiveOpen = open || externalOpen');
    expect(drawer).toContain('data-current-view={currentView}');
    expect(drawer).toContain('data-drawer-enabled={profile');
    expect(drawer).toContain('NATIVE_BACK_EVENT');
    expect(styles).toContain('.lumia-app-shell > .lumia-side-drawer-menu-button');
    expect(styles).toContain('.lumia-universal-drawer-button');
    expect(styles).toContain('.lumia-universal-drawer-mark');
  });

  it('pins the trigger and keeps the app canvas and header pure white', () => {
    const styles = read('styles/personalForecastHeaderLogo.css');

    expect(styles).toContain('--lumia-shared-menu-left');
    expect(styles).toContain('--lumia-shared-menu-top');
    expect(styles).toContain('--lumia-shared-menu-top-telegram');
    expect(styles).toContain('.lumia-universal-drawer-button.is-telegram');
    expect(styles).toContain('left: var(--lumia-shared-menu-left) !important;');
    expect(styles).toContain('background-color: #ffffff !important;');
    expect(styles).toContain('background: #ffffff !important;');
    expect(styles).toContain('backdrop-filter: none !important;');
  });
});
