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

  it('keeps dashboard focused on the approved mvp destinations', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain('onOpenPersonalDaily');
    expect(dashboard).toContain('onCreateNatalChart');
    expect(dashboard).toContain('onOpenMatrix');
    expect(dashboard).toContain('onOpenSynastry');
    expect(dashboard).not.toContain('onOpenOracle');
    expect(dashboard).not.toContain('LzAskPresets');
    expect(dashboard).not.toContain('FreshAskCombobox');
    expect(dashboard).not.toContain('/api/weather');
  });

  it('routes personal day through the single personal_daily view', () => {
    const app = read('App.tsx');

    expect(app).toContain('PersonalDailyScreen');
    expect(app).toContain('const openPersonalDailyView = useCallback');
    expect(app).toContain("navigateTo('personal_daily')");
    expect(app).toContain("view === 'personal_daily'");
    expect(app).toContain('onOpenPersonalDaily={openPersonalDailyView}');
    expect(app).not.toContain("view === 'oracle'");
    expect(app).not.toContain("view === 'hook'");
  });

  it('protects private daily content with server identity and premium entitlement', () => {
    const route = read('pages/api/content/natal/human-daily.ts');
    const service = read('services/natalReadingService.ts');

    expect(route).toContain('ensureValidContext');
    expect(route).toContain('getPremiumEntitlementState');
    expect(route).toContain('PREMIUM_REQUIRED');
    expect(service).toContain("headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }");
  });
});
