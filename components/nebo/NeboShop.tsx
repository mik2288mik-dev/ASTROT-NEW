import React, { useEffect, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import type { UserProfile } from '../../types';
import { ONE_TIME_PRODUCTS, hasEsoAccess, type OneTimeProductId } from '../../lib/oneTimeProducts';
import {
  buyOneTimeProduct,
  canBuyOneTimeProducts,
  redeemPlusCode,
  resumePendingPurchases,
  usePurchases,
} from '../../services/oneTimePurchaseService';

const GIFT_OPTIONS: ReadonlyArray<{ id: OneTimeProductId; label: string }> = [
  { id: 'gift_plus_1m', label: '1 месяц' },
  { id: 'gift_plus_3m', label: '3 месяца' },
  { id: 'gift_plus_12m', label: '12 месяцев' },
];

const REDEEM_ERRORS: Record<string, string> = {
  CODE_NOT_FOUND: 'Такого кода нет. Проверь буквы и цифры.',
  CODE_ALREADY_USED: 'Этот код уже использован.',
  CODE_EXPIRED: 'Срок действия кода закончился.',
  CODE_LIMIT_REACHED: 'Этот код уже использовали все, кому он был выдан.',
  SIGN_IN_REQUIRED: 'Чтобы ввести код, войди в аккаунт.',
};

const BUY_ERRORS: Record<string, string> = {
  RECOVERY_IDENTITY_REQUIRED: 'Чтобы покупка не потерялась, сначала привяжи вход через Яндекс, VK или почту в профиле.',
  RUSTORE_ONLY: 'Покупки работают в приложении NEBO из RuStore.',
};

function shareText(code: string, months: number) {
  const period = months === 12 ? 'год' : months === 3 ? '3 месяца' : 'месяц';
  return `Дарю тебе NEBO Plus на ${period}. Открой NEBO, зайди в Профиль → Магазин → «Есть код?» и введи код ${code}`;
}

async function shareCode(code: string, months: number): Promise<'shared' | 'copied' | 'failed'> {
  const text = shareText(code, months);
  try {
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
  } catch { /* the person closed the share sheet */ return 'failed'; }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

type NeboShopProps = {
  profile: UserProfile;
  /** The Plus subscription block (the existing paywall), shown right after «Есть код?». */
  plusContent: React.ReactNode;
};

/** «Магазин» as on the canvas: code, Plus, esoterica, gifts, support. Prices come from the RuStore console. */
export function NeboShop({ profile, plusContent }: NeboShopProps) {
  const userId = profile.id ? String(profile.id) : '';
  const [purchases, reload] = usePurchases(userId || undefined);
  const [sheet, setSheet] = useState<null | 'redeem' | 'gift' | 'done'>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [giftChoice, setGiftChoice] = useState<OneTimeProductId>('gift_plus_3m');
  const [doneText, setDoneText] = useState({ title: '', text: '', code: '', months: 0, reload: false });
  const canBuy = canBuyOneTimeProducts();
  const esoActive = hasEsoAccess(purchases);

  useEffect(() => {
    if (!userId) return;
    void resumePendingPurchases(userId).then((results) => {
      const gift = results.find((result) => result.status === 'completed' && result.giftCode);
      if (gift && gift.status === 'completed' && gift.giftCode) reload();
    });
  }, [userId, reload]);

  const buy = async (productId: OneTimeProductId) => {
    if (busy) return;
    setBusy(true);
    setNote('');
    const result = await buyOneTimeProduct(userId, productId);
    setBusy(false);
    const product = ONE_TIME_PRODUCTS[productId];
    if (result.status === 'completed') {
      const grant = product.grant;
      if (grant.kind === 'gift_code' && result.giftCode) {
        setDoneText({ title: 'Подарок готов', text: 'Отправь этот код другу. Он введёт его в NEBO и получит Plus.', code: result.giftCode, months: grant.months, reload: false });
      } else if (grant.kind === 'eso_days') {
        setDoneText({ title: 'Эзотерика открыта', text: 'Таро, руны и числа имени теперь без ограничений на 12 месяцев.', code: '', months: 0, reload: false });
      } else if (grant.kind === 'credit') {
        setDoneText({ title: 'Расклад твой', text: 'Открой Таро или Руны в «Моей карте». Купленный расклад не сгорает.', code: '', months: 0, reload: false });
      } else {
        setDoneText({ title: 'Спасибо!', text: 'Спасибо, что угощаешь команду NEBO кофе. Нам очень приятно.', code: '', months: 0, reload: false });
      }
      setSheet('done');
      return;
    }
    if (result.status === 'cancelled') return;
    if (result.status === 'pending') {
      setNote('Оплата ещё проверяется. Как только RuStore её подтвердит, покупка появится здесь сама.');
      return;
    }
    setNote(BUY_ERRORS[result.reason] || 'Покупка сейчас недоступна. Попробуй позже.');
  };

  const redeem = async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    setNote('');
    const result = await redeemPlusCode(code);
    setBusy(false);
    if (result.ok) {
      setCode('');
      setDoneText({ title: 'Plus открыт', text: `Добавили ${result.days} дней NEBO Plus. Приложение обновится, чтобы всё открылось.`, code: '', months: 0, reload: true });
      setSheet('done');
      return;
    }
    setNote(REDEEM_ERRORS[result.reason] || 'Не получилось проверить код. Попробуй ещё раз.');
  };

  const closeDone = () => {
    setSheet(null);
    if (doneText.reload) window.location.reload();
  };

  const row = (image: string, title: string, text: string, price: string, onClick: () => void, disabled = false) => (
    <button type="button" className="nebo-shop-row" onClick={onClick} disabled={disabled}>
      <img src={image} alt="" width={52} height={52} loading="lazy" />
      <span className="nebo-shop-row-copy"><strong>{title}</strong><small>{text}</small></span>
      <span className="nebo-shop-price">{price}</span>
    </button>
  );

  const product = (id: OneTimeProductId, priceLabel?: string) => {
    const item = ONE_TIME_PRODUCTS[id];
    return row(item.image, item.title, item.text, priceLabel || `${item.priceRub} ₽`, () => { void buy(id); }, busy || !canBuy);
  };

  return (
    <div className="nebo-shop">
      <button type="button" className="nebo-shop-code" onClick={() => { setNote(''); setSheet('redeem'); }}>
        <span className="nebo-shop-row-copy"><strong>Есть код?</strong><small>Введи код подарка или промокод</small></span>
        <span className="nebo-shop-price">Ввести</span>
      </button>

      <h2 className="nebo-shop-head">Подписка</h2>
      <div className="nebo-shop-plus">{plusContent}</div>

      {!canBuy ? (
        <p className="nebo-shop-note">Разовые покупки работают в приложении NEBO из RuStore. Код подарка можно ввести здесь.</p>
      ) : null}
      {note ? <p className="nebo-shop-note is-alert" role="alert">{note}</p> : null}

      <h2 className="nebo-shop-head">Эзотерика</h2>
      <div className="nebo-shop-list">
        {esoActive && purchases.esoUntil
          ? row(ONE_TIME_PRODUCTS.eso_year.image, 'Вся эзотерика на год', `Открыто до ${new Date(purchases.esoUntil).toLocaleDateString('ru-RU')}`, 'Есть', () => undefined, true)
          : product('eso_year')}
        {product('spread_one', purchases.spreadCredits > 0 ? `99 ₽ · есть ${purchases.spreadCredits}` : undefined)}
      </div>

      <h2 className="nebo-shop-head">Подарки</h2>
      <div className="nebo-shop-list">
        {row(ONE_TIME_PRODUCTS.gift_plus_1m.image, 'Подарить Plus', 'Другу на 1, 3 или 12 месяцев', 'от 399 ₽', () => { setNote(''); setSheet('gift'); }, !canBuy)}
      </div>
      {purchases.giftCodes.length ? (
        <div className="nebo-shop-codes">
          <h3>Мои подарки</h3>
          {purchases.giftCodes.map((gift) => (
            <div key={gift.code} className="nebo-shop-gift">
              <span><strong>{gift.code}</strong><small>Plus на {gift.months === 12 ? 'год' : gift.months === 3 ? '3 месяца' : 'месяц'} · {gift.redeemed ? 'друг уже получил' : 'ещё не введён'}</small></span>
              {!gift.redeemed ? (
                <button type="button" onClick={() => { void shareCode(gift.code, gift.months); }} aria-label="Отправить код"><Share2 size={18} aria-hidden /></button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <h2 className="nebo-shop-head">Поддержать</h2>
      <div className="nebo-shop-list">{product('tips_149')}</div>

      <CosmicSheet open={sheet === 'redeem'} title="Есть код?" onClose={() => setSheet(null)} closeLabel="Закрыть">
        <div className="nebo-shop-sheet">
          <p>Введи код подарка от друга или промокод. Plus добавится к твоему аккаунту.</p>
          <input
            className="nebo-shop-input"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 40))}
            placeholder="NEBO-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Код"
          />
          {note ? <p className="nebo-shop-note is-alert" role="alert">{note}</p> : null}
          <button type="button" className="nebo-shop-primary" onClick={() => { void redeem(); }} disabled={busy || !code.trim()}>
            {busy ? 'Проверяем…' : 'Активировать'}
          </button>
        </div>
      </CosmicSheet>

      <CosmicSheet open={sheet === 'gift'} title="Подарить Plus" onClose={() => setSheet(null)} closeLabel="Закрыть">
        <div className="nebo-shop-sheet">
          <p>После оплаты появится код. Отправь его другу в любом мессенджере: он введёт код в NEBO, и Plus откроется у него.</p>
          <div className="nebo-shop-options" role="radiogroup" aria-label="Срок подарка">
            {GIFT_OPTIONS.map((option) => (
              <button key={option.id} type="button" role="radio" aria-checked={giftChoice === option.id} className={giftChoice === option.id ? 'is-active' : ''} onClick={() => setGiftChoice(option.id)}>
                <strong>{option.label}</strong>
                <small>{ONE_TIME_PRODUCTS[option.id].priceRub} ₽</small>
              </button>
            ))}
          </div>
          {note ? <p className="nebo-shop-note is-alert" role="alert">{note}</p> : null}
          <button type="button" className="nebo-shop-primary" disabled={busy} onClick={() => { void buy(giftChoice); }}>
            {busy ? 'Открываем оплату…' : `Оплатить ${ONE_TIME_PRODUCTS[giftChoice].priceRub} ₽`}
          </button>
        </div>
      </CosmicSheet>

      <CosmicSheet open={sheet === 'done'} title={doneText.title} onClose={closeDone} closeLabel="Готово">
        <div className="nebo-shop-sheet">
          <p>{doneText.text}</p>
          {doneText.code ? (
            <>
              <div className="nebo-shop-bigcode">{doneText.code}</div>
              <button type="button" className="nebo-shop-primary" onClick={() => { void shareCode(doneText.code, doneText.months); }}>
                <Share2 size={18} aria-hidden /> Отправить другу
              </button>
              <button type="button" className="nebo-shop-secondary" onClick={() => { void navigator.clipboard?.writeText(doneText.code).catch(() => undefined); }}>
                <Copy size={16} aria-hidden /> Скопировать код
              </button>
              <p className="nebo-shop-note">Код всегда можно найти здесь, в разделе «Мои подарки».</p>
            </>
          ) : null}
        </div>
      </CosmicSheet>
    </div>
  );
}
