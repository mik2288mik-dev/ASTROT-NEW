import fs from 'fs';
import path from 'path';
import {
  NATAL_PERMANENT_CONTRACT_VERSION,
  buildPermanentNatalChartFingerprint,
  isNatalPermanentFreeReport,
} from '../lib/natalReading/permanentReport';
import {
  NATAL_REPORT_ANSWER_COUNT,
  NATAL_REPORT_CATEGORIES,
  isNatalReportAnswer,
  isNatalReportCategoryPack,
} from '../lib/natalReading/reportCatalog';
import {
  hasNatalReportCatalogCopyViolation,
  isNatalReportMainSummaryLengthAllowed,
} from '../lib/natalReading/reportCatalogGeneration';
import {
  createUiPreviewChart,
  createUiPreviewCharts,
  createUiPreviewNatalCatalog,
  createUiPreviewNatalPremiumReport,
  createUiPreviewNatalReport,
  createUiPreviewProfile,
} from '../components/ui-preview/uiPreviewFixtures';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('real natal UI Preview surface', () => {
  it('builds a valid preloaded report for the synthetic chart identity', () => {
    const profile = { ...createUiPreviewProfile('premium', 'exact'), id: '' };
    const chart = createUiPreviewChart('exact');
    const preloaded = createUiPreviewNatalReport(profile, chart);

    expect(isNatalPermanentFreeReport(preloaded.report)).toBe(true);
    expect(preloaded.chartFingerprint).toBe(buildPermanentNatalChartFingerprint(profile, chart));
    expect(preloaded.reportVersion).toBe(NATAL_PERMANENT_CONTRACT_VERSION);
    expect(preloaded.report.freeSections).toHaveLength(5);
  });

  it('builds a complete Premium continuation and a selectable chart subject', () => {
    const profile = createUiPreviewProfile('premium', 'exact');
    const chart = createUiPreviewChart('exact');
    const premium = createUiPreviewNatalPremiumReport(profile, chart);
    const charts = createUiPreviewCharts(profile, chart);

    expect(premium.sections).toHaveLength(3);
    expect(charts).toHaveLength(1);
    expect(charts[0]?.subject_type).toBe('self');
  });

  it('builds the complete offline catalog used by the real reading UI', () => {
    const catalog = createUiPreviewNatalCatalog();

    expect(Object.keys(catalog.answers)).toHaveLength(NATAL_REPORT_ANSWER_COUNT);
    expect(NATAL_REPORT_CATEGORIES.every((category) => (
      isNatalReportCategoryPack(catalog.categoryPacks[category.key])
    ))).toBe(true);
    expect(Object.values(catalog.answers).every(isNatalReportAnswer)).toBe(true);
    expect(catalog.categoryPacks.main.summary).toHaveLength(3);
    expect(catalog.categoryPacks.main.observations).toHaveLength(5);
    expect(catalog.categoryPacks.love.previews).toHaveLength(9);
    expect(catalog.categoryPacks.love.previews.find((item) => (
      item.answerKey === 'love_lose_interest'
    ))?.preview).toContain('слишком предсказуемым');

    const visibleCopy = [
      ...Object.values(catalog.categoryPacks).flatMap((pack) => [
        ...pack.summary.map((item) => item.text),
        ...pack.observations.map((item) => item.text),
        ...pack.previews.flatMap((item) => [
          item.title,
          item.preview,
          ...item.fullAnswerIncludes,
        ]),
      ]),
      ...Object.values(catalog.answers).flatMap((answer) => [
        answer.title,
        ...answer.paragraphs.map((item) => item.text),
        ...answer.fullAnswerIncludes,
      ]),
    ];
    expect(visibleCopy.filter(hasNatalReportCatalogCopyViolation)).toEqual([]);
    expect(isNatalReportMainSummaryLengthAllowed(
      catalog.categoryPacks.main.summary.map((item) => item.text),
    )).toBe(true);
  });

  it('mounts the real map and new catalog flow without a standalone preview scene', () => {
    const preview = read('components/ui-preview/UiPreviewApp.tsx');
    const magazine = read('views/v2/NatalMagazine.tsx');
    const catalogReport = read('components/NatalReading/NatalCatalogReport.tsx');

    expect(preview).toContain("import { NatalMagazine } from '../../views/v2/NatalMagazine'");
    expect(preview).toContain('<NatalMagazine');
    expect(preview).not.toContain('<PersonalityReport');
    expect(preview).toContain("const natalProfile = useMemo(() => ({ ...profile, id: '' })");
    expect(preview).toContain('preloadedReport={natalReport}');
    expect(preview).toContain('createUiPreviewNatalCatalog()');
    expect(preview).toContain('catalog: {');
    expect(preview).toContain("scenario.screen === 'question'");
    expect(preview).toContain("? 'questions'");
    expect(preview).toContain("state: scenario.state === 'loading' || scenario.state === 'error'");
    expect(preview).toContain("premiumReport: scenario.access === 'premium' ? natalPremiumReport : null");
    expect(preview).toContain("openQuestion: scenario.screen === 'question'");
    expect(preview).not.toContain('function NatalScene');
    expect(preview).not.toContain('ui-preview-question-sheet');
    expect(magazine).toContain('<NatalCatalogReport');
    expect(magazine).toContain('uiPreview={previewConfig?.catalog}');
    expect(magazine).toContain("process.env.NODE_ENV === 'development'");
    expect(magazine).toContain("process.env.NEXT_PUBLIC_UI_PREVIEW === '1'");
    expect(catalogReport).toContain("process.env.NODE_ENV === 'development'");
    expect(catalogReport).toContain("process.env.NEXT_PUBLIC_UI_PREVIEW === '1'");
  });
});
