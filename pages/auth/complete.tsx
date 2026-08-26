import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AuthCompletePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const status = typeof router.query.status === 'string' ? router.query.status : '';
  const cancelled = status === 'cancelled';
  const failed = status === 'error';
  useEffect(() => {
    const code = typeof router.query.code === 'string' ? router.query.code : '';
    if (!router.isReady || cancelled || failed) return;
    if (!code) {
      setError('Ссылка входа неполная или уже истекла. Начни вход заново.');
      return;
    }
    void fetch('/api/auth/exchange', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, sessionVersion: 2 }),
    }).then(async (response) => {
      if (!response.ok) throw new Error('AUTH_EXCHANGE_FAILED');
      window.location.replace('/');
    }).catch(() => setError('Не удалось завершить вход. Вернитесь в приложение и попробуйте ещё раз.'));
  }, [cancelled, failed, router.isReady, router.query.code]);
  const message = cancelled
    ? 'Вход отменён. Аккаунт и способы входа не изменились.'
    : failed
      ? 'Не удалось завершить вход. Вернись в приложение и попробуй ещё раз.'
      : error || 'Завершаем безопасный вход…';
  return (
    <main style={{ maxWidth: 520, margin: '64px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Вход в NEBO</h1>
      <p>{message}</p>
      {(cancelled || failed || error) ? <a href="/">Вернуться в приложение</a> : null}
    </main>
  );
}
