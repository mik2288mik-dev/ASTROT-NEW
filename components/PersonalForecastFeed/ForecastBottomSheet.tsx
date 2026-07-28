import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

export type ForecastBottomSheetProps = {
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

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

export function ForecastBottomSheet({
  open,
  title,
  subtitle,
  children,
  footer,
  closeLabel = 'Закрыть',
  className,
  contentClassName,
  onClose,
}: ForecastBottomSheetProps) {
  const [portalReady, setPortalReady] = useState(false);
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open || !portalReady || typeof document === 'undefined') return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus({ preventScroll: true });
      previousFocusRef.current = null;
    };
  }, [open, portalReady]);

  if (!portalReady || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="forecast-bottom-sheet-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.button
            type="button"
            className="forecast-bottom-sheet-backdrop"
            aria-label={closeLabel}
            tabIndex={-1}
            onClick={() => onCloseRef.current()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={subtitle ? subtitleId : undefined}
            className={classes('forecast-bottom-sheet-panel', className)}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="forecast-bottom-sheet-handle" aria-hidden />
            <header className="forecast-bottom-sheet-header">
              <div className="forecast-bottom-sheet-heading">
                <h2 id={titleId} className="forecast-bottom-sheet-title">
                  {title}
                </h2>
                {subtitle ? (
                  <p id={subtitleId} className="forecast-bottom-sheet-subtitle">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="forecast-bottom-sheet-close"
                aria-label={closeLabel}
                onClick={() => onCloseRef.current()}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>
            <div
              className={classes(
                'forecast-bottom-sheet-content',
                contentClassName,
              )}
            >
              {children}
            </div>
            {footer ? (
              <footer className="forecast-bottom-sheet-footer">{footer}</footer>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
