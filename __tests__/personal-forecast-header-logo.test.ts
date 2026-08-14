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

  it('replaces the hamburger artwork with the app planet mark without changing drawer behavior', () => {
    const app = read('App.tsx');
    const styles = read('styles/personalForecastHeaderLogo.css');
    const mark = read('public/assets/brand/personal-horoscope-mark.svg');
    const nextApp = read('pages/_app.tsx');

    expect(app).toContain('lumia-side-drawer-menu-button');
    expect(app).toContain('setSideDrawerOpen((open) => !open)');
    expect(styles).toContain("url('/assets/brand/personal-horoscope-mark.svg')");
    expect(styles).toContain('.lumia-side-drawer-menu-icon line');
    expect(styles).toContain('display: none;');
    expect(mark).toContain('<circle');
    expect(mark).toContain('<ellipse');
    expect(nextApp).toContain("import '../styles/personalForecastHeaderLogo.css';");
  });
});
