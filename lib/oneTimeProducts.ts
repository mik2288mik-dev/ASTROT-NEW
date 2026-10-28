/**
 * One-time RuStore products (created in the RuStore console, app 2063750823).
 * Client-safe: the shop reads titles and prices from here, the server reads what each purchase grants.
 * Only products whose feature exists in the app are sold; the rest stay in the console unused.
 */

export type OneTimeProductId =
  | 'eso_year'
  | 'spread_one'
  | 'tips_149'
  | 'gift_plus_1m'
  | 'gift_plus_3m'
  | 'gift_plus_12m';

export type OneTimeGrant =
  | { kind: 'eso_days'; days: number }
  | { kind: 'credit'; credit: 'spread'; amount: number }
  | { kind: 'gift_code'; days: number; months: number }
  | { kind: 'thanks' };

export type OneTimeProduct = {
  id: OneTimeProductId;
  consumable: boolean;
  priceRub: number;
  title: string;
  text: string;
  image: string;
  grant: OneTimeGrant;
};

export const ONE_TIME_PRODUCTS: Record<OneTimeProductId, OneTimeProduct> = {
  eso_year: {
    id: 'eso_year', consumable: false, priceRub: 999,
    title: 'Вся эзотерика на год', text: 'Таро, руны и числа имени без ограничений на 12 месяцев',
    image: '/assets/shop/eso-year.webp', grant: { kind: 'eso_days', days: 365 },
  },
  spread_one: {
    id: 'spread_one', consumable: true, priceRub: 99,
    title: 'Расклад таро или рун', text: 'Один расклад на твой вопрос, не сгорает',
    image: '/assets/shop/spread.webp', grant: { kind: 'credit', credit: 'spread', amount: 1 },
  },
  tips_149: {
    id: 'tips_149', consumable: true, priceRub: 149,
    title: 'Поддержать NEBO', text: 'Угостить команду кофе. Ничего не открывает, просто спасибо',
    image: '/assets/shop/tips.webp', grant: { kind: 'thanks' },
  },
  gift_plus_1m: {
    id: 'gift_plus_1m', consumable: true, priceRub: 399,
    title: 'Подарить Plus на месяц', text: 'Получишь код подарка и отправишь его другу',
    image: '/assets/shop/gift.webp', grant: { kind: 'gift_code', days: 30, months: 1 },
  },
  gift_plus_3m: {
    id: 'gift_plus_3m', consumable: true, priceRub: 899,
    title: 'Подарить Plus на 3 месяца', text: 'Получишь код подарка и отправишь его другу',
    image: '/assets/shop/gift.webp', grant: { kind: 'gift_code', days: 90, months: 3 },
  },
  gift_plus_12m: {
    id: 'gift_plus_12m', consumable: true, priceRub: 2999,
    title: 'Подарить Plus на год', text: 'Получишь код подарка и отправишь его другу',
    image: '/assets/shop/gift.webp', grant: { kind: 'gift_code', days: 365, months: 12 },
  },
};

export function isOneTimeProductId(value: unknown): value is OneTimeProductId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ONE_TIME_PRODUCTS, value);
}

/** What the person owns, as the server reports it. */
export type PurchasesSnapshot = {
  /** ISO date until which tarot, runes and name numbers are open without Plus. */
  esoUntil: string | null;
  spreadCredits: number;
  giftCodes: Array<{ code: string; months: number; redeemed: boolean; createdAt: string }>;
};

export const EMPTY_PURCHASES: PurchasesSnapshot = { esoUntil: null, spreadCredits: 0, giftCodes: [] };

export function hasEsoAccess(snapshot: PurchasesSnapshot | null, now = new Date()): boolean {
  return Boolean(snapshot?.esoUntil && Date.parse(snapshot.esoUntil) > now.getTime());
}

/** Gift codes look like NEBO-7K3M-Q9XA: no 0/O/1/I so they are easy to type from a message. */
export const GIFT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function normalizeRedeemCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}
