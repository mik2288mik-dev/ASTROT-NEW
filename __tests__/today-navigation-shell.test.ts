import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Today minimal navigation shell', () => {
  it('mounts one five-button bottom navigation with a Menu hamburger', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');

    expect(app).not.toContain('LumiaSideDrawer');
    expect(app.match(/<LumiaBottomTabBar/g)).toHaveLength(1);
    expect(app).not.toContain('useNeboDesign');
    expect(app).toContain('shouldShowLumiaBottomNavigation(view)');
    expect(navigation).toContain('data-nav-id="personal"');
    expect(navigation).toContain('data-nav-id="zodiac"');
    expect(navigation).toContain('data-nav-id="compatibility"');
    expect(navigation).toContain('today-bottom-nav-hub');
    expect(navigation).toContain('today-bottom-nav-services');
    expect(navigation).toContain('<Menu aria-hidden="true" strokeWidth={1.25} />');
    expect(navigation).not.toContain('MoreHorizontal');
    expect(navigation).toContain("'matrix'");
    expect(navigation).toContain("'encyclopedia'");
    expect(navigation).toContain("'charts'");
    expect(navigation).toContain("aria-current={natalIsCurrent ? 'page' : undefined}");
    expect(navigation).toContain("aria-current={servicesAreCurrent ? 'page' : undefined}");
    ['Сегодня', 'Зодиак', 'Натальная карта', 'Сравнить', 'Меню']
      .forEach((label) => expect(navigation).toContain(`>${label}</span>`));
  });

  it('opens Matrix from Menu and moves settings into the header', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const services = read('views/v2/ServiceScreen.tsx');

    expect(navigation).toContain("export type LumiaNavigationSheetId = 'profile'");
    ['Матрица судьбы', 'Хочу знать', 'Магазин']
      .forEach((label) => expect(services).toContain(label));
    expect(services).toContain("export type ServiceTab = 'matrix' | 'knowledge' | 'store'");
    expect(services).not.toContain("id: 'subscription'");
    expect(services).not.toContain("id: 'charts'");
    expect(services).toContain('<EditorialTabs');
    expect(services).toContain('className="services-screen-tabs"');
    expect(services).toContain("title={ru ? 'Меню' : 'Menu'}");
    expect(services).toContain('<EditorialChartsButton');
    expect(services).not.toContain('<EditorialSettingsButton');
    expect(services).toContain("'Матрица судьбы'");
    expect(services).toContain('onOpenMatrix');
    expect(app).toContain('<AppTopBarSettingsProvider');
    expect(app).toContain("navigateTo('settings')");
    expect(services).not.toContain('settingsContent');
    expect(app).not.toContain("setServiceTab('charts')");
    expect(app).toContain('onOpenCharts={openProfileCharts}');
    expect(app).toContain("onOpenMatrix={() => navigateTo('matrix')}");
    expect(app).not.toContain("onOpenSettings={() => navigateTo('settings')}");
    expect(app).toContain("navigateTo('services')");
    expect(app).toContain("view === 'services'");
    expect(app).toContain('<ServiceScreen');
    expect(app).not.toContain("view === 'more'");
    expect(app).not.toContain("navigateTo('more')");
    expect(app).not.toContain('<MoreHub');
  });

  it('opens services as a normal screen without an overlay or radial positioning', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const styles = read('styles/todayHome.css');

    expect(navigation).not.toContain("from 'framer-motion'");
    expect(navigation).toContain('onClick={() => runNavigationAction(onOpenServices)}');
    expect(navigation).toContain('data-nav-id="services"');
    expect(navigation).not.toContain('aria-haspopup="menu"');
    expect(navigation).not.toContain('role="menu"');
    expect(navigation).not.toContain('today-services-dismiss-layer');
    expect(navigation).not.toContain('serviceMotion');
    expect(styles).not.toContain('.today-services-menu');
    expect(styles).not.toContain('.today-hub-radial-menu');
    expect(styles).not.toContain('.today-hub-radial-action');
    expect(styles).not.toContain('calc(-40vw');
    expect(styles).toContain('.today-bottom-nav-services');
    expect(styles).not.toContain('.today-bottom-nav-more');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(app).not.toContain("setNavigationSheet('services')");
  });

  it('keeps Matrix separate from Natal tabs and uses the standalone screen', () => {
    const natal = read('views/v2/NatalMagazine.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');

    const primaryNav = natal.slice(natal.indexOf('<nav className={styles.navigation}'), natal.indexOf('</nav>'));
    ['Обзор', 'Карта', 'Подробно', 'Спросить'].forEach((label) => expect(primaryNav).toContain(label));
    expect(primaryNav).not.toContain('Матрица судьбы');
    expect(natal).toContain('<InteractiveNatalMap');

    expect(matrix).toContain('computeMatrix(calculatedDate, lang)');
    expect(matrix).toContain("import styles from './MatrixRoom.module.css'");
    expect(matrix).not.toContain('useNeboVisualMode');
  });

  it('keeps Today period tabs and reduced-motion guards unchanged', () => {
    const dashboard = read('views/Dashboard.tsx');
    const clock = read('components/PersonalForecastFeed/TodayCalendarClock.tsx');
    const styles = read('styles/todayHome.css');

    expect(dashboard).toContain('role="tablist"');
    expect(dashboard).toContain('aria-selected={period === activePeriod}');
    expect(dashboard).toContain('onPeriodChange?.(period)');
    expect(clock).toContain('<time');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.today-bottom-navigation::before');
    expect(styles).toContain('text-align: left');
    expect(styles).not.toContain('text-align: justify');
    expect(styles).toContain('width: min(calc(100% - 2rem), 40rem) !important');
    expect(styles).toContain('margin-inline: auto');
    expect(read('components/PersonalForecastFeed/TodayEditorialFeed.tsx')).not.toContain('today-minimal-closing-label');
  });
});
