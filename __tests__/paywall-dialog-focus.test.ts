import {
  canRestorePaywallFocus,
  getPaywallFocusableElements,
  trapPaywallTabKey,
} from '../lib/paywallDialogFocus';
import fs from 'node:fs';
import path from 'node:path';

type FocusTarget = HTMLElement & {
  focus: jest.Mock;
};

const makeTarget = (options?: {
  connected?: boolean;
  excluded?: boolean;
  rendered?: boolean;
}): FocusTarget => ({
  isConnected: options?.connected ?? true,
  closest: jest.fn(() => options?.excluded ? {} : null),
  getClientRects: jest.fn(() => options?.rendered === false ? [] : [{}]),
  ownerDocument: { defaultView: undefined },
  focus: jest.fn(),
} as unknown as FocusTarget);

const makeHost = (targets: FocusTarget[], activeElement: unknown = null) => ({
  querySelectorAll: jest.fn(() => targets),
  ownerDocument: { activeElement },
  focus: jest.fn(),
} as unknown as FocusTarget);

const makeTabEvent = (shiftKey = false) => ({
  key: 'Tab',
  shiftKey,
  preventDefault: jest.fn(),
});

describe('fullscreen Paywall dialog focus lifecycle', () => {
  it('keeps only rendered, non-inert controls in the dialog tab order', () => {
    const visible = makeTarget();
    const hidden = makeTarget({ rendered: false });
    const inert = makeTarget({ excluded: true });
    const host = makeHost([visible, hidden, inert]);

    expect(getPaywallFocusableElements(host)).toEqual([visible]);
  });

  it('wraps Tab and Shift+Tab at both dialog boundaries', () => {
    const first = makeTarget();
    const last = makeTarget();
    const forwardHost = makeHost([first, last], last);
    const forward = makeTabEvent();

    expect(trapPaywallTabKey(forwardHost, forward)).toBe(true);
    expect(forward.preventDefault).toHaveBeenCalledTimes(1);
    expect(first.focus).toHaveBeenCalledWith({ preventScroll: true });

    const backwardHost = makeHost([first, last], first);
    const backward = makeTabEvent(true);
    expect(trapPaywallTabKey(backwardHost, backward)).toBe(true);
    expect(backward.preventDefault).toHaveBeenCalledTimes(1);
    expect(last.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('pulls escaped focus back inside and focuses the host when it has no controls', () => {
    const first = makeTarget();
    const escapedHost = makeHost([first], makeTarget());
    const escaped = makeTabEvent();
    expect(trapPaywallTabKey(escapedHost, escaped)).toBe(true);
    expect(first.focus).toHaveBeenCalledWith({ preventScroll: true });

    const emptyHost = makeHost([]);
    const empty = makeTabEvent();
    expect(trapPaywallTabKey(emptyHost, empty)).toBe(true);
    expect(emptyHost.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('restores only a connected and rendered trigger', () => {
    expect(canRestorePaywallFocus(makeTarget())).toBe(true);
    expect(canRestorePaywallFocus(makeTarget({ connected: false }))).toBe(false);
    expect(canRestorePaywallFocus(makeTarget({ excluded: true }))).toBe(false);
    expect(canRestorePaywallFocus(makeTarget({ rendered: false }))).toBe(false);
  });

  it('closes Escape through returnFromPaywall and coordinates trigger focus with the return anchor', () => {
    const app = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');
    const lifecycle = app.slice(
      app.indexOf('if (!paywallContext || typeof window'),
      app.indexOf('const paywallEventPayload'),
    );
    const returnFlow = app.slice(
      app.indexOf('const returnFromPaywall'),
      app.indexOf('const paymentPatchFromValidatedPayment'),
    );
    const anchorFlow = app.slice(
      app.indexOf('const restoreScrollAnchor'),
      app.indexOf('const returnFromPaywall'),
    );

    expect(lifecycle).toContain("event.key === 'Escape'");
    expect(lifecycle).toContain('paywallDismissRef.current(context)');
    expect(lifecycle).toContain("document.addEventListener('keydown', handleKeyDown, true)");
    expect(returnFlow).toContain('paywallTriggerRef.current = null');
    expect(returnFlow).toContain('restoreFocusTo: destination.shouldOpenFeature ? null : trigger');
    expect(anchorFlow).toContain("target?.scrollIntoView({ block: 'center' })");
  });
});
