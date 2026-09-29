import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('local natal chart app flow', () => {
  it('shows the cached startup dashboard before background chart refresh work', () => {
    const app = read('App.tsx');
    const startupLocalRead = app.lastIndexOf('const localEntry = readLocalNatalChartCache(updatedProfile)');
    const ready = app.indexOf("setChartLoadState('ready')", startupLocalRead);
    const background = app.indexOf('scheduleStartupBackgroundWork(updatedProfile, localEntry.chartData', ready);
    const dashboard = app.lastIndexOf('showStartupDashboard(', background);
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
    const dbChart = app.indexOf('void loadPrimaryChartOnce(updatedProfile).then((chart) => {');
    const dashboard = app.lastIndexOf('showStartupDashboard(', dbChart);
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


});
