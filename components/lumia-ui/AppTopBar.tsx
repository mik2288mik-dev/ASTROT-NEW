import React, { createContext, useContext } from 'react';
import { ChevronLeft, Settings } from 'lucide-react';
import { NeboLogo } from '../brand/NeboLogo';
import { AvatarCircle } from '../nebo/AvatarPicker';

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

/** Who is signed in, for the account chip on the right of the bar (as on the canvas). */
export type AppTopBarAccount = { id: string; name: string; plus: boolean; guest: boolean };

type AppTopBarSettingsContextValue = { onOpenSettings: () => void; onStepBack?: (() => void) | null; account?: AppTopBarAccount | null } | null;

const AppTopBarSettingsContext = createContext<AppTopBarSettingsContextValue>(null);

/** Makes Settings a real shared-header action instead of a menu-only shortcut. */
export function AppTopBarSettingsProvider({
  onOpenSettings,
  onStepBack,
  account,
  children,
}: {
  onOpenSettings: () => void;
  /** One step back for screens whose bar has no «Back» of its own; null on the home screen. */
  onStepBack?: (() => void) | null;
  account?: AppTopBarAccount | null;
  children: React.ReactNode;
}) {
  return (
    <AppTopBarSettingsContext.Provider value={{ onOpenSettings, onStepBack, account }}>
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
  onBack: onBackProp,
  rightAction,
  leftAction,
  center,
  reserveSpace = true,
  className,
}: AppTopBarProps) {
  const isPersonalForecastHeader = title === 'NEBO';
  const isSignHoroscopeHeader = title === 'Гороскоп по знакам' || title === 'Гороскоп по знакам зодиака';
  const settings = useContext(AppTopBarSettingsContext);
  // Every screen except the home one can step back, even when it did not ask for a «Back» itself.
  const onBack = onBackProp ?? (title !== 'NEBO' ? settings?.onStepBack ?? undefined : undefined);
  const showSettings = Boolean(settings) && title !== 'Настройки' && title !== 'Settings' && title !== 'Premium';
  // Main screens (no «Back») follow the canvas: the NEBO brand on the left, the account chip on the right.
  const mainScreen = !onBack;
  const account = settings?.account ?? null;
  const brand = (
    <span className="nebo-bar-brand">
      <img src="/assets/brand/nebo-app-icon-192.png" alt="" width={26} height={26} />
      <strong>NEBO</strong>
    </span>
  );
  const startAction = onBack ? null : brand;
  const endAction = onBack || leftAction ? rightAction : null;
  const showChip = mainScreen && Boolean(account) && showSettings;
  const chip = account ? (
    <button
      type="button"
      className="nebo-account-chip"
      onClick={settings?.onOpenSettings}
      aria-label={account.guest ? 'Гость. Войти' : `Аккаунт: ${account.name}${account.plus ? ', Plus' : ''}`}
    >
      {account.guest
        ? <span className="nebo-account-chip-avatar is-guest" aria-hidden />
        : <AvatarCircle userId={account.id} name={account.name} className="nebo-account-chip-avatar" />}
      <span className="nebo-account-chip-name">{account.guest ? 'Гость' : account.name.trim().split(/\s+/)[0]}</span>
      <span className={account.plus ? 'nebo-account-chip-badge is-plus' : 'nebo-account-chip-badge'}>
        {account.guest ? 'Войти' : account.plus ? 'Plus' : 'Free'}
      </span>
    </button>
  ) : null;

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

        {center ?? (mainScreen ? <span className="app-top-bar-title nebo-bar-title-empty" /> : (
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
          ) : title}
        </span>
        ))}

        <div className={`app-top-bar-side app-top-bar-side--end${endAction || showSettings ? ' has-actions' : ''}`}>
          {endAction || showSettings ? (
            <div className="app-top-bar-actions">
              {endAction}
              {showChip ? chip : showSettings ? (
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
