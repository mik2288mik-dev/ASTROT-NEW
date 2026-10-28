import React from 'react';
import { AUTH_SKY_BACK, AUTH_SKY_FRONT } from './authSkyMarkup';

/** Planets that wander over the sky: [image, size px, round crop ratio (0 = no crop), path, seconds, delay]. */
const SKY_BODIES: ReadonlyArray<[number, number, number, number, number]> = [
  [66, 0.86, 1, 54, -12], [88, 0, 2, 66, -40], [36, 0.86, 3, 38, -7], [30, 0.86, 4, 44, -30], [22, 0.86, 5, 30, -3],
  [38, 0.86, 6, 60, -22], [34, 0.86, 7, 50, -18], [44, 0.87, 8, 48, -35], [18, 0.86, 9, 70, -50],
];

type Drag = { x: number; y: number; moved: boolean };
const drags = new WeakMap<HTMLElement, Drag>();

function onDown(event: React.PointerEvent<HTMLDivElement>) {
  const el = event.currentTarget;
  try { el.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
  drags.set(el, { x: event.clientX, y: event.clientY, moved: false });
  el.style.transition = 'transform .12s ease-out';
  el.style.transform = 'scale(1.18)';
}

function onMove(event: React.PointerEvent<HTMLDivElement>) {
  const el = event.currentTarget;
  const drag = drags.get(el);
  if (!drag) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  el.style.transition = 'none';
  el.style.transform = `translate(${dx}px,${dy}px) scale(1.18)`;
}

function onUp(event: React.PointerEvent<HTMLDivElement>) {
  const el = event.currentTarget;
  const drag = drags.get(el);
  if (!drag) return;
  drags.delete(el);
  if (!drag.moved) {
    el.style.transition = 'transform .22s ease-out';
    el.style.transform = 'scale(1.35)';
    window.setTimeout(() => {
      el.style.transition = 'transform 1.1s cubic-bezier(.34,1.8,.5,1)';
      el.style.transform = 'translate(0,0) scale(1)';
    }, 220);
    return;
  }
  el.style.transition = 'transform 1.1s cubic-bezier(.34,1.6,.5,1)';
  el.style.transform = 'translate(0,0) scale(1)';
}

/** The blue sky with clouds that part, wandering planets you can pull, and the cat flying on its planet. */
export function AuthSky() {
  return (
    <div className="nebo-auth-sky" aria-hidden="true">
      <div className="nebo-auth-sky-frame">
        <div className="nebo-auth-sky-layer" dangerouslySetInnerHTML={{ __html: AUTH_SKY_BACK }} />
        <div className="nebo-auth-sky-bodies">
          <img className="nebo-auth-cat" src="/assets/auth/cat-planet.webp" alt="" draggable={false} />
          {SKY_BODIES.map(([size, crop, path, seconds, delay], index) => {
            const pad = crop ? ((1 / crop - 1) / 2) * 100 : 0;
            const imageSize = crop ? 100 / crop : 100;
            return (
              <div key={index} className="nebo-auth-body" style={{ animation: `nbWan${path} ${seconds}s ${delay}s linear infinite` }}>
                <div
                  className="nebo-auth-body-grip"
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  style={{ left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: crop ? '50%' : 0, overflow: crop ? 'hidden' : 'visible' }}
                >
                  <img
                    src={`/assets/auth/body-${index + 1}.webp`}
                    alt=""
                    draggable={false}
                    style={{ left: `${-pad}%`, top: `${-pad}%`, width: `${imageSize}%`, height: `${imageSize}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="nebo-auth-sky-layer is-front" dangerouslySetInnerHTML={{ __html: AUTH_SKY_FRONT }} />
      </div>
    </div>
  );
}

export type AuthLandingProvider = { id: string; label: string };

type AuthLandingProps = {
  providers: ReadonlyArray<AuthLandingProvider>;
  telegramReady: boolean;
  emailVisible: boolean;
  busy: string | null;
  message?: string | null;
  onProvider: (id: string) => void;
  onTelegram: () => void;
  onEmail: () => void;
  onGuest: () => void;
};

/** Entry screen as on the canvas (Auth board): sky on top, sign-in buttons at the bottom. */
export function AuthLanding({ providers, telegramReady, emailVisible, busy, message, onProvider, onTelegram, onEmail, onGuest }: AuthLandingProps) {
  const yandex = providers.find((provider) => provider.id === 'yandex');
  const vk = providers.find((provider) => provider.id === 'vk');
  const others = providers.filter((provider) => provider.id !== 'yandex' && provider.id !== 'vk');
  return (
    <main className="nebo-auth" data-auth-layout="landing">
      <AuthSky />
      <header className="nebo-auth-bar">
        <span className="nebo-auth-brand"><img src="/assets/auth/logo.webp" alt="" width={30} height={30} /><strong>NEBO</strong></span>
      </header>
      <section className="nebo-auth-panel">
        <h1>{'Твоё небо\nна каждый день'}</h1>
        <p className="nebo-auth-sub">Личный день по дате рождения, натальная карта, совместимость и лунные календари.</p>
        {message ? <p className="nebo-auth-message" role="alert">{message}</p> : null}
        {yandex ? (
          <button type="button" className="nebo-auth-btn is-yandex" disabled={busy !== null} onClick={() => onProvider('yandex')}>
            <span className="nebo-auth-mark is-yandex" aria-hidden>Я</span>{busy === 'yandex' ? 'Открываем…' : 'Войти с Яндекс ID'}
          </button>
        ) : null}
        {vk ? (
          <button type="button" className="nebo-auth-btn is-vk" disabled={busy !== null} onClick={() => onProvider('vk')}>
            <span className="nebo-auth-mark is-vk" aria-hidden>VK</span>{busy === 'vk' ? 'Открываем…' : 'Войти с VK ID'}
          </button>
        ) : null}
        {others.map((provider) => (
          <button key={provider.id} type="button" className="nebo-auth-btn is-plain" disabled={busy !== null} onClick={() => onProvider(provider.id)}>
            {busy === provider.id ? 'Открываем…' : provider.label}
          </button>
        ))}
        {telegramReady ? (
          <button type="button" className="nebo-auth-btn is-plain" disabled={busy !== null} onClick={onTelegram}>
            {busy === 'telegram' ? 'Открываем…' : 'Войти через Telegram'}
          </button>
        ) : null}
        {emailVisible ? (
          <button type="button" className="nebo-auth-btn is-plain" disabled={busy !== null} onClick={onEmail}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6" /></svg>
            Войти по почте
          </button>
        ) : null}
        <button type="button" className="nebo-auth-guest" disabled={busy !== null} onClick={onGuest}>
          {busy === 'guest' ? 'Создаём профиль…' : 'Продолжить без входа'}
        </button>
        <p className="nebo-auth-terms">Продолжая, ты принимаешь условия использования и политику конфиденциальности</p>
      </section>
    </main>
  );
}
