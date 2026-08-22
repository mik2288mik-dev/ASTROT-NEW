import fs from 'fs';
import path from 'path';
import {
  NATAL_PERMANENT_CONTRACT_VERSION,
  buildPermanentNatalChartFingerprint,
  isNatalPermanentFreeReport,
} from '../lib/natalReading/permanentReport';
import {
  createUiPreviewChart,
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
    expect(preloaded.report.freeSections).toHaveLength(4);
  });

  it('mounts NatalMagazine and its real HumanReport without the standalone preview scene', () => {
    const preview = read('components/ui-preview/UiPreviewApp.tsx');
    const magazine = read('views/v2/NatalMagazine.tsx');

    expect(preview).toContain("import { NatalMagazine } from '../../views/v2/NatalMagazine'");
    expect(preview).toContain('<NatalMagazine');
    expect(preview).toContain("const natalProfile = useMemo(() => ({ ...profile, id: '' })");
    expect(preview).toContain('preloadedReport={natalReport}');
    expect(preview).toContain("initialTab: scenario.screen === 'natal' ? 'map' : 'reading'");
    expect(preview).toContain("openQuestion: scenario.screen === 'question'");
    expect(preview).not.toContain('function NatalScene');
    expect(preview).not.toContain('ui-preview-question-sheet');
    expect(magazine).toContain('<HumanReport');
    expect(magazine).toContain("process.env.NODE_ENV === 'development'");
    expect(magazine).toContain("process.env.NEXT_PUBLIC_UI_PREVIEW === '1'");
  });
});
