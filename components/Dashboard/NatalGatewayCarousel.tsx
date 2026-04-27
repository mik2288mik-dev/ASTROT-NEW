import React, { memo, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
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

const COVERFLOW_OFFSETS = [-2, -1, 0, 1, 2] as const;

function mod(value: number, total: number) {
  return ((value % total) + total) % total;
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

function getCoverflowMotion(offset: number) {
  const side = Math.sign(offset);
  const abs = Math.abs(offset);

  if (abs === 0) {
    return {
      x: 'calc(-50% + 0px)',
      y: 0,
      scale: 1,
      rotateY: 0,
      opacity: 1,
      zIndex: 40,
      filter: 'blur(0px)',
    };
  }

  if (abs === 1) {
    return {
      x: `calc(-50% + ${side * 184}px)`,
      y: 16,
      scale: 0.88,
      rotateY: side * -11,
      opacity: 0.68,
      zIndex: 24,
      filter: 'blur(0.15px)',
    };
  }

  return {
    x: `calc(-50% + ${side * 292}px)`,
    y: 34,
    scale: 0.76,
    rotateY: side * -18,
    opacity: 0.2,
    zIndex: 8,
    filter: 'blur(0.7px)',
  };
}

function overlayClass(tone: GatewayCard['tone']) {
  if (tone === 'dark') {
    return 'bg-[linear-gradient(90deg,rgba(5,12,28,0.84)_0%,rgba(5,12,28,0.58)_43%,rgba(5,12,28,0.10)_100%)]';
  }
  if (tone === 'rose') {
    return 'bg-[linear-gradient(90deg,rgba(255,250,246,0.93)_0%,rgba(255,241,235,0.68)_45%,rgba(117,78,96,0.10)_100%)]';
  }
  if (tone === 'sky') {
    return 'bg-[linear-gradient(90deg,rgba(255,252,244,0.93)_0%,rgba(243,247,255,0.70)_45%,rgba(133,173,218,0.10)_100%)]';
  }
  return 'bg-[linear-gradient(90deg,rgba(255,252,245,0.94)_0%,rgba(255,252,245,0.72)_45%,rgba(255,252,245,0.12)_100%)]';
}

export const NatalGatewayCarousel = memo<NatalGatewayCarouselProps>(
  ({ profile, onOpenMode, onOpenSynastry, onOpenHoroscope }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const lastDragAtRef = useRef(0);
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

    const moveTo = (nextIndex: number) => {
      setActiveIndex((current) => {
        const resolved = mod(nextIndex, cards.length);
        if (resolved !== current) hapticSelection();
        return resolved;
      });
    };

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const shouldGoNext = info.offset.x < -52 || info.velocity.x < -420;
      const shouldGoPrev = info.offset.x > 52 || info.velocity.x > 420;
      if (!shouldGoNext && !shouldGoPrev) return;

      lastDragAtRef.current = Date.now();
      moveTo(activeIndex + (shouldGoNext ? 1 : -1));
    };

    const openCard = (card: GatewayCard, offset: number) => {
      if (Date.now() - lastDragAtRef.current < 180) return;
      if (offset !== 0) {
        moveTo(activeIndex + offset);
        return;
      }

      hapticImpact();
      card.action();
    };

    return (
      <div className="relative flex min-h-[29.5rem] flex-1 flex-col overflow-hidden pb-2 pt-1">
        <motion.div
          drag={shouldReduceMotion ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.11}
          onDragEnd={handleDragEnd}
          className="relative min-h-[26.5rem] flex-1 overflow-visible px-4 [perspective:1200px]"
          style={{ touchAction: 'pan-y' }}
        >
          {COVERFLOW_OFFSETS.map((offset) => {
            const cardIndex = mod(activeIndex + offset, cards.length);
            const card = cards[cardIndex];
            const motionState = getCoverflowMotion(offset);
            const isActive = offset === 0;
            const textIsLight = card.tone === 'dark';

            return (
              <motion.button
                key={`${card.id}-${offset}`}
                type="button"
                onClick={() => openCard(card, offset)}
                initial={false}
                animate={motionState}
                whileTap={isActive && !shouldReduceMotion ? { scale: 0.975 } : undefined}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.38,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  'absolute left-1/2 top-2 h-[min(54dvh,28rem)] min-h-[23rem] max-h-[28.5rem] w-[min(78vw,21rem)] overflow-hidden rounded-[32px] text-left outline-none',
                  'ring-1 ring-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#7B5EA7]/45',
                  isActive
                    ? 'shadow-[0_24px_54px_rgba(31,41,55,0.15)]'
                    : 'shadow-[0_14px_30px_rgba(31,41,55,0.10)]'
                )}
                style={{
                  transformStyle: 'preserve-3d',
                  transformOrigin: '50% 58%',
                }}
                aria-label={card.title}
              >
                <img
                  src={card.image}
                  alt=""
                  draggable={false}
                  className={cn(
                    'pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out',
                    isActive ? 'scale-100' : 'scale-[1.04]'
                  )}
                />
                <span className={cn('absolute inset-0', overlayClass(card.tone))} />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/28 to-transparent" />
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
                        'serif mt-4 block max-w-[13.5rem] text-[clamp(2.1rem,9vw,2.52rem)] leading-[0.96]',
                        textIsLight ? 'text-white' : 'text-[#202024]'
                      )}
                    >
                      {card.title}
                    </span>
                    <span
                      className={cn(
                        'mt-4 block max-w-[14.5rem] text-[14px] leading-relaxed',
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
        </motion.div>

        <div className="flex shrink-0 items-center justify-center gap-2 pb-2 pt-1">
          {cards.map((card, index) => (
            <button
              key={`dot-${card.id}`}
              type="button"
              onClick={() => moveTo(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                index === activeIndex ? 'w-7 bg-[#1f1f1f]' : 'w-2 bg-black/16'
              )}
              aria-label={card.title}
            />
          ))}
        </div>
      </div>
    );
  }
);

NatalGatewayCarousel.displayName = 'NatalGatewayCarousel';
