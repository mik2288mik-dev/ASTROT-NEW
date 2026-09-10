import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('local natal chart app flow', () => {
  it('shows the cached startup dashboard before background chart refresh work', () => {
    const app = read('App.tsx');
    const startupLocalRead = app.indexOf('const localEntry = readLocalNatalChartCache(updatedProfile)');
    const ready = app.indexOf("setChartLoadState('ready')", startupLocalRead);
    const dashboard = app.indexOf("showStartupDashboard('dashboard')", ready);
    const background = app.indexOf('scheduleStartupBackgroundWork(updatedProfile, localEntry.chartData', dashboard);
    const scheduler = app.indexOf('const scheduleStartupBackgroundWork');
    const dbRefresh = app.indexOf('getChartFromDB(String(targetProfile.id))', scheduler);
    const idRefresh = app.indexOf('getPrimaryChartId(String(targetProfile.id))', scheduler);

    expect(startupLocalRead).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(startupLocalRead);
    expect(dashboard).toBeGreaterThan(ready);
    expect(background).toBeGreaterThan(dashboard);
    expect(app.slice(ready, dashboard)).not.toContain('await prewarmUserContent');
    expect(dbRefresh).toBeGreaterThan(scheduler);
    expect(idRefresh).toBeGreaterThan(scheduler);
    expect(app).not.toContain('prepareUserContentDbFirst');
    expect(app).toContain('Background primary chart refresh failed; keeping local cache');
  });

  it('opens dashboard before the background DB chart and leaves forecast loading to Dashboard', () => {
    const app = read('App.tsx');
    const dashboardView = read('views/Dashboard.tsx');
    const dashboard = app.indexOf("showStartupDashboard(requestedViewRef.current || 'dashboard')");
    const dbChart = app.indexOf('void loadPrimaryChartOnce(updatedProfile).then((chart) => {', dashboard);
    const background = app.indexOf('scheduleStartupBackgroundWork(updatedProfile, chart, null, false)', dbChart);

    expect(dashboard).toBeGreaterThan(-1);
    expect(dbChart).toBeGreaterThan(dashboard);
    expect(background).toBeGreaterThan(dbChart);
    expect(app.slice(dashboard, dbChart)).not.toContain('await prewarmUserContent');
    expect(app).not.toContain('prepareUserContentDbFirst');
    expect(dashboardView).toContain('loadPersonalForecast({');
  });

  it('emits startup timing and cache-hit metrics', () => {
    const app = read('App.tsx');
    for (const metric of [
      'startup_profile_loaded_ms',
      'startup_local_chart_hit',
      'startup_chart_ready_ms',
      'startup_dashboard_visible_ms',
    ]) {
      expect(app).toContain(metric);
    }
  });

  it('writes onboarding and force-recalculated charts to local cache', () => {
    const app = read('App.tsx');
    const chartService = read('services/chartService.ts');

    expect(app).toContain('writeLocalNatalChart(canonicalFullProfile, generatedChart)');
    expect(app).toContain('writeLocalNatalChart(canonicalFullProfile, generatedChart, primaryChartId)');
    expect(chartService).toContain('writeLocalNatalChart(profile, chart)');
  });

  it('keeps the self cache stable because saved people cannot become primary', () => {
    const myCharts = read('views/MyCharts.tsx');
    const app = read('App.tsx');

    expect(myCharts).not.toContain('clearLocalNatalChart(profile)');
    expect(myCharts).not.toContain('setPrimaryChart');
    expect(app).toContain('writeLocalNatalChart(targetProfile, freshChart, freshPrimaryChartId ?? undefined)');
    expect(app).toContain('clearLocalNatalChart(targetProfile)');
  });

  it('starts the main natal catalog prefetch with the resolved chart ID after the first dashboard paint', () => {
    const app = read('App.tsx');
    const localRead = app.indexOf('const localEntry = readLocalNatalChartCache(updatedProfile)');
    const dashboard = app.indexOf("showStartupDashboard('dashboard')", localRead);
    const scheduleCall = app.indexOf('scheduleStartupBackgroundWork(updatedProfile, localEntry.chartData, startupChartId, true)', dashboard);
    const scheduler = app.indexOf('const scheduleStartupBackgroundWork');
    const earlyPrefetch = app.indexOf('startNatalCatalogPrefetch(initialChartId, initialChart, () => (', scheduler);
    const backgroundRefresh = app.indexOf('void (async () => {', scheduler);

    expect(dashboard).toBeGreaterThan(localRead);
    expect(scheduleCall).toBeGreaterThan(dashboard);
    expect(earlyPrefetch).toBeGreaterThan(scheduler);
    expect(earlyPrefetch).toBeLessThan(backgroundRefresh);
    expect(app).toMatch(/ensureNatalCatalogCategory\(\s*userId,\s*'main',/);
    expect(app).toContain('startNatalCatalogPrefetch(freshPrimaryChartId, reportChart, () => (');
    expect(app).not.toContain('prefetchHumanBaseReport(');
  });

  it('starts the main natal catalog prefetch after onboarding resolves the canonical primary chart ID', () => {
    const app = read('App.tsx');
    const onboarding = app.indexOf('const handleOnboardingComplete = async');
    const chartReady = app.indexOf('primaryChartDataRef.current = generatedChart', onboarding);
    const resolvePrimaryId = app.indexOf("void getPrimaryChartId(String(canonicalFullProfile.id))", chartReady);
    const currentChartGuard = app.indexOf('primaryChartDataRef.current === generatedChart', resolvePrimaryId);
    const writeWithId = app.indexOf('writeLocalNatalChart(canonicalFullProfile, generatedChart, primaryChartId)', currentChartGuard);
    const catalogPrefetch = app.indexOf('void ensureNatalCatalogCategory(', writeWithId);
    const onboardingEnd = app.indexOf('const handleProfileUpdate = useCallback', catalogPrefetch);

    expect(chartReady).toBeGreaterThan(onboarding);
    expect(resolvePrimaryId).toBeGreaterThan(chartReady);
    expect(currentChartGuard).toBeGreaterThan(resolvePrimaryId);
    expect(writeWithId).toBeGreaterThan(currentChartGuard);
    expect(catalogPrefetch).toBeGreaterThan(writeWithId);
    expect(catalogPrefetch).toBeLessThan(onboardingEnd);
    expect(app.slice(catalogPrefetch, onboardingEnd)).toMatch(/safeUserId,\s*'main',\s*primaryChartId,/);
    expect(app.slice(catalogPrefetch, onboardingEnd)).toContain('canonicalFullProfile.language');
    expect(app.slice(currentChartGuard, catalogPrefetch)).toContain('buildNatalChartFingerprint(generatedChart)');
    expect(app.slice(currentChartGuard, catalogPrefetch)).toContain('NATAL_REPORT_CATALOG_CONTRACT_VERSION');
  });

});
