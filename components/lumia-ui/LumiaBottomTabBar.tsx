import React from 'react';
import {
  BookOpen,
  ChevronRight,
  Crown,
  HeartHandshake,
  Menu,
  MessageCircleQuestion,
  Orbit,
  Settings,
  Star,
  UserRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile, ViewState } from '../../types';
import { formatDisplayDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { ZodiacWheelIcon } from '../icons/UiIcons';
import { CosmicSheet } from './CosmicSheet';

export type LumiaNavigationSheetId = 'hub' | 'services' | 'profile';

type LumiaBottomTabBarProps = {
  profile: UserProfile;
  view: ViewState;
  activeSheet: LumiaNavigationSheetId | null;
  onOpenToday: () => void;
  onOpenZodiac: () => void;
  onOpenSheet: (sheet: 'hub' | 'services') => void;
};

type LumiaNavigationSheetProps = {
  activeSheet: 'hub' | 'services' | 'profile' | null;
  profile: UserProfile;
  onClose: () => void;
  onOpenCompatibility: () => void;
  onOpenNatal: () => void;
  onAskAstrologer: () => void;
  onOpenKnowledge: () => void;
  onOpenSettings: () => void;
  onOpenPremium: () => void;
  onOpenCharts: () => void;
};

export const LUMIA_BOTTOM_NAV_VIEWS: readonly ViewState[] = [
  'dashboard',
  'horoscope',
  'chart',
  'synastry',
  'encyclopedia',
  'matrix',
  'personality',
  'settings',
  'charts',
];
const HUB_VIEWS: ViewState[] = ['chart', 'synastry', 'encyclopedia', 'matrix', 'personality'];
const SERVICE_VIEWS: ViewState[] = ['settings', 'charts'];

export function shouldShowLumiaBottomNavigation(view: ViewState): boolean {
  return LUMIA_BOTTOM_NAV_VIEWS.includes(view);
}

function TodayHubLogo() {
  return (
    <svg
      className="today-bottom-nav-hub-logo"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="5.2" />
      <ellipse cx="16" cy="16" rx="12" ry="4.5" transform="rotate(-18 16 16)" />
      <circle className="today-bottom-nav-hub-logo-dot" cx="26.4" cy="12.2" r="1.15" />
    </svg>
  );
}

function runNavigationAction(action: () => void) {
  lumiaSelectionHaptic();
  action();
}

export function LumiaBottomTabBar({
  profile,
  view,
  activeSheet,
  onOpenToday,
  onOpenZodiac,
  onOpenSheet,
}: LumiaBottomTabBarProps) {
  if (!shouldShowLumiaBottomNavigation(view)) return null;
  const isEnglish = profile.language === 'en';
  const hubIsCurrent = HUB_VIEWS.includes(view);
  const servicesAreCurrent = SERVICE_VIEWS.includes(view);

  return (
    <div className="lumia-bottom-tab-shell today-bottom-navigation pointer-events-none">
      <nav
        className="lumia-bottom-tab-bar today-bottom-nav-bar pointer-events-auto"
        aria-label={isEnglish ? 'Primary navigation' : 'Основная навигация'}
      >
        <div className="today-bottom-nav-quick-links">
          <button
            type="button"
            className="today-bottom-nav-quick-action"
            data-nav-id="personal"
            aria-label={isEnglish ? 'Personal horoscope' : 'Личный гороскоп'}
            aria-current={view === 'dashboard' ? 'page' : undefined}
            onClick={() => runNavigationAction(onOpenToday)}
          >
            <Star aria-hidden="true" strokeWidth={1.35} />
            <span>{isEnglish ? 'Personal horoscope' : 'Личный гороскоп'}</span>
          </button>
          <button
            type="button"
            className="today-bottom-nav-quick-action"
            data-nav-id="zodiac"
            aria-label={isEnglish ? 'Horoscope by sign' : 'Гороскоп по знакам'}
            aria-current={view === 'horoscope' ? 'page' : undefined}
            onClick={() => runNavigationAction(onOpenZodiac)}
          >
            <ZodiacWheelIcon />
            <span>{isEnglish ? 'Horoscope by sign' : 'Гороскоп по знакам'}</span>
          </button>
        </div>

        <button
          type="button"
          className="today-bottom-nav-hub"
          aria-label={isEnglish ? 'Open feature hub' : 'Открыть главное меню'}
          aria-haspopup="dialog"
          aria-expanded={activeSheet === 'hub'}
          aria-current={hubIsCurrent ? 'page' : undefined}
          aria-controls="today-navigation-sheet"
          onClick={() => runNavigationAction(() => onOpenSheet('hub'))}
        >
          <TodayHubLogo />
        </button>

        <button
          type="button"
          className="today-bottom-nav-services"
          aria-label={isEnglish ? 'Open services' : 'Открыть сервисное меню'}
          aria-haspopup="dialog"
          aria-expanded={activeSheet === 'services'}
          aria-current={servicesAreCurrent ? 'page' : undefined}
          aria-controls="today-navigation-sheet"
          onClick={() => runNavigationAction(() => onOpenSheet('services'))}
        >
          <Menu aria-hidden="true" strokeWidth={1.25} />
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
  onOpenCompatibility,
  onOpenNatal,
  onAskAstrologer,
  onOpenKnowledge,
  onOpenSettings,
  onOpenPremium,
  onOpenCharts,
}: LumiaNavigationSheetProps) {
  const isEnglish = profile.language === 'en';
  const sheetTitle = activeSheet === 'profile'
    ? (isEnglish ? 'Profile' : 'Профиль')
    : activeSheet === 'services'
      ? (isEnglish ? 'Services' : 'Сервис')
      : (isEnglish ? 'Explore' : 'Главное');
  const sheetSubtitle = activeSheet === 'profile'
    ? (profile.name?.trim() || (isEnglish ? 'Your details and charts' : 'Твои данные и карты'))
    : activeSheet === 'services'
      ? (isEnglish ? 'Settings, store, and subscription.' : 'Настройки, магазин и подписка.')
      : (isEnglish ? 'The key sections of your horoscope.' : 'Ключевые разделы твоего гороскопа.');

  return (
    <CosmicSheet
      open={activeSheet !== null}
      title={sheetTitle}
      subtitle={sheetSubtitle}
      closeLabel={isEnglish ? 'Close menu' : 'Закрыть меню'}
      className="today-navigation-sheet"
      contentClassName="today-navigation-sheet-content"
      onClose={onClose}
    >
      <div id="today-navigation-sheet">
        {activeSheet === 'hub' ? (
          <div className="today-navigation-sheet-list">
            <NavigationItem
              label={isEnglish ? 'Compatibility' : 'Совместимость'}
              Icon={HeartHandshake}
              onClick={onOpenCompatibility}
            />
            <NavigationItem
              label={isEnglish ? 'Natal chart' : 'Натальная карта'}
              Icon={Orbit}
              onClick={onOpenNatal}
            />
            <NavigationItem
              label={isEnglish ? 'Ask the astrologer' : 'Спросить астролога'}
              Icon={MessageCircleQuestion}
              onClick={onAskAstrologer}
            />
            <NavigationItem
              label={isEnglish ? 'I want to know' : 'Хочу знать'}
              Icon={BookOpen}
              onClick={onOpenKnowledge}
            />
          </div>
        ) : null}

        {activeSheet === 'services' ? (
          <div className="today-navigation-sheet-list">
            <NavigationItem
              label={isEnglish ? 'Settings' : 'Настройки'}
              Icon={Settings}
              onClick={onOpenSettings}
            />
            <NavigationItem
              label={isEnglish ? 'Store' : 'Магазин'}
              description={isEnglish ? 'Premium plans and access' : 'Тарифы и доступ Premium'}
              Icon={WalletCards}
              onClick={onOpenPremium}
            />
            <NavigationItem
              label={isEnglish ? 'Premium and subscription' : 'Premium и подписка'}
              description={isEnglish ? 'Status and management' : 'Статус и управление'}
              Icon={Crown}
              onClick={onOpenSettings}
            />
          </div>
        ) : null}

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
