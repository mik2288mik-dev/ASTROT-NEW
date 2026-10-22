/**
 * Каталог разовых товаров для RuStore. Подписки остаются в premiumPricing
 * (premium_month, premium_quarter, premium_year).
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
  | 'matrix_full'
  | 'numbers_full'
  | 'year_ahead'
  | 'poster_birth_sky'
  | 'person_chart'
  | 'pair_report'
  | 'reading_one'
  | 'reading_pack5'
  | 'questions_3'
  | 'questions_10'
  | 'questions_30'
  | 'gift_plus_month'
  | 'gift_plus_quarter'
  | 'gift_plus_year'
  | 'tip_tea'
  | 'tip_coffee'
  | 'tip_lunch';

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
  { id: 'matrix_full', kind: 'permanent', priceRub: 390, title: 'Матрица судьбы целиком' },
  { id: 'numbers_full', kind: 'permanent', priceRub: 190, title: 'Всё о числах' },
  { id: 'year_ahead', kind: 'permanent', priceRub: 690, title: 'Год вперёд' },
  { id: 'poster_birth_sky', kind: 'permanent', priceRub: 249, title: 'Постер «Небо в день рождения»' },
  { id: 'person_chart', kind: 'consumable', priceRub: 290, title: 'Карта другого человека' },
  { id: 'pair_report', kind: 'consumable', priceRub: 290, title: 'Разбор пары' },
  { id: 'reading_one', kind: 'consumable', priceRub: 99, title: 'Расклад таро или рун', units: 1 },
  { id: 'reading_pack5', kind: 'consumable', priceRub: 299, title: '5 раскладов таро или рун', units: 5 },
  { id: 'questions_3', kind: 'consumable', priceRub: 149, title: '3 вопроса о карте', units: 3 },
  { id: 'questions_10', kind: 'consumable', priceRub: 390, title: '10 вопросов о карте', units: 10 },
  { id: 'questions_30', kind: 'consumable', priceRub: 890, title: '30 вопросов о карте', units: 30 },
  { id: 'gift_plus_month', kind: 'consumable', priceRub: 399, title: 'Plus в подарок на 1 месяц', giftPlanId: 'premium_month' },
  { id: 'gift_plus_quarter', kind: 'consumable', priceRub: 899, title: 'Plus в подарок на 3 месяца', giftPlanId: 'premium_quarter' },
  { id: 'gift_plus_year', kind: 'consumable', priceRub: 2999, title: 'Plus в подарок на 1 год', giftPlanId: 'premium_year' },
  { id: 'tip_tea', kind: 'consumable', priceRub: 99, title: 'Поддержать NEBO: чай с мелиссой' },
  { id: 'tip_coffee', kind: 'consumable', priceRub: 299, title: 'Поддержать NEBO: кофе и круассан' },
  { id: 'tip_lunch', kind: 'consumable', priceRub: 990, title: 'Поддержать NEBO: обед для команды' },
];

export function getRuStoreProduct(id: string): RuStoreProduct | null {
  return RUSTORE_PRODUCTS.find((product) => product.id === id) ?? null;
}
