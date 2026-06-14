import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { ForecastDailyReading } from '../../types';

export type StorySlide = {
  id: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  /** While true the slide shows a skeleton and autoplay pauses on it. */
  loading?: boolean;
  /** Custom interactive content (e.g. a sign picker). Pauses autoplay + disables tap-nav. */
  content?: React.ReactNode;
};

const SLIDE_MS = 6500;
const TAP_MS = 220;

/** Split a sign/daily reading into clean story slides (one idea per slide). */
export function buildReadingSlides(
  reading: ForecastDailyReading | null,
  eyebrow: string,
  language: 'ru' | 'en',
): StorySlide[] {
  if (!reading) return [];
  const slides: StorySlide[] = [];
  const seen = new Set<string>();
  const norm = (s?: string) => String(s || '').trim().toLowerCase();
  // Add a slide only if its body text hasn't appeared on an earlier slide.
  const add = (slide: StorySlide, dedupeText?: string) => {
    const key = norm(dedupeText);
    if (!key || seen.has(key)) return;
    seen.add(key);
    slides.push(slide);
  };
  add(
    { id: 'intro', eyebrow, title: reading.headline || (language === 'ru' ? 'Сегодня' : 'Today'), body: reading.summary },
    reading.summary || reading.headline,
  );
  add({ id: 'reading', title: language === 'ru' ? 'Подробнее' : 'More', body: reading.reading }, reading.reading);
  add({ id: 'focus', title: language === 'ru' ? 'Фокус дня' : 'Focus', body: reading.focus }, reading.focus);
  const adviceBody = reading.advice?.slice(0, 3).join('\n\n');
  add({ id: 'advice', title: language === 'ru' ? 'Совет' : 'Advice', body: adviceBody }, adviceBody);
  return slides;
}

/**
 * Fullscreen "stories" viewer: top segmented progress bars, tap right/left to go
 * forward/back, press-and-hold to pause, auto-advance, close on last + X.
 * Slides whose `loading` is true pause autoplay until their content arrives.
 */
export function StoriesViewer({
  slides,
  open,
  onClose,
  onIndexChange,
  advanceSignal,
  accent = '#111111',
  variant = 'mono',
}: {
  slides: StorySlide[];
  open: boolean;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  /** Bump this to advance past an interactive slide (e.g. after picking a sign). */
  advanceSignal?: number;
  accent?: string;
  variant?: 'mono' | 'cosmic';
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const pausedRef = useRef(false);
  const pressRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (open) { setIndex(0); setProgress(0); }
  }, [open]);

  useEffect(() => {
    if (open) onIndexChange?.(index);
  }, [index, open, onIndexChange]);

  // Advance past an interactive slide (e.g. once a sign is picked → go to the reading).
  useEffect(() => {
    if (advanceSignal) setIndex(1);
  }, [advanceSignal]);

  // Pause autoplay while the active slide is loading or interactive (picker).
  const activeSlide = slides[Math.min(index, slides.length - 1)];
  loadingRef.current = !!activeSlide?.loading || !!activeSlide?.content;

  // Auto-advance the active slide (pausable via hold or while loading).
  useEffect(() => {
    if (!open || slides.length === 0) return;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    setProgress(0);
    const tick = (t: number) => {
      if (!last) last = t;
      const dt = t - last;
      last = t;
      if (!pausedRef.current && !loadingRef.current) {
        elapsed += dt;
        const p = Math.min(1, elapsed / SLIDE_MS);
        setProgress(p);
        if (p >= 1) {
          setIndex((i) => {
            if (i < slides.length - 1) return i + 1;
            onClose();
            return i;
          });
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, open, slides.length, onClose]);

  if (!open || slides.length === 0) return null;
  const slide = slides[Math.min(index, slides.length - 1)];

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (index >= slides.length - 1) { onClose(); return; }
    setIndex(index + 1);
  };

  const onPointerDown = () => {
    pausedRef.current = true;
    pressRef.current = Date.now();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pausedRef.current = false;
    if (Date.now() - pressRef.current < TAP_MS) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width * 0.32) goPrev();
      else goNext();
    }
  };
  const release = () => { pausedRef.current = false; };

  if (typeof document === 'undefined') return null;
  const isMono = variant === 'mono';
  const backdropStyle = isMono
    ? { background: 'linear-gradient(180deg, var(--mono-plate) 0%, var(--mono-bg) 100%)' }
    : { background: `linear-gradient(160deg, ${accent} 0%, #14111C 72%)` };
  const eyebrowClass = isMono ? 'text-mono-muted' : 'text-white/70';
  const titleClass = isMono ? 'text-mono-ink' : 'text-white';
  const bodyClass = isMono ? 'text-mono-muted' : 'text-white/85';
  const progressTrack = isMono ? 'bg-mono-line' : 'bg-white/25';
  const progressFill = isMono ? 'bg-mono-black' : 'bg-white';
  const closeBtnClass = isMono
    ? 'bg-mono-plate text-mono-ink'
    : 'bg-white/15 text-white';
  const skeletonClass = isMono ? 'bg-mono-line' : 'bg-white/25';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0" style={backdropStyle} />

          {/* Tap + hold surface (disabled on an interactive slide) */}
          <div
            className="absolute inset-0 z-10"
            style={{ pointerEvents: slide.content ? 'none' : 'auto' }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={release}
            onPointerCancel={release}
          />

          {/* Content */}
          <div
            className={`absolute inset-0 z-20 flex flex-col justify-center px-6 ${slide.content ? '' : 'pointer-events-none'}`}
            style={{
              paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px), 24px) + 92px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {slide.content ? (
                  slide.content
                ) : (
                  <>
                    {slide.eyebrow ? (
                      <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${eyebrowClass}`}>{slide.eyebrow}</p>
                    ) : null}
                    {slide.title ? (
                      <h2 className={`mt-2 break-words font-lumiaHome text-[30px] font-bold leading-[1.1] ${titleClass}`}>{slide.title}</h2>
                    ) : null}
                    {slide.loading && !slide.body ? (
                      <div className="mt-3 space-y-2" aria-busy="true">
                        <div className={`h-3 w-full animate-pulse rounded-full ${skeletonClass}`} />
                        <div className={`h-3 w-11/12 animate-pulse rounded-full ${skeletonClass}`} />
                        <div className={`h-3 w-3/4 animate-pulse rounded-full ${skeletonClass}`} />
                      </div>
                    ) : slide.body ? (
                      <p className={`mt-3 whitespace-pre-line break-words text-[16px] leading-relaxed ${bodyClass}`}>{slide.body}</p>
                    ) : null}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress bars — below Telegram's top controls */}
          <div
            className="absolute left-0 right-0 z-30 flex gap-1 px-3"
            style={{ top: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px), 24px) + 30px)' }}
          >
            {slides.map((s, i) => (
              <div key={s.id} className={`h-[3px] flex-1 overflow-hidden rounded-full ${progressTrack}`}>
                <div
                  className={`h-full rounded-full ${progressFill}`}
                  style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}
                />
              </div>
            ))}
          </div>

          {/* Close — below Telegram's controls */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`absolute right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full ${closeBtnClass}`}
            style={{ top: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px), 24px) + 48px)' }}
          >
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
