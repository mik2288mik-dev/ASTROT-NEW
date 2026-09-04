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
    const resultHeading = room.indexOf('className="compat-result-heading"');
    const resultScore = room.indexOf('className="compat-result-score"', resultHeading);
    const resultCalculation = room.indexOf('compat-technical-data--near-score', resultScore);
    const resultSummary = room.indexOf('className="compat-result-summary"', resultCalculation);
    const resultMeta = room.indexOf('className="compat-result-meta"', resultSummary);

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
    expect(styles).toContain('.compat-editorial-page--result .compat-result-summary');
    expect(room).toContain('<MeouLogo className="compat-result-brand" />');
    expect(room).toContain('className="compat-result-ring-people"');
    expect(room).toContain('className="compat-result-person-zodiac"');
    expect(room).toContain('getZodiacSign(lang, leftSun)');
    expect(room).toContain('getZodiacSign(lang, theirSun)');
    expect(styles).toContain('.compat-result-person-zodiac');
    expect(styles).toMatch(/\.compat-result-ring-people i\s*\{[^}]*border-radius:\s*50%;[^}]*box-shadow:/);
    expect(styles).toContain('.compat-result-summary:not(.compat-result-summary--sign) > span');
    expect(styles).toMatch(/\.compat-final-payoff > span\s*\{[^}]*text-align:\s*center;/);
    expect(resultHeading).toBeLessThan(resultScore);
    expect(resultScore).toBeLessThan(resultCalculation);
    expect(resultCalculation).toBeLessThan(resultSummary);
    expect(resultSummary).toBeLessThan(resultMeta);
    expect(room).toContain('Большие кольца показывают общий индекс');
    expect(room).toContain('среднее с учётом важности всех сфер ниже');
    expect(room).toContain('className="compat-final-payoff"');
    expect(room).toContain('<ContentActivityBar');
    expect(room).toContain('surface="compatibility"');
    expect(room).toContain('showCounts={false}');
    expect(styles).toContain('.compat-editorial-page--result .compat-result-activity');
    expect(styles).toContain('.compat-editorial-page--result .compat-result-ring-people');
    expect(styles).toContain('.compat-technical-data--near-score + .compat-result-summary');
    expect(styles).toContain('overflow-wrap: anywhere');
    expect(styles).toContain('--compat-ring-offset');
    expect(styles).toContain('@keyframes compat-ring-left-in');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).not.toMatch(/^\.fresh-page\s*\{/m);
    expect(studio).toContain('.compat-editorial-page .compat-editorial-tabs');
    expect(studio).toMatch(
      /\.fresh-page\.compat-editorial-page\s*\{[^}]*overflow-x:\s*clip;[^}]*padding-bottom:\s*48px;[^}]*background:\s*#fff\s*!important;/,
    );
    expect(studio).not.toContain(
      '.lumia-app-shell:has(.compat-editorial-page) .today-bottom-navigation.lumia-bottom-tab-shell',
    );
    expect(studio).not.toMatch(
      /\.compat-editorial-page--add \.compat-air-person\s*\{[^}]*border-inline-start:/,
    );
    expect(studio).not.toMatch(
      /\.compat-editorial-page--add \.compat-air-person--second\s*\{[^}]*border-inline-start-color:/,
    );
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
    expect(room).toContain('compat-time-precision-option');
    expect(room).toContain('onTimePrecisionChange');
    expect(room).toContain('sTimePrecision');
    expect(room).toContain('fTimePrecision');
    expect(room).toContain("value: 'exact', label: ru ? 'Знаю'");
    expect(room).toContain("value: 'approximate', label: ru ? 'Примерно'");
    expect(room).toContain("value: 'unknown', label: ru ? 'Не знаю'");
    expect(addFlow).not.toContain('Sparkles');
    expect(addFlow).not.toContain('✦');
    expect(addFlow).not.toContain("ru ? 'Фокус сравнения' : 'Comparison focus'");
    expect(addFlow).toContain('className="compat-entry-disclosure"');
    expect(addFlow).toContain('Что покажет сравнение');
    expect(addFlow).toContain('Это не вердикт «подходите вы или нет»');
    expect(addFlow).toContain('Что вас сближает');
    expect(addFlow).toContain('Где можно не совпасть');
    expect(addFlow).toContain('Как лучше договориться');
    expect(addFlow).not.toContain('<EditorialCurve');
    for (const label of ['Любовь', 'Отношения', 'Дружба', 'Семья', 'Работа / бизнес']) {
      expect(room).toContain(label);
    }
    expect(room).toContain("value: 'love', context: 'romance'");
    expect(room).toContain("value: 'relationships', context: 'relationship'");

    expect(styles).toContain('.compat-editorial-page--add .compat-entry-form');
    expect(styles).toContain('.compat-editorial-page--add .compat-person-source-option');
    expect(styles).toContain('.compat-editorial-page--add .compat-air-input');
    expect(styles).toContain('font-size: 16px');
    expect(styles).toContain('.compat-editorial-page--add .compat-air-control');
    expect(styles).toContain('.compat-editorial-page--add .compat-air-field:focus-within');
    expect(styles).toContain('/* Compatibility input: white onboarding-style data entry, scoped away from results. */');
    expect(styles).toMatch(
      /\.compat-editorial-page--add \.compat-air-field\s*\{[^}]*border:\s*0;[^}]*border-bottom:\s*1px solid var\(--compat-input-line\);/,
    );
    expect(styles).toContain('.compat-editorial-page--add .compat-time-precision-options');
    expect(styles).toContain('.compat-editorial-page--add .compat-context-options');
    expect(styles).toMatch(
      /\.compat-editorial-page--add \.compat-context-option,[\s\S]*?min-height:\s*2rem;[\s\S]*?border-radius:\s*0\s*!important;/,
    );
    expect(styles).toMatch(
      /\.compat-editorial-page--add \.compat-context-option\.is-active\s*\{[^}]*background:\s*transparent\s*!important;/,
    );
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
    expect(extendedApi).toContain('buildWriterPersonContext');
    expect(extendedApi).not.toContain('swisseph-calculator');
    expect(extendedApi).toContain('createOrReuseCanonicalChart');
    expect(extendedApi).toContain('calculateCompatibility({');
    expect(extendedApi).toContain('calculated.aspects.map');
  });

  it('keeps the compatibility reading image-free and isolated from Zodiac art', () => {
    const room = read('views/v2/UnionRoom.tsx');
    expect(room).not.toContain('personalForecastVisuals');
    expect(room).not.toContain('zodiacLegacyVisuals');
    expect(room).not.toContain('compat-result-sticker');
    expect(room).not.toContain('/assets/');
    expect(room).toContain("import { MeouLogo } from '../../components/onboarding/MeouLogo'");
    expect(room).toContain('Сравниваем совместимость двух человек');
    expect(room).not.toContain('Разбор связи');
  });

  it('keeps shared engagement defaults while removing result views and numeric clutter', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const activity = read('components/Horoscope/HoroscopeActivityBar.tsx');

    expect(room).toContain('<ContentActivityBar');
    expect(room).toContain('surface="compatibility"');
    expect(room).toContain('showCounts={false}');
    expect(room).toContain('showLabels');
    expect(activity).toContain('showViews = true');
    expect(activity).toContain('showCounts = true');
    expect(activity).toContain('{showViews ? (');
    expect(activity).toContain('if (showViews) {');
    expect(activity).toContain('showViews={false}');
  });
});
