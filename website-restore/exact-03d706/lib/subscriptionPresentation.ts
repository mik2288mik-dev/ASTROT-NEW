import type { Language, PremiumEntitlementSnapshot } from '../types';

function formatEntitlementDate(value: string | null, language: Language): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function describePremiumEntitlement(
  entitlement: PremiumEntitlementSnapshot | null | undefined,
  language: Language,
  nowMs = Date.now(),
): {
  title: string;
  body: string;
  canManageInStore: boolean;
  shouldPromote: boolean;
} {
  const ru = language !== 'en';
  const endsAtMs = entitlement?.endsAt ? new Date(entitlement.endsAt).getTime() : Number.NaN;
  const state = entitlement
    && ['gift', 'store_trial', 'paid', 'grace', 'cancelled_active'].includes(entitlement.state)
    && Number.isFinite(endsAtMs)
    && endsAtMs <= nowMs
      ? 'expired'
      : (entitlement?.state || 'free');
  const endDate = formatEntitlementDate(entitlement?.endsAt || null, language);
  const until = endDate ? (ru ? ` до ${endDate}` : ` until ${endDate}`) : '';

  switch (state) {
    case 'gift':
      return {
        title: `${ru ? 'Подарочный Premium' : 'Gift Premium'}${until}`,
        body: ru
          ? 'Это подарок, а не магазинная подписка. Автопродления нет.'
          : 'This is a gift, not a store subscription. It does not renew.',
        canManageInStore: false,
        shouldPromote: false,
      };
    case 'store_trial':
      return {
        title: `${ru ? 'Пробный период RuStore' : 'RuStore trial'}${until}`,
        body: entitlement?.autoRenew
          ? (ru ? 'После окончания продолжится по условиям RuStore.' : 'It will renew under the RuStore terms.')
          : (ru ? 'Автопродление выключено.' : 'Auto-renewal is off.'),
        canManageInStore: true,
        shouldPromote: false,
      };
    case 'paid':
      return {
        title: ru ? 'Premium активен' : 'Premium is active',
        body: entitlement?.autoRenew
          ? `${ru ? 'Автопродление включено' : 'Auto-renewal is on'}${until}.`
          : `${ru ? 'Оплаченный период действует' : 'The paid period is active'}${until}.`,
        canManageInStore: entitlement?.source === 'rustore',
        shouldPromote: false,
      };
    case 'grace':
      return {
        title: ru ? 'Premium временно сохранён' : 'Premium is temporarily retained',
        body: `${ru ? 'RuStore уточняет оплату. Доступ сохранён' : 'RuStore is resolving the payment. Access remains available'}${until}.`,
        canManageInStore: true,
        shouldPromote: false,
      };
    case 'cancelled_active':
      return {
        title: ru ? 'Premium активен' : 'Premium is active',
        body: endDate
          ? (ru
              ? `Автопродление выключено. Premium работает до ${endDate}${endDate.endsWith('.') ? '' : '.'}`
              : `Auto-renewal is off. Premium works until ${endDate}.`)
          : (ru ? 'Автопродление выключено до конца оплаченного периода.' : 'Auto-renewal is off through the paid period.'),
        canManageInStore: true,
        shouldPromote: false,
      };
    case 'expired':
      return {
        title: ru ? 'Premium закончился' : 'Premium expired',
        body: ru
          ? 'Данные сохранены. Premium-функции и дополнительные карты заблокированы до восстановления доступа.'
          : 'Your data is saved. Premium features and additional charts stay locked until access is restored.',
        canManageInStore: entitlement?.source === 'rustore',
        shouldPromote: true,
      };
    case 'free':
    default:
      return {
        title: 'Free',
        body: ru
          ? 'Главное в Today и базовая карта доступны бесплатно.'
          : 'Today essentials and the basic chart are free.',
        canManageInStore: false,
        shouldPromote: true,
      };
  }
}
