import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { NatalChartMode, UserProfile } from '../../types';
import { cn } from '../../lib/cn';

type NatalGatewayCarouselProps = {
  profile: UserProfile;
  onOpenMode: (mode: NatalChartMode) => void;
  onOpenSynastry: () => void;
  onOpenHoroscope: () => void;
};

type GatewayCard = {
  id: 'human' | 'wheel' | 'synastry' | 'horoscope';
  kicker: string;
  title: string;
  subtitle: string;
  cta: string;
  chips: string[];
  image: string;
  tone: 'light' | 'dark' | 'rose' | 'sky';
  action: () => void;
};

function realIndex(loopIndex: number, total: number) {
  return ((loopIndex % total) + total) % total;
}

function hapticSelection() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* Telegram haptics are optional */
  }
}

function hapticImpact() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
  } catch {
    /* Telegram haptics are optional */
  }
}

export const NatalGatewayCarousel = memo<NatalGatewayCarouselProps>(
  ({ profile, onOpenMode, onOpenSynastry, onOpenHoroscope }) => {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const scrollEndRef = useRef<number | null>(null);
    const frameRef = useRef<number | null>(null);
    const loopIndexRef = useRef(0);
    const activeIndexRef = useRef(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const shouldReduceMotion = useReducedMotion();
    const language = profile.language === 'en' ? 'en' : 'ru';

    const cards = useMemo<GatewayCard[]>(
      () =>
        language === 'en'
          ? [
              {
                id: 'human',
                kicker: 'Reading',
                title: 'Personality Map',
                subtitle: 'A human reading of your character, strengths, and life themes.',
                cta: 'Open reading',
                chips: ['Portrait', 'Strengths', 'Life areas'],
                image: '/natal-gateway/personality-map.webp',
                tone: 'light',
                action: () => onOpenMode('human'),
              },
              {
                id: 'wheel',
                kicker: 'Interactive',
                title: 'Natal Wheel',
                subtitle: 'Signs, planets, and aspects arranged on your personal chart.',
                cta: 'Open wheel',
                chips: ['Planets', 'Aspects', 'Signs'],
                image: '/natal-gateway/natal-wheel.webp',
                tone: 'dark',
                action: () => onOpenMode('wheel'),
              },
              {
                id: 'synastry',
                kicker: 'Union',
                title: 'Synastry',
                subtitle: 'How two charts sound together: attraction, closeness, and growth points.',
                cta: 'Open union',
                chips: ['Compatibility', 'Attraction', 'Dialogue'],
                image: '/natal-gateway/synastry-union.webp',
                tone: 'rose',
                action: onOpenSynastry,
              },
              {
                id: 'horoscope',
                kicker: 'Today',
                title: 'Horoscope',
                subtitle: 'A personal daily focus for choices, timing, and calm action.',
                cta: 'Open forecast',
                chips: ['Today', 'Focus', 'Advice'],
                image: '/natal-gateway/daily-horoscope.webp',
                tone: 'sky',
                action: onOpenHoroscope,
              },
            ]
          : [
              {
                id: 'human',
                kicker: 'Разбор',
                title: 'Карта личности',
                subtitle: 'Живой разбор характера, силы и жизненных сфер.',
                cta: 'Открыть разбор',
                chips: ['Портрет', 'Сильные стороны', 'Сферы жизни'],
                image: '/natal-gateway/personality-map.webp',
                tone: 'light',
                action: () => onOpenMode('human'),
              },
              {
                id: 'wheel',
                kicker: 'Интерактив',
                title: 'Натальный круг',
                subtitle: 'Знаки, планеты и аспекты на вашей карте.',
                cta: 'Открыть круг',
                chips: ['Планеты', 'Аспекты', 'Знаки'],
                image: '/natal-gateway/natal-wheel.webp',
                tone: 'dark',
                action: () => onOpenMode('wheel'),
              },
              {
                id: 'synastry',
                kicker: 'Союз',
                title: 'Синастрия',
                subtitle: 'Как ваши карты звучат вместе: притяжение, близость и точки роста.',
                cta: 'Открыть союз',
                chips: ['Совместимость', 'Притяжение', 'Диалог'],
                image: '/natal-gateway/synastry-union.webp',
                tone: 'rose',
                action: onOpenSynastry,
              },
              {
                id: 'horoscope',
                kicker: 'Сегодня',
                title: 'Гороскоп',
                subtitle: 'Персональный фокус дня: где действовать мягче, точнее и спокойнее.',
                cta: 'Открыть прогноз',
                chips: ['Сегодня', 'Фокус', 'Совет'],
                image: '/natal-gateway/daily-horoscope.webp',
                tone: 'sky',
                action: onOpenHoroscope,
              },
            ],
      [language, onOpenHoroscope, onOpenMode, onOpenSynastry]
    );

    const loopCards = useMemo(
      () => [...cards, ...cards, ...cards].map((card, loopIndex) => ({ card, loopIndex })),
      [cards]
    );

    const scrollToLoopIndex = useCallback((nextLoopIndex: number, behavior: ScrollBehavior = 'smooth') => {
      const track = trackRef.current;
      const target = track?.children[nextLoopIndex] as HTMLElement | undefined;
      if (!track || !target) return;
      const left = target.offsetLeft - (track.clientWidth - target.clientWidth) / 2;
      track.scrollTo({ left, behavior });
      loopIndexRef.current = nextLoopIndex;
    }, []);

    useEffect(() => {
      const startIndex = cards.length;
      loopIndexRef.current = startIndex;
      activeIndexRef.current = 0;
      setActiveIndex(0);
      window.setTimeout(() => scrollToLoopIndex(startIndex, 'auto'), 0);
    }, [cards.length, scrollToLoopIndex]);

    useEffect(() => {
      return () => {
        if (scrollEndRef.current) window.clearTimeout(scrollEndRef.current);
        if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      };
    }, []);

    const updateNearestCard = useCallback(() => {
      const track = trackRef.current;
      if (!track) return;

      const center = track.scrollLeft + track.clientWidth / 2;
      let nearestLoopIndex = loopIndexRef.current;
      let nearestDistance = Number.POSITIVE_INFINITY;

      Array.from(track.children).forEach((child, index) => {
        const item = child as HTMLElement;
        const itemCenter = item.offsetLeft + item.clientWidth / 2;
        const distance = Math.abs(itemCenter - center);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestLoopIndex = index;
        }
      });

      const nextActiveIndex = realIndex(nearestLoopIndex, cards.length);
      loopIndexRef.current = nearestLoopIndex;

      if (nextActiveIndex !== activeIndexRef.current) {
        activeIndexRef.current = nextActiveIndex;
        setActiveIndex(nextActiveIndex);
        hapticSelection();
      }
    }, [cards.length]);

    const recenterIfNeeded = useCallback(() => {
      const total = cards.length;
      const current = loopIndexRef.current;
      if (current < total) {
        scrollToLoopIndex(current + total, 'auto');
      } else if (current >= total * 2) {
        scrollToLoopIndex(current - total, 'auto');
      }
    }, [cards.length, scrollToLoopIndex]);

    const handleScroll = useCallback(() => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(updateNearestCard);

      if (scrollEndRef.current) window.clearTimeout(scrollEndRef.current);
      scrollEndRef.current = window.setTimeout(recenterIfNeeded, 130);
    }, [recenterIfNeeded, updateNearestCard]);

    const openCard = (card: GatewayCard, loopIndex: number) => {
      if (loopIndex !== loopIndexRef.current) {
        hapticSelection();
        scrollToLoopIndex(loopIndex);
        return;
      }
      hapticImpact();
      card.action();
    };

    const overlayClass = (tone: GatewayCard['tone']) => {
      if (tone === 'dark') {
        return 'bg-[linear-gradient(90deg,rgba(5,12,28,0.84)_0%,rgba(5,12,28,0.58)_43%,rgba(5,12,28,0.10)_100%)]';
      }
      if (tone === 'rose') {
        return 'bg-[linear-gradient(90deg,rgba(255,250,246,0.92)_0%,rgba(255,241,235,0.68)_45%,rgba(117,78,96,0.10)_100%)]';
      }
      if (tone === 'sky') {
        return 'bg-[linear-gradient(90deg,rgba(255,252,244,0.92)_0%,rgba(243,247,255,0.70)_45%,rgba(133,173,218,0.10)_100%)]';
      }
      return 'bg-[linear-gradient(90deg,rgba(255,252,245,0.94)_0%,rgba(255,252,245,0.72)_45%,rgba(255,252,245,0.12)_100%)]';
    };

    return (
      <div className="relative flex h-full min-h-[34rem] flex-col overflow-hidden pb-2 pt-1">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="scrollbar-hide flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-6 pb-5 pt-1"
          style={{
            scrollBehavior: shouldReduceMotion ? 'auto' : 'smooth',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x',
          }}
        >
          {loopCards.map(({ card, loopIndex }) => {
            const isActive = activeIndex === realIndex(loopIndex, cards.length);
            const textIsLight = card.tone === 'dark';
            return (
              <motion.button
                key={`${card.id}-${loopIndex}`}
                type="button"
                onClick={() => openCard(card, loopIndex)}
                whileTap={!shouldReduceMotion ? { scale: 0.985 } : undefined}
                animate={{
                  scale: isActive ? 1 : 0.94,
                  opacity: isActive ? 1 : 0.76,
                }}
                transition={{ duration: shouldReduceMotion ? 0.08 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'relative my-1 h-[calc(100%-0.5rem)] min-h-[31.5rem] basis-[84%] shrink-0 snap-center overflow-hidden rounded-[34px] text-left outline-none',
                  'ring-1 ring-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#7B5EA7]/45',
                  isActive
                    ? 'shadow-[0_24px_54px_rgba(31,41,55,0.15)]'
                    : 'shadow-[0_16px_34px_rgba(31,41,55,0.10)]'
                )}
              >
                <img
                  src={card.image}
                  alt=""
                  draggable={false}
                  className={cn(
                    'pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out',
                    isActive ? 'scale-100' : 'scale-[1.035]'
                  )}
                />
                <span className={cn('absolute inset-0', overlayClass(card.tone))} />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/28 to-transparent" />
                <span className="relative z-10 flex h-full flex-col justify-between p-5">
                  <span>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                        textIsLight
                          ? 'bg-white/14 text-white/84 ring-1 ring-white/20'
                          : 'bg-white/70 text-[#7B5EA7] ring-1 ring-black/[0.04]'
                      )}
                    >
                      {card.kicker}
                    </span>
                    <span
                      className={cn(
                        'serif mt-4 block max-w-[13.8rem] text-[2.45rem] leading-[0.96]',
                        textIsLight ? 'text-white' : 'text-[#202024]'
                      )}
                    >
                      {card.title}
                    </span>
                    <span
                      className={cn(
                        'mt-4 block max-w-[14.75rem] text-[14px] leading-relaxed',
                        textIsLight ? 'text-white/78' : 'text-[#4b4b50]'
                      )}
                    >
                      {card.subtitle}
                    </span>
                  </span>

                  <span>
                    <span className="mb-4 flex flex-wrap gap-1.5">
                      {card.chips.map((chip) => (
                        <span
                          key={chip}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-medium',
                            textIsLight
                              ? 'bg-white/12 text-white/78 ring-1 ring-white/15'
                              : 'bg-white/66 text-[#4b4652] ring-1 ring-black/[0.04]'
                          )}
                        >
                          {chip}
                        </span>
                      ))}
                    </span>
                    <span
                      className={cn(
                        'inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold',
                        textIsLight
                          ? 'bg-white text-[#14213D] shadow-[0_12px_24px_rgba(0,0,0,0.18)]'
                          : 'bg-[#1f1f1f] text-white shadow-[0_12px_24px_rgba(31,31,31,0.16)]'
                      )}
                    >
                      {card.cta}
                      <ArrowRight size={15} strokeWidth={2.1} />
                    </span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-10 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/72 px-3 py-2 shadow-[0_12px_28px_rgba(31,41,55,0.10)] ring-1 ring-black/[0.05] backdrop-blur-xl">
            {cards.map((card, index) => (
              <button
                key={`dot-${card.id}`}
                type="button"
                onClick={() => {
                  hapticSelection();
                  activeIndexRef.current = index;
                  setActiveIndex(index);
                  scrollToLoopIndex(cards.length + index);
                }}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  index === activeIndex ? 'w-7 bg-[#1f1f1f]' : 'w-2 bg-black/16'
                )}
                aria-label={card.title}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
);

NatalGatewayCarousel.displayName = 'NatalGatewayCarousel';
