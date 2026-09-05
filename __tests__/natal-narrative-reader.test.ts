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
const profile: UserProfile = {
  id: '42', name: 'Анна', birthDate: '1990-01-01', birthTime: '08:15', birthPlace: 'Москва',
  isSetup: true, language: 'ru', theme: 'light', isPremium: false,
};
const chartData = canonicalNatalChart() as unknown as NatalChartData;
const pack = (categoryKey: NatalReportCategoryKey, paragraphs = natalEditorialParagraphs): NatalReportCategoryPack => ({
  schemaVersion: 'natal-report-category-v1', contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  categoryKey, title: getNatalReportCategory(categoryKey)!.title.ru,
  summary: paragraphs.map((text) => ({ text, evidenceIds: ['sun'] })),
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
    jest.advanceTimersByTime(1002);
    await controller.settle();
    expect(controller.reader().isPremium).toBe(false);
    expect(controller.reader().categoryPack).toBeNull();
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
  return renderToStaticMarkup(React.createElement(NatalMeaningExperience, {
    profile, chartData, subjectName: profile.name, activeCategoryKey: 'main',
    mainPack: pack('main'), categoryPack: null, categoryLoading: false, categoryError: null,
    isPremium: false, canPromotePremium: true,
    onSelectCategory: () => undefined, onRetryCategory: () => undefined, onRequestPremium: () => undefined,
    ...overrides,
  }));
}

describe('natal narrative reader', () => {
  it('shows every paragraph of the Free main narrative immediately, before any collapsed evidence', () => {
    const html = render();
    const body = html.match(/<article class="natal-narrative-copy"[^>]*>([\s\S]*?)<\/article>/)?.[1];
    expect(body).toBeDefined();
    expect(body?.match(/<p>/g)).toHaveLength(natalEditorialParagraphs.length);
    for (const paragraph of natalEditorialParagraphs) expect(body).toContain(paragraph);
    expect(body).not.toContain('<details');
    expect(html.indexOf('</article>')).toBeLessThan(html.indexOf('<details'));
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('Читать с Premium');
  });

  it('opens a Premium chapter as a full story without previews, embedded answers, or a question selection', () => {
    const paidText = 'Сохранённая история о том, как ты выбираешь работу.';
    const html = render({ activeCategoryKey: 'work', categoryPack: pack('work', [paidText]), isPremium: true });
    expect(html).toContain(`<p>${paidText}</p>`);
    expect(html).toContain('<h1 tabindex="-1">Работа</h1>');
    expect(html).not.toContain('Читать с Premium');
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('Как ты начинаешь новое дело');
  });

  it('hides an already cached paid story and its evidence controls when Premium expires', () => {
    const categoryPack = pack('love', ['Личный платный текст, который должен исчезнуть после окончания доступа.']);
    expect(render({ activeCategoryKey: 'love', categoryPack, isPremium: true })).toContain(categoryPack.summary[0].text);
    const expired = render({ activeCategoryKey: 'love', categoryPack, isPremium: false });
    expect(expired).not.toContain(categoryPack.summary[0].text);
    expect(expired).not.toContain('natal-narrative-evidence');
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
    const html = render({
      profile: { ...profile, language: 'en' }, subjectName: 'Nina',
      mainPack: pack('main', ['This is Nina’s saved reading in English.']),
    });
    expect(html).toContain('<p>Nina</p><h1 tabindex="-1">About you</h1>');
    expect(html).toContain('This is Nina’s saved reading in English.');
    expect(html).toContain('Keep reading');
    expect(html).not.toContain('Анна');
    expect(html).not.toContain('Читать дальше');
  });

  it('keeps a locked chapter inaccessible when Premium promotion is unavailable', () => {
    const html = render({ activeCategoryKey: 'work', categoryPack: pack('work'), canPromotePremium: false });
    expect(html).toContain('Подробный разбор доступен с Premium.');
    expect(html).not.toContain(natalEditorialParagraphs[0]);
    expect(html).not.toContain('Читать с Premium');
  });
});
