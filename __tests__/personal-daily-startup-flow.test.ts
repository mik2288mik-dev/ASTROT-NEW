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
    expect(dashboard).not.toContain('retryDailyPackage');
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

  it('waits for personal daily before opening Dashboard for cached and DB charts', () => {
    const app = read('App.tsx');

    const localRead = app.indexOf('const localEntry = readLocalNatalChartCache(updatedProfile)');
    const localDaily = indexAfter(app, 'await prepareStartupDailyPackage({', localRead);
    const localDashboard = indexAfter(app, "showStartupDashboard('dashboard')", localDaily);

    const dbRead = app.indexOf('const chart = await loadPrimaryChartOnce(updatedProfile)');
    const dbDaily = indexAfter(app, 'await prepareStartupDailyPackage({', dbRead);
    const dbDashboard = indexAfter(app, "showStartupDashboard(requestedViewRef.current || 'dashboard')", dbDaily);

    expect(localRead).toBeGreaterThan(-1);
    expect(localDaily).toBeGreaterThan(localRead);
    expect(localDashboard).toBeGreaterThan(localDaily);
    expect(dbRead).toBeGreaterThan(-1);
    expect(dbDaily).toBeGreaterThan(dbRead);
    expect(dbDashboard).toBeGreaterThan(dbDaily);
  });

  it('creates the personal daily package during onboarding before opening the app', () => {
    const app = read('App.tsx');

    const chartGenerated = app.indexOf('const generatedChart = await getOrCalculateChart(fullProfile)');
    const dailyPackage = indexAfter(app, 'await prepareStartupDailyPackage({', chartGenerated);
    const openApp = indexAfter(app, 'setView(targetView)', dailyPackage);

    expect(chartGenerated).toBeGreaterThan(-1);
    expect(dailyPackage).toBeGreaterThan(chartGenerated);
    expect(openApp).toBeGreaterThan(dailyPackage);
  });

  it('startup daily errors keep the user on the shared retry screen', () => {
    const app = read('App.tsx');

    expect(app).toContain('const showStartupError = (message: string, error?: unknown)');
    expect(app).toContain('showStartupError(startupDailyErrorMessage(updatedProfile.language), dailyError)');
    expect(app).toContain('const retryStartup = () =>');
    expect(app).toContain('setStartupRetryNonce((value) => value + 1)');
  });

  it('human-daily exposes the structured log request id on the response', () => {
    const endpoint = read('pages/api/content/natal/human-daily.ts');

    expect(endpoint).toContain("res.setHeader('x-request-id', requestId)");
  });
});
