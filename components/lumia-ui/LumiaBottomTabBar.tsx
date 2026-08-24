import React from 'react';
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

export function LumiaBottomTabBar({
  profile,
  view,
  onOpenToday,
  onOpenZodiac,
  onOpenServices,
  onOpenCompatibility,
  onOpenNatal,
}: LumiaBottomTabBarProps) {
  if (!shouldShowLumiaBottomNavigation(view)) return null;
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
          <span className="today-bottom-nav-label" aria-hidden="true">Знаки</span>
        </button>

        <div className="today-bottom-nav-hub-wrap">
          <button
            type="button"
            className="today-bottom-nav-hub"
            aria-label={isEnglish ? 'Natal chart' : 'Натальная карта'}
            aria-current={natalIsCurrent ? 'page' : undefined}
            onClick={() => runNavigationAction(onOpenNatal)}
          >
            <img
              className="today-bottom-nav-hub-logo"
              src="/assets/brand/personal-horoscope-mark.svg"
              alt=""
              aria-hidden="true"
            />
          </button>
          <span className="today-bottom-nav-label" aria-hidden="true">Карта</span>
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
          <span className="today-bottom-nav-label" aria-hidden="true">Сравнить</span>
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
