import React, { useState } from 'react';
import type { UserProfile } from '../types';
import {
  beginExternalAuth,
  requestEmailLoginCode,
  verifyEmailLoginCode,
} from '../services/accountAuthService';

type AuthGateProps = {
  canUseTelegram: boolean;
  deleted?: boolean;
  message?: string | null;
  onTelegramLogin: () => Promise<void>;
  onContinueGuest: () => Promise<void>;
  onAccountLogin: (profile: UserProfile) => void;
};

function readableAuthError(error: unknown): string {
  const value = error as { code?: string; message?: string } | null;
  const code = String(value?.code || value?.message || '').trim();
  if (code === 'TELEGRAM_CONTEXT_REQUIRED') {
    return 'Открой приложение из чата с ботом Telegram и попробуй снова.';
  }
  if (code.includes('INIT_DATA') || code.includes('TELEGRAM_AUTH')) {
    return 'Telegram не подтвердил вход. Закрой приложение и снова открой его из чата с ботом.';
  }
  if (code.includes('ACCOUNT_BLOCKED')) {
    return 'Этот аккаунт сейчас недоступен. Обратись в поддержку.';
  }
  if (code.includes('AUTH_PROVIDER_NOT_CONFIGURED')) {
    return 'Этот способ входа пока не подключён. Выбери другой или войди через Telegram.';
  }
  if (code.includes('EMAIL') && (code.includes('INVALID') || code.includes('REQUIRED'))) {
    return 'Проверь email или код из письма и попробуй ещё раз.';
  }
  if (code.includes('IDENTITY_ALREADY_LINKED')) {
    return 'У тебя уже есть аккаунт с этим способом входа. Войди в него — два заполненных профиля автоматически не объединяются.';
  }
  return 'Не удалось войти. Проверь соединение и попробуй ещё раз.';
}

export const AuthGate: React.FC<AuthGateProps> = ({
  canUseTelegram,
  deleted = false,
  message,
  onTelegramLogin,
  onContinueGuest,
  onAccountLogin,
}) => {
  const [busy, setBusy] = useState<'telegram' | 'guest' | 'oauth' | 'email' | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [emailChallengeId, setEmailChallengeId] = useState('');
  const [emailCode, setEmailCode] = useState('');

  const run = async (action: 'telegram' | 'guest') => {
    setError('');
    setBusy(action);
    try {
      if (action === 'telegram') await onTelegramLogin();
      else await onContinueGuest();
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const startOAuth = async (provider: 'vk' | 'yandex' | 'google') => {
    setError('');
    setBusy('oauth');
    try {
      await beginExternalAuth(provider, 'login');
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const requestCode = async () => {
    setError('');
    setBusy('email');
    try {
      const result = await requestEmailLoginCode(email.trim(), 'login');
      setEmailChallengeId(result.challengeId);
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const confirmCode = async () => {
    setError('');
    setBusy('email');
    try {
      const profile = await verifyEmailLoginCode(emailChallengeId, emailCode);
      onAccountLogin(profile);
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="auth-editorial-page fixed inset-0 h-[100dvh] overflow-y-auto bg-white text-[#111827]">
      <div className="flex min-h-full w-full items-center justify-center px-6 py-10">
        <section className="w-full max-w-sm text-center">
        <p className="mb-7 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
          Твой Гороскоп
        </p>
        <h1 className="text-[32px] font-semibold leading-[1.08] tracking-[-0.025em]">
          {deleted ? 'Аккаунт удалён' : 'Войти в аккаунт'}
        </h1>
        <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-6 text-[#5f6672]">
          {message || (deleted
            ? 'Данные этого аккаунта удалены. Можно войти снова или начать с нового гостевого профиля.'
            : 'Ты вышел с этого устройства. Карта, история и Premium вернутся после входа в тот же аккаунт.')}
        </p>

        <div className="mt-8 grid gap-3">
          {canUseTelegram ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => { void run('telegram'); }}
              className="min-h-[52px] rounded-2xl bg-[#168de2] px-5 text-[16px] font-semibold text-white shadow-[0_10px_28px_rgba(22,141,226,0.2)] transition-opacity disabled:opacity-60"
            >
              {busy === 'telegram' ? 'Входим…' : 'Войти через Telegram'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => { void run('guest'); }}
            className="min-h-[52px] rounded-2xl border border-[#d9dde4] bg-white px-5 text-[16px] font-semibold text-[#1f2937] transition-colors disabled:opacity-60"
          >
            {busy === 'guest' ? 'Создаём профиль…' : 'Продолжить как гость'}
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-[12px] uppercase tracking-[0.12em] text-[#9aa0aa]">
          <span className="h-px flex-1 bg-[#e5e7eb]" />
          Другие способы
          <span className="h-px flex-1 bg-[#e5e7eb]" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['vk', 'VK ID'],
            ['yandex', 'Яндекс'],
            ['google', 'Google'],
          ] as const).map(([provider, label]) => (
            <button
              key={provider}
              type="button"
              disabled={busy !== null}
              onClick={() => { void startOAuth(provider); }}
              className="min-h-[44px] rounded-xl border border-[#e0e3e8] bg-[#f8f9fb] px-2 text-[13px] font-semibold text-[#303846] disabled:opacity-60"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email для входа"
            className="min-h-[48px] w-full rounded-xl border border-[#dfe3e8] bg-white px-4 text-[15px] outline-none focus:border-[#168de2]"
          />
          {emailChallengeId ? (
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={emailCode}
                onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Код из письма"
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-[#dfe3e8] bg-white px-4 text-[15px] outline-none focus:border-[#168de2]"
              />
              <button
                type="button"
                disabled={busy !== null || emailCode.length !== 6}
                onClick={() => { void confirmCode(); }}
                className="rounded-xl border border-[#dfe3e8] px-4 text-[14px] font-semibold disabled:opacity-50"
              >
                Войти
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy !== null || !email.trim()}
              onClick={() => { void requestCode(); }}
              className="min-h-[46px] rounded-xl border border-[#dfe3e8] px-4 text-[14px] font-semibold disabled:opacity-50"
            >
              Получить код
            </button>
          )}
        </div>

        <p className="mt-5 text-[13px] leading-5 text-[#7a818d]">
          Гостевой режим создаст отдельный профиль. Он не заменит и не удалит твой аккаунт Telegram.
        </p>
        {error ? (
          <p role="alert" className="mt-5 rounded-2xl bg-[#fff3f2] px-4 py-3 text-left text-[14px] leading-5 text-[#b42318]">
            {error}
          </p>
        ) : null}
        </section>
      </div>
    </main>
  );
};
