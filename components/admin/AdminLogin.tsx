import React, { useState } from 'react';
import { KeyRound, Send } from 'lucide-react';
import { admin2, admin2Auth } from '../../services/admin2Service';

/**
 * Sign-in to the admin on the website: the same account as in the app.
 * Fastest for the owner: a one-time link from the events bot. Otherwise email
 * and password. VK ID and Яндекс accounts use the bot link.
 */
export function AdminLogin({ notice, denied, onSignedIn, onLogout }: {
  notice?: string | null; denied?: boolean; onSignedIn: () => void; onLogout: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'link' | 'password' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(notice ? { tone: 'bad', text: notice } : null);
  const isLocal = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const stored = admin2Auth.getStoredDevAuth();
  const [devUser, setDevUser] = useState(stored?.userId || '');
  const [devSecret, setDevSecret] = useState(stored?.secret || '');

  const requestLink = async () => {
    setBusy('link'); setMessage(null);
    try {
      await admin2.requestLoginLink();
      setMessage({ tone: 'ok', text: 'Ссылка отправлена в бот «NEBO события». Открой её на этом устройстве.' });
    } catch (error: any) {
      setMessage({ tone: 'bad', text: error?.message || 'Не получилось отправить ссылку' });
    } finally { setBusy(null); }
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('password'); setMessage(null);
    try {
      await admin2.loginWithPassword(email.trim(), password);
      onSignedIn();
    } catch (error: any) {
      setMessage({ tone: 'bad', text: error?.status === 401 || error?.status === 400 ? 'Неверная почта или пароль' : (error?.message || 'Не получилось войти') });
    } finally { setBusy(null); }
  };

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-brand"><span className="adm-logo">NEBO</span><span className="adm-brand-sub">админка</span></div>
        {denied ? (
          <>
            <h1>Нет доступа</h1>
            <p className="adm-muted">Этот аккаунт не администратор. Войди аккаунтом владельца.</p>
            <button type="button" className="adm-btn adm-btn--primary adm-btn--wide" onClick={onLogout}>Войти другим аккаунтом</button>
          </>
        ) : (
          <>
            <h1>Вход</h1>
            <p className="adm-muted">Тем же аккаунтом, что в приложении.</p>
            <button type="button" className="adm-btn adm-btn--primary adm-btn--wide" disabled={busy !== null} onClick={requestLink}>
              <Send aria-hidden="true" />{busy === 'link' ? 'Отправляю…' : 'Прислать ссылку для входа в Telegram'}
            </button>
            <p className="adm-login-or"><span>или почтой</span></p>
            <form onSubmit={signIn} className="adm-form">
              <label>Почта<input className="adm-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label>Пароль<input className="adm-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
              <button type="submit" className="adm-btn adm-btn--wide" disabled={busy !== null}><KeyRound aria-hidden="true" />{busy === 'password' ? 'Вхожу…' : 'Войти'}</button>
            </form>
          </>
        )}
        {message ? <p className={`adm-login-msg ${message.tone === 'ok' ? 'is-ok' : 'is-bad'}`} role="status">{message.text}</p> : null}
        {isLocal ? (
          <details className="adm-login-dev">
            <summary>Локальная разработка</summary>
            <form className="adm-form" onSubmit={(e) => { e.preventDefault(); admin2Auth.saveDevAuth(devUser, devSecret); onSignedIn(); }}>
              <label>ID администратора<input className="adm-input" value={devUser} onChange={(e) => setDevUser(e.target.value)} /></label>
              <label>ADMIN_WEB_DEV_SECRET<input className="adm-input" type="password" value={devSecret} onChange={(e) => setDevSecret(e.target.value)} /></label>
              <button type="submit" className="adm-btn adm-btn--wide">Войти</button>
            </form>
          </details>
        ) : null}
      </div>
    </div>
  );
}
