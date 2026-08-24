import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Today minimal navigation shell', () => {
  it('removes the side drawer and mounts one five-button bottom navigation', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');

    expect(app).not.toContain('LumiaSideDrawer');
    expect(app).not.toContain('sideDrawerOpen');
    expect(app.match(/<LumiaBottomTabBar/g)).toHaveLength(1);
    expect(app).toContain('shouldShowLumiaBottomNavigation(view)');
    expect(navigation).not.toContain('today-bottom-nav-quick-links');
    expect(navigation).toContain('data-nav-id="personal"');
    expect(navigation).toContain('data-nav-id="zodiac"');
    expect(navigation).toContain('data-nav-id="compatibility"');
    expect(navigation).toContain('<MoonStar aria-hidden="true" strokeWidth={1.25} />');
    expect(navigation).toContain('<Users aria-hidden="true" strokeWidth={1.25} />');
    expect(navigation).not.toContain('ZodiacWheelIcon');
    expect(navigation).not.toContain('HeartHandshake');
    expect(navigation).toContain('today-bottom-nav-hub');
    expect(navigation).toContain('today-bottom-nav-services');
    expect(navigation).toContain("'matrix'");
    expect(navigation).toContain("'encyclopedia'");
    expect(navigation).toContain("'charts'");
    expect(navigation).toContain("aria-current={natalIsCurrent ? 'page' : undefined}");
    expect(navigation).toContain("aria-current={servicesAreCurrent ? 'page' : undefined}");
  });

  it('keeps direct destinations, radial services, and profile destinations separate', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');

    expect(navigation).toContain("export type LumiaNavigationSheetId = 'services' | 'profile'");
    expect(navigation).toContain('Совместимость');
    expect(navigation).toContain('Натальная карта');
    expect(navigation).not.toContain('Спросить астролога');
    expect(navigation).toContain('Хочу знать');
    expect(navigation).toContain('onClick={() => runServiceAction(onOpenKnowledge)}');
    expect(app).toContain("navigateTo('encyclopedia')");
    expect(navigation).toContain('Настройки');
    expect(navigation).toContain('Подписка');
    expect(navigation).toContain('const openSubscription = hasActivePremium(profile) ? onOpenSettings : onOpenPremium;');
    expect(navigation).toContain('onClick={() => runServiceAction(openSubscription)}');
    expect(app).toContain("void requestPremium('settings', undefined, undefined, {");
    expect(app).toContain('bypassFirstValueGate: true');
    expect(app).toContain('&& !options?.bypassFirstValueGate');
    expect(navigation).toContain('Сохранённые карты');
    expect(app).toContain("setNavigationSheet('profile')");
  });

  it('opens natal directly and expands services from the right button as a radial menu', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const styles = read('styles/todayHome.css');

    expect(navigation).toContain('/assets/brand/personal-horoscope-mark.svg');
    expect(navigation).toContain("from 'framer-motion'");
    expect(navigation).toContain('onClick={() => runNavigationAction(onOpenNatal)}');
    expect(navigation).toContain('onClick={() => runNavigationAction(onOpenCompatibility)}');
    expect(navigation).toContain('onClick={() => runNavigationAction(onOpenServices)}');
    expect(navigation).toContain('aria-haspopup="menu"');
    expect(navigation).toContain('role="menu"');
    expect(navigation.match(/role="menuitem"/g)).toHaveLength(4);
    expect(navigation).toContain('today-hub-dismiss-layer');
    expect(navigation).toContain("open={activeSheet === 'profile'}");
    expect(styles).toContain('.today-hub-radial-menu');
    expect(styles).toContain('.today-hub-radial-action');
    expect(styles).not.toContain(".today-bottom-nav-services[aria-current='page']::after");
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(app).toContain("current === 'services' ? null : 'services'");
    expect(app).not.toContain("navigationSheet !== 'hub'");
  });

  it('renders three controlled text tabs directly below the Today header', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain('role="tablist"');
    expect(dashboard).toContain('aria-selected={period === activePeriod}');
    expect(dashboard).toContain('tabIndex={period === focusedPeriod ? 0 : -1}');
    expect(dashboard).toContain('onPeriodChange?.(period)');
    expect(dashboard).toContain("day: language === 'ru' ? 'Сегодня' : 'Today'");
    expect(dashboard).toContain("week: language === 'ru' ? 'Неделя' : 'Week'");
    expect(dashboard).toContain("month: language === 'ru' ? 'Месяц' : 'Month'");
  });

  it('uses one semantic clock, hidden decorative lines, and reduced-motion guards', () => {
    const clock = read('components/PersonalForecastFeed/TodayCalendarClock.tsx');
    const styles = read('styles/todayHome.css');

    expect(clock).toContain('<time');
    expect(clock).toContain('aria-hidden="true"');
    expect(clock).toContain('focusable="false"');
    expect(clock).toContain('useReducedMotion');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.today-bottom-navigation::before');
    expect(styles).not.toContain('.today-bottom-navigation::before {\n  border-radius: 50%');
  });
});
