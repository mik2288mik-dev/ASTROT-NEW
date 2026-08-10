import fs from 'fs';
import path from 'path';
import synastryScenes from '../docs/design/newspaper-stickers/synastry-scenes.json';

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

  it('keeps the compatibility entry compact and uses one tab language for every choice', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const styles = read('styles/newspaperVisual.css');
    const addStart = room.indexOf("if (screen === 'add')");
    const addEnd = room.indexOf('/* ── РЕЗУЛЬТАТ ── */', addStart);
    const addFlow = room.slice(addStart, addEnd);

    expect(addFlow).toContain("<AppTopBar title={ru ? 'Совместимость' : 'Compatibility'} />");
    expect(addFlow).toContain('compat-entry-intro');
    expect(addFlow).toContain("'По дате рождения'");
    expect(addFlow).toContain("'По знакам зодиака'");
    expect(addFlow).not.toContain('<small>Premium</small>');
    expect(addFlow).not.toContain("ru ? 'Бесплатно'");
    expect(room.match(/compat-choice-tabs/g)?.length).toBeGreaterThanOrEqual(3);
    expect(addFlow).toContain("ru ? 'Кого сравниваем?' : 'Who are we comparing?'");
    expect(addFlow).toContain('compat-entry-add-chart');
    expect(addFlow).toContain('onOpenCharts');
    expect(addFlow).not.toContain('compat-saved-section');

    expect(styles).toContain('.compat-editorial-page--add .compat-choice-tab::after');
    expect(styles).toContain('.compat-editorial-page--add .compat-choice-tab.is-active::after');
    expect(styles).toContain('.compat-editorial-page--add .compat-entry-person');
    expect(styles).toContain('border: 0 !important;');
  });

  it('starts both people in manual mode and keeps saved charts optional', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const service = read('services/astrologyService.ts');
    const extendedApi = read('pages/api/content/synastry/extended.ts');
    const addStart = room.indexOf("if (screen === 'add')");
    const addEnd = room.indexOf('/* ── РЕЗУЛЬТАТ ── */', addStart);
    const addFlow = room.slice(addStart, addEnd);

    expect(room).toContain("const [firstChartId, setFirstChartId] = useState<number | null>(null)");
    expect(room).toContain('function PersonBirthFields');
    expect(addFlow.match(/<PersonBirthFields/g)).toHaveLength(2);
    expect(addFlow.match(/<details className="compat-saved-picker">/g)).toHaveLength(2);
    expect(addFlow).toContain("ru ? 'Выбрать сохранённую карту' : 'Choose a saved chart'");
    expect(addFlow).not.toContain("className=\"compat-chart-select-label\"");
    expect(addFlow).not.toContain("firstChart?.name ? <small>");
    expect(room).not.toContain("return readable.find((chart) => chart.subject_type === 'self')?.id ?? chartId ?? null;");
    expect(service).toContain('subjectName: subject?.name');
    expect(extendedApi).toContain('const hasManualSubject');
    expect(extendedApi).toContain('userChartData = await calculateNatalChart(');
  });

  it('selects result scenes only with dynamics present in the catalog', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const start = room.indexOf('type CompatibilityVisualDynamic');
    const end = room.indexOf('function readingTitles', start);
    const visualDynamicsBlock = room.slice(start, end);
    const requested = [...visualDynamicsBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    const catalogDynamics = new Set(synastryScenes.flatMap((scene) => scene.dynamics));

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(requested.length).toBeGreaterThan(12);
    expect(requested.every((dynamic) => catalogDynamics.has(dynamic))).toBe(true);
  });
});
