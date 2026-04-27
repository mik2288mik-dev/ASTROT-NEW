import React, { memo, useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import type { NatalChartMode, UserProfile } from '../../types';
import { cn } from '../../lib/cn';

type NatalGatewayCarouselProps = {
  profile: UserProfile;
  onOpenMode: (mode: NatalChartMode) => void;
};

type GatewayCard = {
  mode: NatalChartMode;
  kicker: string;
  title: string;
  subtitle: string;
  cta: string;
  chips: string[];
  image: string;
  tone: 'light' | 'dark';
};

export const NatalGatewayCarousel = memo<NatalGatewayCarouselProps>(({ profile, onOpenMode }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const language = profile.language === 'en' ? 'en' : 'ru';

  const cards = useMemo<GatewayCard[]>(
    () =>
      language === 'en'
        ? [
            {
              mode: 'human',
              kicker: 'Reading',
              title: 'Personality Map',
              subtitle: 'A human reading of your character, strengths, and life themes.',
              cta: 'Open reading',
              chips: ['Portrait', 'Strengths', 'Life areas'],
              image: '/natal-gateway/personality-map.webp',
              tone: 'light',
            },
            {
              mode: 'wheel',
              kicker: 'Interactive',
              title: 'Natal Wheel',
              subtitle: 'Signs, planets, and aspects arranged on your personal chart.',
              cta: 'Open wheel',
              chips: ['Planets', 'Aspects', 'Signs'],
              image: '/natal-gateway/natal-wheel.webp',
              tone: 'dark',
            },
          ]
        : [
            {
              mode: 'human',
              kicker: 'Разбор',
              title: 'Карта личности',
              subtitle: 'Живой разбор характера, силы и жизненных сфер.',
              cta: 'Открыть разбор',
              chips: ['Портрет', 'Сильные стороны', 'Сферы жизни'],
              image: '/natal-gateway/personality-map.webp',
              tone: 'light',
            },
            {
              mode: 'wheel',
              kicker: 'Интерактив',
              title: 'Натальный круг',
              subtitle: 'Знаки, планеты и аспекты на вашей карте.',
              cta: 'Открыть круг',
              chips: ['Планеты', 'Аспекты', 'Знаки'],
              image: '/natal-gateway/natal-wheel.webp',
              tone: 'dark',
            },
          ],
    [language]
  );

  const activeCard = cards[activeIndex];

  const goToIndex = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(cards.length - 1, nextIndex));
    setActiveIndex(clamped);
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -42 || info.velocity.x < -360) {
      goToIndex(activeIndex + 1);
    } else if (info.offset.x > 42 || info.velocity.x > 360) {
      goToIndex(activeIndex - 1);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-3 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-gold">
              {language === 'en' ? 'Natal map' : 'Натальная карта'}
            </p>
            <h2 className="serif mt-1 text-[2rem] leading-none text-text-main">
              {language === 'en' ? 'Choose your path' : 'Выберите путь'}
            </h2>
          </div>
          <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/75 text-[#7B5EA7] shadow-[0_12px_24px_rgba(31,41,55,0.08)] ring-1 ring-black/[0.05]">
            <Sparkles size={18} strokeWidth={1.7} />
          </span>
        </div>
        <p className="mt-2 max-w-[20rem] text-[13px] leading-relaxed text-text-muted">
          {language === 'en'
            ? 'A calm reading first, or the visual wheel when you want to see the mechanics.'
            : 'Сначала живой разбор, или сразу визуальный круг, где видна механика карты.'}
        </p>
      </div>

      <div className="relative min-h-[25.5rem] flex-1 overflow-hidden px-3 pb-3">
        <div className="relative h-full min-h-[25.5rem]">
          {cards.map((card, index) => {
            const offset = index - activeIndex;
            const isActive = offset === 0;
            const x = offset === 0 ? '0%' : offset > 0 ? 'calc(100% - 42px)' : 'calc(-100% + 42px)';
            const textIsLight = card.tone === 'dark';

            return (
              <motion.button
                key={card.mode}
                type="button"
                drag={isActive ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.13}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (isActive) onOpenMode(card.mode);
                  else goToIndex(index);
                }}
                initial={false}
                animate={{
                  x,
                  scale: isActive ? 1 : 0.925,
                  opacity: isActive ? 1 : 0.72,
                  filter: isActive ? 'blur(0px)' : 'blur(0.2px)',
                }}
                whileTap={isActive && !shouldReduceMotion ? { scale: 0.985 } : undefined}
                transition={{
                  duration: shouldReduceMotion ? 0.12 : 0.38,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  'absolute inset-y-0 left-0 w-[calc(100%-42px)] overflow-hidden rounded-[34px] text-left',
                  'shadow-[0_24px_54px_rgba(31,41,55,0.14)] outline-none ring-1 ring-black/[0.05]',
                  'focus-visible:ring-2 focus-visible:ring-[#7B5EA7]/45'
                )}
                style={{ zIndex: isActive ? 2 : 1 }}
              >
                <img
                  src={card.image}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
                <span
                  className={cn(
                    'absolute inset-0',
                    card.tone === 'dark'
                      ? 'bg-[linear-gradient(90deg,rgba(5,12,28,0.82)_0%,rgba(5,12,28,0.56)_43%,rgba(5,12,28,0.08)_100%)]'
                      : 'bg-[linear-gradient(90deg,rgba(255,252,245,0.92)_0%,rgba(255,252,245,0.72)_45%,rgba(255,252,245,0.12)_100%)]'
                  )}
                />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/28 to-transparent" />
                <span className="relative z-10 flex h-full flex-col justify-between p-5">
                  <span>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                        textIsLight ? 'bg-white/14 text-white/82 ring-1 ring-white/20' : 'bg-white/70 text-[#7B5EA7] ring-1 ring-black/[0.04]'
                      )}
                    >
                      {card.kicker}
                    </span>
                    <span
                      className={cn(
                        'serif mt-4 block max-w-[13.5rem] text-[2.45rem] leading-[0.96]',
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
                            textIsLight ? 'bg-white/12 text-white/78 ring-1 ring-white/15' : 'bg-white/66 text-[#4b4652] ring-1 ring-black/[0.04]'
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
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2">
        <div className="flex items-center gap-2">
          {cards.map((card, index) => (
            <button
              key={`dot-${card.mode}`}
              type="button"
              onClick={() => goToIndex(index)}
              className={cn(
                'h-2 rounded-full transition-all',
                index === activeIndex ? 'w-7 bg-[#1f1f1f]' : 'w-2 bg-black/15'
              )}
              aria-label={card.title}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onOpenMode(activeCard.mode)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-text-main shadow-[0_14px_28px_rgba(31,41,55,0.08)] ring-1 ring-black/[0.06] transition active:scale-[0.98]"
        >
          {activeCard.cta}
          <ArrowRight size={15} strokeWidth={2.1} />
        </button>
      </div>
    </div>
  );
});

NatalGatewayCarousel.displayName = 'NatalGatewayCarousel';
