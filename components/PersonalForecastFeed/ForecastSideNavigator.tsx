import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type ForecastSideNavigatorSection = {
  id: string;
  title: string;
};

export type ForecastSideNavigatorProps = {
  sections: ForecastSideNavigatorSection[];
  activeId?: string | null;
  onNavigate: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  longPressMs?: number;
};

type Preview = {
  id: string;
  title: string;
  top: number;
};

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

export function ForecastSideNavigator({
  sections,
  activeId,
  onNavigate,
  ariaLabel = 'Навигация по разделам прогноза',
  className,
  longPressMs = 320,
}: ForecastSideNavigatorProps) {
  const tocId = useId();
  const railRef = useRef<HTMLButtonElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);
  const suppressClickRef = useRef(false);
  const previewRef = useRef<Preview | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const updatePreview = (clientY: number): Preview | null => {
    const rail = railRef.current;
    if (!rail || !sections.length) return null;
    const rect = rail.getBoundingClientRect();
    const top = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const ratio = rect.height > 0 ? top / rect.height : 0;
    const index = sections.length === 1
      ? 0
      : Math.max(
          0,
          Math.min(sections.length - 1, Math.round(ratio * (sections.length - 1))),
        );
    const section = sections[index];
    const next = { id: section.id, title: section.title, top };
    previewRef.current = next;
    setPreview(next);
    return next;
  };

  const finishPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
    navigate: boolean,
  ) => {
    clearPressTimer();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (navigate && didLongPressRef.current && previewRef.current) {
      suppressClickRef.current = true;
      onNavigate(previewRef.current.id);
      setTocOpen(false);
    }
    pointerIdRef.current = null;
    didLongPressRef.current = false;
    previewRef.current = null;
    setPreview(null);
    setScrubbing(false);
  };

  useEffect(() => {
    return () => clearPressTimer();
  }, []);

  useEffect(() => {
    if (sections.length) return;
    setTocOpen(false);
    setScrubbing(false);
    setPreview(null);
  }, [sections.length]);

  useEffect(() => {
    if (!tocOpen && !scrubbing) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      clearPressTimer();
      setTocOpen(false);
      setScrubbing(false);
      setPreview(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [scrubbing, tocOpen]);

  if (!sections.length) return null;

  return (
    <nav
      className={classes('forecast-side-navigator', className)}
      aria-label={ariaLabel}
    >
      <button
        ref={railRef}
        type="button"
        className={classes(
          'forecast-side-navigator-hit-area',
          scrubbing && 'is-scrubbing',
        )}
        style={{ touchAction: 'none' }}
        aria-label={ariaLabel}
        aria-expanded={tocOpen}
        aria-controls={tocId}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
            return;
          }
          clearPressTimer();
          pointerIdRef.current = event.pointerId;
          didLongPressRef.current = false;
          updatePreview(event.clientY);
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture may be unavailable in older embedded WebViews.
          }
          pressTimerRef.current = setTimeout(() => {
            if (pointerIdRef.current !== event.pointerId) return;
            didLongPressRef.current = true;
            setScrubbing(true);
          }, Math.max(0, longPressMs));
        }}
        onPointerMove={(event) => {
          if (pointerIdRef.current !== event.pointerId) return;
          updatePreview(event.clientY);
        }}
        onPointerUp={(event) => {
          if (pointerIdRef.current !== event.pointerId) return;
          finishPointer(event, true);
        }}
        onPointerCancel={(event) => {
          if (pointerIdRef.current !== event.pointerId) return;
          finishPointer(event, false);
        }}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            return;
          }
          setTocOpen((current) => !current);
        }}
      >
        <span className="forecast-side-navigator-marks" aria-hidden>
          {sections.map((section) => (
            <span
              key={section.id}
              className={classes(
                'forecast-side-navigator-mark',
                section.id === activeId && 'is-active',
                section.id === preview?.id && 'is-preview',
              )}
            />
          ))}
        </span>
      </button>

      <AnimatePresence>
        {scrubbing && preview ? (
          <motion.div
            className="forecast-side-navigator-scrub-label"
            style={{ top: preview.top }}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            aria-live="polite"
          >
            {preview.title}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {tocOpen ? (
          <motion.div
            id={tocId}
            className="forecast-side-navigator-toc"
            role="group"
            aria-label={ariaLabel}
            initial={{ opacity: 0, x: 8, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <ol className="forecast-side-navigator-toc-list">
              {sections.map((section) => (
                <li key={section.id} className="forecast-side-navigator-toc-item">
                  <button
                    type="button"
                    className={classes(
                      'forecast-side-navigator-toc-button',
                      section.id === activeId && 'is-active',
                    )}
                    aria-current={section.id === activeId ? 'location' : undefined}
                    onClick={() => {
                      onNavigate(section.id);
                      setTocOpen(false);
                    }}
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ol>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
