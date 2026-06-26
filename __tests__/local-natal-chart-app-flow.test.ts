import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('local natal chart app flow', () => {
  it('shows cached startup dashboard before DB, chart ID, and prewarm background work', () => {
    const app = read('App.tsx');
    const startupLocalRead = app.indexOf('const localEntry = readLocalNatalChartCache(updatedProfile)');
    const ready = app.indexOf("setChartLoadState('ready')", startupLocalRead);
    const dashboard = app.indexOf("showStartupDashboard('dashboard')", ready);
    const background = app.indexOf('scheduleStartupBackgroundWork(updatedProfile, localEntry.chartData', dashboard);
    const scheduler = app.indexOf('const scheduleStartupBackgroundWork');
    const dbRefresh = app.indexOf('getChartFromDB(String(targetProfile.id))', scheduler);
    const idRefresh = app.indexOf('getPrimaryChartId(String(targetProfile.id))', scheduler);
    const prewarm = app.indexOf('void prepareUserContentDbFirst({', scheduler);

    expect(startupLocalRead).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(startupLocalRead);
    expect(dashboard).toBeGreaterThan(ready);
    expect(background).toBeGreaterThan(dashboard);
    expect(dbRefresh).toBeGreaterThan(scheduler);
    expect(idRefresh).toBeGreaterThan(scheduler);
    expect(prewarm).toBeGreaterThan(scheduler);
    expect(app).toContain('Background primary chart refresh failed; keeping local cache');
  });

  it('shows dashboard immediately after a DB chart and keeps prewarm non-blocking', () => {
    const app = read('App.tsx');
    const dbChart = app.indexOf('const chart = await loadPrimaryChartOnce(updatedProfile)');
    const dashboard = app.indexOf("showStartupDashboard(requestedViewRef.current || 'dashboard')", dbChart);
    const background = app.indexOf('scheduleStartupBackgroundWork(updatedProfile, chart, null, false)', dashboard);

    expect(dbChart).toBeGreaterThan(-1);
    expect(dashboard).toBeGreaterThan(dbChart);
    expect(background).toBeGreaterThan(dashboard);
    expect(app).toContain('void prepareUserContentDbFirst({');
  });

  it('emits startup timing and cache-hit metrics', () => {
    const app = read('App.tsx');
    for (const metric of [
      'startup_profile_loaded_ms',
      'startup_local_chart_hit',
      'startup_chart_ready_ms',
      'startup_dashboard_visible_ms',
      'startup_prewarm_done_ms',
    ]) {
      expect(app).toContain(metric);
    }
  });

  it('writes onboarding and force-recalculated charts to local cache', () => {
    const app = read('App.tsx');
    const chartService = read('services/chartService.ts');

    expect(app).toContain('writeLocalNatalChart(fullProfile, generatedChart)');
    expect(app).toContain('writeLocalNatalChart(fullProfile, generatedChart, primaryChartId)');
    expect(chartService).toContain('writeLocalNatalChart(profile, chartData)');
  });

  it('clears or refreshes cache when multi-chart primary changes', () => {
    const myCharts = read('views/MyCharts.tsx');
    const app = read('App.tsx');

    expect(myCharts).toContain('clearLocalNatalChart(profile)');
    expect(app).toContain('writeLocalNatalChart(profile, freshChart, freshPrimaryChartId ?? undefined)');
    expect(app).toContain('clearLocalNatalChart(profile)');
  });

  it('starts human-base prefetch with the cached primary chart ID after the first dashboard paint', () => {
    const app = read('App.tsx');
    const localRead = app.indexOf('const localEntry = readLocalNatalChartCache(updatedProfile)');
    const dashboard = app.indexOf("showStartupDashboard('dashboard')", localRead);
    const scheduleCall = app.indexOf('scheduleStartupBackgroundWork(updatedProfile, localEntry.chartData, localEntry.chartId ?? null, true)', dashboard);
    const scheduler = app.indexOf('const scheduleStartupBackgroundWork');
    const earlyPrefetch = app.indexOf('if (initialChartId != null) startHumanBasePrefetch(initialChartId)', scheduler);
    const prewarm = app.indexOf('void prepareUserContentDbFirst({', scheduler);

    expect(dashboard).toBeGreaterThan(localRead);
    expect(scheduleCall).toBeGreaterThan(dashboard);
    expect(earlyPrefetch).toBeGreaterThan(scheduler);
    expect(earlyPrefetch).toBeLessThan(prewarm);
    expect(app).toContain('prefetchHumanBaseReport(userId, chartId)');
    expect(app).toContain('if (initialChartId == null) startHumanBasePrefetch(freshPrimaryChartId)');
  });

});
