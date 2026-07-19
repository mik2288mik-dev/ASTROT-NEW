import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
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

export function DailyQuestionStoryModal({
  activeStory,
  stories,
  activeIndex,
  language,
  scrollRef,
  onClose,
  onMove,
}: Props) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
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

    document.body.classList.add('daily-question-story-open');
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
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onMove(-1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onMove(1);
        return;
      }
      if (event.key === 'Tab') {
        const focusTarget = hasNativeBack ? titleRef.current : closeButtonRef.current;
        if (focusTarget) {
          event.preventDefault();
          focusTarget.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      backButton?.offClick?.(onClose);
      backButton?.hide?.();
      tg?.enableVerticalSwipes?.();
      document.body.classList.remove('daily-question-story-open');

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
  }, [hasNativeBack, isOpen, onClose, onMove, scrollRef]);

  useEffect(() => {
    if (!activeStory) return;
    const frame = window.requestAnimationFrame(() => {
      const target = hasNativeBack ? titleRef.current : closeButtonRef.current;
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStory, hasNativeBack]);

  const onDragEnd = (_event: unknown, info: PanInfo) => {
    const power = info.offset.x + info.velocity.x * 0.18;
    if (power < -70) onMove(1);
    else if (power > 70) onMove(-1);
  };

  if (!portalRoot) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {activeStory ? (
        <motion.div
          key={activeStory.id}
          className="daily-question-story"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`daily-question-story-title-${activeStory.id}`}
          aria-describedby={`daily-question-story-answer-${activeStory.id}`}
        >
          <motion.div
            className="daily-question-story-scene"
            style={cardBackgroundStyle(activeStory.background)}
            initial={{ scale: 1.012 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.994 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.22}
            onDragEnd={onDragEnd}
          >
            <div className="daily-question-story-progress" aria-hidden>
              {stories.map((story, index) => (
                <i key={story.id} className={index <= (activeIndex ?? 0) ? 'is-active' : ''} />
              ))}
            </div>

            {!hasNativeBack ? (
              <button
                ref={closeButtonRef}
                type="button"
                className="daily-question-story-close"
                onClick={onClose}
                aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}

            <div className="daily-question-story-copy">
              <div className="daily-question-story-kicker">
                {language === 'ru' ? 'Твой вопрос на сегодня' : 'Your question for today'}
              </div>
              <h2
                ref={titleRef}
                id={`daily-question-story-title-${activeStory.id}`}
                tabIndex={-1}
              >
                {activeStory.question}
              </h2>
              <p id={`daily-question-story-answer-${activeStory.id}`}>{activeStory.answer}</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
}
