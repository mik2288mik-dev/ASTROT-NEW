import React from 'react';
import { usePurchases } from '../../services/oneTimePurchaseService';

const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function untilLabel(iso: string | null | undefined, en: boolean): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return en ? `until ${MONTHS_EN[date.getMonth()]} ${date.getDate()}` : `до ${date.getDate()} ${MONTHS_RU[date.getMonth()]}`;
}

type Row = { key: string; icon: string; title: string; sub: string; badge: string; tone: 'ok' | 'muted' };

/** «Покупки» (canvas Purchases): Plus and one-time purchases the server knows about, with their state. */
export function PurchasesList({ userId, plus, premiumUntil, en }: { userId: string; plus: boolean; premiumUntil?: string | null; en: boolean }) {
  const [snapshot] = usePurchases(userId || undefined);
  const now = Date.now();
  const rows: Row[] = [];
  if (plus) {
    rows.push({ key: 'plus', icon: '/assets/nebo-icons/plus.svg', title: 'NEBO Plus', sub: en ? 'Subscription' : 'Подписка', badge: untilLabel(premiumUntil, en) || (en ? 'active' : 'активна'), tone: 'ok' });
  }
  if (snapshot.esoUntil && Date.parse(snapshot.esoUntil) > now) {
    rows.push({ key: 'eso', icon: '/assets/tarot/back.webp', title: en ? 'Tarot, runes and numbers for a year' : 'Таро, руны и числа на год', sub: en ? 'One-time purchase' : 'Разовая покупка', badge: untilLabel(snapshot.esoUntil, en) || '', tone: 'ok' });
  }
  if (snapshot.spreadCredits > 0) {
    rows.push({ key: 'spreads', icon: '/assets/tarot/back.webp', title: en ? 'Tarot spreads' : 'Расклады Таро', sub: en ? 'Bought separately' : 'Куплены отдельно', badge: en ? `${snapshot.spreadCredits} left` : `осталось ${snapshot.spreadCredits}`, tone: 'ok' });
  }
  snapshot.giftCodes.forEach((gift) => {
    rows.push({
      key: gift.code,
      icon: '/assets/nebo-icons/gift.svg',
      title: en ? `Plus gift · ${gift.months} mo.` : `Подарок Plus · ${gift.months} мес.`,
      sub: gift.code,
      badge: gift.redeemed ? (en ? 'used' : 'использован') : (en ? 'not used yet' : 'ещё не использован'),
      tone: gift.redeemed ? 'muted' : 'ok',
    });
  });

  if (!rows.length) {
    return <p className="nebo-purchases-empty">{en ? 'No purchases yet. Everything you buy in NEBO will appear here.' : 'Покупок пока нет. Всё, что купишь в NEBO, появится здесь.'}</p>;
  }
  return (
    <div className="nebo-purchases-list">
      {rows.map((row) => (
        <div key={row.key} className="nebo-purchases-row">
          <img src={row.icon} alt="" width={40} height={40} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
          <span className="nebo-purchases-text"><strong>{row.title}</strong><small>{row.sub}</small></span>
          <span className={`nebo-purchases-badge is-${row.tone}`}>{row.badge}</span>
        </div>
      ))}
    </div>
  );
}
