import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal forecast header and shared navigation', () => {
  it('uses the personal forecast title while keeping the selected period dynamic', () => {
    const topBar = read('components/lumia-ui/AppTopBar.tsx');
    const dashboard = read('views/Dashboard.tsx');

    expect(topBar).toContain("title === 'NEBO'");
    expect(topBar).toContain('app-top-bar-title--personal-forecast');
    expect(topBar).toContain('app-top-bar-context--period');
    expect(dashboard).toContain('title="NEBO"');
    expect(dashboard).toContain('EditorialChartsButton');
    expect(dashboard).toContain('Открыть мои карты');
    expect(dashboard).toContain('role="tablist"');
    expect(dashboard).toContain('activeDateValue');
  });

  it('uses the mark traced from the supplied production icon without the rounded tile', () => {
    const styles = read('styles/personalForecastHeaderLogo.css');
    const mark = read('public/assets/brand/personal-horoscope-mark.svg');

    expect(styles).toContain("url('/assets/brand/personal-horoscope-mark.svg')");
    expect(styles).toContain('width: 43px;');
    expect(styles).toContain('height: 33px;');
    expect(mark).toContain('Geometry traced from the supplied production app icon');
    expect(mark).toContain('viewBox="0 0 672 511"');
    expect(mark).toContain('<path');
    expect(mark).not.toContain('<circle');
    expect(mark).not.toContain('<ellipse');
  });

  it('mounts one bottom navigation and leaves the retired drawer trigger unmounted', () => {
    const nextApp = read('pages/_app.tsx');
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');

    expect(nextApp).not.toContain('UniversalDrawerTrigger');
    expect(app).not.toContain('LumiaSideDrawer');
    expect(app.match(/<LumiaBottomTabBar/g)).toHaveLength(1);
    expect(navigation).not.toContain('today-bottom-nav-quick-links');
    expect(navigation).toContain('data-nav-id="compatibility"');
    expect(navigation).toContain('today-bottom-nav-hub');
    expect(navigation).toContain('today-bottom-nav-services');
  });

  it('keeps the app canvas white and separates the bottom navigation with one hairline', () => {
    const styles = read('styles/personalForecastHeaderLogo.css');
    const todayStyles = read('styles/todayHome.css');

    expect(styles).toContain('background-color: #ffffff !important;');
    expect(styles).toContain('background: #ffffff !important;');
    expect(styles).toContain('backdrop-filter: none !important;');
    expect(todayStyles).toContain('.today-bottom-navigation::before');
    expect(todayStyles).toContain('height: 1px;');
    expect(todayStyles).toContain('border-radius: 0;');
  });
});
