import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('local natal chart app flow', () => {
  it('renders a valid local primary chart before refreshing DB in background', () => {
    const app = read('App.tsx');
    const localRead = app.indexOf('const localEntry = readLocalNatalChartCache(targetProfile)');
    const ready = app.indexOf("setChartLoadState('ready')", localRead);
    const dbRefresh = app.indexOf('void getChartFromDB(String(targetProfile.id))', localRead);

    expect(localRead).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(localRead);
    expect(dbRefresh).toBeGreaterThan(ready);
    expect(app).toContain('Background primary chart refresh failed; keeping local cache');
    expect(app).toContain('Do not recalculate a DB miss while a valid local chart exists');
  });

  it('writes onboarding and force-recalculated charts to local cache', () => {
    const app = read('App.tsx');
    const chartService = read('services/chartService.ts');

    expect(app).toContain('writeLocalNatalChart(fullProfile, generatedChart)');
    expect(app).toContain('writeLocalNatalChart(fullProfile, generatedChart, primaryChartId)');
    expect(chartService).toContain('writeLocalNatalChart(profile, chartData as NatalChartData)');
  });

  it('clears or refreshes cache when multi-chart primary changes', () => {
    const myCharts = read('views/MyCharts.tsx');
    const app = read('App.tsx');

    expect(myCharts).toContain('clearLocalNatalChart(profile)');
    expect(app).toContain('writeLocalNatalChart(profile, freshChart, freshPrimaryChartId ?? undefined)');
    expect(app).toContain('clearLocalNatalChart(profile)');
  });
});
