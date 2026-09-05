import {
  createUiPreviewChart,
  createUiPreviewNatalCatalog,
  createUiPreviewProfile,
} from '../components/ui-preview/uiPreviewFixtures';
import { NATAL_REPORT_CATEGORIES, isNatalReportCategoryPack } from '../lib/natalReading/reportCatalog';
import { buildNatalModelContext, getNatalNarrativeEvidenceIds } from '../lib/natalReading/permanentReport';

describe('synthetic natal chapter previews', () => {
  const catalog = createUiPreviewNatalCatalog();
  const availableEvidence = getNatalNarrativeEvidenceIds(buildNatalModelContext(
    createUiPreviewProfile('premium', 'exact'), createUiPreviewChart('exact'),
  ));

  it.each(NATAL_REPORT_CATEGORIES)('renders a complete and valid $key reading', ({ key }) => {
    const pack = catalog.categoryPacks[key];
    expect(isNatalReportCategoryPack(pack)).toBe(true);
    expect(pack.summary).toHaveLength(key === 'main' ? 7 : 5);
    const words = pack.summary.reduce((total, paragraph) => total
      + (paragraph.text.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)?.length || 0), 0);
    expect(words).toBeGreaterThanOrEqual(key === 'main' ? 180 : 220);
    expect(words).toBeLessThanOrEqual(key === 'main' ? 300 : 280);
    expect(pack.summary.every((paragraph) => paragraph.title && !paragraph.title.includes('?'))).toBe(true);
    expect(new Set(pack.summary.map((paragraph) => paragraph.text)).size).toBe(pack.summary.length);

    const citedIds = new Set(pack.summary.flatMap((paragraph) => paragraph.evidenceIds));
    expect(citedIds.size).toBeGreaterThan(2);
    for (const paragraph of pack.summary) {
      expect(paragraph.evidenceIds.length).toBeGreaterThan(0);
      expect(paragraph.evidenceIds.every((id) => id.startsWith('natal.position.')
        && availableEvidence.has(id))).toBe(true);
    }
    expect(pack.followUps).toHaveLength(key === 'main' ? 3 : 2);
    for (const followUp of pack.followUps || []) {
      expect(followUp.categoryKey).not.toBe(key);
      expect(catalog.categoryPacks[followUp.categoryKey]).toBeDefined();
      expect(followUp.evidenceIds.every((id) => citedIds.has(id))).toBe(true);
    }
  });
});
