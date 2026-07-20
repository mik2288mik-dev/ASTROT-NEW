import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DailyQuestionStory } from '../../lib/dailyQuestions';

type Props = {
  activeStory: DailyQuestionStory | null;
  stories: DailyQuestionStory[];
  activeIndex: number | null;
  language: 'ru' | 'en';
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onMove: (direction: number) => void;
};

type DragState = {
  pointerId: number;
  startY: number;
  lastY: number;
  startedAt: number;
};

const CLOSE_DURATION_MS = 230;
const CLOSE_DISTANCE_PX = 92;
const CLOSE_VELOCITY_PX_MS = 0.55;

export function DailyQuestionStoryModal({
  activeStory,
  language,
  scrollRef,
  onClose,
}: Props) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [renderedStory, setRenderedStory] = useState<DailyQuestionStory | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const openFramesRef = useRef<number[]>([]);
  const openerRef = useRef<HTMLElement | null>(null);

  const clearTimers = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    openFramesRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
    openFramesRef.current = [];
  }, []);

  const resetDrag = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
    sheetRef.current?.style.removeProperty('--daily-question-sheet-y');
  }, []);

  const finishClose = useCallback(() => {
    clearTimers();
    resetDrag();
    setIsOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setRenderedStory(null);
      onClose();
    }, CLOSE_DURATION_MS);
  }, [clearTimers, onClose, resetDrag]);

  useEffect(() => {
    if (typeof document !== 'undefined') setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    clearTimers();

    if (!activeStory) {
      if (renderedStory) {
        setIsOpen(false);
        closeTimerRef.current = window.setTimeout(() => {
          closeTimerRef.current = null;
          setRenderedStory(null);
          resetDrag();
        }, CLOSE_DURATION_MS);
      }
      return;
    }

    setRenderedStory(activeStory);
    setIsOpen(false);
    resetDrag();

    const first = window.requestAnimationFrame(() => {
      const second = window.requestAnimationFrame(() => setIsOpen(true));
      openFramesRef.current.push(second);
    });
    openFramesRef.current.push(first);

    return clearTimers;
  }, [activeStory, clearTimers, renderedStory, resetDrag]);

  useEffect(() => {
    if (!renderedStory || typeof document === 'undefined') return;

    const scrollNode = scrollRef?.current || null;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const previousScrollOverflow = scrollNode?.style.overflowY ?? '';
    const previousScrollTouchAction = scrollNode?.style.touchAction ?? '';

    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    document.body.classList.add('daily-question-sheet-open');
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    if (scrollNode) {
      scrollNode.style.overflowY = 'hidden';
      scrollNode.style.touchAction = 'none';
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('daily-question-sheet-open');
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      if (scrollNode) {
        scrollNode.style.overflowY = previousScrollOverflow;
        scrollNode.style.touchAction = previousScrollTouchAction;
      }
      openerRef.current?.focus({ preventScroll: true });
      openerRef.current = null;
    };
  }, [finishClose, renderedStory, scrollRef]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      startedAt: performance.now(),
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.lastY = event.clientY;
    const offset = Math.max(0, event.clientY - drag.startY);
    sheetRef.current?.style.setProperty('--daily-question-sheet-y', `${offset}px`);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const offset = Math.max(0, event.clientY - drag.startY);
    const elapsed = Math.max(performance.now() - drag.startedAt, 1);
    const velocity = Math.max(0, event.clientY - drag.startY) / elapsed;
    dragRef.current = null;
    setIsDragging(false);

    if (!cancelled && (offset >= CLOSE_DISTANCE_PX || velocity >= CLOSE_VELOCITY_PX_MS)) {
      finishClose();
      return;
    }

    sheetRef.current?.style.setProperty('--daily-question-sheet-y', '0px');
  };

  if (!portalRoot || !renderedStory) return null;

  const answerParagraphs = String(renderedStory.answer || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return createPortal(
    <div
      className={`daily-question-sheet-layer${isOpen ? ' is-open' : ''}`}
      role="presentation"
    >
      <button
        type="button"
        className="daily-question-sheet-backdrop"
        aria-label={language === 'ru' ? 'Закрыть ответ' : 'Close answer'}
        onClick={finishClose}
      />

      <section
        ref={sheetRef}
        className={`daily-question-sheet daily-question-sheet--${renderedStory.theme}${isDragging ? ' is-dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`daily-question-sheet-title-${renderedStory.id}`}
        aria-describedby={`daily-question-sheet-answer-${renderedStory.id}`}
      >
        <div
          className="daily-question-sheet-grab-area"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => handlePointerEnd(event)}
          onPointerCancel={(event) => handlePointerEnd(event, true)}
        >
          <span className="daily-question-sheet-handle" aria-hidden />
        </div>

        <button
          type="button"
          className="daily-question-sheet-close"
          onClick={finishClose}
          aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="daily-question-sheet-content">
          <p className="daily-question-sheet-label">
            {language === 'ru' ? 'Спроси про сегодня' : 'Ask about today'}
          </p>
          <h2 id={`daily-question-sheet-title-${renderedStory.id}`}>
            {renderedStory.question}
          </h2>
          {renderedStory.teaser ? (
            <p className="daily-question-sheet-lead">{renderedStory.teaser}</p>
          ) : null}
          <div
            className="daily-question-sheet-answer"
            id={`daily-question-sheet-answer-${renderedStory.id}`}
          >
            {answerParagraphs.map((paragraph, index) => (
              <p key={`${renderedStory.id}-${index}`}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>
    </div>,
    portalRoot,
  );
}
