import React, { Fragment, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  ChevronRight,
  Crown,
  Menu,
  MoonStar,
  Orbit,
  Settings,
  Star,
  UserRound,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile, ViewState } from '../../types';
import { hasActivePremium } from '../../lib/accessMatrix';
import { formatDisplayDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { CosmicSheet } from './CosmicSheet';

export type LumiaNavigationSheetId = 'services' | 'profile';

type LumiaBottomTabBarProps = {
  profile: UserProfile;
  view: ViewState;
  activeSheet: LumiaNavigationSheetId | null;
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
  onOpenSettings: () => void;
  onOpenPremium: () => void;
  onOpenCharts: () => void;
  onOpenKnowledge: () => void;
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
const NATAL_VIEWS: ViewState[] = ['chart', 'matrix', 'personality'];
const SERVICE_VIEWS: ViewState[] = ['encyclopedia', 'settings', 'charts'];

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
  activeSheet,
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
        </button>

        <button
          id="today-services-trigger"
          type="button"
          className="today-bottom-nav-services"
          aria-label={isEnglish ? 'Open services' : 'Открыть сервисное меню'}
          aria-haspopup="menu"
          aria-expanded={activeSheet === 'services'}
          aria-current={servicesAreCurrent ? 'page' : undefined}
          aria-controls="today-services-radial-menu"
          onClick={() => runNavigationAction(onOpenServices)}
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
  onOpenNatal,
  onOpenSettings,
  onOpenPremium,
  onOpenCharts,
  onOpenKnowledge,
}: LumiaNavigationSheetProps) {
  const firstServiceActionRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const serviceWasOpenRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const isEnglish = profile.language === 'en';
  const serviceIsOpen = activeSheet === 'services';
  const sheetTitle = isEnglish ? 'Profile' : 'Профиль';
  const sheetSubtitle = profile.name?.trim() || (isEnglish ? 'Your details and charts' : 'Твои данные и карты');
  const openSubscription = hasActivePremium(profile) ? onOpenSettings : onOpenPremium;

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (serviceIsOpen) {
      serviceWasOpenRef.current = true;
      firstServiceActionRef.current?.focus({ preventScroll: true });
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeRef.current();
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }

    if (serviceWasOpenRef.current) {
      serviceWasOpenRef.current = false;
      if (document.activeElement?.getAttribute('role') === 'menuitem') {
        document.getElementById('today-services-trigger')?.focus({ preventScroll: true });
      }
    }
  }, [serviceIsOpen]);

  const serviceMotion = (x: string, y: number, order: number) => ({
    initial: reduceMotion ? { x, y, opacity: 1 } : { x: 0, y: 0, scale: 0.82, opacity: 0 },
    animate: { x, y, scale: 1, opacity: 1 },
    exit: reduceMotion ? { opacity: 0 } : { x: 0, y: 0, scale: 0.82, opacity: 0 },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.23, delay: order * 0.035, ease: [0.22, 1, 0.36, 1] as const },
  });

  const runServiceAction = (action: () => void) => runNavigationAction(action);

  return (
    <>
      <AnimatePresence>
        {serviceIsOpen ? (
          <Fragment key="services-radial-menu">
            <motion.button
              type="button"
              className="today-hub-dismiss-layer"
              aria-label={isEnglish ? 'Close services menu' : 'Закрыть сервисное меню'}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
              onClick={onClose}
            />
            <motion.div
              id="today-services-radial-menu"
              className="today-hub-radial-menu"
              role="menu"
              aria-label={isEnglish ? 'Services' : 'Сервисное меню'}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
            >
              <motion.button
                ref={firstServiceActionRef}
                type="button"
                role="menuitem"
                className="today-hub-radial-action"
                onClick={() => runServiceAction(onOpenKnowledge)}
                {...serviceMotion('calc(-40vw - 112px)', -67, 0)}
              >
                <span className="today-hub-radial-icon"><BookOpen aria-hidden="true" /></span>
                <span>{isEnglish ? 'I want to know' : 'Хочу знать'}</span>
              </motion.button>
              <motion.button
                type="button"
                role="menuitem"
                className="today-hub-radial-action"
                onClick={() => runServiceAction(onOpenPremium)}
                {...serviceMotion('calc(-40vw - 43px)', -131, 1)}
              >
                <span className="today-hub-radial-icon"><WalletCards aria-hidden="true" /></span>
                <span>{isEnglish ? 'Store' : 'Магазин'}</span>
              </motion.button>
              <motion.button
                type="button"
                role="menuitem"
                className="today-hub-radial-action"
                onClick={() => runServiceAction(onOpenSettings)}
                {...serviceMotion('calc(-40vw + 43px)', -131, 2)}
              >
                <span className="today-hub-radial-icon"><Settings aria-hidden="true" /></span>
                <span>{isEnglish ? 'Settings' : 'Настройки'}</span>
              </motion.button>
              <motion.button
                type="button"
                role="menuitem"
                className="today-hub-radial-action"
                onClick={() => runServiceAction(openSubscription)}
                {...serviceMotion('calc(-40vw + 112px)', -67, 3)}
              >
                <span className="today-hub-radial-icon"><Crown aria-hidden="true" /></span>
                <span>{isEnglish ? 'Premium' : 'Подписка'}</span>
              </motion.button>
            </motion.div>
          </Fragment>
        ) : null}
      </AnimatePresence>

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
    </>
  );
}
