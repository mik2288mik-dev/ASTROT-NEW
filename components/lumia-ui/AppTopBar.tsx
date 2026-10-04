import React, { createContext, useContext } from 'react';
import { ChevronLeft, Settings } from 'lucide-react';
import { NeboLogo } from '../brand/NeboLogo';

type AppTopBarProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  /** An action on the left when there is no «Back». */
  leftAction?: React.ReactNode;
  /** Replaces the title, e.g. the «Сегодня | Будущее» switch on the home screen. */
  center?: React.ReactNode;
  reserveSpace?: boolean;
  className?: string;
};

type AppTopBarSettingsContextValue = { onOpenSettings: () => void } | null;

const AppTopBarSettingsContext = createContext<AppTopBarSettingsContextValue>(null);

/** Makes Settings a real shared-header action instead of a menu-only shortcut. */
export function AppTopBarSettingsProvider({
  onOpenSettings,
  children,
}: {
  onOpenSettings: () => void;
  children: React.ReactNode;
}) {
  return (
    <AppTopBarSettingsContext.Provider value={{ onOpenSettings }}>
      {children}
    </AppTopBarSettingsContext.Provider>
  );
}

/**
 * The single top bar used by every primary application screen.
 * The optional context line sits below the glass so the bar itself never changes height.
 */
export function AppTopBar({
  title,
  subtitle,
  onBack,
  rightAction,
  leftAction,
  center,
  reserveSpace = true,
  className,
}: AppTopBarProps) {
  const isPersonalForecastHeader = title === 'NEBO';
  const isSignHoroscopeHeader = title === 'Гороскоп по знакам' || title === 'Гороскоп по знакам зодиака';
  const settings = useContext(AppTopBarSettingsContext);
  const showSettings = Boolean(settings) && title !== 'Настройки' && title !== 'Settings' && title !== 'Premium';
  // One layout everywhere: profile on the left, settings on the right (as on the home screen).
  const startAction = onBack ? null : leftAction ?? rightAction ?? null;
  const endAction = onBack || leftAction ? rightAction : null;

  return (
    <>
      <div className={className ? `home-logo-bar app-top-bar ${className}` : 'home-logo-bar app-top-bar'}>
        <div className="app-top-bar-side app-top-bar-side--start">
          {onBack ? (
            <button
              className="app-top-bar-action"
              onClick={onBack}
              type="button"
              aria-label="Назад / Back"
            >
              <ChevronLeft aria-hidden strokeWidth={1.9} />
            </button>
          ) : startAction}
        </div>

        {center ?? (
        <span
          className={`home-logo-wordmark app-top-bar-title${
            isPersonalForecastHeader ? ' app-top-bar-title--personal-forecast' : isSignHoroscopeHeader ? ' app-top-bar-title--sign-horoscope' : ''
          }`}
        >
          {isPersonalForecastHeader ? (
            <NeboLogo
              className="app-top-bar-cloud-logo"
              fullCloud
              size="header"
              priority
            />
          ) : isSignHoroscopeHeader ? (
            <><span>Гороскоп по знакам</span><span>зодиака</span></>
          ) : title}
        </span>
        )}

        <div className={`app-top-bar-side app-top-bar-side--end${endAction || showSettings ? ' has-actions' : ''}`}>
          {endAction || showSettings ? (
            <div className="app-top-bar-actions">
              {endAction}
              {showSettings ? (
                <button
                  className="app-top-bar-action app-top-bar-settings-button"
                  onClick={settings?.onOpenSettings}
                  type="button"
                  aria-label="Открыть настройки"
                >
                  <Settings aria-hidden strokeWidth={1.8} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {reserveSpace ? <div className="app-top-bar-spacer" aria-hidden /> : null}
      {reserveSpace && subtitle ? (
        <div
          className={`app-top-bar-context${
            isPersonalForecastHeader ? ' app-top-bar-context--period' : ''
          }`}
        >
          {subtitle}
        </div>
      ) : null}
    </>
  );
}
