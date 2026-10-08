import React, { useEffect } from 'react';
import {
  ChevronRight,
  Menu,
  MoonStar,
  Orbit,
  Star,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile, ViewState } from '../../types';
import { formatDisplayDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { CosmicSheet } from './CosmicSheet';

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

function NatalChartMark() {
  return (
    <svg
      className="today-bottom-nav-hub-chart"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="24" r="18.5" strokeWidth="0.78" opacity="0.88" />
        <circle cx="24" cy="24" r="13.35" strokeWidth="0.62" opacity="0.72" />
        <circle cx="24" cy="24" r="6.8" strokeWidth="0.55" opacity="0.46" />
        <g strokeWidth="0.62" opacity="0.7">
          <line x1="24" y1="5.5" x2="24" y2="10.65" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(30 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(60 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(90 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(120 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(150 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(180 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(210 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(240 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(270 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(300 24 24)" />
          <line x1="24" y1="5.5" x2="24" y2="10.65" transform="rotate(330 24 24)" />
        </g>
        <g strokeWidth="0.66" opacity="0.72">
          <path d="M12.1 24 35.4 20.1" strokeDasharray="1.3 1.25" />
          <path d="M14.2 24.7 30.4 33.2" />
          <path d="M17.1 14.5 28.4 34.2" />
        </g>
        <g strokeWidth="0.64" opacity="0.82">
          <circle cx="32" cy="14.8" r="2.05" />
          <circle cx="34.2" cy="23.4" r="1.55" />
          <circle cx="21.8" cy="33.7" r="1.75" />
          <circle cx="15.4" cy="29.5" r="1.3" />
        </g>
        <g fill="currentColor" stroke="none" opacity="0.72">
          <circle cx="32" cy="14.8" r="0.45" />
          <circle cx="34.2" cy="23.4" r="0.38" />
          <circle cx="21.8" cy="33.7" r="0.4" />
          <circle cx="15.4" cy="29.5" r="0.35" />
        </g>
      </g>
    </svg>
  );
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
  if (!visible) return null;
  const isEnglish = profile.language === 'en';
  const natalIsCurrent = NATAL_VIEWS.includes(view);
  const servicesAreCurrent = SERVICE_VIEWS.includes(view);

  return (
    <div className="lumia-bottom-tab-shell today-bottom-navigation pointer-events-none">
      <nav
        className="lumia-bottom-tab-bar today-bottom-nav-bar pointer-events-auto"
        aria-label={isEnglish ? 'Primary navigation' : 'Основная навигация'}
      >
        <button
          type="button"
          className="today-bottom-nav-action"
          data-nav-id="personal"
          aria-label={isEnglish ? 'Personal horoscope' : 'Личный гороскоп'}
          aria-current={view === 'dashboard' ? 'page' : undefined}
          onClick={() => runNavigationAction(onOpenToday)}
        >
          <Star aria-hidden="true" strokeWidth={1.25} />
          <span className="today-bottom-nav-label" aria-hidden="true">Сегодня</span>
        </button>
        <button
          type="button"
          className="today-bottom-nav-action"
          data-nav-id="zodiac"
          aria-label={isEnglish ? 'Horoscope by sign' : 'Гороскоп по знакам'}
          aria-current={view === 'horoscope' ? 'page' : undefined}
          onClick={() => runNavigationAction(onOpenZodiac)}
        >
          <MoonStar aria-hidden="true" strokeWidth={1.25} />
          <span className="today-bottom-nav-label" aria-hidden="true">Гороскоп</span>
        </button>

        <div className="today-bottom-nav-hub-wrap">
          <button
            type="button"
            className="today-bottom-nav-hub"
            aria-label={isEnglish ? 'Natal chart' : 'Натальная карта'}
            aria-current={natalIsCurrent ? 'page' : undefined}
            onClick={() => runNavigationAction(onOpenNatal)}
          >
            <NatalChartMark />
          </button>
          <span className="today-bottom-nav-label" aria-hidden="true">Натальная карта</span>
        </div>

        <button
          type="button"
          className="today-bottom-nav-action"
          data-nav-id="compatibility"
          aria-label={isEnglish ? 'Compatibility' : 'Совместимость'}
          aria-current={view === 'synastry' ? 'page' : undefined}
          onClick={() => runNavigationAction(onOpenCompatibility)}
        >
          <Users aria-hidden="true" strokeWidth={1.25} />
          <span className="today-bottom-nav-label" aria-hidden="true">Совместимость</span>
        </button>

        <button
          id="today-services-trigger"
          type="button"
          className="today-bottom-nav-services"
          data-nav-id="services"
          aria-label={isEnglish ? 'Services' : 'Сервисы'}
          aria-current={servicesAreCurrent ? 'page' : undefined}
          onClick={() => runNavigationAction(onOpenServices)}
        >
          <Menu aria-hidden="true" strokeWidth={1.25} />
          <span className="today-bottom-nav-label" aria-hidden="true">Меню</span>
        </button>
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
