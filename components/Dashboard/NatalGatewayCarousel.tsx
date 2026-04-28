import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'framer-motion';
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

const SLIDE_OFFSETS = [-1, 0, 1] as const;

function mod(value: number, total: number) {
  return ((value % total) + total) % total;
}

function shortestDelta(from: number, to: number, total: number) {
  let delta = mod(to - from, total);
  if (delta > total / 2) delta -= total;
  return delta;
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

function slideOverlayClass(tone: GatewayCard['tone']) {
  if (tone === 'dark') {
    return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.22)_24%,rgba(7,13,28,0.18)_48%,rgba(5,9,20,0.88)_100%)]';
  }
  if (tone === 'rose') {
    return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,250,247,0.34)_31%,rgba(89,54,72,0.14)_56%,rgba(255,242,237,0.92)_100%)]';
  }
  if (tone === 'sky') {
    return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.80)_0%,rgba(246,249,255,0.30)_30%,rgba(93,132,178,0.13)_58%,rgba(248,251,255,0.93)_100%)]';
  }
  return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,252,245,0.36)_30%,rgba(255,252,245,0.16)_58%,rgba(255,250,242,0.95)_100%)]';
}

function textClass(tone: GatewayCard['tone']) {
  return tone === 'dark' ? 'text-white' : 'text-[#202024]';
}

function mutedTextClass(tone: GatewayCard['tone']) {
  return tone === 'dark' ? 'text-white/78' : 'text-[#4f4c50]';
}

type GatewaySlideProps = {
  card: GatewayCard;
  offset: number;
  viewportWidth: number;
  dragX: MotionValue<number>;
  onOpen: (card: GatewayCard) => void;
};

const GatewaySlide = memo<GatewaySlideProps>(({ card, offset, viewportWidth, dragX, onOpen }) => {
  const x = useTransform(dragX, (latest) => latest + offset * viewportWidth);
  const imageX = useTransform(dragX, (latest) => (latest / Math.max(viewportWidth, 1)) * -26 - offset * 10);
  const contentX = useTransform(dragX, (latest) => (latest / Math.max(viewportWidth, 1)) * -30);
  const contentOpacity = useTransform(
    dragX,
    [-viewportWidth * 0.58, 0, viewportWidth * 0.58],
    [0.38, 1, 0.38]
  );
  const textIsLight = card.tone === 'dark';

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{
        x,
        zIndex: offset === 0 ? 30 : 10,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
      aria-hidden={offset !== 0}
    >
      <motion.img
        src={card.image}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.06] object-cover"
        style={{ x: imageX, willChange: 'transform' }}
      />
      <div className={cn('pointer-events-none absolute inset-0', slideOverlayClass(card.tone))} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[13.25rem] bg-gradient-to-b from-white/92 via-white/58 to-transparent" />

      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-6 pb-[calc(1.35rem+max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))]"
        style={{ x: contentX, opacity: contentOpacity }}
      >
        <div className="mx-auto max-w-[23rem]">
          <p
            className={cn(
              'mb-3 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur-xl',
              textIsLight
                ? 'bg-white/12 text-white/82 ring-1 ring-white/18'
                : 'bg-white/58 text-[#7B5EA7] ring-1 ring-black/[0.04]'
            )}
          >
            {card.kicker}
          </p>

          <h2
            className={cn(
              'serif mb-4 max-w-[17rem] text-[clamp(2.45rem,11.4vw,3.22rem)] leading-[0.93]',
              textClass(card.tone)
            )}
          >
            {card.title}
          </h2>
          <p className={cn('mb-5 max-w-[18.5rem] text-[15px] leading-relaxed', mutedTextClass(card.tone))}>
            {card.subtitle}
          </p>

          <div className="mb-5 flex max-w-[20rem] flex-wrap gap-1.5">
            {card.chips.map((chip) => (
              <span
                key={chip}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-xl',
                  textIsLight
                    ? 'bg-white/12 text-white/78 ring-1 ring-white/15'
                    : 'bg-white/56 text-[#4b4652] ring-1 ring-black/[0.04]'
                )}
              >
                {chip}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpen(card)}
            className={cn(
              'pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-transform active:scale-[0.98]',
              textIsLight
                ? 'bg-white text-[#14213D] shadow-[0_16px_28px_rgba(0,0,0,0.18)]'
                : 'bg-[#1f1f1f] text-white shadow-[0_16px_28px_rgba(31,31,31,0.16)]'
            )}
          >
            {card.cta}
            <ArrowRight size={16} strokeWidth={2.1} />
          </button>
        </div>
      </motion.div>
    </motion.section>
  );
});

GatewaySlide.displayName = 'GatewaySlide';

export const NatalGatewayCarousel = memo<NatalGatewayCarouselProps>(
  ({ profile, onOpenMode, onOpenSynastry, onOpenHoroscope }) => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const activeIndexRef = useRef(0);
    const animationRef = useRef<{ stop: () => void } | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [viewportWidth, setViewportWidth] = useState(390);
    const dragX = useMotionValue(0);
    const shouldReduceMotion = useReducedMotion();
    const language = profile.language === 'en' ? 'en' : 'ru';

    const cards = useMemo<GatewayCard[]>(
      () =>
        language === 'en'
          ? [
              {
                id: 'human',
                kicker: 'Your chart',
                title: 'Your Natal Map',
                subtitle: 'A deep reading of your character, strengths, and life areas.',
                cta: 'Open map',
                chips: ['Portrait', 'Strength', 'Life areas'],
                image: '/natal-gateway/personality-map.webp',
                tone: 'light',
                action: () => onOpenMode('human'),
              },
              {
                id: 'wheel',
                kicker: 'Planets',
                title: 'Natal Wheel',
                subtitle: 'The planet layout from the moment you were born.',
                cta: 'Open wheel',
                chips: ['Signs', 'Planets', 'Aspects'],
                image: '/natal-gateway/natal-wheel.webp',
                tone: 'dark',
                action: () => onOpenMode('wheel'),
              },
              {
                id: 'synastry',
                kicker: 'Connection',
                title: 'Bond Map',
                subtitle: 'How two charts sound together: attraction, closeness, and growth.',
                cta: 'Open bond',
                chips: ['Attraction', 'Dialogue', 'Closeness'],
                image: '/natal-gateway/synastry-union.webp',
                tone: 'rose',
                action: onOpenSynastry,
              },
              {
                id: 'horoscope',
                kicker: 'Today',
                title: 'Today by Your Chart',
                subtitle: 'A personal focus of the day based on your natal map.',
                cta: 'Open today',
                chips: ['Focus', 'Advice', 'Energy'],
                image: '/natal-gateway/daily-horoscope.webp',
                tone: 'sky',
                action: onOpenHoroscope,
              },
            ]
          : [
              {
                id: 'human',
                kicker: 'Твоя карта',
                title: 'Твоя натальная карта',
                subtitle: 'Глубокий разбор характера, сильных сторон и жизненных сфер.',
                cta: 'Открыть карту',
                chips: ['Портрет', 'Сила', 'Сферы жизни'],
                image: '/natal-gateway/personality-map.webp',
                tone: 'light',
                action: () => onOpenMode('human'),
              },
              {
                id: 'wheel',
                kicker: 'Планеты',
                title: 'Натальный круг',
                subtitle: 'Расположение планет в момент твоего рождения.',
                cta: 'Открыть круг',
                chips: ['Знаки', 'Планеты', 'Аспекты'],
                image: '/natal-gateway/natal-wheel.webp',
                tone: 'dark',
                action: () => onOpenMode('wheel'),
              },
              {
                id: 'synastry',
                kicker: 'Связь',
                title: 'Карта связи',
                subtitle: 'Как ваши карты звучат вместе: притяжение, близость и точки роста.',
                cta: 'Открыть связь',
                chips: ['Притяжение', 'Диалог', 'Близость'],
                image: '/natal-gateway/synastry-union.webp',
                tone: 'rose',
                action: onOpenSynastry,
              },
              {
                id: 'horoscope',
                kicker: 'Сегодня',
                title: 'Сегодня по карте',
                subtitle: 'Личный фокус дня по твоей натальной карте.',
                cta: 'Открыть день',
                chips: ['Фокус', 'Совет', 'Энергия'],
                image: '/natal-gateway/daily-horoscope.webp',
                tone: 'sky',
                action: onOpenHoroscope,
              },
            ],
      [language, onOpenHoroscope, onOpenMode, onOpenSynastry]
    );

    useEffect(() => {
      const node = rootRef.current;
      if (!node) return;

      const updateWidth = () => setViewportWidth(Math.max(node.getBoundingClientRect().width, 320));
      updateWidth();
      const observer = new ResizeObserver(updateWidth);
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    const commitIndex = (nextIndex: number) => {
      const resolved = mod(nextIndex, cards.length);
      activeIndexRef.current = resolved;
      setActiveIndex(resolved);
      dragX.set(0);
    };

    const settle = (direction: -1 | 0 | 1, velocity = 0) => {
      animationRef.current?.stop();

      if (direction !== 0) hapticSelection();

      if (shouldReduceMotion) {
        commitIndex(activeIndexRef.current + direction);
        return;
      }

      const targetX = direction === 0 ? 0 : -direction * viewportWidth;
      animationRef.current = animate(dragX, targetX, {
        type: 'spring',
        stiffness: direction === 0 ? 300 : 238,
        damping: direction === 0 ? 32 : 29,
        mass: 0.88,
        velocity,
        onComplete: () => commitIndex(activeIndexRef.current + direction),
      });
    };

    const handleDragStart = () => {
      animationRef.current?.stop();
    };

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = viewportWidth * 0.16;
      const direction =
        info.offset.x < -threshold || info.velocity.x < -420
          ? 1
          : info.offset.x > threshold || info.velocity.x > 420
            ? -1
            : 0;
      settle(direction, info.velocity.x);
    };

    const moveToIndex = (index: number) => {
      const delta = shortestDelta(activeIndexRef.current, index, cards.length);
      if (delta === 0) return;
      if (Math.abs(delta) === 1 || Math.abs(delta) === cards.length - 1) {
        settle(delta > 0 ? 1 : -1);
        return;
      }
      hapticSelection();
      commitIndex(index);
    };

    const openCard = (card: GatewayCard) => {
      hapticImpact();
      card.action();
    };

    return (
      <div ref={rootRef} className="absolute inset-0 z-0 overflow-hidden bg-[#f7f4ef]">
        {SLIDE_OFFSETS.map((offset) => {
          const card = cards[mod(activeIndex + offset, cards.length)];
          return (
            <GatewaySlide
              key={`${activeIndex}-${offset}`}
              card={card}
              offset={offset}
              viewportWidth={viewportWidth}
              dragX={dragX}
              onOpen={openCard}
            />
          );
        })}

        <motion.div
          drag={shouldReduceMotion ? false : 'x'}
          dragConstraints={{ left: -viewportWidth, right: viewportWidth }}
          dragElastic={0.035}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{ touchAction: 'pan-y' }}
          className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(0.58rem+max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))] z-40 flex items-center justify-center gap-2">
          {cards.map((card, index) => (
            <button
              key={`dot-${card.id}`}
              type="button"
              onClick={() => moveToIndex(index)}
              className={cn(
                'pointer-events-auto h-2 rounded-full bg-black/22 transition-all duration-300',
                index === activeIndex ? 'w-7 bg-[#1f1f1f]' : 'w-2'
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
