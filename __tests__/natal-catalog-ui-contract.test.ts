import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal catalog UI contract', () => {
  it('starts with a clear foundation and keeps wheel, exploration and questions separate', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const styles = read('styles/natalMeaningMap.css');

    expect(magazine).toContain("export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map' | 'matrix'");
    expect(magazine).toContain("return 'foundation'");
    expect(magazine).toContain("selectTab('map')");
    expect(magazine).toContain("selectTab('foundation')");
    expect(magazine).toContain("selectTab('explore')");
    expect(magazine).toContain("selectTab('ask')");
    expect(magazine).toContain("'Круг карты'");
    expect(magazine).toContain('onClick={onOpenCharts}');
    expect(magazine).not.toContain('<EditorialTabs');
    expect(magazine).toContain('<MatrixRoom');
    expect(magazine).toContain("selectTab('matrix')");
    expect(magazine).toContain("'Матрица судьбы'");
    expect(styles).toContain('.natal-v3-primary-nav {');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(styles).toContain(".natal-v3-primary-nav[data-items='4']");
    expect(styles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
  });

  it('opens the complete story before offering chapter continuations', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');
    expect(report).toContain('<NatalMeaningExperience');
    expect(report).not.toContain('NATAL_REPORT_ANSWER_COUNT');
    expect(experience).toContain('natal-narrative-copy');
    expect(experience).toContain('pack.summary.map');
    expect(experience).not.toContain('mainExpanded');
    expect(experience).not.toContain('natal-v3-answer-sheet');
    expect(experience).not.toContain('natal-v3-meaning-map');
    expect(experience).toContain('Читать дальше');
  });

  it('returns from Premium directly to the selected chapter', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');
    expect(report).toContain("returnAction: 'open_natal_category'");
    expect(report).toContain('returnEntityId: category');
    expect(report).toContain('premiumContinuation.paywallInstanceId');
    expect(experience).toContain("const locked = !main && !isPremium");
    expect(experience).toContain('Читать с Premium');
    expect(experience).not.toContain('lockedPreviews');
  });

  it('explains each conclusion with real evidence and birth-time reliability', () => {
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');
    const evidence = read('components/NatalReading/NatalEvidenceSheet.tsx');

    expect(experience).toContain('Почему так?');
    expect(experience).toContain('<NatalEvidenceSheet');
    expect(evidence).toContain('buildNatalModelContext(profile, chartData)');
    expect(evidence).toContain('getPermanentNatalReliability(chartData)');
    expect(evidence).toContain('Что именно использовано');
    expect(evidence).toContain('Насколько это зависит от времени рождения');
    expect(evidence).toContain('Показать данные карты');
  });
});
