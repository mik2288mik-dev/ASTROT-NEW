import React, { useEffect, useRef, useState } from 'react';
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
  if (reading.headline || reading.summary) {
    slides.push({ id: 'intro', eyebrow, title: reading.headline || (language === 'ru' ? 'Сегодня' : 'Today'), body: reading.summary });
  }
  if (reading.reading) slides.push({ id: 'reading', title: language === 'ru' ? 'Подробнее' : 'More', body: reading.reading });
  if (reading.focus) slides.push({ id: 'focus', title: language === 'ru' ? 'Фокус дня' : 'Focus', body: reading.focus });
  if (reading.advice?.length) {
    slides.push({ id: 'advice', title: language === 'ru' ? 'Совет' : 'Advice', body: reading.advice.slice(0, 3).join('\n\n') });
  }
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
  accent = '#7559CF',
}: {
  slides: StorySlide[];
  open: boolean;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  accent?: string;
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

  // Mirror the active slide's loading flag so the rAF loop can read it.
  loadingRef.current = !!slides[Math.min(index, slides.length - 1)]?.loading;

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${accent} 0%, #14111C 72%)` }} />

          {/* Tap + hold surface */}
          <div
            className="absolute inset-0 z-10"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={release}
            onPointerCancel={release}
          />

          {/* Content (taps pass through to the surface) */}
          <div
            className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end px-6"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 76px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 52px)',
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
                {slide.eyebrow ? (
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">{slide.eyebrow}</p>
                ) : null}
                {slide.title ? (
                  <h2 className="mt-2 break-words font-lumiaHomeDisplay text-[30px] font-bold leading-[1.1] text-white">{slide.title}</h2>
                ) : null}
                {slide.loading && !slide.body ? (
                  <div className="mt-3 space-y-2" aria-busy="true">
                    <div className="h-3 w-full animate-pulse rounded-full bg-white/25" />
                    <div className="h-3 w-11/12 animate-pulse rounded-full bg-white/20" />
                    <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/15" />
                  </div>
                ) : slide.body ? (
                  <p className="mt-3 whitespace-pre-line break-words text-[16px] leading-relaxed text-white/85">{slide.body}</p>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress bars */}
          <div
            className="absolute left-0 right-0 z-30 flex gap-1 px-3"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
          >
            {slides.map((s, i) => (
              <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}
                />
              </div>
            ))}
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
          >
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
