import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('natal personality API snapshot policy', () => {
  it('never recalculates or duplicates a selected saved-person chart while resolving a report', () => {
    const helper = read('lib/natalReading/apiHelper.ts');

    expect(helper).toContain('&& isSelfChart(resolvedChart)');
    expect(helper).toContain('repairCanonicalChartRecord(userId, resolvedChart.id)');
    expect(helper).toContain('requireCanonicalSnapshot');
    expect(helper).toContain("code: 'NATAL_SNAPSHOT_INVALID'");
  });

  it('loads the personality subject list without repairing the primary chart', () => {
    const view = read('views/PersonalityReport.tsx');
    const storage = read('services/storageService.ts');
    const endpoint = read('pages/api/charts/index.ts');

    expect(view).toContain('getCharts(profile.id, { repairPrimary: false })');
    expect(storage).toContain("options.repairPrimary === false ? '/api/charts?repairPrimary=0'");
    expect(endpoint).toContain("const repairPrimary=req.query.repairPrimary!=='0'");
    expect(endpoint).toContain('if (repairPrimary&&(!selfChart');
  });

  it.each([
    'pages/api/content/natal/human-base.ts',
    'pages/api/content/natal/human-premium.ts',
    'pages/api/content/natal/questions.ts',
  ])('%s requires the same complete saved snapshot', (file) => {
    const source = read(file);
    expect(source).toContain('requireCanonicalSnapshot: true');
    expect(source).toContain('repairCanonicalSnapshot: false');
  });

  it('reads the primary timezone for questions without repairing or recalculating it', () => {
    const source = read('pages/api/content/natal/questions.ts');
    expect(source).toContain('{ repairCanonical: false }');
  });

  it.each([
    'pages/api/content/natal/human-base.ts',
    'pages/api/content/natal/human-premium.ts',
  ])('%s returns a retryable error and never caches an empty success fallback', (file) => {
    const source = read(file);
    expect(source).toContain('retryable: true');
    expect(source).toContain('status(503)');
    expect(source).not.toContain("source: 'fallback-inline'");
    expect(source).not.toContain('deterministic_fallback');
  });

  it.each([
    'pages/api/content/natal/human-base.ts',
    'pages/api/content/natal/human-premium.ts',
  ])('%s localizes retryable errors from the resolved subject language', (file) => {
    const source = read(file);
    expect(source).toContain("ctx.profile.language === 'en'");
    expect(source).toContain("language === 'en'");
    expect(source).toContain('the saved chart has not changed');
  });
});
