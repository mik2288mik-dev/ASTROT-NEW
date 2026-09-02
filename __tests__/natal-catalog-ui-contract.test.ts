import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal catalog UI contract', () => {
  it('starts with a clear foundation and keeps wheel, exploration and questions separate', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const styles = read('styles/natalMeaningMap.css');

    expect(magazine).toContain("export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map'");
    expect(magazine).toContain("return 'foundation'");
    expect(magazine).toContain("selectTab('map')");
    expect(magazine).toContain("selectTab('foundation')");
    expect(magazine).toContain("selectTab('explore')");
    expect(magazine).toContain("selectTab('ask')");
    expect(magazine).toContain("'Круг карты'");
    expect(magazine).toContain('onClick={onOpenCharts}');
    expect(magazine).not.toContain('<EditorialTabs');
    expect(magazine).not.toContain('<MatrixRoom');
    expect(styles).toContain('.natal-v3-primary-nav {');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
  });

  it('uses foundation plus five directions instead of six inner tabs', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');

    expect(report).toContain('<NatalMeaningExperience');
    expect(report).not.toContain('role="tablist"');
    expect(report).not.toContain('natal-catalog-tabs');
    expect(experience).toContain('const DOMAIN_KEYS = [');
    ['character', 'love', 'communication', 'work', 'money']
      .forEach((key) => expect(experience).toContain(`'${key}'`));
    expect(experience).toContain('className={`natal-v3-map-node is-foundation');
    expect(experience).toContain('className={`natal-v3-map-node is-${categoryKey}');
    expect(experience).toContain('Главное о тебе');
    expect(experience).toContain('Что можно разобрать');
  });

  it('opens one focused answer in a sheet and returns to the exact row', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');

    expect(report).toContain("returnAction: 'open_natal_answer'");
    expect(report).toContain('returnEntityId: answerKey');
    expect(report).toContain("openAnswer(answerKey, 'paywall_return')");
    expect(report).toContain('premiumContinuation.paywallInstanceId');
    expect(report).toContain('previewAlreadyLoaded');
    expect(report).toContain('if (!previewAlreadyLoaded) setActiveCategory(definition.categoryKey)');
    expect(report).toContain('.flatMap((pack) => pack?.previews || [])');
    expect(report).toContain('buildStaticDetailCategoryPack(selectedDefinition.categoryKey, language, selectedPreview)');
    expect(report).toContain('setAnswerLoading(canReadAnswer && !readableAnswerLoaded)');
    expect(report).toContain('document.getElementById(`natal-catalog-row-${answerKey}`)');
    expect(experience).toContain('className="natal-v3-sheet natal-v3-answer-sheet"');
    expect(experience).toContain('aria-modal="true"');
    expect(experience).toContain('answer.paragraphs.map');
  });

  it('shows one premium block for a direction rather than a lock on every row', () => {
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');

    expect(experience).toContain('const lockedPreviews = isPremium');
    expect(experience).toContain('className="natal-v3-premium-section"');
    expect(experience).toContain('lockedPreviews.slice(0, 4)');
    expect(experience).toContain('Открыть раздел полностью');
    expect(experience).not.toContain('natal-catalog-row-lock');
  });

  it('keeps bookmarks only for a readable full answer', () => {
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');
    const report = read('components/NatalReading/NatalCatalogReport.tsx');

    expect(experience).toContain('{canRead && answer ? (');
    expect(experience).toContain('onToggleBookmark(answerKey)');
    expect(experience).toContain("bookmarked ? 'Сохранено' : 'Сохранить'");
    expect(report).toContain('`${storageScope}:bookmarks`');
    expect(report).not.toContain('`${storageScope}:recent`');
    expect(report).not.toContain('`${storageScope}:last-read`');
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
