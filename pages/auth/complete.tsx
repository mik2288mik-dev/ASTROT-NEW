import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AuthCompletePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    const code = typeof router.query.code === 'string' ? router.query.code : '';
    if (!router.isReady || !code) return;
    void fetch('/api/auth/exchange', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then(async (response) => {
      if (!response.ok) throw new Error('AUTH_EXCHANGE_FAILED');
      window.location.replace('/');
    }).catch(() => setError('Не удалось завершить вход. Вернитесь в приложение и попробуйте ещё раз.'));
  }, [router.isReady, router.query.code]);
  return (
    <main style={{ maxWidth: 520, margin: '64px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Вход в «Твой Гороскоп»</h1>
      <p>{error || 'Завершаем безопасный вход…'}</p>
    </main>
  );
}
