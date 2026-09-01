import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal catalog UI contract', () => {
  it('keeps the four product tabs and opens the reading first', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const styles = read('styles/editorialStudio.css');
    const map = magazine.indexOf("{ id: 'map' as const");
    const reading = magazine.indexOf("{ id: 'reading' as const");
    const questions = magazine.indexOf("{ id: 'questions' as const");
    const matrix = magazine.indexOf("{ id: 'matrix' as const");

    expect(map).toBeGreaterThan(-1);
    expect(reading).toBeGreaterThan(map);
    expect(questions).toBeGreaterThan(reading);
    expect(matrix).toBeGreaterThan(questions);
    expect(magazine).toContain("previewConfig?.initialTab || 'reading'");
    expect(magazine).toContain('aria-label={language === \'ru\' ? \'Открыть круг карты\'');
    expect(magazine).toContain('label={language === \'ru\' ? \'Открыть мои карты\'');
    expect(styles).toContain('.natal-editorial-page .app-top-bar {\n  /* The bar already removes safe-area padding from its content width. */\n  --app-top-bar-title-rail: 94px;');
    expect(styles).toContain('@media (max-width: 360px)');
    expect(styles).toContain('--app-top-bar-title-rail: 90px;');
  });

  it('uses six inner topics, a flat list, and a separate answer state', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const hub = read('components/NatalReading/NatalReportHub.tsx');
    const styles = read('styles/editorialStudio.css');

    expect(report).toContain('NATAL_REPORT_CATEGORIES.map((category, index) =>');
    expect(report).toContain("role=\"tablist\"");
    expect(report).toContain('{!selectedAnswerKey ? (');
    expect(hub).toContain('className="natal-catalog-list"');
    expect(hub).toContain('{locked ? <LockKeyhole className="natal-catalog-row-lock"');
    expect(hub).not.toContain('className="natal-catalog-row-premium"');
    expect(hub).toContain('selectedAnswer.paragraphs.map((paragraph, index) =>');
    expect(hub).toContain("{language === 'ru' ? 'В полном ответе'");
    expect(hub).toContain("heading?.closest('.natal-catalog-detail')?.scrollIntoView");
    expect(styles).toContain('.natal-catalog-detail-heading h2:focus');
    expect(styles).toContain('scroll-margin-top: calc(');
  });

  it('returns to the exact paid answer and keeps reading state per chart', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const app = read('App.tsx');

    expect(report).toContain("returnAction: 'open_natal_answer'");
    expect(report).toContain('returnEntityId: answerKey');
    expect(report).toContain("openAnswer(answerKey, 'paywall_return')");
    expect(report).toContain('premiumContinuation.paywallInstanceId');
    expect(report).toContain('previewAlreadyLoaded');
    expect(report).toContain('if (!previewAlreadyLoaded) setActiveCategory(definition.categoryKey)');
    expect(report).toContain('.flatMap((pack) => pack?.previews || [])');
    expect(report).toContain('ensureNatalCatalogCategory(\n        userId,\n        definition.categoryKey,');
    expect(report).toContain('buildStaticDetailCategoryPack(selectedDefinition.categoryKey, language, selectedPreview)');
    expect(report).toContain('categoryPack={displayCategoryPack}');
    expect(report).toContain('setAnswerLoading(canReadAnswer && !readableAnswerLoaded)');
    expect(report).toContain('setCategoryLoading(!categoryPacks[categoryKey])');
    expect(report).toContain('const target = answerRow || document.getElementById(\'natal-catalog-category-title\')');
    expect(report).toContain('id={`natal-catalog-tab-${category.key}`}');
    expect(report).toContain('aria-labelledby={!selectedAnswerKey ? `natal-catalog-tab-${activeCategory}` : undefined}');
    expect(app).toContain("'.pw2-close, .pw2 .app-top-bar-side--start .app-top-bar-action'");
    expect(report).toContain('`${storageScope}:read`');
    expect(report).toContain('`${storageScope}:bookmarks`');
    expect(report).toContain('`${storageScope}:recent`');
    expect(report).toContain('`${storageScope}:last-read`');
  });

  it('prefers the preview from the tapped topic before owning and fallback packs', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const priorityLookup = report.indexOf('categoryPacks[categoryKey]?.previews.find');
    const fallbackLookup = report.indexOf('return Object.values(categoryPacks)', priorityLookup);

    expect(report).toContain('answerOriginCategory || activeCategory');
    expect(report).toContain('const priority = [primaryCategoryKey, definition?.categoryKey]');
    expect(priorityLookup).toBeGreaterThan(-1);
    expect(fallbackLookup).toBeGreaterThan(priorityLookup);
  });

  it('keeps a newly unlocked answer in loading until content or an API error arrives', () => {
    const hub = read('components/NatalReading/NatalReportHub.tsx');
    const pendingState = hub.indexOf('const answerPending = canReadAnswer');
    const pendingRender = hub.indexOf(') : answerPending ? (', pendingState);
    const errorRender = hub.indexOf(') : canReadAnswer && answerError ? (', pendingRender);

    expect(hub).toContain('&& !selectedAnswer\n      && !answerError');
    expect(pendingState).toBeGreaterThan(-1);
    expect(pendingRender).toBeGreaterThan(pendingState);
    expect(errorRender).toBeGreaterThan(pendingRender);
  });

  it('shows history and saved full answers without bookmarking a locked preview', () => {
    const hub = read('components/NatalReading/NatalReportHub.tsx');

    expect(hub).toContain("{language === 'ru' ? 'Сохранённое'");
    expect(hub).toContain("{language === 'ru' ? 'Недавно открыто'");
    expect(hub).toContain('{canReadAnswer && selectedAnswer ? (');
    expect(hub).toContain('onToggleBookmark(selectedAnswerKey)');
  });
});
