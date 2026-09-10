import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('mvp home surface', () => {
  it('does not ship removed home/chat/weather entry points', () => {
    for (const file of [
      'views/v2/TodayFeed.tsx',
      'views/v2/ActionWindows.tsx',
      'views/OracleChat.tsx',
      'views/HookChat.tsx',
      'components/lumia-ui/v2/LzAskPresets.tsx',
      'components/fresh-ui/FreshAskCombobox.tsx',
      'pages/api/content/today/home.ts',
      'pages/api/content/today/pulse.ts',
      'pages/api/content/today/action-time.ts',
      'pages/api/content/question/ask.ts',
      'pages/api/weather.ts',
      'services/weatherService.ts',
    ]) {
      expect({ file, exists: exists(file) }).toEqual({ file, exists: false });
    }
  });

  it('keeps the continuous Dashboard focused on approved destinations', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).toContain('onCreateNatalChart');
    expect(dashboard).toContain('onRequestPremium');
    expect(dashboard).not.toContain('ForecastPromotion');
    expect(dashboard).not.toContain('onOpenOracle');
    expect(dashboard).not.toContain('LzAskPresets');
    expect(dashboard).not.toContain('FreshAskCombobox');
    expect(dashboard).not.toContain('/api/weather');
  });

  it('keeps every personal period inside one PersonalForecastPackage Dashboard', () => {
    const app = read('App.tsx');
    const dashboard = read('views/Dashboard.tsx');
    const types = read('types.ts');
    expect(app).toContain('<Dashboard {...dashboardProps}');
    expect(app).toContain('onRequestPremium: requestPremium');
    expect(dashboard).toContain("const FORECAST_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month']");
    expect(dashboard).toContain("const activePeriod: PersonalForecastPeriod = requestedPeriod || 'day';");
    expect(dashboard).toContain('TodayEditorialFeed');
    expect(dashboard).toContain('ForecastSectionBlock');
    expect(dashboard).not.toContain('FreshTabs');
    expect(dashboard).not.toContain('ForecastSideNavigator');
    expect(dashboard).not.toContain('ForecastBottomSheet');
    expect(app).not.toContain('PersonalForecastScreen');
    expect(app).not.toContain("navigateTo('personal_daily')");
    expect(app).not.toContain("view === 'personal_daily'");
    expect(types).not.toContain('personal_daily');
  });

  it('protects private personal forecasts with authenticated profile ownership and entitlement slicing', () => {
    const route = read('pages/api/content/forecast/personal.ts');
    const service = read('services/personalForecastService.ts');
    expect(route).toContain('requireAppUser(req, { allowGuest: true })');
    expect(route).toContain('allowGuest: true');
    expect(route).toContain('getPremiumEntitlementState(userId)');
    expect(route).toContain('slicePersonalForecastForAccess');
    expect(route).toContain('PERSONAL_FORECAST_PROFILE_REQUIRED');
    expect(route).toContain('lockedSectionIds');
    expect(service).toContain('isPersonalForecastPackage');
    expect(service).toContain("'Content-Type': 'application/json'");
    expect(service).toContain('...getTelegramInitDataHeaders()');
    expect(service).not.toContain("params.set('userId'");
    expect(service).not.toContain('chartId');
  });
});
