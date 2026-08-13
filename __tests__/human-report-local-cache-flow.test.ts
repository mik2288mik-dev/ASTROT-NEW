import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('human report local-cache flow', () => {
  const source = read('components/NatalReading/HumanReport.tsx');
  const app = read('App.tsx');

  it('uses the chart-scoped local human-base synchronously before showing a loading state', () => {
    expect(app).toContain('const cacheContext = { chartData: targetChartData || null };');
    expect(app).toContain('readLocalHumanBaseReportWithFallback(targetProfile, targetChartId, cacheContext)');
    expect(source).toContain('const matchingPreloadedReport = useMemo');
    expect(source).toContain('preloadedReport.chartFingerprint === cacheIdentity.chartFingerprint');
    expect(source).toContain('preloadedReport.reportVersion === cacheIdentity.reportVersion');
    expect(source).toContain('const initialBase = matchingPreloadedReport || cachedBase');
    expect(source).toContain('const [loading, setLoading] = useState(!initialBase)');
  });

  it('keeps language-specific service caches and only clears text when language changes', () => {
    expect(source).toContain('getHumanBaseReportCached(userId, chartId, language, cacheIdentity)');
    expect(source).toContain('reportVersion: NATAL_PERMANENT_CONTRACT_VERSION');
    expect(source).toContain('const identityChanged = baseIdentityRef.current !== reportIdentity;');
  });

  it('writes server cache and background generation results with chart context', () => {
    expect(app).toContain('writeLocalHumanBaseReport(targetProfile, dbCached, targetChartId, cacheContext)');
    expect(app).toContain('writeLocalHumanBaseReport(targetProfile, report, chartId, {');
    expect(app).toContain('chartData: reportChartData');
  });

  it('never publishes a background preload after the active snapshot changed', () => {
    expect(app).toContain('isCurrentSnapshot: () => boolean');
    expect(app).toContain('if (!cancelled && isCurrentSnapshot())');
    expect(app).toContain('current?.chartFingerprint === freshFingerprint ? current : null');
  });

  it('loads one cohesive Premium report instead of the legacy section map', () => {
    expect(source).toContain('ensureHumanPremiumReport(userId, chartId, language, cacheIdentity)');
    expect(source).not.toContain('HUMAN_MAP_SECTION_KEYS');
    expect(source).not.toContain('loadHumanPaidSection');
  });

  it('persists App prefetch results and clears local reports with chart invalidation', () => {
    const charts = read('views/MyCharts.tsx');
    expect(app).toContain('writeLocalHumanBaseReport(targetProfile, report, chartId, {');
    expect(app).toContain('writeLocalHumanBaseReport(targetProfile, dbCached, targetChartId, cacheContext)');
    expect(app).toContain('clearLocalHumanBaseReport(fullProfile, primaryChartId)');
    expect(charts).toContain('clearLocalHumanBaseReport(profile, chart.id, {');
  });

  it('passes the complete saved-chart subject and remounts before rendering its report', () => {
    const app = read('App.tsx');
    const charts = read('views/MyCharts.tsx');
    const magazine = read('views/v2/NatalMagazine.tsx');
    expect(charts).toContain('onChartSelect?: (chart: ChartListItem) => void');
    expect(charts).toContain('onChartSelect(chart)');
    expect(app).toContain('setActiveChartSubject(chart)');
    expect(app).toContain('chartSubject={activeChartSubject}');
    expect(magazine).toContain('key={reportSubjectKey}');
    expect(magazine).toContain('chartSubject={chartSubject}');
  });

  it('shows the chart summary immediately while the human-base API is slow', () => {
    // Дочерний экран сразу использует рассчитанную chartData; ожидание относится только к тексту Luna.
    const personality = read('views/PersonalityReport.tsx');
    expect(personality).toContain('chartData={chartData}');
    expect(source).toContain('Подготавливаем разбор карты.');
    expect(source).not.toContain('Загружаем интерпретацию карты');
    expect(source).not.toContain('Array.from({ length: 5 })');
  });
});
