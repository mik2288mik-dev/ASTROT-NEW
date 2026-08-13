import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../types';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../lib/nativeBack';
import {
  authenticateWithProvider,
  completePasswordReset,
  getAccountAuthCapabilities,
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
};

type AuthScreen = 'register' | 'verify' | 'login' | 'forgot' | 'reset';
type Provider = 'google' | 'yandex' | 'vk';

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: 'google', label: 'Продолжить с Google' },
  { id: 'yandex', label: 'Продолжить с Яндексом' },
  { id: 'vk', label: 'Продолжить с VK ID' },
];

function authErrorCode(error: unknown): string {
  const value = error as { code?: string; message?: string; name?: string } | null;
  return String(value?.code || value?.message || value?.name || '').trim();
}

function readableAuthError(error: unknown): string {
  const code = authErrorCode(error);
  if (code.includes('AUTH_CANCELLED')) return '';
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
    return 'Пароль должен содержать не меньше 12 символов.';
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
const primaryClass = 'min-h-[52px] w-full rounded-2xl bg-[#1f3a32] px-5 text-[16px] font-semibold text-white shadow-[0_10px_28px_rgba(31,58,50,0.16)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50';
const providerClass = 'min-h-[52px] w-full rounded-2xl border border-[#d9dde4] bg-white px-5 text-[15px] font-semibold text-[#1f2937] transition-colors disabled:cursor-not-allowed disabled:bg-[#f6f7f8] disabled:text-[#9aa0aa]';

export const AuthGate: React.FC<AuthGateProps> = ({ deleted = false, message, onAccountLogin }) => {
  const [screen, setScreen] = useState<AuthScreen>('register');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [capabilities, setCapabilities] = useState<AccountAuthCapabilities | null>(null);
  const [capabilitiesLoadFailed, setCapabilitiesLoadFailed] = useState(false);
  const [capabilitiesReload, setCapabilitiesReload] = useState(0);

  useEffect(() => {
    let alive = true;
    const loadCapabilities = async () => {
      try {
        const value = await getAccountAuthCapabilities();
        if (!alive) return;
        setCapabilities(value);
        setCapabilitiesLoadFailed(false);
      } catch {
        if (!alive) return;
        setCapabilities(null);
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
      if (screen === 'register') return;
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail) detail.handled = true;
      setError('');
      setNotice('');
      setCode('');
      setChallengeId('');
      setScreen(screen === 'verify' ? 'register' : screen === 'reset' ? 'forgot' : 'register');
    };
    window.addEventListener(NATIVE_BACK_EVENT, onNativeBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, onNativeBack);
  }, [screen]);

  const emailPasswordReady = capabilities?.emailPassword === true;
  const emailDeliveryReady = capabilities?.emailDelivery === true;
  const availableProviders = PROVIDERS.filter((provider) => capabilities?.[provider.id] === true);
  const telegramReady = hasTelegramMiniAppContext();
  const emailFlowVisible = screen === 'verify' || screen === 'reset'
    || (screen === 'login' ? emailPasswordReady : emailDeliveryReady);
  const passwordFieldsValid = useMemo(
    () => email.trim().length > 0 && password.length >= 12 && password === passwordConfirmation,
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
  };

  const runProvider = async (provider: Provider) => {
    if (busy) return;
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
    if (busy || !hasTelegramMiniAppContext()) return;
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

  const submitRegistration = async () => {
    if (busy || !passwordFieldsValid) return;
    setError('');
    setNotice('');
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
  const title = screen === 'register'
    ? 'Создать аккаунт'
    : screen === 'verify'
      ? 'Подтвердить email'
      : screen === 'login'
        ? 'Войти'
        : screen === 'forgot'
          ? 'Восстановить пароль'
          : 'Новый пароль';

  return (
    <main className="auth-editorial-page fixed inset-0 h-[100dvh] overflow-y-auto bg-[#fbfaf7] text-[#111827]">
      <div className="flex min-h-full w-full items-center justify-center px-5 py-8">
        <section className="w-full max-w-sm rounded-[28px] border border-[#e8e5df] bg-white px-5 py-7 shadow-[0_18px_54px_rgba(44,48,45,0.08)] sm:px-7">
          <p className="mb-5 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
            Твой Гороскоп
          </p>
          <h1 className="text-center text-[30px] font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
          {(message || deleted) && isRegister ? (
            <p className="mx-auto mt-3 text-center text-[14px] leading-5 text-[#687079]">
              {message || 'Аккаунт удалён. Можно создать новый или войти в существующий.'}
            </p>
          ) : null}

          {(isRegister || isLogin) ? (
            <div className="mt-7 grid gap-2.5">
              {PROVIDERS.filter((provider) => capabilities?.[provider.id] === true).map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={providerClass}
                  disabled={busy !== null}
                  onClick={() => { void runProvider(provider.id); }}
                >
                  {busy === provider.id ? 'Открываем…' : provider.label}
                </button>
              ))}
              {telegramReady ? (
                <button
                  type="button"
                  className={providerClass}
                  disabled={busy !== null}
                  onClick={() => { void runTelegram(); }}
                >
                  {busy === 'telegram' ? 'Открываем…' : 'Войти через Telegram'}
                </button>
              ) : null}
            </div>
          ) : null}

          {(isRegister || isLogin) && emailFlowVisible && (availableProviders.length > 0 || telegramReady) ? (
            <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-[0.12em] text-[#9aa0aa]">
              <span className="h-px flex-1 bg-[#e5e7eb]" />
              или
              <span className="h-px flex-1 bg-[#e5e7eb]" />
            </div>
          ) : null}

          {emailFlowVisible ? <div className={(isRegister || isLogin) ? 'grid gap-2.5' : 'mt-7 grid gap-2.5'}>
            {screen !== 'verify' && screen !== 'reset' ? (
              <input
                className={fieldClass}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                disabled={busy !== null}
              />
            ) : null}

            {(screen === 'register' || screen === 'login' || screen === 'reset') ? (
              <input
                className={fieldClass}
                type="password"
                autoComplete={screen === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={screen === 'reset' ? 'Новый пароль' : 'Пароль'}
                disabled={busy !== null}
              />
            ) : null}

            {(screen === 'register' || screen === 'reset') ? (
              <input
                className={fieldClass}
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                placeholder="Повторите пароль"
                disabled={busy !== null}
              />
            ) : null}

            {(screen === 'verify' || screen === 'reset') ? (
              <input
                className={fieldClass}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Код из письма"
                aria-label="Код из письма"
                disabled={busy !== null}
              />
            ) : null}

            {screen === 'register' ? (
              <button className={primaryClass} type="button" disabled={busy !== null || !emailDeliveryReady || !passwordFieldsValid} onClick={() => { void submitRegistration(); }}>
                {busy === 'email' ? 'Отправляем код…' : 'Создать аккаунт'}
              </button>
            ) : screen === 'verify' ? (
              <button className={primaryClass} type="button" disabled={busy !== null || code.length !== 6} onClick={() => { void verifyRegistration(); }}>
                {busy === 'email' ? 'Проверяем…' : 'Подтвердить email'}
              </button>
            ) : screen === 'login' ? (
              <button className={primaryClass} type="button" disabled={busy !== null || !emailPasswordReady || !email.trim() || !password} onClick={() => { void submitLogin(); }}>
                {busy === 'email' ? 'Входим…' : 'Войти'}
              </button>
            ) : screen === 'forgot' ? (
              <button className={primaryClass} type="button" disabled={busy !== null || !emailDeliveryReady || !email.trim()} onClick={() => { void beginReset(); }}>
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

          {isLogin ? (
            <button type="button" className="mx-auto mt-4 block text-[14px] font-medium text-[#395a50]" disabled={busy !== null} onClick={() => changeScreen('forgot')}>
              Забыли пароль?
            </button>
          ) : null}

          {screen === 'register' ? (
            <p className="mt-6 text-center text-[14px] text-[#687079]">
              Уже есть аккаунт?{' '}
              <button type="button" className="font-semibold text-[#28493f]" disabled={busy !== null} onClick={() => changeScreen('login')}>Войти</button>
            </p>
          ) : screen === 'login' ? (
            <p className="mt-6 text-center text-[14px] text-[#687079]">
              Нет аккаунта?{' '}
              <button type="button" className="font-semibold text-[#28493f]" disabled={busy !== null} onClick={() => changeScreen('register')}>Создать</button>
            </p>
          ) : (
            <button type="button" className="mx-auto mt-5 block text-[14px] font-medium text-[#395a50]" disabled={busy !== null} onClick={() => changeScreen(screen === 'verify' ? 'register' : 'login')}>
              Назад
            </button>
          )}

          {!emailDeliveryReady && capabilities ? (
            <p className="mt-4 text-center text-[12px] leading-4 text-[#8a7159]">Отправка писем будет доступна после настройки почтового сервиса.</p>
          ) : null}
          {capabilitiesLoadFailed ? (
            <div className="mt-4 text-center text-[12px] leading-4 text-[#8a7159]">
              <p>Не удалось загрузить способы входа.</p>
              <button
                type="button"
                className="mt-2 font-semibold text-[#395a50]"
                onClick={() => {
                  setCapabilitiesLoadFailed(false);
                  setCapabilitiesReload((value) => value + 1);
                }}
              >
                Повторить
              </button>
            </div>
          ) : null}
          {!capabilities && !capabilitiesLoadFailed ? (
            <p className="mt-4 text-center text-[12px] leading-4 text-[#687079]">Загружаем доступные способы входа…</p>
          ) : null}
          {notice ? <p role="status" className="mt-4 rounded-2xl bg-[#eef5f1] px-4 py-3 text-[14px] leading-5 text-[#315348]">{notice}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-2xl bg-[#fff3f2] px-4 py-3 text-[14px] leading-5 text-[#b42318]">{error}</p> : null}
        </section>
      </div>
    </main>
  );
};
