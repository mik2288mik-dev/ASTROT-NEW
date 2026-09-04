export const PAYWALL_FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const EXCLUDED_FOCUS_TARGET_SELECTOR = '[hidden], [aria-hidden="true"], [inert]';

const isRenderedFocusTarget = (element: HTMLElement): boolean => {
  if (element.closest(EXCLUDED_FOCUS_TARGET_SELECTOR)) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  return element.getClientRects().length > 0;
};

export const getPaywallFocusableElements = (host: HTMLElement): HTMLElement[] => (
  Array.from(host.querySelectorAll<HTMLElement>(PAYWALL_FOCUSABLE_SELECTOR))
    .filter(isRenderedFocusTarget)
);

type PaywallTabEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>;

export const trapPaywallTabKey = (
  host: HTMLElement,
  event: PaywallTabEvent,
): boolean => {
  if (event.key !== 'Tab') return false;

  const focusable = getPaywallFocusableElements(host);
  if (!focusable.length) {
    event.preventDefault();
    host.focus({ preventScroll: true });
    return true;
  }

  const activeIndex = focusable.findIndex((element) => (
    element === host.ownerDocument.activeElement
  ));
  const shouldWrapBackward = event.shiftKey && activeIndex <= 0;
  const shouldWrapForward = !event.shiftKey && (
    activeIndex < 0 || activeIndex === focusable.length - 1
  );
  if (!shouldWrapBackward && !shouldWrapForward) return false;

  event.preventDefault();
  const target = shouldWrapBackward ? focusable[focusable.length - 1] : focusable[0];
  target.focus({ preventScroll: true });
  return true;
};

export const canRestorePaywallFocus = (
  element: HTMLElement | null | undefined,
): element is HTMLElement => !!element?.isConnected && isRenderedFocusTarget(element);
