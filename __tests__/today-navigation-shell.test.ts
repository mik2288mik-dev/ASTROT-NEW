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
    expect(navigation).toContain('data-nav-id="more"');
    expect(navigation).toContain('today-bottom-nav-more');
    expect(navigation).toContain('<MoreHorizontal aria-hidden="true" strokeWidth={1.25} />');
    expect(navigation).toContain("'matrix'");
    expect(navigation).toContain("'encyclopedia'");
    expect(navigation).toContain("'charts'");
    expect(navigation).toContain("'more'");
    expect(navigation).toContain("aria-current={natalIsCurrent ? 'page' : undefined}");
    expect(navigation).toContain("aria-current={view === 'more' ? 'page' : undefined}");
  });

  it('mounts More as one persistent three-tab screen that reuses existing surfaces', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const more = read('views/v2/MoreHub.tsx');
    const encyclopedia = read('views/v2/AstrologyEncyclopedia.tsx');
    const settings = read('views/Settings.tsx');

    expect(navigation).toContain("export type LumiaNavigationSheetId = 'profile'");
    expect(navigation).toContain('Совместимость');
    expect(navigation).toContain('Натальная карта');
    expect(navigation).not.toContain('Спросить астролога');
    expect(app).toContain("view === 'more'");
    expect(app).toContain('<MoreHub');
    expect(app).toContain("navigateTo('more')");
    expect(app).toContain("requestPremium('settings', { returnView: 'more' }, undefined, {");
    expect(app).toContain('bypassFirstValueGate: true');
    expect(app).toContain('&& !options?.bypassFirstValueGate');
    expect(more).toContain("export type MoreHubTab = 'knowledge' | 'premium' | 'settings'");
    expect(more).toContain('<AppTopBar');
    expect(more).toContain('<EditorialTabs');
    expect(more).toContain('<AstrologyEncyclopedia');
    expect(more).toContain('<PremiumHub');
    expect(more).toContain('<Settings');
    expect(more).not.toContain('navigateTo(');
    expect(encyclopedia).toContain('embedded?: boolean');
    expect(settings).toContain('embedded?: boolean');
    expect(app).toContain("setNavigationSheet('profile')");
  });

  it('opens More directly and removes the former radial service interaction', () => {
    const app = read('App.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const styles = read('styles/todayHome.css');

    expect(navigation).toContain('/assets/brand/personal-horoscope-mark.svg');
    expect(navigation).toContain('onClick={() => runNavigationAction(onOpenNatal)}');
    expect(navigation).toContain('onClick={() => runNavigationAction(onOpenCompatibility)}');
    expect(navigation).toContain('onClick={() => runNavigationAction(onOpenMore)}');
    expect(navigation).toContain("aria-label={isEnglish ? 'More' : 'Ещё'}");
    expect(navigation).toContain("open={activeSheet === 'profile'}");
    expect(navigation).not.toContain('serviceMotion');
    expect(navigation).not.toContain('role="menu"');
    expect(navigation).not.toContain('today-hub-dismiss-layer');
    expect(styles).not.toContain('.today-hub-radial-menu');
    expect(styles).not.toContain('.today-hub-radial-action');
    expect(styles).toContain(".today-bottom-nav-more[aria-current='page']::after");
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(app).not.toContain("'services'");
    expect(app).not.toContain('openNavigationServices');
  });

  it('keeps Matrix inside the persistent Natal tab shell', () => {
    const app = read('App.tsx');
    const natal = read('views/v2/NatalMagazine.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');

    expect(natal).toContain("{ id: 'matrix'");
    expect(natal).toContain("if (tab === 'matrix') setMatrixMounted(true)");
    expect(natal).toContain('hidden={activeTab !== \'matrix\'}');
    expect(natal).toContain('<MatrixRoom');
    expect(natal).toContain('embedded');
    expect(natal).not.toContain('onOpenMatrix');
    expect(natal).not.toContain("navigateTo('matrix')");
    expect(matrix).toContain('embedded?: boolean');
    expect(matrix).toContain('{!embedded ? (');
    expect(app).not.toContain('onOpenMatrix={() => navigateTo(\'matrix\')}');
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
