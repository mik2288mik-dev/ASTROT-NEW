import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Today minimal navigation shell', () => {
  it('removes the side drawer and mounts one three-zone bottom navigation', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');

    expect(app).not.toContain('LumiaSideDrawer');
    expect(app).not.toContain('sideDrawerOpen');
    expect(app.match(/<LumiaBottomTabBar/g)).toHaveLength(1);
    expect(app).toContain('shouldShowLumiaBottomNavigation(view)');
    expect(navigation).toContain('today-bottom-nav-quick-links');
    expect(navigation).toContain('data-nav-id="personal"');
    expect(navigation).toContain('data-nav-id="zodiac"');
    expect(navigation).toContain('today-bottom-nav-hub');
    expect(navigation).toContain('today-bottom-nav-services');
    expect(navigation).toContain("'matrix'");
    expect(navigation).toContain("'encyclopedia'");
    expect(navigation).toContain("'charts'");
    expect(navigation).toContain("aria-current={hubIsCurrent ? 'page' : undefined}");
    expect(navigation).toContain("aria-current={servicesAreCurrent ? 'page' : undefined}");
  });

  it('keeps hub, services, and profile destinations separate', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');

    expect(navigation).toContain("activeSheet: 'hub' | 'services' | 'profile' | null");
    expect(navigation).toContain('Совместимость');
    expect(navigation).toContain('Натальная карта');
    expect(navigation).toContain('Спросить астролога');
    expect(navigation).toContain('Хочу знать');
    expect(navigation).toContain('onClick={onOpenKnowledge}');
    expect(app).toContain("navigateTo('encyclopedia')");
    expect(navigation).toContain('Настройки');
    expect(navigation).toContain('Premium и подписка');
    expect(navigation).toContain('Сохранённые карты');
    expect(app).toContain("setNavigationSheet('profile')");
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
