import { readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import { NATIVE_BACK_EVENT } from '../lib/nativeBack';
import { useScreenBack } from '../lib/useScreenBack';
import { useSwipeBack } from '../lib/useSwipeBack';

const mockCleanups: Array<() => void> = [];
jest.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => { const cleanup = effect(); if (cleanup) mockCleanups.push(cleanup); },
  useRef: (current: unknown) => ({ current }),
}));
jest.mock('../lib/haptics', () => ({ lumiaImpactHaptic: jest.fn() }));

// Execute the shipped callbacks, rather than reproducing navigation in a test model.
function source(file: string) {
  return ts.createSourceFile(file, readFileSync(path.resolve(__dirname, '..', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function initializer(file: string, name: string): string {
  const tree = source(file);
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer) expression = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (!expression) throw new Error(`Missing ${name} in ${file}`);
  if (ts.isCallExpression(expression) && expression.expression.getText(tree) === 'useCallback') expression = expression.arguments[0];
  return expression.getText(tree);
}
function effectContaining(file: string, marker: string): string {
  const tree = source(file);
  let callback: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes(marker)) callback = node.arguments[0].getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (!callback) throw new Error(`Missing effect ${marker}`);
  return callback;
}
function screenBackCall(file: string): string {
  const tree = source(file);
  let call: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useScreenBack') call = node.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (!call) throw new Error(`Missing nested back wiring in ${file}`);
  return call;
}
function execute(code: string, scope: Record<string, any>): any {
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('scope', `with (scope) { ${compiled} }`)(scope);
}

class Surface {
  listeners: Array<{ type: string; callback: (event: any) => void; capture: boolean }> = [];
  Telegram: any;
  requestAnimationFrame = (callback: () => void) => { callback(); return 1; };
  scrollTo = jest.fn();
  addEventListener(type: string, callback: (event: any) => void, options: boolean | AddEventListenerOptions = false) {
    this.listeners.push({ type, callback, capture: typeof options === 'boolean' ? options : Boolean(options.capture) });
  }
  removeEventListener(type: string, callback: (event: any) => void) { this.listeners = this.listeners.filter((item) => item.type !== type || item.callback !== callback); }
  dispatchEvent(event: any) {
    let stopped = false;
    event.stopImmediatePropagation = () => { stopped = true; };
    for (const listener of this.listeners.filter((item) => item.type === event.type).sort((a, b) => Number(b.capture) - Number(a.capture))) {
      listener.callback(event);
      if (stopped) break;
    }
    return true;
  }
}
class BackEvent {
  constructor(public type: string, public options: { detail: { handled: boolean } }) {}
  get detail() { return this.options.detail; }
}

function appHarness() {
  const window = new Surface();
  const document = new Surface();
  const callbacks = new Map<string, (...args: any[]) => void>();
  const scope: Record<string, any> = {
    window, document, CustomEvent: BackEvent, NATIVE_BACK_EVENT,
    view: 'dashboard', viewRef: { current: 'dashboard' }, navigationHistoryRef: { current: [] },
    profile: {}, androidUpdate: { allowNavigation: () => true },
    PRIMARY_CHART_NAVIGATION_VIEWS: new Set(['chart']), primaryChartDataRef: { current: null },
    activeChartId: undefined, chartReturnView: 'dashboard', chartsReturnView: 'dashboard',
    navigationSheet: null, paywallContext: null,
    appDebugLog: jest.fn(), setActiveChartId: jest.fn(), setActiveChartSubject: jest.fn(), setChartData: jest.fn(), setChartReturnView: jest.fn(), setDashboardPeriod: jest.fn(),
    setView: (view: string) => { scope.view = view; scope.viewRef.current = view; },
    setNavigationSheet: (value: unknown) => { scope.navigationSheet = value; },
    returnFromPaywall: jest.fn(() => { scope.paywallContext = null; }),
    Capacitor: { isNativePlatform: () => true },
    CapacitorApp: { addListener: jest.fn((name, callback) => { callbacks.set(name, callback); return Promise.resolve({ remove: jest.fn() }); }), exitApp: jest.fn() },
  };
  const names = ['pushReturnView', 'navigateTo', 'handleBack', 'handleSurfaceBack', 'openBottomToday', 'openBottomZodiac', 'openBottomNatal'];
  const handlers = execute(`${names.map((name) => `const ${name} = ${initializer('App.tsx', name)};`).join('\n')}
    return { ${names.join(',')}, canSwipeBack: () => (${initializer('App.tsx', 'canSwipeBack')}),
      nativeEffect: ${effectContaining('App.tsx', "CapacitorApp.addListener('backButton'")},
      telegramEffect: ${effectContaining('App.tsx', 'const backButton = tg?.BackButton')} };`, scope);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  const swipe = () => {
    useSwipeBack({ onSwipeBack: handlers.handleSurfaceBack, enabled: handlers.canSwipeBack(), threshold: 70, edgeWidth: 30 });
    document.dispatchEvent({ type: 'touchstart', touches: [{ clientX: 10, clientY: 200 }] });
    document.dispatchEvent({ type: 'touchend', changedTouches: [{ clientX: 110, clientY: 203 }] });
    mockCleanups.splice(0).forEach((cleanup) => cleanup());
  };
  return { scope, window, document, callbacks, handlers, swipe };
}

let previousWindow: PropertyDescriptor | undefined;
let previousDocument: PropertyDescriptor | undefined;
beforeEach(() => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
});
afterEach(() => {
  mockCleanups.splice(0).forEach((cleanup) => cleanup());
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document');
});

describe('back returns to the visited screen', () => {
  it('returns from bottom-navigation Natal to Sounds, then Menu, then the initial Today', () => {
    const h = appHarness();
    h.handlers.navigateTo('services');
    h.handlers.navigateTo('sounds');
    h.handlers.openBottomNatal();
    h.swipe(); expect(h.scope.view).toBe('sounds');
    h.swipe(); expect(h.scope.view).toBe('services');
    h.swipe(); expect(h.scope.view).toBe('dashboard');
    expect(h.handlers.canSwipeBack()).toBe(false);
  });

  it('preserves visits between bottom tabs, including Today opened after another screen', () => {
    const h = appHarness();
    h.handlers.navigateTo('sounds');
    h.handlers.openBottomZodiac();
    h.handlers.openBottomToday();
    expect(h.handlers.canSwipeBack()).toBe(true);
    h.swipe(); expect(h.scope.view).toBe('horoscope');
    h.swipe(); expect(h.scope.view).toBe('sounds');
  });

  it('does not add a duplicate entry when the current tab is pressed again', () => {
    const h = appHarness();
    h.handlers.openBottomZodiac();
    h.handlers.openBottomZodiac();
    h.swipe(); expect(h.scope.view).toBe('dashboard');
    expect(h.scope.navigationHistoryRef.current).toEqual([]);
  });

  it('uses Android back history on Today instead of starting the exit sequence', () => {
    const h = appHarness();
    h.handlers.navigateTo('sounds'); h.handlers.openBottomToday();
    const cleanup = h.handlers.nativeEffect();
    h.callbacks.get('backButton')!();
    expect(h.scope.view).toBe('sounds');
    expect(h.scope.CapacitorApp.exitApp).not.toHaveBeenCalled();
    cleanup();
  });

  it('shows Telegram back on a revisited Today and routes to the previous screen', () => {
    const h = appHarness();
    const backButton = { hide: jest.fn(), show: jest.fn(), onClick: jest.fn(), offClick: jest.fn() };
    h.window.Telegram = { WebApp: { BackButton: backButton } };
    h.handlers.navigateTo('sounds'); h.handlers.openBottomToday();
    const cleanup = h.handlers.telegramEffect();
    expect(backButton.show).toHaveBeenCalled();
    backButton.onClick.mock.calls[0][0]();
    expect(h.scope.view).toBe('sounds');
    cleanup();
  });

  it('closes a Premium overlay on Today without consuming screen history', () => {
    const h = appHarness();
    h.handlers.navigateTo('sounds'); h.handlers.openBottomToday();
    h.scope.paywallContext = {};
    const history = [...h.scope.navigationHistoryRef.current];
    h.swipe();
    expect(h.scope.returnFromPaywall).toHaveBeenCalled();
    expect(h.scope.view).toBe('dashboard');
    expect(h.scope.navigationHistoryRef.current).toEqual(history);
  });
});

describe('nested rooms consume back before app history', () => {
  it.each([
    ['views/v2/StoriesRoom.tsx', 'back', { kind: 'read', seriesId: 'series-a', number: 2 }, { kind: 'series', seriesId: 'series-a' }],
    ['views/v2/StoriesRoom.tsx', 'back', { kind: 'series', seriesId: 'series-a' }, { kind: 'list' }],
    ['views/v2/TestsRoom.tsx', 'back', { kind: 'result' }, { kind: 'list' }],
    ['views/v2/MatrixRoom.tsx', 'goHome', { kind: 'theme', theme: 'money' }, { kind: 'home' }],
    ['views/v2/AntistressRoom.tsx', 'back', 'player', 'breathe'],
    ['views/v2/AntistressRoom.tsx', 'back', 'breathe', 'hub'],
    ['views/v2/UnionRoom.tsx', 'backToEntry', 'result', 'add'],
  ])('%s returns one level via %s', (file, name, screen, expected) => {
    const h = appHarness();
    h.handlers.navigateTo('services');
    const nested: Record<string, any> = { screen, window: h.window, selected: { kind: 'person' }, lumiaSelectionHaptic: jest.fn(), setEntryMode: jest.fn(), scrollCompatibilityToTop: jest.fn(), onBack: jest.fn(), setScreen: (value: unknown) => { nested.screen = value; } };
    const back = execute(`return ${initializer(file as string, name as string)};`, nested);
    Object.assign(nested, { [name as string]: back, useScreenBack, internal: true });
    execute(`${screenBackCall(file as string)};`, nested);
    h.swipe();
    expect(nested.screen).toEqual(expected);
    expect(h.scope.view).toBe('services');
    expect(h.scope.navigationHistoryRef.current).toEqual(['dashboard']);
  });

  it('closes a sheet registered after a nested handler before leaving the nested screen', () => {
    const h = appHarness();
    h.handlers.navigateTo('services');
    const localBack = jest.fn();
    useScreenBack(true, localBack);
    const close = jest.fn();
    const sheetScope = { window: h.window, document: { addEventListener: jest.fn(), removeEventListener: jest.fn() }, NATIVE_BACK_EVENT, isTopmostSheet: () => true, sheetId: 'sheet', onCloseRef: { current: close } };
    const tree = source('components/lumia-ui/CosmicSheet.tsx');
    let listenerSetup = '';
    const visit = (node: ts.Node) => {
      if (ts.isExpressionStatement(node) && node.getText(tree).includes('window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack')) listenerSetup = node.getText(tree);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    execute(`const handleNativeBack = ${initializer('components/lumia-ui/CosmicSheet.tsx', 'handleNativeBack')}; ${listenerSetup}`, sheetScope);
    h.swipe();
    expect(close).toHaveBeenCalledTimes(1);
    expect(localBack).not.toHaveBeenCalled();
  });

  it('unregisters a room handler when that room is unmounted', () => {
    const h = appHarness();
    const localBack = jest.fn();
    useScreenBack(true, localBack);
    mockCleanups.splice(0).forEach((cleanup) => cleanup());
    h.handlers.navigateTo('sounds'); h.swipe();
    expect(localBack).not.toHaveBeenCalled();
    expect(h.scope.view).toBe('dashboard');
  });
});
