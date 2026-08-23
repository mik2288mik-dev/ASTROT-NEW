import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('compatibility editorial layout', () => {
  it('scopes the light flow to every UnionRoom state and preserves its gates', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const styles = read('styles/compatibilityEditorial.css');
    const studio = read('styles/editorialStudio.css');
    const app = read('pages/_app.tsx');

    expect(room.match(/compat-editorial-page compat-editorial-page--/g)).toHaveLength(2);
    expect(room).toContain('compat-editorial-page--add');
    expect(room).toContain('compat-editorial-page--result');
    expect(room).not.toContain("if (!hasChart) { onCreateNatalChart?.(); return; }");
    expect(room).toContain("requestPremium('compatibility_by_charts'");
    expect(room).toContain("featureKey: 'synastry_by_charts'");
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
    expect(studio).toContain('.compat-editorial-page .compat-editorial-tabs');
    expect(app).toContain("import '../styles/compatibilityEditorial.css'");
    expect(app).toContain("import '../styles/editorialStudio.css'");
  });

  it('matches the compact monochrome form contract from the approved render', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const styles = read('styles/editorialStudio.css');
    const addStart = room.indexOf("if (screen === 'add')");
    const addEnd = room.indexOf('/* ── РЕЗУЛЬТАТ ── */', addStart);
    const addFlow = room.slice(addStart, addEnd);

    expect(room).toContain("title={ru ? 'Совместимость' : 'Compatibility'}");
    expect(room).toContain('<EditorialTabs');
    expect(room).toContain("label: ru ? 'По карте' : 'By birth data'");
    expect(room).toContain("label: ru ? 'По знакам' : 'By zodiac signs'");
    expect(addFlow).toContain("ru ? 'Первый человек' : 'First person'");
    expect(addFlow).toContain("ru ? 'Второй человек' : 'Second person'");
    expect(addFlow).not.toContain('aria-hidden=\"true\">01');
    expect(addFlow).not.toContain('aria-hidden=\"true\">02');
    expect(addFlow.match(/className="compat-air-person compat-air-person--/g)).toHaveLength(2);
    expect(addFlow.match(/<PersonBirthFields/g)).toHaveLength(2);
    expect(addFlow).toContain('sign={youSign}');
    expect(addFlow).toContain('sign={pickSign}');
    expect(room).toContain('compat-air-time-unknown');
    expect(room).toContain('onUnknownTimeChange');
    expect(room).toContain('sUnknownTime');
    expect(room).toContain('fUnknownTime');
    expect(addFlow).not.toContain('Sparkles');
    expect(addFlow).toContain("ru ? 'Тип отношений' : 'Relationship type'");
    expect(addFlow).toContain('<div className="compat-person-divider" aria-hidden="true"><span>✦</span></div>');

    expect(styles).toContain('.compat-editorial-page--add .compat-entry-form');
    expect(styles).toContain('.compat-editorial-page--add .compat-person-source-option');
    expect(styles).toContain('.compat-editorial-page--add .compat-air-input');
    expect(styles).toContain('font-size: 16px');
    expect(styles).toContain('.compat-editorial-page--add .compat-air-control');
    expect(styles).toContain('.compat-editorial-page--add .compat-air-field:focus-within');
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
    expect(room).toContain("value: 'saved'");
    expect(room).toContain("value: 'birth'");
    expect(room).toContain("value: 'sign'");
    expect(room).toContain('aria-pressed={active}');
    expect(room).toContain("ru ? 'Дата' : 'Date'");
    expect(room).toContain("ru ? 'Карта' : 'Chart'");
    expect(room).toContain("ru ? 'Знак' : 'Sign'");
    expect(room).toContain("ru ? 'Выбрать карту' : 'Choose a chart'");
    expect(addFlow).not.toContain('className="compat-chart-select-label"');
    expect(addFlow).not.toContain('firstChart?.name ? <small>');
    expect(room).not.toContain('compat-person-primary-row');
    expect(room).not.toContain('compat-saved-picker');
    expect(room).not.toContain("return readable.find((chart) => chart.subject_type === 'self')?.id ?? chartId ?? null;");
    expect(addFlow).toContain('compat-use-own-chart');
    expect(room).toContain('compat-saved-quick-option');
    expect(service).toContain('subjectName: subject?.name');
    expect(extendedApi).toContain('const hasManualSubject');
    expect(extendedApi).toContain('buildLunaPersonContext');
    expect(extendedApi).not.toContain('calculateFlexibleNatalChart');
    expect(extendedApi).not.toContain('computeSynastryAspects');
  });

  it('keeps the compatibility reading image-free and isolated from Zodiac art', () => {
    const room = read('views/v2/UnionRoom.tsx');
    expect(room).not.toContain('personalForecastVisuals');
    expect(room).not.toContain('zodiacLegacyVisuals');
    expect(room).not.toContain('compat-result-sticker');
    expect(room).not.toContain('/assets/');
  });
});
