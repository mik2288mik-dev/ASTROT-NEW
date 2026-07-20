import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import type { DailyQuestionStory } from '../../lib/dailyQuestions';
import { cardBackgroundStyle } from '../../lib/cardBackgrounds';

type Props = {
  activeStory: DailyQuestionStory | null;
  stories: DailyQuestionStory[];
  activeIndex: number | null;
  language: 'ru' | 'en';
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onMove: (direction: number) => void;
};

const SHEET_EASE = [0.22, 1, 0.36, 1] as const;

export function DailyQuestionStoryModal({
  activeStory,
  language,
  scrollRef,
  onClose,
}: Props) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();
  const isOpen = !!activeStory;
  const hasNativeBack = typeof window !== 'undefined'
    && !!(window as any).Telegram?.WebApp?.BackButton;

  useEffect(() => {
    if (typeof document !== 'undefined') setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const tg = (window as any).Telegram?.WebApp;
    const backButton = tg?.BackButton;
    const appShell = document.querySelector<HTMLElement>('.lumia-app-shell');
    const scrollNode = scrollRef?.current || null;
    const inertShell = appShell as (HTMLElement & { inert?: boolean }) | null;
    const previousInert = !!inertShell?.inert;
    const previousAriaHidden = appShell?.getAttribute('aria-hidden') ?? null;
    const previousOverflowY = scrollNode?.style.overflowY ?? '';
    const previousTouchAction = scrollNode?.style.touchAction ?? '';

    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    openerRef.current?.blur();

    document.body.classList.add('daily-question-sheet-open');
    if (scrollNode) {
      scrollNode.style.overflowY = 'hidden';
      scrollNode.style.touchAction = 'none';
    }
    if (inertShell) inertShell.inert = true;
    appShell?.setAttribute('aria-hidden', 'true');

    tg?.disableVerticalSwipes?.();
    backButton?.onClick?.(onClose);
    backButton?.show?.();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab') {
        const target = hasNativeBack ? titleRef.current : closeButtonRef.current;
        if (target) {
          event.preventDefault();
          target.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      backButton?.offClick?.(onClose);
      backButton?.hide?.();
      tg?.enableVerticalSwipes?.();
      document.body.classList.remove('daily-question-sheet-open');

      if (scrollNode) {
        scrollNode.style.overflowY = previousOverflowY;
        scrollNode.style.touchAction = previousTouchAction;
      }
      if (inertShell) inertShell.inert = previousInert;
      if (appShell) {
        if (previousAriaHidden == null) appShell.removeAttribute('aria-hidden');
        else appShell.setAttribute('aria-hidden', previousAriaHidden);
      }

      openerRef.current?.focus({ preventScroll: true });
      openerRef.current = null;
    };
  }, [hasNativeBack, isOpen, onClose, scrollRef]);

  useEffect(() => {
    if (!activeStory) return;

    // Let the sheet finish its GPU transform before moving focus. On Telegram iOS,
    // focusing during the first frame can force a costly layout and make the opening stutter.
    const timer = window.setTimeout(() => {
      const target = hasNativeBack ? titleRef.current : closeButtonRef.current;
      target?.focus({ preventScroll: true });
    }, 280);

    return () => window.clearTimeout(timer);
  }, [activeStory, hasNativeBack]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 720) onClose();
  };

  if (!portalRoot) return null;

  const answerParagraphs = String(activeStory?.answer || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return createPortal(
    <AnimatePresence>
      {activeStory ? (
        <motion.div
          className="daily-question-sheet-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          role="presentation"
        >
          <button
            type="button"
            className="daily-question-sheet-backdrop"
            aria-label={language === 'ru' ? 'Закрыть ответ' : 'Close answer'}
            onClick={onClose}
          />

          <motion.section
            className="daily-question-sheet"
            initial={{ y: '102%' }}
            animate={{ y: 0 }}
            exit={{ y: '102%' }}
            transition={{ duration: 0.27, ease: SHEET_EASE }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.26 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`daily-question-sheet-title-${activeStory.id}`}
            aria-describedby={`daily-question-sheet-answer-${activeStory.id}`}
          >
            <div
              className="daily-question-sheet-drag-zone"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <span className="daily-question-sheet-handle" aria-hidden />
              <div
                className="daily-question-sheet-art"
                style={cardBackgroundStyle(activeStory.background)}
                aria-hidden
              />
            </div>

            {!hasNativeBack ? (
              <button
                ref={closeButtonRef}
                type="button"
                className="daily-question-sheet-close"
                onClick={onClose}
                aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}

            <div className="daily-question-sheet-content">
              <p className="daily-question-sheet-label">
                {language === 'ru' ? 'Спроси про сегодня' : 'Ask about today'}
              </p>
              <h2
                ref={titleRef}
                id={`daily-question-sheet-title-${activeStory.id}`}
                tabIndex={-1}
              >
                {activeStory.question}
              </h2>
              {activeStory.teaser ? (
                <p className="daily-question-sheet-lead">{activeStory.teaser}</p>
              ) : null}
              <div
                className="daily-question-sheet-answer"
                id={`daily-question-sheet-answer-${activeStory.id}`}
              >
                {answerParagraphs.map((paragraph, index) => (
                  <p key={`${activeStory.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
}
