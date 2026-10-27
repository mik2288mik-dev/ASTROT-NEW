/**
 * Каталог разовых товаров для RuStore. Подписки остаются в premiumPricing
 * (premium_month, premium_quarter, premium_year). Матрица, «Год вперёд»,
 * все расклады и вопросы каждый день входят в Plus и отдельно не продаются.
 *
 * Пока ничем не используется: оплата и выдача доступа к этим товарам
 * подключаются отдельно, после проверки совместимости со старыми версиями.
 *
 * kind:
 * - 'permanent': покупается один раз и остаётся навсегда;
 * - 'consumable': можно покупать много раз, что куплено, хранит наш сервер.
 */
export type RuStoreProductKind = 'permanent' | 'consumable';

export type RuStoreProductId =
  | 'natal_full'
  | 'chart_or_pair'
  | 'reading_one'
  | 'questions_10'
  | 'poster_birth_sky'
  | 'gift_plus_month'
  | 'gift_plus_quarter'
  | 'gift_plus_year'
  | 'tip_team';

export type RuStoreProduct = {
  id: RuStoreProductId;
  kind: RuStoreProductKind;
  priceRub: number;
  title: string;
  /** Сколько единиц даёт покупка: вопросов или раскладов. */
  units?: number;
  /** Для подарка: какой тариф Plus получит друг. */
  giftPlanId?: 'premium_month' | 'premium_quarter' | 'premium_year';
};

export const RUSTORE_PRODUCTS: readonly RuStoreProduct[] = [
  { id: 'natal_full', kind: 'permanent', priceRub: 490, title: 'Натальная карта целиком' },
  { id: 'poster_birth_sky', kind: 'permanent', priceRub: 249, title: 'Постер «Небо в день рождения»' },
  { id: 'chart_or_pair', kind: 'consumable', priceRub: 290, title: 'Разбор человека или пары' },
  { id: 'reading_one', kind: 'consumable', priceRub: 99, title: 'Расклад таро или рун', units: 1 },
  { id: 'questions_10', kind: 'consumable', priceRub: 390, title: '10 вопросов о карте', units: 10 },
  { id: 'gift_plus_month', kind: 'consumable', priceRub: 399, title: 'Plus в подарок на 1 месяц', giftPlanId: 'premium_month' },
  { id: 'gift_plus_quarter', kind: 'consumable', priceRub: 899, title: 'Plus в подарок на 3 месяца', giftPlanId: 'premium_quarter' },
  { id: 'gift_plus_year', kind: 'consumable', priceRub: 2999, title: 'Plus в подарок на 1 год', giftPlanId: 'premium_year' },
  { id: 'tip_team', kind: 'consumable', priceRub: 149, title: 'Поддержать NEBO' },
];

export function getRuStoreProduct(id: string): RuStoreProduct | null {
  return RUSTORE_PRODUCTS.find((product) => product.id === id) ?? null;
}
