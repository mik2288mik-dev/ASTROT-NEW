import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Eye, EyeOff, Mail } from 'lucide-react';
import { NeboLogo } from '../components/brand/NeboLogo';
import type { UserProfile } from '../types';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../lib/nativeBack';
import { meetsMinimumPasswordLength } from '../lib/auth/passwordPolicy';
import {
  authenticateWithProvider,
  completePasswordReset,
  getAccountAuthCapabilities,
  getLocalAccountAuthCapabilities,
  loginWithTelegram,
  loginWithEmailPassword,
  registerEmailPassword,
  requestPasswordReset,
  verifyEmailPasswordRegistration,
  type AccountAuthCapabilities,
} from '../services/accountAuthService';
import { hasTelegramMiniAppContext } from '../services/authSessionIntent';

type AuthGateProps = {
  deleted?: boolean;
  message?: string | null;
  onAccountLogin: (profile: UserProfile) => void;
  onGuestStart: () => Promise<void>;
};

type AuthScreen = 'register' | 'verify' | 'login' | 'forgot' | 'reset';
type Provider = 'yandex' | 'vk';

const PROVIDERS: Array<{ id: Provider; label: string; shortLabel: string }> = [
  { id: 'yandex', label: 'Продолжить с Яндексом', shortLabel: 'Яндекс' },
  { id: 'vk', label: 'Продолжить с VK ID', shortLabel: 'VK ID' },
];

function authErrorCode(error: unknown): string {
  const value = error as { code?: string; message?: string; name?: string } | null;
  return String(value?.code || value?.message || value?.name || '').trim();
}

function readableAuthError(error: unknown): string {
  const code = authErrorCode(error);
  if (code.includes('AUTH_CANCELLED')) return '';
  if (code.includes('AUTH_TIMEOUT')) {
    return 'Вход занял слишком много времени. Проверь сеть и попробуй ещё раз.';
  }
  if (code.includes('NETWORK') || code.includes('OFFLINE') || code.includes('Failed to fetch')) {
    return 'Нет соединения с интернетом. Проверь сеть и попробуй ещё раз.';
  }
  if (code.includes('RATE_LIMIT') || code.includes('TOO_MANY')) {
    return 'Слишком много попыток. Подожди немного и попробуй снова.';
  }
  if (code.includes('PASSWORD_INVALID') || code.includes('INVALID_CREDENTIALS')) {
    return 'Email или пароль не подошли.';
  }
  if (code.includes('PASSWORD_TOO_SHORT')) {
    return 'Не менее 8 символов';
  }
  if (code.includes('PASSWORD_CONFIRMATION')) {
    return 'Пароли не совпадают.';
  }
  if (code.includes('CODE_INVALID') || code.includes('CHALLENGE_INVALID') || code.includes('CODE_EXPIRED')) {
    return 'Код неверный или уже истёк. Запроси новый код.';
  }
  if (code.includes('IDENTITY_ALREADY_LINKED')) {
    return 'Этот способ входа уже принадлежит другому аккаунту. Войди в тот аккаунт — данные автоматически не объединяются.';
  }
  if (code.includes('AUTH_PROVIDER_NOT_CONFIGURED')) {
    return 'Этот способ входа пока не настроен. Выбери другой.';
  }
  if (code.includes('EMAIL') && (code.includes('INVALID') || code.includes('REQUIRED'))) {
    return 'Проверь email и попробуй ещё раз.';
  }
  return 'Не удалось завершить вход. Проверь данные и соединение, затем попробуй снова.';
}

const fieldClass = 'min-h-[50px] w-full rounded-2xl border border-[#dfe3e8] bg-white px-4 text-[16px] text-[#111827] outline-none transition-colors placeholder:text-[#9aa0aa] focus:border-[#4f6f62] disabled:bg-[#f5f6f7]';
const primaryClass = 'auth-primary-button min-h-12 w-full rounded-2xl px-5 text-[16px] font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const providerClass = 'auth-provider-button min-h-12 w-full rounded-2xl px-3 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50';

export const AuthGate: React.FC<AuthGateProps> = ({
  deleted = false,
  message,
  onAccountLogin,
  onGuestStart,
}) => {
  const [screen, setScreen] = useState<AuthScreen>('register');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const initialLocalCapabilities = getLocalAccountAuthCapabilities();
  const [capabilities, setCapabilities] = useState<AccountAuthCapabilities | null>(
    () => initialLocalCapabilities,
  );
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false);
  const [capabilitiesLoadFailed, setCapabilitiesLoadFailed] = useState(false);
  const [capabilitiesReload, setCapabilitiesReload] = useState(0);
  const authPreview = process.env.NODE_ENV === 'development'
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('authPreview') === '1';

  useEffect(() => {
    let alive = true;
    const loadCapabilities = async () => {
      try {
        const value = await getAccountAuthCapabilities();
        if (!alive) return;
        setCapabilities(value);
        setCapabilitiesLoaded(true);
        setCapabilitiesLoadFailed(false);
      } catch {
        if (!alive) return;
        // Keep locally compiled Yandex/VK visible. Only the remote email
        // capability is unknown when discovery fails.
        setCapabilities((current) => current || getLocalAccountAuthCapabilities());
        setCapabilitiesLoaded(true);
        setCapabilitiesLoadFailed(true);
      }
    };
    const retryOnReconnect = () => { void loadCapabilities(); };
    void loadCapabilities();
    window.addEventListener('online', retryOnReconnect);
    return () => {
      alive = false;
      window.removeEventListener('online', retryOnReconnect);
    };
  }, [capabilitiesReload]);

  useEffect(() => {
    const onNativeBack = (event: Event) => {
      if (screen === 'register' && !emailExpanded) return;
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail) detail.handled = true;
      setError('');
      setNotice('');
      setCode('');
      setChallengeId('');
      if (screen === 'register') {
        setEmailExpanded(false);
      } else if (screen === 'verify') {
        setScreen('register');
        setEmailExpanded(true);
      } else {
        setScreen(screen === 'reset' ? 'forgot' : screen === 'forgot' ? 'login' : 'register');
        setEmailExpanded(false);
      }
    };
    window.addEventListener(NATIVE_BACK_EVENT, onNativeBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, onNativeBack);
  }, [emailExpanded, screen]);

  const emailPasswordReady = capabilities?.emailPassword === true;
  const emailDeliveryReady = capabilities?.emailDelivery === true;
  const emailLoginVisible = authPreview || emailPasswordReady;
  const availableProviders = authPreview
    ? PROVIDERS
    : PROVIDERS.filter((provider) => capabilities?.[provider.id] === true);
  const telegramReady = hasTelegramMiniAppContext();
  const emailFlowVisible = authPreview || screen === 'verify' || screen === 'reset'
    || (screen === 'login' ? emailPasswordReady : emailDeliveryReady);
  const passwordFieldsValid = useMemo(
    () => email.trim().length > 0 && meetsMinimumPasswordLength(password) && password === passwordConfirmation,
    [email, password, passwordConfirmation],
  );

  const changeScreen = (next: AuthScreen) => {
    if (busy) return;
    setScreen(next);
    setError('');
    setNotice('');
    setCode('');
    setChallengeId('');
    setPassword('');
    setPasswordConfirmation('');
    setPasswordVisible(false);
    setPasswordConfirmationVisible(false);
    setEmailExpanded(false);
  };

  const openEmailRegistration = () => {
    if (busy) return;
    setScreen('register');
    setError('');
    setNotice('');
    setCode('');
    setChallengeId('');
    setPassword('');
    setPasswordConfirmation('');
    setPasswordVisible(false);
    setPasswordConfirmationVisible(false);
    setEmailExpanded(true);
  };

  const runProvider = async (provider: Provider) => {
    if (busy) return;
    if (authPreview) {
      setError('');
      setNotice(`В Android-приложении откроется вход через ${provider === 'yandex' ? 'Яндекс' : 'VK ID'}.`);
      return;
    }
    setError('');
    setNotice('');
    setBusy(provider);
    try {
      const profile = await authenticateWithProvider(provider, 'login');
      if (profile) onAccountLogin(profile);
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const runTelegram = async () => {
    if (busy) return;
    if (authPreview) {
      setError('');
      setNotice('В Telegram Mini App здесь откроется вход через Telegram.');
      return;
    }
    if (!hasTelegramMiniAppContext()) return;
    setError('');
    setNotice('');
    setBusy('telegram');
    try {
      onAccountLogin(await loginWithTelegram());
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const runGuest = async () => {
    if (busy) return;
    // Keep the existing "Продолжить без аккаунта" guest contract; only the visible CTA is shorter.
    if (authPreview) {
      setError('');
      setNotice('В приложении здесь начнётся гостевой режим без регистрации.');
      return;
    }
    setError('');
    setNotice('');
    setBusy('guest');
    try {
      await onGuestStart();
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const goBack = () => {
    if (busy) return;
    if (screen === 'register') {
      setError('');
      setNotice('');
      setEmailExpanded(false);
      return;
    }
    if (screen === 'verify') {
      openEmailRegistration();
      return;
    }
    changeScreen(screen === 'reset' ? 'forgot' : screen === 'forgot' ? 'login' : 'register');
  };

  const submitRegistration = async () => {
    if (busy || !passwordFieldsValid) return;
    setError('');
    setNotice('');
    if (authPreview) {
      setChallengeId('auth-preview');
      setCode('');
      setScreen('verify');
      setNotice('На почту придёт шестизначный код. Введи его здесь, чтобы подтвердить email.');
      return;
    }
    setBusy('email');
    try {
      const result = await registerEmailPassword({
        email: email.trim(),
        password,
        passwordConfirmation,
      });
      setChallengeId(result.challengeId);
      setCode('');
      setScreen('verify');
      setNotice('Если email свободен, шестизначный код отправлен. Если аккаунт уже существует — войди или восстанови пароль: профили автоматически не объединяются.');
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const verifyRegistration = async () => {
    if (busy || !challengeId || code.length !== 6) return;
    setError('');
    if (authPreview) {
      setNotice('В приложении код подтвердит email и завершит создание аккаунта.');
      return;
    }
    setBusy('email');
    try {
      onAccountLogin(await verifyEmailPasswordRegistration(challengeId, code));
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const submitLogin = async () => {
    if (busy || !email.trim() || !password) return;
    setError('');
    if (authPreview) {
      setNotice('В приложении здесь выполняется вход по email.');
      return;
    }
    setBusy('email');
    try {
      onAccountLogin(await loginWithEmailPassword(email.trim(), password));
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const beginReset = async () => {
    if (busy || !email.trim()) return;
    setError('');
    if (authPreview) {
      setChallengeId('auth-preview-reset');
      setCode('');
      setScreen('reset');
      setNotice('На почту придёт шестизначный код для восстановления пароля.');
      return;
    }
    setBusy('email');
    try {
      const result = await requestPasswordReset(email.trim());
      setChallengeId(result.challengeId);
      setCode('');
      setScreen('reset');
      setNotice('Если такой аккаунт существует, код уже отправлен на email.');
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const finishReset = async () => {
    if (busy || !challengeId || code.length !== 6 || !passwordFieldsValid) return;
    setError('');
    if (authPreview) {
      setNotice('В приложении новый пароль сохранится после проверки кода.');
      return;
    }
    setBusy('email');
    try {
      onAccountLogin(await completePasswordReset({
        challengeId,
        code,
        password,
        passwordConfirmation,
      }));
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const isRegister = screen === 'register';
  const isLogin = screen === 'login';
  const isEmailRegistration = isRegister && emailExpanded;
  const isLanding = isRegister && !emailExpanded;
  const showEmailForm = emailFlowVisible && (!isRegister || isEmailRegistration);
  const title = screen === 'register'
    ? 'Начать'
    : screen === 'verify'
      ? 'Подтвердить email'
      : screen === 'login'
        ? 'Войти по email'
        : screen === 'forgot'
          ? 'Восстановить пароль'
          : 'Новый пароль';
  const registerTitle = 'Твой гороскоп — и намного больше';
  const visibleTitle = isLanding ? registerTitle : isEmailRegistration ? 'Создать аккаунт' : title;

  return (
    <main className="auth-editorial-page fixed inset-0 h-[100dvh] overflow-y-auto bg-white text-[#111827]">
      <div className="flex min-h-full w-full items-start justify-center px-4 py-3 sm:py-7">
        <section className="relative w-full max-w-[460px] bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!isLanding ? (
            <button
              type="button"
              className="auth-back-button absolute left-0 top-1 flex h-11 w-11 items-center justify-center rounded-full"
              aria-label="Назад"
              disabled={busy !== null}
              onClick={goBack}
            >
              <ChevronLeft size={26} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
          <div className={isLanding ? 'text-center' : 'mb-3 text-center'} role="img" aria-label="NEBO">
            <NeboLogo decorative priority />
          </div>
          <h1 className={isLanding
            ? 'mx-auto text-center text-[27px] font-semibold leading-[1.06] tracking-[-0.03em]'
            : 'text-center text-[29px] font-semibold leading-tight tracking-[-0.025em]'}
          >
            {visibleTitle}
          </h1>
          {(message || deleted) && isLanding && !authPreview ? (
            <p className="mx-auto mt-3 rounded-2xl bg-[#fff3f2] px-4 py-3 text-center text-[14px] leading-5 text-[#9f2f28]">
              {message || 'Аккаунт удалён. Можно создать новый или войти в существующий.'}
            </p>
          ) : null}

          {isLanding ? (
            <>
              <p className="mx-auto mt-2.5 text-center text-[15px] leading-[1.35] text-[#62676f]">
                Личный прогноз на сегодня, неделю и месяц — по твоим данным рождения.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-left">
                <div className="min-w-0">
                  <strong className="block text-[14px] leading-[1.15]">Все знаки зодиака</strong>
                  <span className="mt-0.5 block text-[13px] leading-4 text-[#62676f]">Сегодня, неделя и месяц</span>
                </div>
                <div className="min-w-0">
                  <strong className="block text-[14px] leading-[1.15]">Полная натальная карта</strong>
                  <span className="mt-0.5 block text-[13px] leading-4 text-[#62676f]">Планеты, дома, аспекты и разбор</span>
                </div>
                <div className="min-w-0">
                  <strong className="block text-[14px] leading-[1.15]">Совместимость</strong>
                  <span className="mt-0.5 block text-[13px] leading-4 text-[#62676f]">По знакам зодиака и двум картам</span>
                </div>
                <div className="min-w-0">
                  <strong className="block text-[14px] leading-[1.15]">ИИ-астролог</strong>
                  <span className="mt-0.5 block text-[13px] leading-4 text-[#62676f]">Вопросы по своей карте</span>
                </div>
                <div className="col-span-2 min-w-0">
                  <strong className="inline text-[14px] leading-4">Библиотека</strong>
                  <span className="ml-1 text-[13px] leading-4 text-[#62676f]">— понятные материалы об астрологии</span>
                </div>
              </div>
              <button
                type="button"
                className={`${primaryClass} mt-4`}
                disabled={busy !== null}
                onClick={() => { void runGuest(); }}
              >
                {busy === 'guest' ? 'Создаём профиль…' : 'Начать без регистрации'}
              </button>
              <p className="mt-2 text-center text-[12px] leading-4 text-[#777d85]">
                Аккаунт можно привязать позже.
              </p>
            </>
          ) : null}

          {isLanding && (availableProviders.length > 0 || telegramReady || emailLoginVisible) ? (
            <div className="mt-2.5">
              <p className="text-center text-[12px] leading-4 text-[#8a8f96]">или</p>
              <p className="mb-2 mt-1 text-center text-[13px] font-medium leading-4 text-[#4f555d]">Войти с помощью</p>
              <div className={`grid gap-2 ${availableProviders.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {availableProviders.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className={`${providerClass} auth-provider-button--${provider.id}`}
                    aria-label={provider.label}
                    disabled={busy !== null}
                    onClick={() => { void runProvider(provider.id); }}
                  >
                    <span className={`auth-provider-mark auth-provider-mark--${provider.id}`} aria-hidden="true">
                      {provider.id === 'yandex' ? 'Я' : (
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M2.5 6.2h3.4l3.25 7.05V6.2h3.05v4.1l3.65-4.1h3.75l-4.45 4.85 5.05 6.75h-3.9l-4.1-5.45v5.45H8.65L2.5 6.2Z" />
                        </svg>
                      )}
                    </span>
                    <span>{busy === provider.id ? 'Открываем…' : provider.shortLabel}</span>
                  </button>
                ))}
                {telegramReady ? (
                  <button
                    type="button"
                    className={`${providerClass} auth-provider-button--telegram col-span-full`}
                    aria-label="Войти через Telegram"
                    disabled={busy !== null}
                    onClick={() => { void runTelegram(); }}
                  >
                    <span className="auth-provider-mark auth-provider-mark--telegram" aria-hidden="true">T</span>
                    <span>{busy === 'telegram' ? 'Открываем…' : 'Telegram'}</span>
                  </button>
                ) : null}
                {emailLoginVisible ? (
                  <button
                    type="button"
                    className={`${providerClass} auth-provider-button--email col-span-full`}
                    aria-label="Войти по email"
                    disabled={busy !== null}
                    onClick={() => changeScreen('login')}
                  >
                    <Mail size={19} strokeWidth={2} aria-hidden="true" />
                    <span>Войти по email</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showEmailForm ? <div className={(isEmailRegistration || isLogin) ? 'mt-5 grid gap-2.5' : 'mt-7 grid gap-2.5'}>
            {isEmailRegistration ? (
              <p className="text-[13px] leading-[1.35] text-[#62676f]">
                На почту придёт шестизначный код. Введи его на следующем экране, чтобы подтвердить email.
              </p>
            ) : null}
            {screen !== 'verify' && screen !== 'reset' ? (
              <label className="grid gap-1.5 text-[13px] font-medium text-[#4b5563]">
                Email
                <input
                  className={fieldClass}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  disabled={busy !== null}
                />
              </label>
            ) : null}

            {(screen === 'register' || screen === 'login' || screen === 'reset') ? (
              <div className="grid gap-1.5 text-[13px] font-medium text-[#4b5563]">
                <label htmlFor="auth-password">{screen === 'reset' ? 'Новый пароль' : 'Пароль'}</label>
                <div className="relative">
                  <input
                    id="auth-password"
                    className={`${fieldClass} pr-12`}
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete={screen === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Минимум 8 символов"
                    disabled={busy !== null}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle absolute right-0 top-1/2 flex h-11 w-12 -translate-y-1/2 items-center justify-center rounded-xl text-[#687079] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#4f6f62] disabled:opacity-50"
                    aria-label={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                    aria-pressed={passwordVisible}
                    disabled={busy !== null}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            ) : null}

            {(screen === 'register' || screen === 'reset') ? (
              <div className="grid gap-1.5 text-[13px] font-medium text-[#4b5563]">
                <label htmlFor="auth-password-confirmation">Повторите пароль</label>
                <div className="relative">
                  <input
                    id="auth-password-confirmation"
                    className={`${fieldClass} pr-12`}
                    type={passwordConfirmationVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    placeholder="Повторите пароль"
                    disabled={busy !== null}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle absolute right-0 top-1/2 flex h-11 w-12 -translate-y-1/2 items-center justify-center rounded-xl text-[#687079] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#4f6f62] disabled:opacity-50"
                    aria-label={passwordConfirmationVisible ? 'Скрыть повтор пароля' : 'Показать повтор пароля'}
                    aria-pressed={passwordConfirmationVisible}
                    disabled={busy !== null}
                    onClick={() => setPasswordConfirmationVisible((visible) => !visible)}
                  >
                    {passwordConfirmationVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            ) : null}

            {(screen === 'verify' || screen === 'reset') ? (
              <label className="grid gap-1.5 text-[13px] font-medium text-[#4b5563]">
                Шестизначный код из письма
                <input
                  className={fieldClass}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  disabled={busy !== null}
                />
              </label>
            ) : null}

            {screen === 'register' ? (
              <button className={primaryClass} type="button" disabled={busy !== null || (!emailDeliveryReady && !authPreview) || !passwordFieldsValid} onClick={() => { void submitRegistration(); }}>
                {busy === 'email' ? 'Отправляем код…' : 'Создать аккаунт'}
              </button>
            ) : screen === 'verify' ? (
              <button className={primaryClass} type="button" disabled={busy !== null || code.length !== 6} onClick={() => { void verifyRegistration(); }}>
                {busy === 'email' ? 'Проверяем…' : 'Подтвердить email'}
              </button>
            ) : screen === 'login' ? (
              <button className={primaryClass} type="button" disabled={busy !== null || (!emailPasswordReady && !authPreview) || !email.trim() || !password} onClick={() => { void submitLogin(); }}>
                {busy === 'email' ? 'Входим…' : 'Войти'}
              </button>
            ) : screen === 'forgot' ? (
              <button className={primaryClass} type="button" disabled={busy !== null || (!emailDeliveryReady && !authPreview) || !email.trim()} onClick={() => { void beginReset(); }}>
                {busy === 'email' ? 'Отправляем код…' : 'Получить код'}
              </button>
            ) : (
              <button className={primaryClass} type="button" disabled={busy !== null || code.length !== 6 || !passwordFieldsValid} onClick={() => { void finishReset(); }}>
                {busy === 'email' ? 'Сохраняем…' : 'Сохранить новый пароль'}
              </button>
            )}
          </div> : null}

          {screen === 'verify' ? (
            <button type="button" className="mx-auto mt-3 block text-[14px] font-medium text-[#395a50]" disabled={busy !== null} onClick={() => { void submitRegistration(); }}>
              Отправить новый код
            </button>
          ) : screen === 'reset' ? (
            <button type="button" className="mx-auto mt-3 block text-[14px] font-medium text-[#395a50]" disabled={busy !== null} onClick={() => { void beginReset(); }}>
              Отправить новый код
            </button>
          ) : null}

          {isLogin && (authPreview || emailDeliveryReady) ? (
            <button type="button" className="mx-auto mt-4 block text-[14px] font-medium text-[#395a50]" disabled={busy !== null} onClick={() => changeScreen('forgot')}>
              Забыли пароль?
            </button>
          ) : null}

          {isEmailRegistration ? (
            <p className="mt-6 text-center text-[14px] text-[#687079]">
              Уже есть аккаунт?{' '}
              <button type="button" className="rounded-md px-1 font-semibold text-[#28493f]" disabled={busy !== null} onClick={() => changeScreen('login')}>Войти</button>
            </p>
          ) : screen === 'login' && (authPreview || emailDeliveryReady) ? (
            <p className="mt-6 text-center text-[14px] text-[#687079]">
              Нет аккаунта?{' '}
              <button type="button" className="rounded-md px-1 font-semibold text-[#28493f]" disabled={busy !== null} onClick={openEmailRegistration}>Создать</button>
            </p>
          ) : null}

          {!authPreview && capabilitiesLoaded && !capabilitiesLoadFailed && !emailDeliveryReady && capabilities ? (
            <p className="mt-4 text-center text-[12px] leading-4 text-[#8a7159]">Отправка писем будет доступна после настройки почтового сервиса.</p>
          ) : null}
          {!authPreview && capabilitiesLoadFailed ? (
            <div className="mt-4 text-center text-[12px] leading-4 text-[#8a7159]">
              <p>Не удалось проверить вход по почте. Гостевой вход, Яндекс и VK ID остаются доступны.</p>
              <button
                type="button"
                className="mt-2 font-semibold text-[#395a50]"
                onClick={() => {
                  setCapabilitiesLoaded(false);
                  setCapabilitiesLoadFailed(false);
                  setCapabilitiesReload((value) => value + 1);
                }}
              >
                Повторить
              </button>
            </div>
          ) : null}
          {!authPreview && !capabilitiesLoaded && !capabilitiesLoadFailed ? (
            <p className="mt-4 text-center text-[12px] leading-4 text-[#687079]">Проверяем вход по почте…</p>
          ) : null}
          {notice ? <p role="status" className="mt-4 rounded-2xl bg-[#eef5f1] px-4 py-3 text-[14px] leading-5 text-[#315348]">{notice}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-2xl bg-[#fff3f2] px-4 py-3 text-[14px] leading-5 text-[#b42318]">{error}</p> : null}
        </section>
      </div>
    </main>
  );
};
