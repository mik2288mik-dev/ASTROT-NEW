import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import type { NatalChartData, UserProfile } from '../types';
import {
  getNatalReportCategory, NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  type NatalReportCategoryKey, type NatalReportCategoryPack,
} from '../lib/natalReading/reportCatalog';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { natalEditorialParagraphs } from './fixtures/natalEditorialNarrative';
import { buildNatalModelContext } from '../lib/natalReading/permanentReport';

// Next preserves JSX; compile these real components for the repository's Node Jest runner.
// This keeps the rendering test independent of browser and DOM test dependencies.
const componentModules = new Map<string, Record<string, unknown>>();
function loadComponent(filename: string, replacements: Record<string, unknown> = {}): Record<string, unknown> {
  const modules = Object.keys(replacements).length ? new Map<string, Record<string, unknown>>() : componentModules;
  const existing = modules.get(filename);
  if (existing) return existing;
  const exports: Record<string, unknown> = {};
  modules.set(filename, exports);
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (specifier in replacements) return replacements[specifier];
    if (!specifier.startsWith('.')) return require(specifier);
    const target = path.resolve(path.dirname(filename), specifier);
    return existsSync(`${target}.tsx`) ? loadComponent(`${target}.tsx`) : require(target);
  };
  new Function('require', 'exports', output)(localRequire, exports);
  return exports;
}

const { NatalMeaningExperience } = loadComponent(path.resolve(__dirname, '../components/NatalReading/NatalMeaningExperience.tsx')) as {
  NatalMeaningExperience: typeof import('../components/NatalReading/NatalMeaningExperience').NatalMeaningExperience;
};
type ReaderProps = React.ComponentProps<typeof NatalMeaningExperience>;
const { NatalEvidenceSheet, formatNatalEvidenceLabel } = loadComponent(path.resolve(__dirname, '../components/NatalReading/NatalEvidenceSheet.tsx')) as typeof import('../components/NatalReading/NatalEvidenceSheet');
const profile: UserProfile = {
  id: '42', name: 'Анна', birthDate: '1990-01-01', birthTime: '08:15', birthPlace: 'Москва',
  isSetup: true, language: 'ru', theme: 'light', isPremium: false,
};
const chartData = canonicalNatalChart() as unknown as NatalChartData;
const evidenceFacts = buildNatalModelContext(profile, chartData).context.evidence.filter((fact) => fact.kind === 'placement');
const observationTitles = [
  'Начинать проще с небольшой попытки', 'Первый ответ ещё не обещание',
  'Серьёзный выбор меняет твой темп', 'Внимание заметнее по поступкам',
  'Готовую работу легче улучшать', 'Разным делам нужен разный темп',
  'Чужой восторг не заменяет интереса', 'Любопытство помогает найти объяснение',
];
const pack = (categoryKey: NatalReportCategoryKey, paragraphs = natalEditorialParagraphs): NatalReportCategoryPack => ({
  schemaVersion: 'natal-report-category-v1', contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  categoryKey, title: getNatalReportCategory(categoryKey)!.title.ru,
  summary: paragraphs.map((text, index) => ({
    title: observationTitles[index], text,
    evidenceIds: [evidenceFacts[index % evidenceFacts.length].id],
  })),
  followUps: [
    { categoryKey: 'work' as const, label: 'Какая работа оставляет тебе место для пробы?', evidenceIds: [evidenceFacts[1].id] },
    { categoryKey: 'love' as const, label: 'Как ты показываешь интерес без громких признаний?', evidenceIds: [evidenceFacts[2].id] },
    { categoryKey: 'communication' as const, label: 'Когда первый ответ принимают за обещание?', evidenceIds: [evidenceFacts[3].id] },
  ].filter((item) => item.categoryKey !== categoryKey),
  observations: [], previews: [], freeAnswers: [],
});

type ControllerProps = React.ComponentProps<typeof import('../components/NatalReading/NatalCatalogReport').NatalCatalogReport>;

// Run the controller's state/effect boundaries without installing a DOM implementation.
// Rendering remains real React server rendering; only effect scheduling is driven here.
function controllerHarness(initial: Partial<ControllerProps> = {}) {
  type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
  const slots: Slot[] = [];
  let cursor = 0;
  let dirty = true;
  let effects: Array<() => void> = [];
  let element: React.ReactElement | null = null;
  const changed = (before: unknown[] | undefined, after: unknown[] | undefined) => !before || !after || before.length !== after.length || after.some((value, index) => !Object.is(value, before[index]));
  const hooks = {
    ...React,
    useState(initialValue: unknown) {
      const slot = slots[cursor++] ||= { value: typeof initialValue === 'function' ? initialValue() : initialValue };
      return [slot.value, (next: unknown) => {
        const value = typeof next === 'function' ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) { slot.value = value; dirty = true; }
      }];
    },
    useRef(initialValue: unknown) {
      const slot = slots[cursor++] ||= { value: { current: initialValue } };
      return slot.value;
    },
    useMemo(create: () => unknown, deps: unknown[]) {
      const slot = slots[cursor++] ||= {};
      if (changed(slot.deps, deps)) { slot.value = create(); slot.deps = deps; }
      return slot.value;
    },
    useCallback(callback: unknown, deps: unknown[]) { return hooks.useMemo(() => callback, deps); },
    useEffect(create: () => void | (() => void), deps?: unknown[]) {
      const slot = slots[cursor++] ||= {};
      if (changed(slot.deps, deps)) {
        slot.deps = deps;
        effects.push(() => { slot.cleanup?.(); slot.cleanup = create() || undefined; });
      }
    },
  };
  const getCharts = jest.fn().mockResolvedValue({ charts: [], isPremium: false });
  const cached = jest.fn().mockImplementation((_userId, categoryKey) => pack(categoryKey));
  const ensure = jest.fn().mockImplementation(async (_userId, categoryKey) => pack(categoryKey));
  const { NatalCatalogReport } = loadComponent(path.resolve(__dirname, '../components/NatalReading/NatalCatalogReport.tsx'), {
    react: hooks,
    '../../services/storageService': { getCharts },
    '../../services/natalCatalogService': { getNatalCatalogCategoryCached: cached, ensureNatalCatalogCategory: ensure },
    '../../services/sessionService': { recordUserAppEvent: jest.fn().mockResolvedValue(undefined) },
    './NatalMeaningExperience': { NatalMeaningExperience },
  }) as { NatalCatalogReport: (props: ControllerProps) => React.ReactElement };
  let props: ControllerProps = {
    profile, chartData, view: 'foundation',
    requestPremium: jest.fn(), onViewChange: (view) => { props = { ...props, view }; dirty = true; },
    ...initial,
  };
  const render = () => {
    cursor = 0; effects = []; dirty = false;
    element = NatalCatalogReport(props);
    const committed = effects;
    effects = [];
    committed.forEach((effect) => effect());
  };
  return {
    getCharts, cached, ensure,
    update(next: Partial<ControllerProps>) { props = { ...props, ...next }; dirty = true; },
    async settle() { for (let index = 0; index < 20; index += 1) { if (dirty) render(); await Promise.resolve(); } },
    html() { if (dirty) render(); return renderToStaticMarkup(element!); },
    reader() { return (element?.props as { children: React.ReactElement<ReaderProps> }).children.props; },
    dispose() { slots.forEach((slot) => slot.cleanup?.()); },
  };
}

describe('natal narrative controller transitions', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let controller: ReturnType<typeof controllerHarness> | undefined;
  const premiumProfile: UserProfile = { ...profile, isPremium: true, premiumUntil: '2026-09-05T10:00:01.000Z' };
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener: jest.fn(), removeEventListener: jest.fn() } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener: jest.fn(), removeEventListener: jest.fn() } });
  });
  afterEach(() => {
    controller?.dispose();
    controller = undefined;
    jest.useRealTimers();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
  });

  it('hides a paid chapter at the stored deadline without waiting for another profile update', async () => {
    controller = controllerHarness({ profile: premiumProfile, view: 'explore' });
    await controller.settle();
    expect(controller.reader().isPremium).toBe(true);
    expect(controller.reader().categoryPack?.categoryKey).toBe('love');
    const paidPack = controller.reader().categoryPack!;
    for (const item of paidPack.summary) {
      expect(controller.html()).toContain(item.title);
      expect(controller.html()).toContain(item.text);
    }
    for (const item of paidPack.followUps!) expect(controller.html()).toContain(item.label);
    jest.advanceTimersByTime(1002);
    await controller.settle();
    expect(controller.reader().isPremium).toBe(false);
    expect(controller.reader().categoryPack).toBeNull();
    for (const item of paidPack.summary) expect(controller.html()).not.toContain(item.text);
    for (const item of paidPack.followUps!) expect(controller.html()).not.toContain(item.label);
    expect(controller.html()).not.toContain('class="natal-reading-why"');
    expect(controller.html()).toContain('Читать с Premium');
  });

  it('checks saved-chart access before reading local stories and hides all cached content on expiry', async () => {
    const subject = { id: 7, name: 'Нина', is_primary: false, subject_type: 'saved_person' } as ControllerProps['chartSubject'];
    controller = controllerHarness({ profile: premiumProfile, chartId: 7, chartSubject: subject });
    let resolveAccess!: (value: unknown) => void;
    controller.getCharts.mockImplementationOnce(() => new Promise((resolve) => { resolveAccess = resolve; }));
    await controller.settle();
    expect(controller.cached).not.toHaveBeenCalled();
    expect(controller.ensure).not.toHaveBeenCalled();
    expect(controller.html()).toContain('Загружаем сохранённую карту');
    resolveAccess({ charts: [{ ...subject, access_locked: false }], isPremium: true });
    await controller.settle();
    expect(controller.reader().mainPack?.categoryKey).toBe('main');
    controller.getCharts.mockResolvedValueOnce({ charts: [{ ...subject, access_locked: true }], isPremium: false });
    jest.advanceTimersByTime(1002);
    await controller.settle();
    expect(controller.getCharts).toHaveBeenCalledTimes(2);
    expect(controller.getCharts).toHaveBeenCalledWith('42', { repairPrimary: false });
    expect(controller.html()).toContain('Эта сохранённая карта доступна с Premium.');
    expect(controller.html()).not.toContain(natalEditorialParagraphs[0]);
  });

  it('preserves a server Premium denial across category switches until entitlement changes', async () => {
    controller = controllerHarness({ profile: premiumProfile, view: 'explore' });
    controller.cached.mockImplementation((_userId, categoryKey) => categoryKey === 'main' ? pack('main') : null);
    controller.ensure.mockImplementation(async (_userId, categoryKey) => {
      if (categoryKey !== 'main') throw Object.assign(new Error('Premium required'), { code: 'PREMIUM_REQUIRED' });
      return pack('main');
    });
    await controller.settle();
    expect(controller.reader().isPremium).toBe(false);
    controller.cached.mockImplementation((_userId, categoryKey) => pack(categoryKey));
    controller.reader().onSelectCategory('work');
    await controller.settle();
    expect(controller.reader().isPremium).toBe(false);
    expect(controller.reader().categoryPack).toBeNull();
    expect(controller.ensure.mock.calls.filter(([, category]) => category === 'work')).toHaveLength(0);
    controller.ensure.mockImplementation(async (_userId, categoryKey) => pack(categoryKey));
    controller.update({ profile: { ...premiumProfile, premiumUntil: '2026-10-05T10:00:00.000Z' } });
    await controller.settle();
    expect(controller.reader().isPremium).toBe(true);
    expect(controller.reader().categoryPack?.categoryKey).toBe('work');
  });

  it('ignores an old chart response after switching chart and language', async () => {
    controller = controllerHarness({ chartId: 1 });
    controller.cached.mockReturnValue(null);
    const pending = new Map<number, (value: NatalReportCategoryPack) => void>();
    controller.ensure.mockImplementation((_user, _category, chartId) => new Promise((resolve) => pending.set(chartId, resolve)));
    await controller.settle();
    controller.update({ chartId: 2, chartData: canonicalNatalChart({ birthDate: '1992-02-02' }) as unknown as NatalChartData, profile: { ...profile, language: 'en' } });
    await controller.settle();
    pending.get(2)!(pack('main', ['Current saved chart in English.']));
    await controller.settle();
    pending.get(1)!(pack('main', ['Устаревший русский разбор первой карты.']));
    await controller.settle();
    expect(controller.reader().mainPack?.summary[0].text).toBe('Current saved chart in English.');
    expect(controller.html()).not.toContain('Устаревший русский разбор первой карты.');
    expect(controller.ensure).toHaveBeenLastCalledWith('42', 'main', 2, 'en', expect.anything(), false);
  });

  it('keeps the newest requested chapter when a previous chapter finishes later', async () => {
    controller = controllerHarness({ profile: premiumProfile, view: 'explore' });
    controller.cached.mockReturnValue(null);
    const pending = new Map<string, (value: NatalReportCategoryPack) => void>();
    controller.ensure.mockImplementation((_user, category) => category === 'main'
      ? Promise.resolve(pack('main'))
      : new Promise((resolve) => pending.set(category, resolve)));
    await controller.settle();
    controller.reader().onSelectCategory('work');
    await controller.settle();
    expect(controller.reader().categoryLoading).toBe(true);
    pending.get('work')!(pack('work', ['Текущий рассказ о работе.']));
    await controller.settle();
    pending.get('love')!(pack('love', ['Поздний рассказ о любви.']));
    await controller.settle();
    expect(controller.reader().activeCategoryKey).toBe('work');
    expect(controller.reader().categoryPack?.summary[0].text).toBe('Текущий рассказ о работе.');
    expect(controller.html()).not.toContain('Поздний рассказ о любви.');
  });

  it('returns to the requested chapter once after a confirmed Premium update', async () => {
    const handled = jest.fn();
    controller = controllerHarness({ onPremiumContinuationHandled: handled });
    await controller.settle();
    const continuation = {
      returnView: 'chart', featureKey: 'natal_deep', returnAction: 'open_natal_category',
      returnEntityId: 'work', paywallInstanceId: 'payment-1',
    } as ControllerProps['premiumContinuation'];
    controller.update({ profile: premiumProfile, premiumContinuation: continuation });
    await controller.settle();
    expect(controller.reader().activeCategoryKey).toBe('work');
    expect(controller.reader().categoryPack?.categoryKey).toBe('work');
    expect(handled).toHaveBeenCalledWith('payment-1');
    controller.update({ profile: { ...premiumProfile, name: 'Анна Новая' } });
    await controller.settle();
    expect(handled).toHaveBeenCalledTimes(1);
  });
});
function render(overrides: Partial<ReaderProps> = {}): string {
  return renderToStaticMarkup(React.createElement(NatalMeaningExperience, readerProps(overrides)));
}

function readerProps(overrides: Partial<ReaderProps> = {}): ReaderProps {
  return {
    profile, chartData, subjectName: profile.name, activeCategoryKey: 'main',
    mainPack: pack('main'), categoryPack: null, categoryLoading: false, categoryError: null,
    isPremium: false, canPromotePremium: true,
    onSelectCategory: () => undefined, onRetryCategory: () => undefined, onRequestPremium: () => undefined,
    ...overrides,
  };
}

type TreeElement = React.ReactElement<Record<string, unknown> & { children?: React.ReactNode }>;
function treeElements(node: React.ReactNode, match: (element: TreeElement) => boolean): TreeElement[] {
  if (!React.isValidElement(node)) return [];
  const element = node as TreeElement;
  return [
    ...(match(element) ? [element] : []),
    ...React.Children.toArray(element.props.children).flatMap((child) => treeElements(child, match)),
  ];
}

// Keep the real reader and evidence sheet; drive only the reader's state hooks.
// Buttons below are the actual rendered handlers, not a test copy of their routing logic.
function interactiveReader(overrides: Partial<ReaderProps> = {}) {
  const slots: Array<{ value: unknown }> = [];
  let cursor = 0;
  const hooks = {
    ...React,
    useState(initial: unknown) {
      const slot = slots[cursor++] ||= { value: initial };
      return [slot.value, (value: unknown) => { slot.value = value; }];
    },
    useRef(initial: unknown) { return (slots[cursor++] ||= { value: { current: initial } }).value; },
    useEffect() { /* SSR has no browser commit effects. */ },
  };
  const { NatalMeaningExperience: Reader } = loadComponent(path.resolve(__dirname, '../components/NatalReading/NatalMeaningExperience.tsx'), { react: hooks }) as {
    NatalMeaningExperience: (props: ReaderProps) => React.ReactElement;
  };
  const props = readerProps(overrides);
  let tree: React.ReactElement;
  const redraw = () => { cursor = 0; tree = Reader(props); };
  redraw();
  return {
    nodes(match: (element: TreeElement) => boolean) { return treeElements(tree, match); },
    click(element: TreeElement) { (element.props.onClick as () => void)(); redraw(); },
    evidence() {
      const sheet = treeElements(tree, (element) => element.type === NatalEvidenceSheet)[0];
      return sheet.props as unknown as React.ComponentProps<typeof NatalEvidenceSheet>;
    },
    html() { return renderToStaticMarkup(tree); },
  };
}

describe('natal narrative reader', () => {
  it.each([['Pisces', 'Рыбах'], ['Scorpio', 'Скорпионе']])('shows %s in natural Russian while preserving the calculated degree and house', (sign, russianSign) => {
    const fact = {
      ...evidenceFacts[0],
      data: { key: 'sun', sign, degree: 12.5, house: 3, retrograde: false },
    };
    expect(formatNatalEvidenceLabel(fact, 'ru')).toBe(`Солнце в ${russianSign}, 12.5° · 3 дом`);
    expect(formatNatalEvidenceLabel(fact, 'en')).toBe(`Sun in ${sign}, 12.5° · 3 house`);
  });

  it.each([6, 7, 8])('shows all %i observations with an accessible evidence icon beside each heading', (count) => {
    const mainPack = pack('main', Array.from({ length: count }, (_, index) =>
      natalEditorialParagraphs[index] || `Дополнительный вывод ${index + 1} остаётся виден полностью. Его продолжение не нужно открывать отдельной кнопкой.`,
    ));
    const html = render({ mainPack });
    const body = html.match(/<article class="natal-narrative-copy"[^>]*>([\s\S]*?)<\/article>/)?.[1];
    expect(body).toBeDefined();
    expect(body?.match(/class="natal-reading-observation"/g)).toHaveLength(count);
    expect(body?.match(/<h2>/g)).toHaveLength(count);
    expect(body?.match(/<p>/g)).toHaveLength(count);
    expect(body?.match(/class="natal-reading-why"/g)).toHaveLength(count);
    expect(body?.match(/class="natal-reading-observation-heading"/g)).toHaveLength(count);
    const sections = [...body!.matchAll(/<section class="natal-reading-observation">([\s\S]*?)<\/section>/g)];
    mainPack.summary.forEach((paragraph, index) => {
      expect(sections[index][1]).toContain(`<h2>${paragraph.title}</h2>`);
      expect(sections[index][1]).toContain(`<p>${paragraph.text}</p>`);
      expect(sections[index][1]).toContain(`aria-label="На чём основано: ${paragraph.title}"`);
      expect(sections[index][1]).not.toContain('Почему так?');
    });
    expect(body).not.toContain('<details');
    expect(html.indexOf('</article>')).toBeLessThan(html.indexOf('class="natal-narrative-chapters"'));
    expect(html).toContain('aria-label="Разделы натального разбора"');
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('Читать с Premium');
    expect(html).not.toContain('role="dialog"');
  });

  it('keeps reading-time badges and redundant instructions out of the reading and question entry', () => {
    const mainPack = pack('main');
    const reader = interactiveReader({ mainPack, isPremium: true, onOpenQuestions: jest.fn() });
    const html = reader.html();
    expect(html).not.toContain('natal-reading-meta');
    expect(html).not.toMatch(/мин чтения|min read/u);
    const questionEntry = reader.nodes((element) => element.props.className === 'natal-v3-ask-entry')[0];
    expect(treeElements(questionEntry, (element) => element.type === 'h2')).toHaveLength(1);
    expect(treeElements(questionEntry, (element) => element.type === 'button')).toHaveLength(1);
    expect(treeElements(questionEntry, (element) => element.type === 'p')).toHaveLength(0);
    const followUps = reader.nodes((element) => element.props.className === 'natal-narrative-chapters')[0];
    expect(treeElements(followUps, (element) => element.type === 'p')).toHaveLength(0);
  });

  it('opens a Premium chapter with every observation, without requiring a question selection', () => {
    const categoryPack = pack('work');
    const html = render({ activeCategoryKey: 'work', categoryPack, isPremium: true });
    for (const item of categoryPack.summary) {
      expect(html).toContain(`<h2>${item.title}</h2>`);
      expect(html).toContain(`<p>${item.text}</p>`);
    }
    expect(html).toContain('<h1 tabindex="-1">Работа</h1>');
    expect(html).not.toContain('Читать с Premium');
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('Как ты начинаешь новое дело');
  });

  it('opens each named evidence icon with exactly its observation and saved evidence, including the final point', () => {
    const mainPack = pack('main', Array.from({ length: 8 }, (_, index) =>
      natalEditorialParagraphs[index] || `Текст пункта ${index + 1}. Продолжение относится только к этому выводу.`,
    ));
    mainPack.summary[0].evidenceIds = [evidenceFacts[0].id, evidenceFacts[2].id];
    const reader = interactiveReader({ mainPack });
    const whyButtons = () => reader.nodes((element) => element.type === 'button' && element.props.className === 'natal-reading-why');
    expect(whyButtons()).toHaveLength(8);
    expect(reader.evidence().target).toBeNull();
    mainPack.summary.forEach((observation, index) => {
      const button = whyButtons()[index];
      const heading = reader.nodes((element) => element.props.className === 'natal-reading-observation-heading')[index];
      expect(treeElements(heading, (element) => element.type === 'button')).toEqual([button]);
      expect(treeElements(heading, (element) => element.type === 'h2')[0].props.children).toBe(observation.title);
      expect(button.props.type).toBe('button');
      expect(button.props['aria-label']).toBe(`На чём основано: ${observation.title}`);
      const iconHtml = renderToStaticMarkup(button);
      expect(iconHtml).toMatch(/<svg[^>]*aria-hidden="true"/u);
      expect(iconHtml.replace(/<[^>]+>/gu, '')).toBe('');
      reader.click(button);
      expect(reader.evidence().target).toEqual({
        mode: 'why', title: observation.title, text: observation.text,
        evidenceIds: observation.evidenceIds,
      });
      expect(reader.evidence().chartData).toBe(chartData);
      const html = reader.html();
      expect(html).toContain('role="dialog"');
      const dialog = html.match(/<section[^>]*role="dialog"[^>]*>([\s\S]*?)<\/section>/)![1];
      expect(dialog).toContain('Данные твоей карты');
      expect(dialog).not.toContain('<details');
      expect(dialog).not.toContain('Показать данные карты');
      expect(dialog).not.toContain('рассчитанное положение');
      for (const fact of evidenceFacts) {
        const label = renderToStaticMarkup(React.createElement('span', null, formatNatalEvidenceLabel(fact, 'ru'))).slice(6, -7);
        if (observation.evidenceIds.includes(fact.id)) expect(html).toContain(label);
        else expect(html).not.toContain(label);
      }
    });
  });

  it('uses each saved follow-up label and opens its category through the real button handler', () => {
    const mainPack = pack('main');
    const selected = jest.fn();
    const questions = jest.fn();
    const reader = interactiveReader({ mainPack, onSelectCategory: selected, onOpenQuestions: questions });
    const section = reader.nodes((element) => element.type === 'section' && element.props.className === 'natal-narrative-chapters')[0];
    const followUpButtons = treeElements(section, (element) => element.type === 'button' && element.props.className !== 'natal-reading-all-chapters');
    expect(followUpButtons).toHaveLength(mainPack.followUps!.length);
    mainPack.followUps!.forEach((followUp, index) => {
      expect(renderToStaticMarkup(followUpButtons[index])).toContain(followUp.label);
      reader.click(followUpButtons[index]);
      expect(selected).toHaveBeenNthCalledWith(index + 1, followUp.categoryKey);
    });
    expect(questions).not.toHaveBeenCalled();
  });

  it('omits a follow-up pointing to the chapter that is already open', () => {
    const categoryPack = pack('work');
    categoryPack.followUps = [
      { categoryKey: 'work', label: 'Уже открытый раздел не должен повторяться.', evidenceIds: [evidenceFacts[0].id] },
      ...categoryPack.followUps!,
    ];
    const html = render({ activeCategoryKey: 'work', categoryPack, isPremium: true });
    expect(html).not.toContain(categoryPack.followUps[0].label);
    expect(html).toContain(categoryPack.followUps[1].label);
  });

  it('hides an already cached paid story and its evidence controls when Premium expires', () => {
    const categoryPack = pack('love', ['Личный платный текст, который должен исчезнуть после окончания доступа.']);
    expect(render({ activeCategoryKey: 'love', categoryPack, isPremium: true })).toContain(categoryPack.summary[0].text);
    const expired = render({ activeCategoryKey: 'love', categoryPack, isPremium: false });
    expect(expired).not.toContain(categoryPack.summary[0].text);
    expect(expired).not.toContain('class="natal-reading-why"');
    for (const followUp of categoryPack.followUps!) expect(expired).not.toContain(followUp.label);
    expect(expired).toContain('Читать с Premium');
    expect(render({ isPremium: false })).toContain(natalEditorialParagraphs.at(-1));
  });

  it('shows loading without an error or the main story under a Premium chapter heading', () => {
    const html = render({ activeCategoryKey: 'money', isPremium: true, categoryLoading: true });
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(natalEditorialParagraphs[0]);
  });

  it('shows a recoverable error when the requested story is unavailable', () => {
    const html = render({ mainPack: null, categoryError: 'Сохранённую карту нужно восстановить.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Сохранённую карту нужно восстановить.');
    expect(html).toContain('Попробовать снова');
    expect(html).not.toContain('natal-narrative-copy');
    expect(html).not.toContain('aria-busy="true"');
  });

  it('renders the current saved subject and language without replacing them with account-owner metadata', () => {
    const mainPack = pack('main', ['This is Nina’s saved reading in English.']);
    mainPack.summary[0].title = 'Trying makes the idea clearer';
    mainPack.followUps = [
      { categoryKey: 'work', label: 'What kind of work lets you try an idea?', evidenceIds: [evidenceFacts[0].id] },
      { categoryKey: 'love', label: 'How do you show someone you care?', evidenceIds: [evidenceFacts[1].id] },
    ];
    const html = render({
      profile: { ...profile, language: 'en' }, subjectName: 'Nina',
      mainPack,
    });
    expect(html).toMatch(/<p(?:\s[^>]*)?>Nina<\/p><h1 tabindex="-1">You, in a few words<\/h1>/u);
    expect(html).toContain('This is Nina’s saved reading in English.');
    expect(html).toContain('<h2>Trying makes the idea clearer</h2>');
    expect(html).toContain('aria-label="Chart evidence: Trying makes the idea clearer"');
    expect(html).toContain('What else about you?');
    for (const followUp of mainPack.followUps) expect(html).toContain(followUp.label);
    expect(html).not.toContain('Анна');
    expect(html).not.toMatch(/[А-Яа-яЁё]/u);
  });

  it('keeps a saved legacy reading without titles or follow-ups readable and its evidence reachable', () => {
    const mainPack = pack('main');
    mainPack.summary = mainPack.summary.map(({ text, evidenceIds }) => ({ text, evidenceIds }));
    delete mainPack.followUps;
    const reader = interactiveReader({ mainPack });
    const html = reader.html();
    const body = html.match(/<article class="natal-narrative-copy"[^>]*>([\s\S]*?)<\/article>/)![1];
    expect(body).not.toContain('<h2>');
    for (const paragraph of mainPack.summary) expect(body).toContain(`<p>${paragraph.text}</p>`);
    expect(html).toContain('Все темы разбора');
    expect(html).not.toContain('undefined');
    const firstWhy = reader.nodes((element) => element.props.className === 'natal-reading-why')[0];
    expect(firstWhy.props['aria-label']).toBe(`На чём основано: ${mainPack.summary[0].text.split('. ')[0]}.`);
    expect(renderToStaticMarkup(firstWhy).replace(/<[^>]+>/gu, '')).toBe('');
    reader.click(firstWhy);
    expect(reader.evidence().target).toEqual({
      mode: 'why', title: 'В твоей карте', text: mainPack.summary[0].text,
      evidenceIds: mainPack.summary[0].evidenceIds,
    });
  });

  it('localizes the actual Why dialog and chart labels for the saved English reader', () => {
    const mainPack = pack('main', ['You can try the idea before describing every detail.']);
    mainPack.summary[0].title = 'Trying makes the idea clearer';
    mainPack.followUps = [];
    const reader = interactiveReader({ profile: { ...profile, language: 'en' }, subjectName: 'Nina', mainPack });
    reader.click(reader.nodes((element) => element.props.className === 'natal-reading-why')[0]);
    const dialog = reader.html().match(/<section[^>]*role="dialog"[^>]*>([\s\S]*?)<\/section>/)![1];
    expect(dialog).toContain('Why this conclusion?');
    expect(dialog).toContain('Your chart data');
    expect(dialog).toContain(formatNatalEvidenceLabel(evidenceFacts[0], 'en'));
    expect(dialog).toContain('Birth time is recorded as exact.');
    expect(dialog).not.toContain('How much this depends on birth time');
    expect(dialog).not.toMatch(/[А-Яа-яЁё]/u);
  });

  it('keeps a locked chapter inaccessible when Premium promotion is unavailable', () => {
    const html = render({ activeCategoryKey: 'work', categoryPack: pack('work'), canPromotePremium: false });
    expect(html).toContain('Подробный разбор доступен с Premium.');
    expect(html).not.toContain(natalEditorialParagraphs[0]);
    expect(html).not.toContain('Читать с Premium');
  });
});

describe('natal Why dialog keyboard lifecycle', () => {
  it('portals above the inert app, traps Tab and restores prior accessibility state, scrolling and focus after closing', () => {
    const descriptors = new Map(['window', 'document', 'HTMLElement'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const documentState = { activeElement: null as unknown, body: { children: [] as FocusTarget[], style: { overflow: 'auto' } } };
    class FocusTarget {
      isConnected = true;
      tagName = 'DIV';
      attributes = new Map<string, string>();
      getAttribute = (name: string) => this.attributes.get(name) ?? null;
      setAttribute = (name: string, value: string) => this.attributes.set(name, value);
      removeAttribute = (name: string) => this.attributes.delete(name);
      focus = jest.fn(() => { documentState.activeElement = this; });
    }
    const opener = new FocusTarget();
    const first = new FocusTarget();
    const last = new FocusTarget();
    const heading = new FocusTarget();
    const layer = new FocusTarget();
    const app = new FocusTarget();
    const alreadyHidden = new FocusTarget();
    alreadyHidden.setAttribute('inert', '');
    alreadyHidden.setAttribute('aria-hidden', 'false');
    const script = Object.assign(new FocusTarget(), { tagName: 'SCRIPT' });
    documentState.body.children = [app, alreadyHidden, script, layer];
    const touchListeners = new Map<string, unknown>();
    const panel = Object.assign(new FocusTarget(), {
      style: { transform: '', transition: '', willChange: '' },
      contains: (element: unknown) => [first, last, heading].includes(element as FocusTarget),
      querySelectorAll: () => [first, last],
      addEventListener: (name: string, listener: unknown) => touchListeners.set(name, listener),
      removeEventListener: (name: string) => touchListeners.delete(name),
    });
    const scroll = { scrollTop: 120 };
    documentState.activeElement = opener;
    const listeners = new Map<string, (event: any) => void>();
    const windowState = {
      addEventListener: jest.fn((name: string, listener: (event: any) => void) => listeners.set(name, listener)),
      removeEventListener: jest.fn((name: string) => listeners.delete(name)),
      matchMedia: () => ({ matches: true }),
    };
    const effects: Array<() => void | (() => void)> = [];
    const close = jest.fn();
    const cleanups: Array<() => void> = [];
    try {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: windowState });
      Object.defineProperty(globalThis, 'document', { configurable: true, value: documentState });
      Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: FocusTarget });
      const { NatalEvidenceSheet: Sheet } = loadComponent(path.resolve(__dirname, '../components/NatalReading/NatalEvidenceSheet.tsx'), {
        react: {
          ...React,
          useRef: (() => {
            const refs: unknown[] = [heading, layer, panel, scroll];
            return (value: unknown) => ({ current: refs.length ? refs.shift() : value });
          })(),
          useState: () => [documentState.body, jest.fn()],
          useMemo: (create: () => unknown) => create(),
          useEffect: (create: () => void | (() => void)) => effects.push(create),
        },
        'react-dom': { createPortal: (element: React.ReactElement, host: unknown) => {
          expect(host).toBe(documentState.body);
          return element;
        } },
      }) as { NatalEvidenceSheet: (props: React.ComponentProps<typeof NatalEvidenceSheet>) => React.ReactElement };
      Sheet({
        target: { mode: 'why', title: 'Вывод', text: 'Текст вывода.', evidenceIds: [evidenceFacts[0].id] },
        profile, chartData, onClose: close,
      });
      expect(effects).toHaveLength(3);
      for (const effect of effects) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      }
      expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(documentState.body.style.overflow).toBe('hidden');
      expect(scroll.scrollTop).toBe(0);
      expect(app.getAttribute('inert')).toBe('');
      expect(app.getAttribute('aria-hidden')).toBe('true');
      expect(layer.getAttribute('inert')).toBeNull();
      expect(script.getAttribute('inert')).toBeNull();

      const key = (value: string, shiftKey = false) => {
        const event = { key: value, shiftKey, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() };
        listeners.get('keydown')!(event);
        return event;
      };
      expect(key('Tab').preventDefault).toHaveBeenCalled();
      expect(documentState.activeElement).toBe(first);
      expect(key('Tab', true).preventDefault).toHaveBeenCalled();
      expect(documentState.activeElement).toBe(last);
      expect(key('Tab').preventDefault).toHaveBeenCalled();
      expect(documentState.activeElement).toBe(first);
      expect(key('Escape').stopImmediatePropagation).toHaveBeenCalled();
      expect(close).toHaveBeenCalledTimes(1);

      const back = [...listeners.entries()].find(([name]) => name !== 'keydown')![1];
      const event = { detail: { handled: false }, stopImmediatePropagation: jest.fn() };
      back(event);
      back(event);
      expect(event.detail.handled).toBe(true);
      expect(event.stopImmediatePropagation).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(2);

      while (cleanups.length) cleanups.pop()!();
      expect(documentState.body.style.overflow).toBe('auto');
      expect(app.getAttribute('inert')).toBeNull();
      expect(app.getAttribute('aria-hidden')).toBeNull();
      expect(alreadyHidden.getAttribute('inert')).toBe('');
      expect(alreadyHidden.getAttribute('aria-hidden')).toBe('false');
      expect(opener.focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(documentState.activeElement).toBe(opener);
      expect(listeners.size).toBe(0);
      expect(touchListeners.size).toBe(0);
    } finally {
      while (cleanups.length) cleanups.pop()!();
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
});
