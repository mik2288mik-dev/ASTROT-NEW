import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { CosmicSurface } from './CosmicSurface';

export type CosmicSheetProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
  contentClassName?: string;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type SheetStackEntry = {
  id: symbol;
  layer: HTMLDivElement;
};

type BackgroundState = {
  ariaHidden: string | null;
  inert: string | null;
};

const sheetStack: SheetStackEntry[] = [];
const isolatedBackground = new Map<HTMLElement, BackgroundState>();
let bodyOverflowBeforeSheets = '';
let bodyOverflowCaptured = false;

function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) {
    element.removeAttribute(name);
    return;
  }
  element.setAttribute(name, value);
}

function isolateElement(element: HTMLElement): void {
  if (!isolatedBackground.has(element)) {
    isolatedBackground.set(element, {
      ariaHidden: element.getAttribute('aria-hidden'),
      inert: element.getAttribute('inert'),
    });
  }
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('inert', '');
}

function restoreElement(element: HTMLElement): void {
  const state = isolatedBackground.get(element);
  if (!state) return;
  restoreAttribute(element, 'aria-hidden', state.ariaHidden);
  restoreAttribute(element, 'inert', state.inert);
  isolatedBackground.delete(element);
}

function syncSheetEnvironment(): void {
  if (typeof document === 'undefined') return;

  const topLayer = sheetStack[sheetStack.length - 1]?.layer ?? null;
  if (!topLayer) {
    Array.from(isolatedBackground.keys()).forEach(restoreElement);
    if (bodyOverflowCaptured) {
      document.body.style.overflow = bodyOverflowBeforeSheets;
      bodyOverflowCaptured = false;
    }
    return;
  }

  if (!bodyOverflowCaptured) {
    bodyOverflowBeforeSheets = document.body.style.overflow;
    bodyOverflowCaptured = true;
  }
  document.body.style.overflow = 'hidden';

  const elementsToIsolate = new Set(
    Array.from(document.body.children).filter((element): element is HTMLElement => (
      element instanceof HTMLElement
      && element !== topLayer
      && !['SCRIPT', 'STYLE', 'LINK', 'META'].includes(element.tagName)
    )),
  );

  Array.from(isolatedBackground.keys()).forEach((element) => {
    if (!elementsToIsolate.has(element)) restoreElement(element);
  });
  elementsToIsolate.forEach(isolateElement);
}

function registerSheet(id: symbol, layer: HTMLDivElement): void {
  const existingIndex = sheetStack.findIndex((entry) => entry.id === id);
  if (existingIndex >= 0) sheetStack.splice(existingIndex, 1);
  sheetStack.push({ id, layer });
  syncSheetEnvironment();
}

function unregisterSheet(id: symbol): boolean {
  const index = sheetStack.findIndex((entry) => entry.id === id);
  if (index < 0) return false;
  const wasTopmost = index === sheetStack.length - 1;
  sheetStack.splice(index, 1);
  syncSheetEnvironment();
  return wasTopmost;
}

function isTopmostSheet(id: symbol): boolean {
  return sheetStack[sheetStack.length - 1]?.id === id;
}

function restoreSheetFocus(previousFocusRef: { current: HTMLElement | null }): void {
  const previousFocus = previousFocusRef.current;
  if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) {
    previousFocusRef.current?.focus({ preventScroll: true });
    return;
  }

  const topLayer = sheetStack[sheetStack.length - 1]?.layer;
  const fallback = topLayer?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ?? topLayer?.querySelector<HTMLElement>('[role="dialog"]');
  fallback?.focus({ preventScroll: true });
}

function classNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

export function CosmicSheet({
  open,
  title,
  subtitle,
  children,
  footer,
  closeLabel = 'Close',
  className,
  contentClassName,
  onClose,
}: CosmicSheetProps) {
  const isEditorialSheet = className?.includes('lz-sheet-panel--editorial') ?? false;
  const [portalReady, setPortalReady] = useState(false);
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const sheetIdRef = useRef(Symbol('cosmic-sheet'));
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open || !portalReady || typeof document === 'undefined') return;

    const layer = layerRef.current;
    if (!layer) return;
    const sheetId = sheetIdRef.current;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    registerSheet(sheetId, layer);
    const frame = window.requestAnimationFrame(() => {
      if (isTopmostSheet(sheetId)) {
        closeButtonRef.current?.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostSheet(sheetId)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute('hidden'));
      if (!focusable.length) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleNativeBack = (event: Event) => {
      if (!isTopmostSheet(sheetId)) return;
      const nativeEvent = event as CustomEvent<NativeBackEventDetail>;
      if (nativeEvent.detail?.handled) return;
      if (nativeEvent.detail) nativeEvent.detail.handled = true;
      onCloseRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
      const shouldRestoreFocus = unregisterSheet(sheetId);
      if (shouldRestoreFocus) restoreSheetFocus(previousFocusRef);
      previousFocusRef.current = null;
    };
  }, [open, portalReady]);

  if (!portalReady || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={layerRef}
          className="cosmic-sheet-layer forecast-bottom-sheet-layer"
          data-editorial-sheet={isEditorialSheet || undefined}
          initial={isEditorialSheet ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={isEditorialSheet ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          <motion.button
            type="button"
            className="cosmic-sheet-backdrop forecast-bottom-sheet-backdrop"
            aria-label={closeLabel}
            tabIndex={-1}
            onClick={() => onCloseRef.current()}
            initial={isEditorialSheet ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={isEditorialSheet ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          />
          <motion.div
            className="cosmic-sheet-motion"
            initial={reduceMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reduceMotion
              ? { duration: 0 }
              : isEditorialSheet
                ? { duration: 0.24, ease: [0.25, 1, 0.5, 1] }
                : { type: 'spring', stiffness: 380, damping: 36 }}
          >
            <CosmicSurface
              as="section"
              ref={panelRef as React.Ref<HTMLElement>}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={subtitle ? subtitleId : undefined}
              className={classNames('cosmic-sheet-panel', className)}
              planeClassName="cosmic-sheet-plane"
              tabIndex={-1}
              variant="sheet"
            >
              <div className="cosmic-sheet-handle forecast-bottom-sheet-handle" aria-hidden="true" />
              <header className="cosmic-sheet-header forecast-bottom-sheet-header">
                <div className="cosmic-sheet-heading forecast-bottom-sheet-heading">
                  <h2 id={titleId} className="cosmic-sheet-title forecast-bottom-sheet-title">{title}</h2>
                  {subtitle ? (
                    <p id={subtitleId} className="cosmic-sheet-subtitle forecast-bottom-sheet-subtitle">{subtitle}</p>
                  ) : null}
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="cosmic-sheet-close forecast-bottom-sheet-close"
                  aria-label={closeLabel}
                  onClick={() => onCloseRef.current()}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M5 5L15 15M15 5L5 15"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </header>
              <div className={classNames('cosmic-sheet-content', contentClassName)}>
                {children}
              </div>
              {footer ? <footer className="cosmic-sheet-footer forecast-bottom-sheet-footer">{footer}</footer> : null}
            </CosmicSurface>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
