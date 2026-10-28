import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Orbit,
  Star,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile, ViewState } from '../../types';
import { formatDisplayDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { CosmicSheet } from './CosmicSheet';
import { LIQUID_GLASS_SCALES, liquidGlassMap } from './neboLiquidGlass';

export type LumiaNavigationSheetId = 'profile';

type LumiaBottomTabBarProps = {
  profile: UserProfile;
  view: ViewState;
  onOpenToday: () => void;
  onOpenZodiac: () => void;
  onOpenServices: () => void;
  onOpenCompatibility: () => void;
  onOpenNatal: () => void;
};

type LumiaNavigationSheetProps = {
  activeSheet: LumiaNavigationSheetId | null;
  profile: UserProfile;
  onClose: () => void;
  onOpenNatal: () => void;
  onOpenCharts: () => void;
};

export const LUMIA_BOTTOM_NAV_VIEWS: readonly ViewState[] = [
  'dashboard',
  'horoscope',
  'chart',
  'synastry',
  'services',
  'encyclopedia',
  'matrix',
  'personality',
  'settings',
  'charts',
  'tests',
  'mood',
  'sounds',
  'antistress',
  'stories',
];
const NATAL_VIEWS: ViewState[] = ['chart', 'matrix', 'personality'];
const SERVICE_VIEWS: ViewState[] = ['services', 'encyclopedia', 'settings', 'charts'];

export function shouldShowLumiaBottomNavigation(view: ViewState): boolean {
  return LUMIA_BOTTOM_NAV_VIEWS.includes(view);
}

function runNavigationAction(action: () => void) {
  lumiaSelectionHaptic();
  action();
}

const parseRgb = (value: string): [number, number, number, number] | null => {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match) return null;
  const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
};

/** Brightness (0..1) of whatever is painted under a point, or null when it cannot be told. */
function brightnessUnder(x: number, y: number): number | null {
  for (const element of document.elementsFromPoint(x, y)) {
    if (element.closest('.lumia-bottom-tab-shell')) continue;
    if (element instanceof HTMLCanvasElement) {
      try {
        const box = element.getBoundingClientRect();
        const pixel = element.getContext('2d')?.getImageData(
          Math.floor(((x - box.left) / box.width) * element.width),
          Math.floor(((y - box.top) / box.height) * element.height), 1, 1,
        ).data;
        if (pixel && pixel[3] > 200) return (0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]) / 255;
      } catch { /* a tainted or WebGL canvas: look at what is behind it */ }
    }
    const style = getComputedStyle(element);
    const fromImage = style.backgroundImage.includes('gradient') ? parseRgb(style.backgroundImage) : null;
    const color = fromImage ?? parseRgb(style.backgroundColor);
    if (color && color[3] > 0.55) return (0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) / 255;
  }
  return null;
}

/** The bar is clear glass: its ink turns white over dark content and dark over light content. */
function useAdaptiveNavigationInk(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.innerHeight - 36;
      const samples = [0.2, 0.5, 0.8].map((fraction) => brightnessUnder(window.innerWidth * fraction, y)).filter((value): value is number => value !== null);
      if (!samples.length) return;
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      if (average < 0.42) root.dataset.navInk = 'light';
      else delete root.dataset.navInk;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    schedule();
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const timer = window.setInterval(schedule, 700);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', schedule, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', schedule);
      window.clearInterval(timer);
      delete root.dataset.navInk;
    };
  }, [active]);
}

type NeboTab = {
  id: 'today' | 'zodiac' | 'natal' | 'compatibility' | 'rest';
  label: string;
  labelEn: string;
  icon: string;
  /** Relative width, as in the canvas: long labels get a wider cell. */
  fr: number;
  views: readonly ViewState[];
};

// Icon paths and cell widths come straight from the NEBO canvas tab bar.
const NEBO_TABS: readonly NeboTab[] = [
  { id: 'today', label: 'Сегодня', labelEn: 'Today', fr: 1, views: ['dashboard'], icon: 'M12 8.2a3.8 3.8 0 1 1 0 7.6a3.8 3.8 0 1 1 0-7.6zM12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4' },
  { id: 'zodiac', label: 'Гороскоп', labelEn: 'Signs', fr: 0.84, views: ['horoscope'], icon: 'M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.1 2.7 1-5.7-4.1-4 5.7-.8z' },
  { id: 'natal', label: 'Моя карта', labelEn: 'My chart', fr: 1.08, views: ['chart', 'matrix', 'personality', 'encyclopedia'], icon: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17zM12 7.8a4.2 4.2 0 1 1 0 8.4a4.2 4.2 0 1 1 0-8.4zM12 3.5v4.3M12 16.2v4.3M3.5 12h4.3M16.2 12h4.3' },
  { id: 'compatibility', label: 'Совместимость', labelEn: 'Compatibility', fr: 1.42, views: ['synastry'], icon: 'M9 6.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11zM15 6.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11z' },
  { id: 'rest', label: 'Отдых', labelEn: 'Unwind', fr: 0.86, views: ['services', 'tests', 'mood', 'sounds', 'antistress', 'stories'], icon: 'M4 14.5v-2.5a8 8 0 0 1 16 0v2.5M3.5 14.5h4v5.5h-4zM16.5 14.5h4v5.5h-4z' },
];
const NEBO_TAB_FR_SUM = NEBO_TABS.reduce((sum, tab) => sum + tab.fr, 0);
const BAR_HEIGHT = 64;
const DROP_SIZE = { w: 76, h: 56, r: 28, e: 12 };

export function LumiaBottomTabBar({
  profile,
  view,
  onOpenToday,
  onOpenZodiac,
  onOpenServices,
  onOpenCompatibility,
  onOpenNatal,
}: LumiaBottomTabBarProps) {
  const visible = shouldShowLumiaBottomNavigation(view);
  useAdaptiveNavigationInk(visible);
  const navRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ x: number; drag: boolean; base: number; w: number; tx: number } | null>(null);
  const [barWidth, setBarWidth] = useState(358);

  useEffect(() => {
    const nav = navRef.current;
    if (!visible || !nav || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setBarWidth(Math.round(nav.offsetWidth) || 358));
    observer.observe(nav);
    return () => observer.disconnect();
  }, [visible]);

  const maps = useMemo(() => ({
    bar: liquidGlassMap({ w: barWidth, h: BAR_HEIGHT, r: 32, e: 9 }),
    drop: liquidGlassMap(DROP_SIZE),
  }), [barWidth]);

  if (!visible) return null;
  const isEnglish = profile.language === 'en';
  const actions: Record<NeboTab['id'], () => void> = {
    today: onOpenToday,
    zodiac: onOpenZodiac,
    natal: onOpenNatal,
    compatibility: onOpenCompatibility,
    rest: onOpenServices,
  };
  const activeIndex = NEBO_TABS.findIndex((tab) => tab.views.includes(view));
  const before = NEBO_TABS.slice(0, Math.max(0, activeIndex)).reduce((sum, tab) => sum + tab.fr, 0);
  const dropStyle = activeIndex < 0 ? { display: 'none' } : {
    left: `calc(6px + (100% - 10px) * ${(before / NEBO_TAB_FR_SUM).toFixed(4)})`,
    width: `calc((100% - 10px) * ${(NEBO_TABS[activeIndex].fr / NEBO_TAB_FR_SUM).toFixed(4)} - 2px)`,
  };

  // Drag the drop along the bar like on iOS; letting go picks the nearest tab.
  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = { x: event.clientX, drag: false, base: 0, w: 0, tx: 0 };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const nav = navRef.current;
    const state = dragRef.current;
    const drop = nav?.querySelector<HTMLElement>('.nebo-tabbar-drop');
    const glass = nav?.querySelector<HTMLElement>('.nebo-tabbar-drop-glass');
    if (!nav || !state || !drop || !glass || activeIndex < 0) return;
    if (!state.drag) {
      if (Math.abs(event.clientX - state.x) < 6) return;
      state.drag = true;
      state.base = drop.offsetLeft;
      state.w = drop.offsetWidth;
      try { nav.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
      glass.classList.add('is-dragging');
    }
    const box = nav.getBoundingClientRect();
    const left = Math.max(2, Math.min(nav.offsetWidth - state.w - 2, event.clientX - box.left - state.w / 2));
    state.tx = left - state.base;
    glass.style.transform = `translateX(${state.tx}px) scale(1.16, 1.12)`;
  };
  const onPointerUp = () => {
    const nav = navRef.current;
    const state = dragRef.current;
    dragRef.current = null;
    if (!nav || !state?.drag) return;
    const glass = nav.querySelector<HTMLElement>('.nebo-tabbar-drop-glass');
    const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('.nebo-tabbar-item'));
    if (!glass || !buttons.length) return;
    const middle = state.base + state.tx + state.w / 2;
    let pick = 0;
    let best = Number.POSITIVE_INFINITY;
    buttons.forEach((button, index) => {
      const distance = Math.abs(button.offsetLeft + button.offsetWidth / 2 - middle);
      if (distance < best) { best = distance; pick = index; }
    });
    glass.classList.remove('is-dragging');
    glass.style.transform = `translateX(${buttons[pick].offsetLeft - state.base}px) scale(1.04, 1.02)`;
    window.setTimeout(() => {
      runNavigationAction(actions[NEBO_TABS[pick].id]);
      glass.style.transform = '';
    }, 330);
  };

  return (
    <div className="lumia-bottom-tab-shell nebo-tabbar-shell pointer-events-none">
      <svg className="nebo-tabbar-filters" width="0" height="0" aria-hidden="true">
        <defs>
          {(['bar', 'drop'] as const).map((kind) => {
            const size = kind === 'bar' ? { w: barWidth, h: BAR_HEIGHT } : DROP_SIZE;
            const [red, green, blue] = LIQUID_GLASS_SCALES[kind];
            return (
              <filter key={kind} id={`nebo-lq-${kind}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                <feImage href={maps[kind]} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
                <feDisplacementMap in="SourceGraphic" in2="map" scale={red} xChannelSelector="R" yChannelSelector="B" result="d0" />
                <feColorMatrix in="d0" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="c0" />
                <feDisplacementMap in="SourceGraphic" in2="map" scale={green} xChannelSelector="R" yChannelSelector="B" result="d1" />
                <feColorMatrix in="d1" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="c1" />
                <feDisplacementMap in="SourceGraphic" in2="map" scale={blue} xChannelSelector="R" yChannelSelector="B" result="d2" />
                <feColorMatrix in="d2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="c2" />
                <feBlend in="c0" in2="c1" mode="screen" result="c01" />
                <feBlend in="c01" in2="c2" mode="screen" />
              </filter>
            );
          })}
        </defs>
      </svg>
      <nav
        ref={navRef}
        className="nebo-tabbar pointer-events-auto"
        aria-label={isEnglish ? 'Primary navigation' : 'Основная навигация'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="nebo-tabbar-glass" aria-hidden="true" />
        <span className="nebo-tabbar-drop" style={dropStyle} aria-hidden="true">
          <span className="nebo-tabbar-drop-glass" />
        </span>
        <div className="nebo-tabbar-row">
          {NEBO_TABS.map((tab) => {
            const current = activeIndex >= 0 && NEBO_TABS[activeIndex].id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className="nebo-tabbar-item"
                data-nav-id={tab.id}
                aria-current={current ? 'page' : undefined}
                onClick={() => runNavigationAction(actions[tab.id])}
              >
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={tab.icon} />
                </svg>
                <span>{isEnglish ? tab.labelEn : tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function NavigationItem({
  label,
  description,
  Icon,
  disabled = false,
  onClick,
}: {
  label: string;
  description?: string;
  Icon: LucideIcon;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="today-navigation-sheet-item"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden="true" strokeWidth={1.35} />
      <span className="today-navigation-sheet-item-copy">
        <strong>{label}</strong>
        {description && !disabled ? <small>{description}</small> : null}
      </span>
      {disabled ? (
        <span className="today-navigation-sheet-status">
          {description}
        </span>
      ) : (
        <ChevronRight aria-hidden="true" strokeWidth={1.25} />
      )}
    </button>
  );
}

export function LumiaNavigationSheet({
  activeSheet,
  profile,
  onClose,
  onOpenNatal,
  onOpenCharts,
}: LumiaNavigationSheetProps) {
  const isEnglish = profile.language === 'en';
  const sheetTitle = isEnglish ? 'Profile' : 'Профиль';
  const sheetSubtitle = profile.name?.trim() || (isEnglish ? 'Your details and charts' : 'Твои данные и карты');

  return (
    <CosmicSheet
      open={activeSheet === 'profile'}
      title={sheetTitle}
      subtitle={sheetSubtitle}
      closeLabel={isEnglish ? 'Close menu' : 'Закрыть меню'}
      className="today-navigation-sheet"
      contentClassName="today-navigation-sheet-content"
      onClose={onClose}
    >
      <div id="today-navigation-sheet">
        {activeSheet === 'profile' ? (
          <div className="today-navigation-profile">
            <div className="today-navigation-profile-mark" aria-hidden="true">
              <UserRound strokeWidth={1.25} />
            </div>
            <dl className="today-navigation-profile-data">
              <div>
                <dt>{isEnglish ? 'Birth date' : 'Дата рождения'}</dt>
                <dd>{profile.birthDate
                  ? formatDisplayDate(profile.birthDate, isEnglish ? 'en' : 'ru')
                  : (isEnglish ? 'Not specified' : 'Не указана')}</dd>
              </div>
              <div>
                <dt>{isEnglish ? 'Birth time' : 'Время рождения'}</dt>
                <dd>{profile.birthTime?.trim() || (isEnglish ? 'Not specified' : 'Не указано')}</dd>
              </div>
              <div>
                <dt>{isEnglish ? 'Birth place' : 'Место рождения'}</dt>
                <dd>{profile.birthPlace?.trim() || (isEnglish ? 'Not specified' : 'Не указано')}</dd>
              </div>
            </dl>
            <div className="today-navigation-sheet-list is-profile">
              <NavigationItem
                label={isEnglish ? 'Saved charts' : 'Сохранённые карты'}
                description={isEnglish ? 'Open and manage charts' : 'Открыть и управлять картами'}
                Icon={Star}
                onClick={onOpenCharts}
              />
              <NavigationItem
                label={isEnglish ? 'My natal chart' : 'Моя натальная карта'}
                Icon={Orbit}
                onClick={onOpenNatal}
              />
            </div>
          </div>
        ) : null}
      </div>
    </CosmicSheet>
  );
}
