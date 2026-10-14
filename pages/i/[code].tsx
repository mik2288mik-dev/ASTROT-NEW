import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const RUSTORE_URL = 'https://www.rustore.ru/catalog/app/ru.tvoygoroskop.app';
const CONTEXT_LABELS: Record<string, string> = { relationship: 'Пара', friendship: 'Дружба', family: 'Семья', work: 'Работа' };

type Preview = { status: string; inviterName: string; relationshipContext: string };

/**
 * Where an invite link lands when NEBO is not installed (or the phone did not hand
 * the link to the app). Shows only a first name, never a photo or birth details.
 */
export default function InvitePage() {
  const router = useRouter();
  const raw = typeof router.query.code === 'string' ? router.query.code : '';
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!router.isReady || code.length !== 8) return;
    let alive = true;
    fetch(`/api/people/invites/${code}`, { credentials: 'omit' })
      .then(async (response) => {
        if (!alive) return;
        if (!response.ok) { setMissing(true); return; }
        setPreview((await response.json()).invite);
      })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [router.isReady, code]);

  const displayCode = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : '';
  const active = preview?.status === 'active';
  const name = preview?.inviterName || '';
  const openApp = `intent://invite/${code}#Intent;scheme=nebo;package=ru.tvoygoroskop.app;S.browser_fallback_url=${encodeURIComponent(RUSTORE_URL)};end`;

  return (
    <>
      <Head>
        <title>Тебя зовут в NEBO</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
        <meta property="og:title" content="Тебя зовут в NEBO" />
        <meta property="og:description" content="Свяжите свои карты и читайте один общий разбор совместимости на двоих." />
      </Head>
      <main className="people-landing">
        <div className="people-landing-card">
          <span className="people-landing-brand">NEBO</span>
          {missing ? (
            <>
              <h1>Приглашение не найдено</h1>
              <p>Возможно, в ссылке опечатка или её уже отменили. Попроси прислать новую.</p>
            </>
          ) : !preview ? (
            <p>Открываем приглашение…</p>
          ) : active ? (
            <>
              <h1>{name ? `${name} зовёт тебя в NEBO` : 'Тебя зовут в NEBO'}</h1>
              <p>
                Свяжите свои карты и читайте один общий разбор совместимости на двоих.
                {preview.relationshipContext && CONTEXT_LABELS[preview.relationshipContext] ? ` Как: ${CONTEXT_LABELS[preview.relationshipContext]}.` : ''}
              </p>
              <a className="people-primary" href={openApp}>Открыть в приложении</a>
              <a className="people-secondary" href={RUSTORE_URL}>Скачать NEBO в RuStore</a>
              <p>
                После установки открой эту ссылку ещё раз или введи код в разделе «Совместимость», вкладка «Близкие»:
              </p>
              <div className="people-code"><span>Код приглашения</span><strong>{displayCode}</strong></div>
            </>
          ) : (
            <>
              <h1>Приглашение больше не действует</h1>
              <p>Ссылка устарела или ею уже воспользовались. Попроси прислать новую, это займёт пару секунд.</p>
              <a className="people-secondary" href={RUSTORE_URL}>NEBO в RuStore</a>
            </>
          )}
        </div>
      </main>
    </>
  );
}
