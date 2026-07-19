import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

type PointerGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  startProgress: number;
  seeking: boolean;
  moved: boolean;
};

const HOLD_TO_SEEK_MS = 180;
const TAP_MAX_MS = 300;
const SWIPE_THRESHOLD_PX = 58;
const CLOSE_SWIPE_THRESHOLD_PX = 92;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function getStoryDurationMs(story: DailyQuestionStory | null): number {
  const words = String(story?.answer || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.round(clamp(9000 + words * 120, 11000, 20000));
}

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
  const [progress, setProgressState] = useState(0);
  const [isPaused, setIsPausedState] = useState(false);

  const progressRef = useRef(0);
  const pausedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const previousFrameTimeRef = useRef<number | null>(null);
  const pointerGestureRef = useRef<PointerGesture | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const transitionDirectionRef = useRef<1 | -1>(1);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const isOpen = !!activeStory;
  const currentIndex = activeIndex ?? 0;
  const durationMs = useMemo(() => getStoryDurationMs(activeStory), [activeStory]);
  const hasNativeBack = typeof window !== 'undefined'
    && !!(window as any).Telegram?.WebApp?.BackButton;

  const setProgress = useCallback((value: number) => {
    const next = clamp(value);
    progressRef.current = next;
    setProgressState(next);
  }, []);

  const setPaused = useCallback((value: boolean) => {
    pausedRef.current = value;
    previousFrameTimeRef.current = null;
    setIsPausedState(value);
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const goForward = useCallback(() => {
    transitionDirectionRef.current = 1;
    setProgress(0);
    if (currentIndex >= stories.length - 1) {
      onClose();
      return;
    }
    onMove(1);
  }, [currentIndex, onClose, onMove, setProgress, stories.length]);

  const goBack = useCallback(() => {
    transitionDirectionRef.current = -1;
    setProgress(0);
    if (currentIndex <= 0) return;
    onMove(-1);
  }, [currentIndex, onMove, setProgress]);

  useEffect(() => {
    if (typeof document !== 'undefined') setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    setProgress(0);
    setPaused(false);
  }, [activeStory?.id, setPaused, setProgress]);

  useEffect(() => {
    if (!activeStory || isPaused) return;

    const tick = (timestamp: number) => {
      if (previousFrameTimeRef.current == null) {
        previousFrameTimeRef.current = timestamp;
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const elapsed = timestamp - previousFrameTimeRef.current;
      previousFrameTimeRef.current = timestamp;
      const next = progressRef.current + elapsed / durationMs;

      if (next >= 1) {
        setProgress(1);
        frameRef.current = window.requestAnimationFrame(goForward);
        return;
      }

      setProgress(next);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      previousFrameTimeRef.current = null;
    };
  }, [activeStory, durationMs, goForward, isPaused, setProgress]);

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

    const handleVisibility = () => {
      setPaused(document.visibilityState !== 'visible');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goBack();
      } else if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        goForward();
      } else if (event.key === 'Tab') {
        const focusTarget = hasNativeBack ? titleRef.current : closeButtonRef.current;
        if (focusTarget) {
          event.preventDefault();
          focusTarget.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibility);
      backButton?.offClick?.(onClose);
      backButton?.hide?.();
      tg?.enableVerticalSwipes?.();
      document.body.classList.remove('daily-question-story-open');
      clearHoldTimer();

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
  }, [clearHoldTimer, goBack, goForward, hasNativeBack, isOpen, onClose, scrollRef, setPaused]);

  useEffect(() => {
    if (!activeStory) return;
    const frame = window.requestAnimationFrame(() => {
      const target = hasNativeBack ? titleRef.current : closeButtonRef.current;
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStory, hasNativeBack]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearHoldTimer();
    setPaused(true);

    pointerGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      startProgress: progressRef.current,
      seeking: false,
      moved: false,
    };

    holdTimerRef.current = window.setTimeout(() => {
      const gesture = pointerGestureRef.current;
      if (gesture && !gesture.moved) gesture.seeking = true;
    }, HOLD_TO_SEEK_MS);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) gesture.moved = true;

    if (gesture.seeking) {
      const width = Math.max(event.currentTarget.clientWidth, 1);
      setProgress(gesture.startProgress + dx / width);
    }
  };

  const finishPointerGesture = (
    event: React.PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    clearHoldTimer();
    pointerGestureRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const elapsed = performance.now() - gesture.startedAt;
    const horizontalSwipe = Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.15;
    const closeSwipe = dy >= CLOSE_SWIPE_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx) * 1.15;
    const cleanTap = !cancelled && elapsed <= TAP_MAX_MS && Math.abs(dx) < 18 && Math.abs(dy) < 18;

    setPaused(false);

    if (cancelled || gesture.seeking) return;
    if (closeSwipe) {
      onClose();
      return;
    }
    if (horizontalSwipe) {
      if (dx < 0) goForward();
      else goBack();
      return;
    }
    if (cleanTap) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const localX = event.clientX - bounds.left;
      if (localX <= bounds.width * 0.28) goBack();
      else goForward();
    }
  };

  if (!portalRoot) return null;

  return createPortal(
    <AnimatePresence>
      {activeStory ? (
        <motion.div
          key="daily-question-story-modal"
          className={`daily-question-story${isPaused ? ' is-paused' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`daily-question-story-title-${activeStory.id}`}
          aria-describedby={`daily-question-story-answer-${activeStory.id}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeStory.id}
              className="daily-question-story-scene"
              style={cardBackgroundStyle(activeStory.background)}
              initial={{ opacity: 0, x: transitionDirectionRef.current * 24, scale: 1.012 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: transitionDirectionRef.current * -18, scale: 0.997 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="daily-question-story-gesture-layer"
                aria-hidden
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => finishPointerGesture(event)}
                onPointerCancel={(event) => finishPointerGesture(event, true)}
                onContextMenu={(event) => event.preventDefault()}
              />

              <div className="daily-question-story-progress" aria-hidden>
                {stories.map((story, index) => {
                  const fill = index < currentIndex ? 1 : index > currentIndex ? 0 : progress;
                  return (
                    <i key={story.id}>
                      <span style={{ transform: `scaleX(${fill})` }} />
                    </i>
                  );
                })}
              </div>

              <div className="daily-question-story-meta" aria-hidden>
                <span>{language === 'ru' ? 'Спроси про сегодня' : 'Ask about today'}</span>
                <span>{currentIndex + 1}/{stories.length}</span>
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
                  {language === 'ru' ? 'Твой личный ответ' : 'Your personal answer'}
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

              <div className="daily-question-story-pause" aria-hidden>
                <span />
                <span />
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
}
