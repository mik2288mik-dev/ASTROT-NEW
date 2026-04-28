import React, { memo, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  animate,
  motion,
  useDragControls,
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

const CARD_STEP = 206;
const COVERFLOW_SLOTS = [-3, -2, -1, 0, 1, 2, 3] as const;

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

function getCoverflowVisual(relativeOffset: number) {
  const side = Math.sign(relativeOffset);
  const abs = Math.min(Math.abs(relativeOffset), 3);
  const eased = Math.pow(abs, 0.92);
  const x = side * (abs <= 1 ? CARD_STEP * eased : CARD_STEP + (abs - 1) * 118);
  const y = 24 + abs * 17;
  const scale = abs <= 1 ? 1 - abs * 0.13 : 0.87 - (abs - 1) * 0.1;
  const rotateY = side * -13 * Math.min(abs, 1.85);
  const opacity = abs <= 1 ? 1 - abs * 0.18 : abs <= 2 ? 0.82 - (abs - 1) * 0.42 : 0.09;
  const blur = abs <= 1 ? 0 : (abs - 1) * 0.45;

  return {
    x,
    y,
    scale: Math.max(scale, 0.58),
    rotateY,
    opacity: Math.max(opacity, 0),
    filter: `blur(${blur}px)`,
    zIndex: Math.round(80 - abs * 14),
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

type GatewayCardViewProps = {
  card: GatewayCard;
  loopIndex: number;
  slotOffset: number;
  progress: MotionValue<number>;
  shouldReduceMotion: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onOpen: (card: GatewayCard, slotOffset: number) => void;
};

const GatewayCardView = memo<GatewayCardViewProps>(
  ({ card, loopIndex, slotOffset, progress, shouldReduceMotion, onPointerDown, onOpen }) => {
    const textIsLight = card.tone === 'dark';
    const isCenterSlot = slotOffset === 0;
    const relativeOffset = useTransform(progress, (latest) => loopIndex - latest);
    const x = useTransform(relativeOffset, (latest) => {
      const visual = getCoverflowVisual(latest);
      return `calc(-50% + ${visual.x}px)`;
    });
    const y = useTransform(relativeOffset, (latest) => getCoverflowVisual(latest).y);
    const scale = useTransform(relativeOffset, (latest) => getCoverflowVisual(latest).scale);
    const rotateY = useTransform(relativeOffset, (latest) => getCoverflowVisual(latest).rotateY);
    const opacity = useTransform(relativeOffset, (latest) => getCoverflowVisual(latest).opacity);
    const filter = useTransform(relativeOffset, (latest) => getCoverflowVisual(latest).filter);
    const zIndex = useTransform(relativeOffset, (latest) => getCoverflowVisual(latest).zIndex);

    return (
      <motion.button
        type="button"
        onPointerDown={onPointerDown}
        onClick={() => onOpen(card, slotOffset)}
        initial={false}
        whileTap={isCenterSlot && !shouldReduceMotion ? { scale: 0.975 } : undefined}
        className={cn(
          'absolute left-1/2 top-6 h-[clamp(25rem,58dvh,30rem)] w-[min(84vw,22.5rem)] overflow-hidden rounded-[32px] text-left outline-none',
          'ring-1 ring-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#7B5EA7]/45',
          isCenterSlot
            ? 'shadow-[0_26px_58px_rgba(31,41,55,0.16)]'
            : 'shadow-[0_14px_32px_rgba(31,41,55,0.10)]'
        )}
        style={{
          x,
          y,
          scale,
          rotateY,
          opacity,
          filter,
          zIndex,
          pointerEvents: Math.abs(slotOffset) <= 2 ? 'auto' : 'none',
          transformStyle: 'preserve-3d',
          transformOrigin: '50% 58%',
          willChange: 'transform, opacity, filter',
        }}
        tabIndex={isCenterSlot ? 0 : -1}
        aria-label={card.title}
        aria-hidden={!isCenterSlot && Math.abs(slotOffset) > 1}
      >
        <img
          src={card.image}
          alt=""
          draggable={false}
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out',
            isCenterSlot ? 'scale-100' : 'scale-[1.04]'
          )}
        />
        <span className={cn('absolute inset-0', overlayClass(card.tone))} />
        <span className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/28 to-transparent" />
        <span className="relative z-10 flex h-full flex-col justify-between p-5">
          <span>
            <span
              className={cn(
                'inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                textIsLight ? 'bg-white/14 text-white/84 ring-1 ring-white/20' : 'bg-white/70 text-[#7B5EA7] ring-1 ring-black/[0.04]'
              )}
            >
              {card.kicker}
            </span>
            <span
              className={cn(
                'serif mt-4 block max-w-[13.5rem] text-[clamp(2.18rem,9.4vw,2.64rem)] leading-[0.96]',
                textIsLight ? 'text-white' : 'text-[#202024]'
              )}
            >
              {card.title}
            </span>
            <span className={cn('mt-4 block max-w-[14.5rem] text-[14px] leading-relaxed', textIsLight ? 'text-white/78' : 'text-[#4b4b50]')}>
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
  }
);

GatewayCardView.displayName = 'GatewayCardView';

export const NatalGatewayCarousel = memo<NatalGatewayCarouselProps>(
  ({ profile, onOpenMode, onOpenSynastry, onOpenHoroscope }) => {
    const [centerIndex, setCenterIndex] = useState(0);
    const centerIndexRef = useRef(0);
    const lastDragAtRef = useRef(0);
    const dragStartCenterRef = useRef(0);
    const progress = useMotionValue(0);
    const dragX = useMotionValue(0);
    const dragControls = useDragControls();
    const animationRef = useRef<{ stop: () => void } | null>(null);
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

    const activeIndex = mod(centerIndex, cards.length);

    const commitCenterIndex = (nextCenterIndex: number) => {
      centerIndexRef.current = nextCenterIndex;
      setCenterIndex(nextCenterIndex);
      progress.set(nextCenterIndex);
    };

    const settleToCenter = (nextCenterIndex: number, velocity = 0) => {
      const target = Math.round(nextCenterIndex);
      const current = centerIndexRef.current;
      if (target !== current) hapticSelection();
      animationRef.current?.stop();

      if (shouldReduceMotion) {
        commitCenterIndex(target);
        dragX.set(0);
        return;
      }

      animationRef.current = animate(progress, target, {
        type: 'spring',
        stiffness: 245,
        damping: 29,
        mass: 0.82,
        velocity,
        onComplete: () => commitCenterIndex(target),
      });

      animate(dragX, 0, { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 });
    };

    const moveToCardIndex = (cardIndex: number) => {
      const delta = shortestDelta(mod(centerIndexRef.current, cards.length), cardIndex, cards.length);
      if (delta === 0) return;
      settleToCenter(centerIndexRef.current + delta);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (shouldReduceMotion) return;
      dragControls.start(event, { snapToCursor: false });
    };

    const handleDragStart = () => {
      animationRef.current?.stop();
      dragStartCenterRef.current = centerIndexRef.current;
    };

    const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      progress.set(dragStartCenterRef.current - info.offset.x / CARD_STEP);
    };

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const distanceStep = Math.round(-info.offset.x / CARD_STEP);
      const flingStep = info.velocity.x < -460 ? 1 : info.velocity.x > 460 ? -1 : 0;
      let step = Math.max(-2, Math.min(2, distanceStep || flingStep));

      if (step === 0 && Math.abs(info.offset.x) > 58) {
        step = info.offset.x < 0 ? 1 : -1;
      }

      if (Math.abs(info.offset.x) > 8) {
        lastDragAtRef.current = Date.now();
      }

      const target = dragStartCenterRef.current + step;
      settleToCenter(target, -info.velocity.x / CARD_STEP);
    };

    const openCard = (card: GatewayCard, slotOffset: number) => {
      if (Date.now() - lastDragAtRef.current < 180) return;
      if (slotOffset !== 0) {
        settleToCenter(centerIndexRef.current + slotOffset);
        return;
      }

      hapticImpact();
      card.action();
    };

    return (
      <div className="relative flex min-h-[34rem] flex-1 flex-col justify-start overflow-hidden pb-2 pt-10">
        <div className="relative min-h-[31rem] flex-1 overflow-visible px-4 [perspective:1500px]">
          {COVERFLOW_SLOTS.map((slotOffset) => {
            const loopIndex = centerIndex + slotOffset;
            const card = cards[mod(loopIndex, cards.length)];

            return (
              <GatewayCardView
                key={loopIndex}
                card={card}
                loopIndex={loopIndex}
                slotOffset={slotOffset}
                progress={progress}
                shouldReduceMotion={Boolean(shouldReduceMotion)}
                onPointerDown={handlePointerDown}
                onOpen={openCard}
              />
            );
          })}

          <motion.div
            drag={shouldReduceMotion ? false : 'x'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ left: -CARD_STEP * 1.8, right: CARD_STEP * 1.8 }}
            dragElastic={0.06}
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            style={{ x: dragX, touchAction: 'pan-y' }}
            className="pointer-events-none absolute inset-0 z-[90]"
          />
        </div>

        <div className="flex shrink-0 items-center justify-center gap-2 pb-2 pt-3">
          {cards.map((card, index) => (
            <button
              key={`dot-${card.id}`}
              type="button"
              onClick={() => moveToCardIndex(index)}
              className={cn('h-2 rounded-full transition-all duration-300', index === activeIndex ? 'w-7 bg-[#1f1f1f]' : 'w-2 bg-black/16')}
              aria-label={card.title}
            />
          ))}
        </div>
      </div>
    );
  }
);

NatalGatewayCarousel.displayName = 'NatalGatewayCarousel';
