import React, { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { BookOpenText, Handshake, MoreHorizontal } from 'lucide-react';
import type { UserProfile, ViewState } from '../../types';
import { cn } from '../../lib/cn';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { NatalChartIcon, ZodiacWheelIcon } from '../icons/UiIcons';

type LumiaBottomTabBarProps = {
  profile: UserProfile;
  view: ViewState;
  onOpenToday: () => void;
  onOpenZodiac: () => void;
  onOpenNatal: () => void;
  onOpenSynastry: () => void;
  onOpenMore: () => void;
};

const SHOW_ON: ViewState[] = ['dashboard', 'horoscope', 'chart', 'synastry', 'settings'];
const LIQUID_DRAG_THRESHOLD_PX = 7;

type LiquidDragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  dragging: boolean;
  nearestIndex: number;
};

function getBottomNavLabels(language: UserProfile['language']) {
  if (language === 'en') {
    return {
      today: 'Diary',
      zodiac: 'Zodiac',
      chart: 'Map',
      union: 'Compatibility',
      more: 'More',
    };
  }

  return {
    today: 'Дневник',
    zodiac: 'Зодиак',
    chart: 'Карта',
    union: 'Совместимость',
    more: 'Ещё',
  };
}

export function LumiaBottomTabBar({
  profile,
  view,
  onOpenToday,
  onOpenZodiac,
  onOpenNatal,
  onOpenSynastry,
  onOpenMore,
}: LumiaBottomTabBarProps) {
  const labels = getBottomNavLabels(profile.language);
  const reduce = useReducedMotion();
  const barRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dragSessionRef = useRef<LiquidDragSession | null>(null);
  const suppressClickRef = useRef(false);
  const lensX = useMotionValue(0);
  const lensWidth = useMotionValue(0);
  const lensScaleX = useMotionValue(1);
  const lensSkewX = useMotionValue(0);
  const [lensReady, setLensReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const items: Array<{
    id: string;
    label: string;
    active: boolean;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [
    {
      id: 'diary',
      label: labels.today,
      active: view === 'dashboard',
      icon: <BookOpenText aria-hidden strokeWidth={1.7} />,
      onClick: onOpenToday,
    },
    {
      id: 'zodiac',
      label: labels.zodiac,
      active: view === 'horoscope',
      icon: <ZodiacWheelIcon />,
      onClick: onOpenZodiac,
    },
    {
      id: 'union',
      label: labels.union,
      active: view === 'synastry',
      icon: <Handshake aria-hidden strokeWidth={1.7} />,
      onClick: onOpenSynastry,
    },
    {
      id: 'chart',
      label: labels.chart,
      active: view === 'chart',
      icon: <NatalChartIcon />,
      onClick: onOpenNatal,
    },
    {
      id: 'more',
      label: labels.more,
      active: view === 'settings',
      icon: <MoreHorizontal aria-hidden strokeWidth={1.75} />,
      onClick: onOpenMore,
    },
  ];

  const activeIndex = Math.max(items.findIndex((item) => item.active), 0);
  const [lensTargetIndex, setLensTargetIndex] = useState(activeIndex);

  const getLensGeometry = useCallback((index: number) => {
    const bar = barRef.current;
    const item = itemRefs.current[index];
    if (!bar || !item) return null;

    const barRect = bar.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const width = Math.max(44, itemRect.width - 4);

    return {
      x: itemRect.left - barRect.left + (itemRect.width - width) / 2,
      width,
    };
  }, []);

  const settleLens = useCallback((index: number, immediate = false) => {
    const geometry = getLensGeometry(index);
    if (!geometry) return;

    setLensReady(true);
    if (immediate || reduce) {
      lensX.set(geometry.x);
      lensWidth.set(geometry.width);
      lensScaleX.set(1);
      lensSkewX.set(0);
      return;
    }

    const spring = { type: 'spring' as const, stiffness: 430, damping: 34, mass: 0.72 };
    animate(lensX, geometry.x, spring);
    animate(lensWidth, geometry.width, spring);
    animate(lensScaleX, 1, spring);
    animate(lensSkewX, 0, spring);
  }, [getLensGeometry, lensScaleX, lensSkewX, lensWidth, lensX, reduce]);

  useEffect(() => {
    if (!SHOW_ON.includes(view)) return;

    setLensTargetIndex(activeIndex);
    settleLens(activeIndex, !lensReady);

    const handleResize = () => settleLens(activeIndex, true);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeIndex, lensReady, settleLens, view]);

  const nearestItemIndex = useCallback((clientX: number) => {
    let nearestIndex = activeIndex;
    let nearestDistance = Number.POSITIVE_INFINITY;

    itemRefs.current.forEach((item, index) => {
      if (!item) return;
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }, [activeIndex]);

  const moveLensWithPointer = useCallback((clientX: number, velocityX: number) => {
    const bar = barRef.current;
    const firstItem = itemRefs.current[0];
    const lastItem = itemRefs.current[items.length - 1];
    const targetItem = itemRefs.current[nearestItemIndex(clientX)];
    if (!bar || !firstItem || !lastItem || !targetItem) return;

    const barRect = bar.getBoundingClientRect();
    const firstRect = firstItem.getBoundingClientRect();
    const lastRect = lastItem.getBoundingClientRect();
    const targetRect = targetItem.getBoundingClientRect();
    const width = Math.max(44, targetRect.width - 4);
    const minimumX = firstRect.left - barRect.left + (firstRect.width - width) / 2;
    const maximumX = lastRect.right - barRect.left - width - (lastRect.width - width) / 2;
    const pointerX = clientX - barRect.left - width / 2;

    lensX.set(Math.min(Math.max(pointerX, minimumX), maximumX));
    lensWidth.set(width);

    if (reduce) {
      lensScaleX.set(1);
      lensSkewX.set(0);
      return;
    }

    const stretch = Math.min(Math.abs(velocityX) / 1800, 0.16);
    lensScaleX.set(1 + stretch);
    lensSkewX.set(Math.max(-5, Math.min(5, velocityX / 180)));
  }, [items.length, lensScaleX, lensSkewX, lensWidth, lensX, nearestItemIndex, reduce]);

  const beginLiquidDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      dragging: false,
      nearestIndex: activeIndex,
    };
  };

  const updateLiquidDrag = (event: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    if (!session.dragging) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;
      if (Math.abs(deltaX) < LIQUID_DRAG_THRESHOLD_PX) return;

      session.dragging = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    const elapsed = Math.max(event.timeStamp - session.lastTime, 1);
    const velocityX = ((event.clientX - session.lastX) / elapsed) * 1000;
    const nearestIndex = nearestItemIndex(event.clientX);

    if (nearestIndex !== session.nearestIndex) {
      session.nearestIndex = nearestIndex;
      setLensTargetIndex(nearestIndex);
      lumiaSelectionHaptic();
    }

    moveLensWithPointer(event.clientX, velocityX);
    session.lastX = event.clientX;
    session.lastTime = event.timeStamp;
  };

  const finishLiquidDrag = (event: React.PointerEvent<HTMLElement>, cancelled = false) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    dragSessionRef.current = null;
    setIsDragging(false);

    if (session.dragging && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (cancelled || !session.dragging) {
      setLensTargetIndex(activeIndex);
      settleLens(activeIndex);
      return;
    }

    const nextIndex = session.nearestIndex;
    setLensTargetIndex(nextIndex);
    settleLens(nextIndex);
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    items[nextIndex]?.onClick();
  };

  if (!SHOW_ON.includes(view)) return null;

  return (
    <div className="lumia-bottom-tab-shell pointer-events-none">
      <nav
        ref={barRef}
        className={cn('lumia-bottom-tab-bar pointer-events-auto', isDragging && 'is-dragging')}
        aria-label={profile.language === 'en' ? 'Primary navigation' : 'Основная навигация'}
        onPointerDown={beginLiquidDrag}
        onPointerMove={updateLiquidDrag}
        onPointerUp={(event) => finishLiquidDrag(event)}
        onPointerCancel={(event) => finishLiquidDrag(event, true)}
        onLostPointerCapture={(event) => finishLiquidDrag(event, true)}
      >
        <motion.span
          aria-hidden
          className="lumia-bottom-tab-liquid-lens"
          style={{
            opacity: lensReady ? 1 : 0,
            x: lensX,
            width: lensWidth,
            scaleX: lensScaleX,
            skewX: lensSkewX,
          }}
        />
        {items.map((item, itemIndex) => {
            return (
              <button
                key={item.id}
                ref={(element) => {
                  itemRefs.current[itemIndex] = element;
                }}
                type="button"
                data-tab-id={item.id}
                className={cn(
                  'lumia-bottom-tab-item',
                  item.active && 'is-active',
                  lensTargetIndex === itemIndex && 'is-lens-target',
                )}
                aria-label={item.label}
                aria-current={item.active ? 'page' : undefined}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  lumiaSelectionHaptic();
                  item.onClick();
                }}
              >
                <span className="lumia-bottom-tab-icon">
                  {item.icon}
                </span>
                <span className="lumia-bottom-tab-label">{item.label}</span>
              </button>
            );
        })}
      </nav>
    </div>
  );
}
