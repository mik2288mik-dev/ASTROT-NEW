import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import type { NatalChartData, UserProfile } from '../types';

// Exercise the real TSX handler in the Node runner without a browser dependency.
const filename = path.resolve(__dirname, '../components/NatalReading/NatalEvidenceSheet.tsx');
const moduleExports: Record<string, unknown> = {};
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  fileName: filename,
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'exports', compiled)(
  (name: string) => require(name.startsWith('.') ? path.resolve(path.dirname(filename), name) : name),
  moduleExports,
);
const { bindNatalEvidenceSwipe, NatalEvidenceSheet } = moduleExports as typeof import('../components/NatalReading/NatalEvidenceSheet');

class TouchSurface {
  parent: TouchSurface | null = null;
  interactive = false;
  scrollTop = 0;
  style = { transform: '', transition: '', willChange: '' };
  listeners = new Map<string, { listener: (event: TouchEvent) => void; options: AddEventListenerOptions }>();
  addEventListener(name: string, listener: (event: TouchEvent) => void, options: AddEventListenerOptions) {
    this.listeners.set(name, { listener, options });
  }
  removeEventListener(name: string) { this.listeners.delete(name); }
  closest(): TouchSurface | null { return this.interactive ? this : this.parent?.closest() ?? null; }
  contains(target: TouchSurface | null): boolean { return !!target && (target === this || this.contains(target.parent)); }
  getBoundingClientRect() { return { height: 400 }; }
}

function swipeHarness(reducedMotion = true) {
  const panel = new TouchSurface();
  const body = Object.assign(new TouchSurface(), { parent: panel });
  const text = Object.assign(new TouchSurface(), { parent: body });
  const header = Object.assign(new TouchSurface(), { parent: panel });
  const close = jest.fn();
  const cleanup = bindNatalEvidenceSwipe(panel as unknown as HTMLElement, body as unknown as HTMLElement, close, reducedMotion);
  const fire = (name: string, target: TouchSurface, x: number, y: number, timeStamp: number, options: { count?: number; cancelable?: boolean } = {}) => {
    const event = {
      target, timeStamp, cancelable: options.cancelable ?? true, preventDefault: jest.fn(),
      touches: Array.from({ length: options.count ?? (name === 'touchend' ? 0 : 1) }, (_, index) => ({ identifier: index, clientX: x, clientY: y })),
    };
    panel.listeners.get(name)?.listener(event as unknown as TouchEvent);
    return event;
  };
  return { panel, body, text, header, close, cleanup, fire };
}

describe('natal evidence sheet touch scrolling and dismissal', () => {
  it('follows a downward drag from the body top without animating against the finger, then closes', () => {
    const h = swipeHarness();
    h.fire('touchstart', h.text, 50, 100, 0);
    const move = h.fire('touchmove', h.text, 53, 210, 300);
    expect(move.preventDefault).toHaveBeenCalledTimes(1);
    expect(h.panel.style.transform).toBe('translateY(110px)');
    expect(h.panel.style.transition).toBe('none');
    expect(h.panel.listeners.get('touchmove')!.options.passive).toBe(false);
    h.fire('touchend', h.text, 53, 210, 310);
    expect(h.close).toHaveBeenCalledTimes(1);
    h.cleanup();
  });

  it('lets a short fast downward flick dismiss the sheet', () => {
    const h = swipeHarness();
    h.fire('touchstart', h.header, 50, 100, 0);
    h.fire('touchmove', h.header, 50, 142, 50);
    h.fire('touchend', h.header, 50, 142, 60);
    expect(h.close).toHaveBeenCalledTimes(1);
    h.cleanup();
  });

  it('does not hijack a body scroll that starts below the top, even after it reaches the top', () => {
    const h = swipeHarness();
    h.body.scrollTop = 150;
    h.fire('touchstart', h.text, 50, 100, 0);
    h.body.scrollTop = 0;
    const move = h.fire('touchmove', h.text, 50, 230, 200);
    h.fire('touchend', h.text, 50, 230, 250);
    expect(move.preventDefault).not.toHaveBeenCalled();
    expect(h.panel.style.transform).toBe('');
    expect(h.close).not.toHaveBeenCalled();
    h.cleanup();
  });

  it('still lets the header dismiss while evidence is scrolled down', () => {
    const h = swipeHarness();
    h.body.scrollTop = 150;
    h.fire('touchstart', h.header, 50, 100, 0);
    h.fire('touchmove', h.header, 50, 230, 250);
    h.fire('touchend', h.header, 50, 230, 300);
    expect(h.close).toHaveBeenCalledTimes(1);
    h.cleanup();
  });

  it.each([
    ['upward reading scroll', 50, 0, true],
    ['horizontal gesture', 170, 125, true],
    ['scroll already owned by the browser', 50, 230, false],
  ])('keeps %s native', (_label, x, y, cancelable) => {
    const h = swipeHarness();
    h.fire('touchstart', h.text, 50, 100, 0);
    const move = h.fire('touchmove', h.text, x as number, y as number, 200, { cancelable: cancelable as boolean });
    h.fire('touchend', h.text, x as number, y as number, 250);
    expect(move.preventDefault).not.toHaveBeenCalled();
    expect(h.close).not.toHaveBeenCalled();
    h.cleanup();
  });

  it('does not turn a tap or short slow drag into dismissal', () => {
    const h = swipeHarness();
    h.fire('touchstart', h.header, 50, 100, 0);
    h.fire('touchend', h.header, 50, 100, 80);
    h.fire('touchstart', h.header, 50, 100, 100);
    h.fire('touchmove', h.header, 50, 128, 200);
    h.fire('touchend', h.header, 50, 128, 400);
    expect(h.panel.style.transform).toBe('');
    expect(h.close).not.toHaveBeenCalled();
    h.cleanup();
  });

  it.each(['touchcancel', 'multitouch'])('cancels an in-progress drag on %s', (kind) => {
    const h = swipeHarness();
    h.fire('touchstart', h.header, 50, 100, 0);
    h.fire('touchmove', h.header, 50, 200, 200);
    h.fire(kind === 'touchcancel' ? 'touchcancel' : 'touchmove', h.header, 50, 210, 220, { count: kind === 'touchcancel' ? 0 : 2 });
    h.fire('touchend', h.header, 50, 210, 250);
    expect(h.panel.style.transform).toBe('');
    expect(h.close).not.toHaveBeenCalled();
    h.cleanup();
  });

  it('leaves touch gestures on an interactive control alone', () => {
    const h = swipeHarness();
    const button = Object.assign(new TouchSurface(), { parent: h.header, interactive: true });
    const icon = Object.assign(new TouchSurface(), { parent: button });
    h.fire('touchstart', icon, 50, 100, 0);
    const move = h.fire('touchmove', icon, 50, 230, 200);
    h.fire('touchend', icon, 50, 230, 250);
    expect(move.preventDefault).not.toHaveBeenCalled();
    expect(h.close).not.toHaveBeenCalled();
    h.cleanup();
  });

  it('cleans up the exit timer when another close action unmounts the sheet', () => {
    jest.useFakeTimers();
    const h = swipeHarness(false);
    try {
      h.fire('touchstart', h.header, 50, 100, 0);
      h.fire('touchmove', h.header, 50, 200, 200);
      h.fire('touchend', h.header, 50, 200, 220);
      expect(h.close).not.toHaveBeenCalled();
      expect(h.panel.style.transform).toBe('translateY(424px)');
      h.cleanup();
      jest.runAllTimers();
      expect(h.close).not.toHaveBeenCalled();
      expect(h.panel.listeners.size).toBe(0);
    } finally { h.cleanup(); jest.useRealTimers(); }
  });

  it('keeps unknown-time limitations visible without the long interpretation preface', () => {
    const profile = { name: 'Анна', birthDate: '1990-01-01', birthTime: '', birthPlace: 'Москва', language: 'ru' } as UserProfile;
    const chartData = canonicalNatalChart({ time: { mode: 'unknown', localTime: null, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null } }) as unknown as NatalChartData;
    const html = renderToStaticMarkup(React.createElement(NatalEvidenceSheet, {
      profile, chartData, target: { mode: 'why', title: 'Твой темп', evidenceIds: ['natal.position.sun'] }, onClose: jest.fn(),
    }));
    expect(html).toContain('Время рождения неизвестно. Дома, Асцендент и MC не используются.');
    expect(html).not.toContain('Это астрологическая интерпретация');
    expect(html).not.toContain('Насколько это зависит');
    expect(html).toContain('natal-v3-evidence-scroll');
    expect(html).toContain('aria-label="Закрыть"');
  });
});
