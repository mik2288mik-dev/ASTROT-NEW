import React, { useState } from 'react';
import { admin2Auth, Admin2Error } from '../../services/admin2Service';

export interface AdminAccessScreenProps {
  error?: Admin2Error | Error | null;
  busy?: boolean;
  onRetry?: () => void;
  onAuthenticated?: () => void;
  onClose?: () => void;
}

export function AdminAccessScreen({
  error = null,
  busy = false,
  onRetry,
  onAuthenticated,
  onClose,
}: AdminAccessScreenProps) {
  const storedAuth = admin2Auth.getStoredDevAuth();
  const [userId, setUserId] = useState(storedAuth?.userId || '');
  const [secret, setSecret] = useState(storedAuth?.secret || '');
  const [formError, setFormError] = useState<string | null>(null);
  const code = error instanceof Admin2Error ? error.code : null;
  const hasTelegramAuth = admin2Auth.hasTelegramAuth();

  const handleAction = () => {
    if (onAuthenticated) onAuthenticated();
    else if (onRetry) onRetry();
  };

  const saveAndRetry = () => {
    setFormError(null);
    if (!userId.trim() || !secret) {
      setFormError('Укажите Admin User ID и Secret.');
      return;
    }
    admin2Auth.saveDevAuth(userId.trim(), secret.trim());
    handleAction();
  };

  const clearAndRetry = () => {
    admin2Auth.clearDevAuth();
    setSecret('');
    handleAction();
  };

  return (
    <div className="admin2-app fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 text-[#312D4B] bg-[#F4F5FA]">
      <div className="w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(20,30,60,0.14)]">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-[#312D4B] p-8 text-white flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 text-white">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4Zm0 3.2 6 2.7V11c0 4-2.5 7.6-6 8.8C8.5 18.6 6 15 6 11V6.9l6-2.7Zm-1 10.6 6-6-1.4-1.4L11 12l-2.1-2.1-1.4 1.4 3.5 3.5Z" />
                </svg>
              </div>
              <h1 className="mt-6 text-3xl font-bold leading-tight">NEBO Operations</h1>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Центр управления и система наблюдаемости приложения. Для доступа требуются права администратора.
              </p>
            </div>
            <div className="mt-8 space-y-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-white/50 text-xs">Режим авторизации</p>
                <p className="mt-1 font-semibold">{hasTelegramAuth ? 'Telegram initData' : storedAuth ? 'Browser-dev credentials' : 'Ожидает ввода'}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-white/50 text-xs">Статус API</p>
                <p className="mt-1 font-semibold">{code || (error ? error.message : 'Готов к подключению')}</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold text-[#312D4B]">Вход в админ-панель</p>
                  <p className="mt-1 text-sm text-slate-400">В локальной разработке используется Browser-dev доступ.</p>
                </div>
                {onClose ? (
                  <button className="admin2-button admin2-button--secondary" onClick={onClose}>
                    В приложение
                  </button>
                ) : null}
              </div>

              {error ? <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{error.message}</div> : null}
              {formError ? <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">{formError}</div> : null}

              <div className="mt-6 space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Admin User ID
                  <input
                    className="admin2-input mt-1 w-full"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Telegram ID администратора или Owner ID"
                  />
                </label>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Browser-dev secret
                  <input
                    className="admin2-input mt-1 w-full"
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="ADMIN_WEB_DEV_SECRET"
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button className="admin2-button admin2-button--primary" disabled={busy} onClick={saveAndRetry}>
                    {busy ? 'Проверяю…' : 'Войти в панель'}
                  </button>
                  <button className="admin2-button admin2-button--secondary" disabled={busy} onClick={onRetry}>
                    Повторить Telegram
                  </button>
                  {storedAuth ? (
                    <button className="admin2-button admin2-button--secondary" disabled={busy} onClick={clearAndRetry}>
                      Сбросить
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
              <b className="text-slate-700">Production:</b> вход выполняется автоматически через Telegram Mini App.
              <br />
              <b className="text-slate-700">Desktop / Local:</b> укажите ID администратора и секрет из <code className="text-slate-800 font-mono">.env</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
