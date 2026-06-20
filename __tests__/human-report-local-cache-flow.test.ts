import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('human report local-cache flow', () => {
  const source = read('components/NatalReading/HumanReport.tsx');

  it('uses local human-base synchronously before showing a loading state', () => {
    expect(source).toContain('const initialReport = preloadedReport');
    expect(source).toContain('readLocalHumanBaseReportWithFallback(profile, chartId)');
    expect(source).toContain('const [loading, setLoading] = useState(!initialReport)');
  });

  it('does not clear an existing report when chartId resolves and refreshes quietly', () => {
    expect(source).not.toContain('setReport(null)');
    expect(source).toContain('} else if (!report) {');
    expect(source).toContain('A chartId resolution (primary -> numeric ID) must only refresh the text quietly.');
  });

  it('writes every successful human-base ensure result to local cache', () => {
    expect(source).toContain('writeLocalHumanBaseReport(profile, nextReport, chartId)');
  });

  it('keeps paid map sections click-only on initial render', () => {
    expect(source).toContain('HUMAN_MAP_SECTION_KEYS remain click-only below and never trigger generation here.');
    // Премиум-карточки тем грузят разбор только по тапу (toggleTopic), не на рендере.
    expect(source).toMatch(/onToggle=\{\(\) => toggleTopic\(key\)\}/);
    expect(source).toMatch(/const toggleTopic[\s\S]*if \(!paidSections\[key\]\) void openPaidSection\(key\)/);
    expect(source).not.toMatch(/useEffect\([\s\S]*HUMAN_MAP_SECTION_KEYS\.map[\s\S]*loadHumanPaidSection/);
  });

  it('persists App prefetch results and clears local reports with chart invalidation', () => {
    const app = read('App.tsx');
    const charts = read('views/MyCharts.tsx');
    expect(app).toContain('writeLocalHumanBaseReport(targetProfile, report, chartId)');
    expect(app).toContain('writeLocalHumanBaseReport(targetProfile, dbCached, targetChartId)');
    expect(app).toContain('clearLocalHumanBaseReport(fullProfile, primaryChartId)');
    expect(charts).toContain('clearLocalHumanBaseReport(profile, chart.is_primary ? undefined : chart.id)');
  });

  it('shows the chart summary immediately while the human-base API is slow', () => {
    // Мгновенная сводка карты теперь рисуется синхронно из chartData в NatalMagazine
    // («большая тройка» + «Карта в цифрах»), а HumanReport показывает мягкое сообщение загрузки.
    const magazine = read('views/v2/NatalMagazine.tsx');
    expect(magazine).toContain('natal-big3');
    expect(source).toContain('Основные данные карты уже готовы. Подгружаем текстовый разбор ниже.');
    expect(source).not.toContain('Загружаем интерпретацию карты');
    expect(source).not.toContain('Array.from({ length: 5 })');
  });
});
