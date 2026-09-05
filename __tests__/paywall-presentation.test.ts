import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import type { UserProfile } from '../types';
import type { PremiumPlanId } from '../lib/premiumPricing';
import type { RuStoreProduct } from '../services/rustorePayService';
import { createPaywallContextFromRequest } from '../lib/paywallContext';

type PaywallProps = React.ComponentProps<typeof import('../views/Paywall').Paywall>;
type Element = React.ReactElement<Record<string, any>>;
type Catalog = Partial<Record<PremiumPlanId, RuStoreProduct>>;

// The existing Jest runner is Node-only and Next preserves JSX. Compile the real
// view as in natal-narrative-reader; drive hooks, with only provider I/O replaced.
function loadComponent(filename: string, replacements: Record<string, unknown>): Record<string, unknown> {
  const exports: Record<string, unknown> = {};
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (specifier in replacements) return replacements[specifier];
    if (specifier.endsWith('.css')) return {};
    if (!specifier.startsWith('.')) return require(specifier);
    const target = path.resolve(path.dirname(filename), specifier);
    return existsSync(`${target}.tsx`) ? loadComponent(`${target}.tsx`, replacements) : require(target);
  };
  new Function('require', 'exports', output)(localRequire, exports);
  return exports;
}

function elements(node: React.ReactNode, predicate: (element: Element) => boolean): Element[] {
  return React.Children.toArray(node).flatMap((child) => {
    if (!React.isValidElement<Record<string, any>>(child)) return [];
    return [...(predicate(child) ? [child] : []), ...elements(child.props.children, predicate)];
  });
}
const hasClass = (element: Element, name: string) => String(element.props.className || '').split(/\s+/u).includes(name);
const visibleText = (node: React.ReactNode) => renderToStaticMarkup(React.createElement(React.Fragment, null, node)).replace(/<[^>]+>/gu, ' ');
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}
function product(id: string, duration: string, amountLabel: string): RuStoreProduct {
  return { productId: id, type: 'SUBSCRIPTION', amountLabel, subscriptionInfo: { periods: [{ type: 'MainPeriod', duration }] } };
}
const catalog: Catalog = {
  premium_month: product('month', 'P1M', '319 ₽'),
  premium_quarter: product('quarter', 'P3M', '749 ₽'),
  premium_year: product('year', 'P1Y', '2 199 ₽'),
};
const profile: UserProfile = {
  id: '42', name: 'Анна', birthDate: '1990-01-01', birthTime: '08:15', birthPlace: 'Москва',
  isSetup: true, language: 'ru', theme: 'light', isPremium: false,
};
const mounted: Array<{ dispose: () => void }> = [];

function harness(options: {
  channel?: 'rustore' | 'telegram' | 'development';
  loadProducts?: jest.Mock;
  props?: Partial<PaywallProps>;
} = {}) {
  type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
  const slots: Slot[] = [];
  let cursor = 0;
  let dirty = true;
  let effects: Array<() => void> = [];
  let tree: React.ReactElement | null = null;
  const changed = (before: unknown[] | undefined, after: unknown[] | undefined) => !before || !after || before.length !== after.length || after.some((value, index) => !Object.is(value, before[index]));
  const hooks = {
    ...React,
    useState(initial: unknown) {
      const slot = slots[cursor++] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, (next: unknown) => {
        const value = typeof next === 'function' ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) { slot.value = value; dirty = true; }
      }];
    },
    useRef(initial: unknown) { return (slots[cursor++] ||= { value: { current: initial } }).value; },
    useMemo(create: () => unknown, deps: unknown[]) {
      const slot = slots[cursor++] ||= {};
      if (changed(slot.deps, deps)) { slot.value = create(); slot.deps = deps; }
      return slot.value;
    },
    useEffect(create: () => void | (() => void), deps?: unknown[]) {
      const slot = slots[cursor++] ||= {};
      if (changed(slot.deps, deps)) {
        slot.deps = deps;
        effects.push(() => { slot.cleanup?.(); slot.cleanup = create() || undefined; });
      }
    },
  };
  const channel = options.channel || 'rustore';
  const loadProducts = options.loadProducts || jest.fn().mockResolvedValue(catalog);
  const loadStars = jest.fn().mockResolvedValue([
    { id: 'premium_week', days: 7, stars: 90 }, { id: 'premium_month', days: 30, stars: 180 },
    { id: 'premium_quarter', days: 90, stars: 430 }, { id: 'premium_year', days: 365, stars: 990 },
  ]);
  const onPurchase = jest.fn().mockResolvedValue('cancelled');
  const onRestore = jest.fn().mockResolvedValue('completed');
  const onPlanSelected = jest.fn();
  const onManageSubscription = jest.fn().mockResolvedValue(true);
  const { Paywall } = loadComponent(path.resolve(__dirname, '../views/Paywall.tsx'), {
    react: hooks,
    '../lib/haptics': { lumiaSelectionHaptic: jest.fn() },
    '../lib/distributionChannel': {
      resolveDistributionChannel: () => channel,
      canUseRuStorePay: () => channel === 'rustore',
      canUseTelegramStars: () => channel === 'telegram',
    },
    '../services/rustorePayService': { loadRuStoreProducts: loadProducts },
    '../services/paymentPlanCatalog': { loadTelegramPremiumPlans: loadStars },
  }) as { Paywall: (props: PaywallProps) => React.ReactElement };
  let props: PaywallProps = {
    profile,
    context: createPaywallContextFromRequest({ source: 'settings', currentView: 'settings' }),
    onPurchase, onRestore, onPlanSelected, onManageSubscription,
    onClose: jest.fn(), onContinueFree: jest.fn(),
    ...options.props,
  };
  const render = () => {
    cursor = 0; effects = []; dirty = false;
    tree = Paywall(props);
    const committed = effects;
    effects = [];
    committed.forEach((effect) => effect());
  };
  const find = (predicate: (element: Element) => boolean) => {
    if (dirty) render();
    return elements(tree, predicate);
  };
  const api = {
    onPurchase, onRestore, onPlanSelected, onManageSubscription, loadProducts, loadStars,
    update(next: Partial<PaywallProps>) { props = { ...props, ...next }; dirty = true; },
    async settle() { for (let index = 0; index < 24; index += 1) { if (dirty) render(); await Promise.resolve(); } },
    find,
    html() { if (dirty) render(); return renderToStaticMarkup(tree!); },
    radios() { return find((element) => element.type === 'input' && element.props.type === 'radio'); },
    selectedId() {
      return find((element) => Boolean(element.props['data-plan-id'])).find((element) => elements(element, (child) => child.type === 'input' && child.props.checked).length)?.props['data-plan-id'];
    },
    choose(id: PremiumPlanId) {
      const row = find((element) => element.props['data-plan-id'] === id)[0];
      expect(row).toBeDefined();
      const radio = elements(row, (element) => element.type === 'input' && element.props.type === 'radio')[0];
      expect(radio.props.disabled).toBeFalsy();
      radio.props.onChange();
    },
    cta() { return find((element) => element.type === 'button' && hasClass(element, 'pw2-cta'))[0]; },
    checkout() { return find((element) => element.type === 'footer' && hasClass(element, 'pw2-checkout'))[0]; },
    restoreButton() { return find((element) => element.type === 'button' && /Восстановить покупку|Проверяем покупки|Restore purchase|Checking purchases/u.test(visibleText(element)))[0]; },
    dispose() { slots.forEach((slot) => slot.cleanup?.()); },
  };
  mounted.push(api);
  return api;
}

afterEach(() => { mounted.splice(0).forEach((view) => view.dispose()); });

describe('real compact Premium paywall presentation', () => {
  it('preserves a valid initial plan after an asynchronous catalog without a quarter plan', async () => {
    const loading = deferred<Catalog>();
    const view = harness({ loadProducts: jest.fn(() => loading.promise), props: { initialPlanId: 'premium_year' } });
    await view.settle();
    expect(view.cta().props.disabled).toBe(true);
    expect(view.html()).toContain('role="status"');
    loading.resolve({ premium_month: catalog.premium_month, premium_year: catalog.premium_year });
    await view.settle();
    expect(view.selectedId()).toBe('premium_year');
    expect(view.cta().props.disabled).toBe(false);
    expect(visibleText(view.checkout())).toContain('2 199 ₽');
    view.cta().props.onClick();
    await view.settle();
    expect(view.onPurchase).toHaveBeenCalledWith('premium_year');
  });

  it('falls back from a missing initial plan to a loaded, purchasable plan', async () => {
    const view = harness({ loadProducts: jest.fn().mockResolvedValue({ premium_month: catalog.premium_month }), props: { initialPlanId: 'premium_year' } });
    await view.settle();
    expect(view.selectedId()).toBe('premium_month');
    expect(view.cta().props.disabled).toBe(false);
    expect(visibleText(view.checkout())).toContain('319 ₽');
    view.cta().props.onClick();
    await view.settle();
    expect(view.onPurchase).toHaveBeenCalledWith('premium_month');
  });

  it.each([false, true])('shows one benefits block and one payment footer with the exact selected term and full price (embedded=%s)', async (embedded) => {
    const view = harness({ props: { embedded } });
    await view.settle();
    expect(view.radios()).toHaveLength(3);
    expect(view.radios().map((radio) => radio.props['aria-label'])).toEqual(['1 месяц — 319 ₽', '3 месяца — 749 ₽', '1 год — 2 199 ₽']);
    expect(view.find((element) => element.type === 'dl' && hasClass(element, 'pw2-benefits'))).toHaveLength(1);
    expect(view.find((element) => hasClass(element, 'pw2-plan-features'))).toHaveLength(0);
    expect(view.find((element) => element.type === 'button' && hasClass(element, 'pw2-cta'))).toHaveLength(1);
    const content = view.find((element) => hasClass(element, 'pw2-content'))[0];
    expect(content).toBeDefined();
    expect(elements(content, (element) => hasClass(element, 'pw2-checkout'))).toHaveLength(0);
    expect(view.checkout()).toBeDefined();
    expect(view.selectedId()).toBe('premium_quarter');
    view.choose('premium_month');
    await view.settle();
    expect(view.onPlanSelected).toHaveBeenCalledWith('premium_month');
    expect(visibleText(view.checkout())).toContain('1 месяц');
    expect(visibleText(view.checkout())).toContain('319 ₽');
    expect(visibleText(view.checkout())).not.toContain('749 ₽');
    const descriptionId = view.cta().props['aria-describedby'];
    const description = view.find((element) => element.props.id === descriptionId)[0];
    expect(visibleText(description)).toContain('Автопродление:');
    expect(view.html()).toContain('20');
    expect(view.html()).not.toMatch(/До 5 |Up to 5 |47 ответ|Today/u);
    view.cta().props.onClick();
    await view.settle();
    expect(view.onPurchase).toHaveBeenCalledWith('premium_month');
  });

  it('keeps RuStore pending locked while allowing restore to check the same purchase', async () => {
    const view = harness();
    view.onPurchase.mockResolvedValueOnce('pending');
    view.onRestore.mockResolvedValueOnce('pending');
    await view.settle();
    view.cta().props.onClick();
    await view.settle();
    expect(view.cta().props.disabled).toBe(true);
    expect(view.radios().every((radio) => radio.props.disabled)).toBe(true);
    expect(view.restoreButton().props.disabled).toBeFalsy();
    view.restoreButton().props.onClick();
    await view.settle();
    expect(view.onRestore).toHaveBeenCalledTimes(1);
    expect(view.cta().props.disabled).toBe(true);
    expect(view.restoreButton().props.disabled).toBeFalsy();
    expect(view.html()).toContain('повторно покупать не нужно');
    expect(view.onPurchase).toHaveBeenCalledTimes(1);
  });

  it('locks plan changes, duplicate purchase taps and restore while checkout is running', async () => {
    const purchase = deferred<'cancelled'>();
    const view = harness();
    view.onPurchase.mockReturnValueOnce(purchase.promise);
    await view.settle();
    view.cta().props.onClick();
    await view.settle();
    expect(view.cta().props.disabled).toBe(true);
    expect(view.cta().props['aria-busy']).toBe(true);
    expect(view.radios().every((radio) => radio.props.disabled)).toBe(true);
    expect(view.restoreButton().props.disabled).toBe(true);
    view.cta().props.onClick();
    view.restoreButton().props.onClick();
    await view.settle();
    expect(view.onPurchase).toHaveBeenCalledTimes(1);
    expect(view.onRestore).not.toHaveBeenCalled();
    purchase.resolve('cancelled');
    await view.settle();
    expect(view.cta().props.disabled).toBe(false);
  });

  it('retains the chosen term for account recovery without automatically reopening payment', async () => {
    const view = harness();
    view.onPurchase.mockResolvedValueOnce('recovery_required');
    await view.settle();
    view.choose('premium_year');
    await view.settle();
    view.cta().props.onClick();
    await view.settle();
    expect(view.onPurchase).toHaveBeenCalledTimes(1);
    expect(view.onPurchase).toHaveBeenCalledWith('premium_year');
    expect(view.onPlanSelected).toHaveBeenLastCalledWith('premium_year');
    expect(view.selectedId()).toBe('premium_year');
    const resumed = harness({ props: { initialPlanId: 'premium_year', resumeNotice: 'Способ восстановления привязан.' } });
    await resumed.settle();
    expect(resumed.selectedId()).toBe('premium_year');
    expect(resumed.html()).toContain('Способ восстановления привязан.');
    expect(resumed.onPurchase).not.toHaveBeenCalled();
  });

  it('keeps Telegram pending checkable and its four one-time Stars plans separate from RuStore restore', async () => {
    const view = harness({ channel: 'telegram' });
    view.onPurchase.mockResolvedValue('pending');
    await view.settle();
    expect(view.loadProducts).not.toHaveBeenCalled();
    expect(view.loadStars).toHaveBeenCalledTimes(1);
    expect(view.radios()).toHaveLength(4);
    view.choose('premium_week');
    await view.settle();
    expect(visibleText(view.checkout())).toContain('90 Stars');
    expect(visibleText(view.checkout())).toMatch(/Разовая оплата/u);
    expect(view.restoreButton()).toBeUndefined();
    view.cta().props.onClick();
    await view.settle();
    expect(view.cta().props.disabled).toBe(false);
    expect(visibleText(view.cta())).toContain('Проверить оплату');
    expect(view.radios().every((radio) => radio.props.disabled)).toBe(true);
    view.cta().props.onClick();
    await view.settle();
    expect(view.onPurchase.mock.calls).toEqual([['premium_week'], ['premium_week']]);
  });

  it('offers catalog retry without a fabricated price and recovers into the selected plan', async () => {
    const loadProducts = jest.fn().mockRejectedValueOnce(new Error('provider_secret_details')).mockResolvedValue(catalog);
    const view = harness({ loadProducts });
    await view.settle();
    expect(view.cta().props.disabled).toBe(true);
    expect(view.html()).not.toContain('provider_secret_details');
    expect(view.html()).not.toContain('319 ₽');
    const retry = view.find((element) => element.type === 'button' && visibleText(element).trim() === 'Загрузить цены')[0];
    expect(retry).toBeDefined();
    retry.props.onClick();
    await view.settle();
    expect(loadProducts).toHaveBeenCalledTimes(2);
    expect(view.selectedId()).toBe('premium_quarter');
    expect(view.cta().props.disabled).toBe(false);
  });

  it('shows an active entitlement without selling another subscription and surfaces management failure', async () => {
    const view = harness({ props: { profile: { ...profile, isPremium: true, premiumUntil: '2099-01-01T00:00:00.000Z', premiumEntitlement: { state: 'paid', isPremium: true, source: 'rustore', startsAt: null, endsAt: '2099-01-01T00:00:00.000Z', autoRenew: true, productId: 'quarter', period: 'P3M' } } } });
    view.onManageSubscription.mockResolvedValue(false);
    await view.settle();
    expect(view.radios()).toHaveLength(0);
    expect(visibleText(view.cta())).toContain('Управлять подпиской');
    view.cta().props.onClick();
    await view.settle();
    expect(view.onManageSubscription).toHaveBeenCalledTimes(1);
    expect(view.onPurchase).not.toHaveBeenCalled();
    expect(view.html()).toContain('Не удалось открыть управление подпиской');
  });

  it('fails closed on a channel without payments and renders the English benefit limit', async () => {
    const view = harness({ channel: 'development', props: { profile: { ...profile, language: 'en' } } });
    await view.settle();
    expect(view.loadProducts).not.toHaveBeenCalled();
    expect(view.loadStars).not.toHaveBeenCalled();
    expect(view.cta().props.disabled).toBe(true);
    expect(view.restoreButton()).toBeUndefined();
    expect(view.html()).toContain('Purchases are unavailable');
    expect(view.html()).toContain('up to 20 other people');
    expect(view.html()).not.toContain('Up to 5');
  });
});
