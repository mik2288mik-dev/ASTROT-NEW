import fs from 'fs';
import path from 'path';
import {
  getPersonalEditorialAssetLibrary,
  selectSynastryEditorialSticker,
} from '../lib/personalForecastVisuals';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('compatibility editorial layout', () => {
  it('scopes the light flow to every UnionRoom state and preserves its gates', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const styles = read('styles/compatibilityEditorial.css');
    const app = read('pages/_app.tsx');

    expect(room.match(/compat-editorial-page compat-editorial-page--/g)).toHaveLength(2);
    expect(room).toContain('compat-editorial-page--add');
    expect(room).toContain('compat-editorial-page--result');
    expect(room).not.toContain("if (!hasChart) { onCreateNatalChart?.(); return; }");
    expect(room).toContain("if (!premium) { requestPremium(); return; }");
    expect(room).toContain('loadCompatHistory');
    expect(room).toContain('calculateExtendedSynastry');
    expect(room).toContain('RelationshipContextPicker');
    expect(room).toContain('selected.relationshipContext');
    expect(room).toContain("entryMode === 'birth'");
    expect(room).toContain("entryMode === 'sign'");
    expect(room).toContain('subjectChartId');
    expect(room).toContain('clearCompatHistory');
    expect(styles).toContain('.compat-editorial-page .compat-quick');
    expect(styles).toContain('.compat-editorial-page .compat-context-picker');
    expect(styles).toContain('.compat-editorial-page--result .compat-person-snapshot');
    expect(styles).toContain('.compat-editorial-page--result .compat-read-block');
    expect(styles).not.toMatch(/^\.fresh-page\s*\{/m);
    expect(app).toContain("import '../styles/compatibilityEditorial.css'");
  });

  it('matches the compact monochrome form contract from the approved render', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const styles = read('styles/newspaperVisual.css');
    const addStart = room.indexOf("if (screen === 'add')");
    const addEnd = room.indexOf('/* ── РЕЗУЛЬТАТ ── */', addStart);
    const addFlow = room.slice(addStart, addEnd);

    expect(addFlow).toContain("title={ru ? 'Совместимость' : 'Compatibility'}");
    expect(addFlow).not.toContain('subtitle=');
    expect(addFlow).toContain("ru ? 'По дате рождения' : 'By birth date'");
    expect(addFlow).toContain("ru ? 'По знакам зодиака' : 'By zodiac signs'");
    expect(addFlow).not.toContain('compat-mode-note');
    expect(addFlow).not.toContain("ru ? 'Кого сравниваем?' : 'Who are we comparing?'");
    expect(addFlow).toContain("ru ? 'Первый человек' : 'First person'");
    expect(addFlow).toContain("ru ? 'Второй человек' : 'Second person'");
    expect(addFlow).not.toContain('aria-hidden=\"true\">01');
    expect(addFlow).not.toContain('aria-hidden=\"true\">02');
    expect(addFlow.match(/className="compat-air-person"/g)).toHaveLength(2);
    expect(addFlow.match(/<PersonBirthFields/g)).toHaveLength(2);
    expect(addFlow).toContain('sign={youSign}');
    expect(addFlow).toContain('sign={pickSign}');
    expect(room).not.toContain('compat-time-unknown');
    expect(room).not.toContain('onUnknownTimeChange');
    expect(room).not.toContain('sUnknownTime');
    expect(room).not.toContain('setUnknownTime');
    expect(addFlow).not.toContain('compat-entry-precision-note');
    expect(addFlow).not.toContain('Sparkles');
    expect(addFlow).toContain("ru ? 'Тип отношений' : 'Relationship type'");
    expect(addFlow).toContain('<div className="compat-person-divider" aria-hidden="true" />');

    expect(styles).toContain('Compatibility entry: compact native-form layout');
    expect(styles).toContain('--compat-air-accent-start');
    expect(styles).not.toContain('#176f45');
    expect(styles).toContain('.compat-editorial-page--add .compat-mode-switch');
    expect(styles).toContain('background: var(--compat-air-ink) !important');
    expect(styles).toContain('color: #ffffff !important');
    expect(styles).toContain('.compat-editorial-page--add .compat-air-input');
    expect(styles).toContain('font-size: 16px');
    expect(styles).not.toContain('.compat-editorial-page--add .compat-entry-precision-note');
    expect(styles).toContain('.compat-editorial-page--add .compat-air-control');
    expect(styles).toContain('.compat-air-input:focus-visible');
    expect(room).not.toContain('compat-zodiac-field');
    expect(styles).not.toContain('.compat-editorial-page--add .compat-entry-person');
  });

  it('starts both people in manual mode and keeps each saved-chart choice explicit', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const service = read('services/astrologyService.ts');
    const extendedApi = read('pages/api/content/synastry/extended.ts');
    const addStart = room.indexOf("if (screen === 'add')");
    const addEnd = room.indexOf('/* ── РЕЗУЛЬТАТ ── */', addStart);
    const addFlow = room.slice(addStart, addEnd);

    expect(room).toContain("const [firstChartId, setFirstChartId] = useState<number | null>(null)");
    expect(room).toContain('function PersonBirthFields');
    expect(room).toContain("const [subjectSource, setSubjectSource] = useState<CompatibilityPersonSource>");
    expect(room).toContain("const [partnerSource, setPartnerSource] = useState<CompatibilityPersonSource>");
    expect(addFlow.match(/<PersonSourcePicker/g)).toHaveLength(2);
    expect(room).toContain('<option value="saved">');
    expect(room).toContain("ru ? 'Дата' : 'Date'");
    expect(room).toContain("ru ? 'Карта' : 'Chart'");
    expect(room).toContain("ru ? 'Знак' : 'Sign'");
    expect(room).toContain("ru ? 'Выбрать карту' : 'Choose a chart'");
    expect(addFlow).not.toContain('className="compat-chart-select-label"');
    expect(addFlow).not.toContain('firstChart?.name ? <small>');
    expect(room).not.toContain('compat-person-primary-row');
    expect(room).not.toContain('compat-saved-picker');
    expect(room).not.toContain("return readable.find((chart) => chart.subject_type === 'self')?.id ?? chartId ?? null;");
    expect(service).toContain('subjectName: subject?.name');
    expect(extendedApi).toContain('const hasManualSubject');
    expect(extendedApi).toContain('buildLunaPersonContext');
    expect(extendedApi).not.toContain('calculateFlexibleNatalChart');
    expect(extendedApi).not.toContain('computeSynastryAspects');
  });

  it('selects compatibility visuals only from the personal editorial source', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const approved = new Set(getPersonalEditorialAssetLibrary().map((asset) => asset.id));
    const selected = Array.from({ length: 200 }, (_, index) => selectSynastryEditorialSticker({
      screenKey: 'compatibility-result',
      contentKey: `pair-${index}`,
      context: index % 2 ? 'love' : 'friendship',
      dynamics: [`dynamic-${index}`],
    })).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));

    expect(room).toContain("from '../../lib/personalForecastVisuals'");
    expect(room).not.toContain('zodiacLegacyVisuals');
    expect(selected).toHaveLength(200);
    expect(selected.every((asset) => approved.has(asset.id))).toBe(true);
    expect(selected.every((asset) => asset.path.startsWith('/assets/personal-editorial/'))).toBe(true);
    expect(selected.every((asset) => asset.hasEmbeddedText === false)).toBe(true);
  });
});
