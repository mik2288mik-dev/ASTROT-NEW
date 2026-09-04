type PaymentFailureLanguage = 'ru' | 'en';

const ACCOUNT_CONFLICT_REASONS = new Set([
  'RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER',
  'RUSTORE_PURCHASE_USER_MISMATCH',
]);

export function paymentFailureCopy(
  reason: unknown,
  language: PaymentFailureLanguage,
): string | null {
  const code = String(reason || '').trim();
  const ru = language === 'ru';
  if (ACCOUNT_CONFLICT_REASONS.has(code)) {
    return ru
      ? 'Эта покупка уже связана с другим аккаунтом NEBO. Войди в исходный аккаунт или открой «Меню → Поддержка». Повторно покупать не нужно.'
      : 'This purchase is linked to another NEBO account. Sign in to the original account or open Menu → Support. Do not buy it again.';
  }
  if (code === 'RUSTORE_PURCHASE_PRODUCT_MISMATCH') {
    return ru
      ? 'RuStore вернул покупку для другого тарифа. Не покупай повторно — открой «Меню → Поддержка».'
      : 'RuStore returned a purchase for another plan. Do not buy it again — open Menu → Support.';
  }
  if (code === 'RUSTORE_PURCHASE_ID_REQUIRED') {
    return ru
      ? 'RuStore не передал номер покупки. Не покупай повторно — открой «Меню → Поддержка».'
      : 'RuStore did not return a purchase ID. Do not buy it again — open Menu → Support.';
  }
  if (code === 'RECOVERY_IDENTITY_REQUIRED') {
    return ru
      ? 'Чтобы восстановить покупку, привяжи VK ID, Яндекс или email в разделе аккаунта и проверь снова.'
      : 'To restore the purchase, link VK ID, Yandex, or email in Account and try again.';
  }
  if (code === 'RUSTORE_SUBSCRIPTION_PAUSED') {
    return ru
      ? 'Подписка приостановлена в RuStore. Открой управление подпиской и проверь способ оплаты — повторно покупать не нужно.'
      : 'The subscription is paused in RuStore. Open subscription management and check the payment method — do not buy it again.';
  }
  if (code === 'RUSTORE_PREMIUM_NOT_CONFIRMED') {
    return ru
      ? 'RuStore не подтвердил активный Premium. Проверь статус подписки или восстанови покупку — повторно покупать не нужно.'
      : 'RuStore did not confirm an active Premium subscription. Check its status or restore the purchase — do not buy it again.';
  }
  return null;
}
