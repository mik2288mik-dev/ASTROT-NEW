import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function indexAfter(source: string, needle: string, from: number): number {
  return source.indexOf(needle, from);
}

describe('personal daily startup flow', () => {
  it('App owns the single DailyCanvas request and passes the same object to daily screens', () => {
    const app = read('App.tsx');

    expect(app).toContain('const [dailyPackage, setDailyPackage] = useState<DailyCanvas | null>(null)');
    expect(app).toContain('dailyPackageSessionRef');
    expect(app).toContain('const prepareStartupDailyPackage = useCallback');
    expect(app).toContain('loadHumanDailyPackage(userId, input.chartId ?? undefined, dateKey');
    expect(app).toContain('dailyPackage,');
    expect(app).toContain('dailyPackage={dailyPackage}');
  });

  it('Dashboard only renders the startup package and has no personal daily network loader', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain('dailyPackage: DailyCanvas | null');
    expect(dashboard).toContain('dailyPackage?.hero_title');
    expect(dashboard).toContain('dailyPackage?.[key]?.hook');
    expect(dashboard).not.toContain('loadHumanDailyPackage');
    expect(dashboard).not.toContain('requestDailyPackage');
    expect(dashboard).toContain('onRetryDailyPackage');
    expect(dashboard).not.toContain('useEffect(');
    expect(dashboard).not.toContain('fetch(');
  });

  it('PersonalDaily renders all tabs from DailyCanvas without per-tab fetches', () => {
    const screen = read('views/DailyContentScreens.tsx');

    expect(screen).toContain('dailyPackage: DailyCanvas | null');
    expect(screen).toContain('sectionFromDailyCanvas');
    expect(screen).toContain('DAILY_SECTION_TO_CANVAS_KEY');
    expect(screen).not.toContain('loadHumanDailySection');
    expect(screen).not.toContain('fetch(');
    expect(screen).not.toContain('loadingKey');
    expect(screen).not.toContain('reloadNonce');
    expect(screen).not.toContain('setSections');
  });

  it('opens Dashboard before starting personal daily background work for cached and DB charts', () => {
    const app = read('App.tsx');

    const localRead = app.indexOf('const localEntry = readLocalNatalChartCache(updatedProfile)');
    const localDashboard = indexAfter(app, "showStartupDashboard('dashboard')", localRead);
    const localBackground = indexAfter(app, 'scheduleStartupBackgroundWork(updatedProfile, localEntry.chartData', localDashboard);

    const dbRead = app.indexOf('const chart = await loadPrimaryChartOnce(updatedProfile)');
    const dbDashboard = indexAfter(app, "showStartupDashboard(requestedViewRef.current || 'dashboard')", dbRead);
    const dbBackground = indexAfter(app, 'scheduleStartupBackgroundWork(updatedProfile, chart, null, false)', dbDashboard);
    const scheduler = app.indexOf('const scheduleStartupBackgroundWork');
    const backgroundDaily = indexAfter(app, 'void prepareStartupDailyPackage({', scheduler);

    expect(localRead).toBeGreaterThan(-1);
    expect(localDashboard).toBeGreaterThan(localRead);
    expect(localBackground).toBeGreaterThan(localDashboard);
    expect(dbRead).toBeGreaterThan(-1);
    expect(dbDashboard).toBeGreaterThan(dbRead);
    expect(dbBackground).toBeGreaterThan(dbDashboard);
    expect(backgroundDaily).toBeGreaterThan(scheduler);
    expect(app.slice(localRead, localDashboard)).not.toContain('await prepareStartupDailyPackage');
    expect(app.slice(dbRead, dbDashboard)).not.toContain('await prepareStartupDailyPackage');
  });

  it('starts the personal daily package without awaiting it during onboarding', () => {
    const app = read('App.tsx');

    const chartGenerated = app.indexOf('const generatedChart = await getOrCalculateChart(fullProfile)');
    const dailyPackage = indexAfter(app, 'void prepareStartupDailyPackage({', chartGenerated);
    const openApp = indexAfter(app, 'setView(targetView)', dailyPackage);

    expect(chartGenerated).toBeGreaterThan(-1);
    expect(dailyPackage).toBeGreaterThan(chartGenerated);
    expect(openApp).toBeGreaterThan(dailyPackage);
    expect(app.slice(chartGenerated, openApp)).not.toContain('await prepareStartupDailyPackage');
  });

  it('startup daily errors do not block Dashboard entry', () => {
    const app = read('App.tsx');

    expect(app).toContain('Startup personal daily package failed; continuing without blocking app entry');
    expect(app).not.toContain('showStartupError(startupDailyErrorMessage(updatedProfile.language), dailyError)');
    expect(app).toContain('const retryStartup = () =>');
    expect(app).toContain('setStartupRetryNonce((value) => value + 1)');
  });

  it('human-daily exposes the structured log request id on the response', () => {
    const endpoint = read('pages/api/content/natal/human-daily.ts');

    expect(endpoint).toContain("res.setHeader('x-request-id', requestId)");
  });
});
