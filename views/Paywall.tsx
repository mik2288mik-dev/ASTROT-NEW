import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../types';
import type { PremiumPlanId } from '../lib/premiumPricing';
import type { PaywallContext } from '../lib/paywallContext';
import { hasActivePremium, PREMIUM_SAVED_PERSON_LIMIT } from '../lib/accessMatrix';
import { lumiaSelectionHaptic } from '../lib/haptics';
import {
  canUseRuStorePay,
  canUseTelegramStars,
  resolveDistributionChannel,
} from '../lib/distributionChannel';
import {
  loadRuStoreProducts,
  type RuStoreProduct,
} from '../services/rustorePayService';
import { STORE_RELEASE_CONFIG } from '../lib/storeReleaseConfig';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import type { PurchaseRestoreStatus } from '../services/paymentProvider';
import { loadTelegramPremiumPlans } from '../services/paymentPlanCatalog';
import { paymentFailureCopy } from '../lib/paymentFailureCopy';
import {
  getNatalReportAnswer,
  isNatalReportAnswerKey,
  localizeNatalReportText,
} from '../lib/natalReading/reportCatalog';

export type PaywallPurchaseStatus =
  | 'completed'
  | 'pending'
  | 'cancelled'
  | 'failed'
  | 'unavailable'
  | 'recovery_required';

interface PaywallProps {
  profile: UserProfile;
  context: PaywallContext;
  onPurchase: (planId: PremiumPlanId) => Promise<PaywallPurchaseStatus | void>;
  onClose: () => void;
  onContinueFree: () => void;
  onRestore: () => Promise<PurchaseRestoreStatus>;
  onManageSubscription?: () => Promise<boolean> | boolean;
  onPlanSelected?: (planId: PremiumPlanId) => void;
  initialPlanId?: PremiumPlanId;
  resumeNotice?: string | null;
  embedded?: boolean;
  uiPreview?: {
    plans: Array<{
      id: PremiumPlanId;
      periodLabel: string;
      priceLabel: string;
      autoRenew: boolean;
    }>;
  };
}

type CatalogPlan = {
  id: PremiumPlanId;
  periodLabel: string;
  priceLabel: string;
  autoRenew: boolean;
  product?: RuStoreProduct;
};

const RUSTORE_PLAN_ORDER: PremiumPlanId[] = ['premium_month', 'premium_quarter', 'premium_year'];
const TELEGRAM_PLAN_ORDER: PremiumPlanId[] = [
  'premium_week',
  'premium_month',
  'premium_quarter',
  'premium_year',
];
const DEFAULT_PERIODS: Record<PremiumPlanId, { ru: string; en: string }> = {
  premium_week: { ru: '1 неделя', en: '1 week' },
  premium_month: { ru: '1 месяц', en: '1 month' },
  premium_quarter: { ru: '3 месяца', en: '3 months' },
  premium_year: { ru: '1 год', en: '1 year' },
};
const CONTEXT_COPY: Record<PaywallContext['placement'], { ru: string; en: string }> = {
  today: {
    ru: 'Личные прогнозы, подробные разборы и совместимость по картам.',
    en: 'Personal forecasts, detailed readings, and two-chart compatibility.',
  },
  week: { ru: 'Откроется твоя личная неделя.', en: 'Your personal week will open.' },
  month: { ru: 'Откроется твой личный месяц.', en: 'Your personal month will open.' },
  deep_natal: { ru: 'Откроются все разделы твоей натальной карты.', en: 'Every topic in your natal chart will open.' },
  personality_deep: { ru: 'Откроется глубокий разбор личности.', en: 'Your deep personality reading will open.' },
  natal_questions: { ru: 'Вернёмся к вопросу по сохранённой карте.', en: 'We will return to your saved-chart question.' },
  compatibility_by_charts: { ru: 'Откроется совместимость по двум рассчитанным картам.', en: 'Two-chart compatibility will open.' },
  saved_people: { ru: 'Откроются дополнительные сохранённые люди.', en: 'Additional saved people will open.' },
  settings: { ru: 'Личные прогнозы, подробные разборы и совместимость по картам.', en: 'Personal forecasts, detailed readings, and two-chart compatibility.' },
};

function formatCatalogDuration(duration: string, language: 'ru' | 'en'): string {
  const normalized = duration.trim().toUpperCase();
  const labels: Record<string, { ru: string; en: string }> = {
    P1M: { ru: '1 месяц', en: '1 month' },
    P3M: { ru: '3 месяца', en: '3 months' },
    P1Y: { ru: '1 год', en: '1 year' },
    P12M: { ru: '1 год', en: '1 year' },
  };
  return labels[normalized]?.[language] || duration;
}

function formatCatalogDays(days: number, language: 'ru' | 'en'): string {
  const exactPlanId = ({
    7: 'premium_week',
    30: 'premium_month',
    90: 'premium_quarter',
    365: 'premium_year',
  } as Partial<Record<number, PremiumPlanId>>)[days];
  if (exactPlanId) return DEFAULT_PERIODS[exactPlanId][language];
  return language === 'ru' ? `${days} дн.` : `${days} days`;
}

export const Paywall: React.FC<PaywallProps> = ({
  profile,
  context,
  onPurchase,
  onClose,
  onContinueFree,
  onRestore,
  onManageSubscription,
  onPlanSelected,
  initialPlanId = 'premium_quarter',
  resumeNotice,
  embedded = false,
  uiPreview,
}) => {
  const previewFixture = process.env.NODE_ENV === 'development' ? uiPreview : undefined;
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const distributionChannel = resolveDistributionChannel();
  const rustorePaymentsEnabled = canUseRuStorePay(distributionChannel);
  const telegramPaymentsEnabled = canUseTelegramStars(distributionChannel);
  const paymentCatalogEnabled = rustorePaymentsEnabled || telegramPaymentsEnabled;
  const planOrder = telegramPaymentsEnabled ? TELEGRAM_PLAN_ORDER : RUSTORE_PLAN_ORDER;
  const alreadyPremium = hasActivePremium(profile);
  const canManageInRuStore = rustorePaymentsEnabled
    && profile.premiumEntitlement?.source === 'rustore';
  const natalAnswer = context.placement === 'deep_natal'
    && isNatalReportAnswerKey(context.returnEntityId)
      ? getNatalReportAnswer(context.returnEntityId)
      : null;
  const natalAnswerTitle = natalAnswer
    ? localizeNatalReportText(natalAnswer.title, language)
    : null;
  const [selected, setSelected] = useState<PremiumPlanId>(initialPlanId);
  const [plans, setPlans] = useState<Partial<Record<PremiumPlanId, CatalogPlan>>>(() => (
    previewFixture
      ? Object.fromEntries(previewFixture.plans.map((plan) => [plan.id, plan]))
      : {}
  ));
  const [catalogState, setCatalogState] = useState<
    'loading' | 'ready' | 'not_configured' | 'empty' | 'error'
  >(
    previewFixture ? 'ready' : paymentCatalogEnabled ? 'loading' : 'not_configured',
  );
  const [catalogRetryToken, setCatalogRetryToken] = useState(0);
  const [paying, setPaying] = useState(false);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [restoreFailureReason, setRestoreFailureReason] = useState('');
  const [restorePending, setRestorePending] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [manageError, setManageError] = useState(false);
  const [previewNotice, setPreviewNotice] = useState('');

  useEffect(() => {
    if (previewFixture) return;
    let cancelled = false;
    setPlans({});
    if (!paymentCatalogEnabled) {
      setCatalogState('not_configured');
      return;
    }
    setCatalogState('loading');

    const catalogRequest: Promise<Partial<Record<PremiumPlanId, CatalogPlan>>> = rustorePaymentsEnabled
      ? loadRuStoreProducts().then((products) => {
        const entries: Array<readonly [PremiumPlanId, CatalogPlan]> = [];
        for (const [rawId, product] of Object.entries(products)) {
          const id = rawId as PremiumPlanId;
          if (
            !RUSTORE_PLAN_ORDER.includes(id)
            || !product
            || product.type !== 'SUBSCRIPTION'
            || !product.amountLabel
            || !product.subscriptionInfo
          ) continue;
          const mainPeriod = product.subscriptionInfo.periods.find(
            (period) => period.type === 'MainPeriod',
          );
          if (!mainPeriod?.duration) continue;
          entries.push([id, {
            id,
            periodLabel: formatCatalogDuration(mainPeriod.duration, language),
            priceLabel: product.amountLabel,
            autoRenew: true,
            product,
          }]);
        }
        return Object.fromEntries(entries) as Partial<Record<PremiumPlanId, CatalogPlan>>;
      })
      : loadTelegramPremiumPlans().then((telegramPlans) => Object.fromEntries(
        telegramPlans.map((plan) => [plan.id, {
          id: plan.id,
          periodLabel: formatCatalogDays(plan.days, language),
          priceLabel: `${plan.stars} Stars`,
          autoRenew: false,
        }]),
      ) as Partial<Record<PremiumPlanId, CatalogPlan>>);

    void catalogRequest
      .then((nextPlans) => {
        if (cancelled) return;
        setPlans(nextPlans);
        const available = planOrder.filter((id) => nextPlans[id]);
        setSelected((current) => nextPlans[current]
          ? current
          : nextPlans.premium_quarter ? 'premium_quarter' : available[0] || current);
        setCatalogState(available.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setCatalogState('error');
      });

    return () => { cancelled = true; };
  }, [
    catalogRetryToken,
    language,
    paymentCatalogEnabled,
    planOrder,
    previewFixture,
    rustorePaymentsEnabled,
  ]);

  const visiblePlans = useMemo(
    () => planOrder.map((id): CatalogPlan => plans[id] || ({
      id,
      periodLabel: DEFAULT_PERIODS[id][language],
      priceLabel: '',
      autoRenew: rustorePaymentsEnabled,
    })),
    [language, planOrder, plans, rustorePaymentsEnabled],
  );
  const selectedPlan = plans[selected] || null;
  const catalogLoading = catalogState === 'loading';
  const operationBusy = paying
    || restoring
    || managingSubscription
    || restorePending;
  const planSelectionLocked = operationBusy || purchaseState === 'pending';
  const purchaseActionLocked = operationBusy
    || (purchaseState === 'pending' && !telegramPaymentsEnabled);

  const missingPriceLabel = catalogLoading
    ? (ru ? 'Загрузка…' : 'Loading…')
    : catalogState === 'error'
      ? (ru ? 'Нет цены' : 'No price')
      : (ru ? 'Цена позже' : 'Price later');

  const selectPlan = (planId: PremiumPlanId) => {
    if (planSelectionLocked) return;
    lumiaSelectionHaptic();
    setSelected(planId);
    setPurchaseState('idle');
    if (previewFixture) return;
    onPlanSelected?.(planId);
  };

  const buy = async () => {
    if (purchaseActionLocked || !selectedPlan) return;
    if (previewFixture) {
      setPreviewNotice('Оплата отключена в локальном Preview.');
      return;
    }
    lumiaSelectionHaptic();
    setPurchaseState('idle');
    setPaying(true);
    try {
      const result = await onPurchase(selectedPlan.id);
      if (result === 'pending') setPurchaseState('pending');
      else if (result === 'failed' || result === 'unavailable') setPurchaseState('failed');
      else setPurchaseState('idle');
    } catch {
      setPurchaseState('failed');
    } finally {
      setPaying(false);
    }
  };

  const restore = async () => {
    if (restoring || paying || managingSubscription) return;
    if (previewFixture) {
      setPreviewNotice('Восстановление покупок отключено в локальном Preview.');
      return;
    }
    setRestoreError(false);
    setRestoreFailureReason('');
    setRestorePending(false);
    setRestoring(true);
    try {
      const result = await onRestore();
      if (result === 'pending') setRestorePending(true);
    } catch (error) {
      setRestoreError(true);
      setRestoreFailureReason(error instanceof Error ? error.message : '');
      // The service keeps the durable checkout marker, so unlocking the CTA is
      // safe: the next attempt reconciles that order instead of creating one.
      setPurchaseState('idle');
    } finally {
      setRestoring(false);
    }
  };

  const manageSubscription = async () => {
    if (!onManageSubscription || managingSubscription || restoring || paying) return;
    if (previewFixture) {
      setPreviewNotice('Управление подпиской отключено в локальном Preview.');
      return;
    }
    setManageError(false);
    setManagingSubscription(true);
    try {
      const opened = await onManageSubscription();
      if (!opened) setManageError(true);
    } catch {
      setManageError(true);
    } finally {
      setManagingSubscription(false);
    }
  };

  const blockPreviewLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!previewFixture) return;
    event.preventDefault();
    setPreviewNotice('Внешние ссылки отключены в локальном Preview.');
  };

  const benefits = ru
    ? [
        { title: 'Личные прогнозы', description: 'Сегодня, неделя и месяц' },
        { title: 'Натальный разбор', description: 'Характер, отношения, работа, деньги и свои вопросы' },
        { title: 'Совместимость', description: 'Разбор вашей пары по двум картам' },
        { title: 'Мои карты', description: `Своя + до ${PREMIUM_SAVED_PERSON_LIMIT} карт других людей` },
      ]
    : [
        { title: 'Personal forecasts', description: 'Today, week, and month' },
        { title: 'Birth chart reading', description: 'Character, relationships, work, money, and your questions' },
        { title: 'Compatibility', description: 'Your relationship through two saved charts' },
        { title: 'My charts', description: `Yours + up to ${PREMIUM_SAVED_PERSON_LIMIT} other people` },
      ];
  const renewalId = `premium-renewal-${context.paywallInstanceId}`;

  return (
    <div
      className={`fresh-page pw2 ${embedded ? 'pw2--embedded' : 'pw2--overlay'}`}
      data-paywall-instance-id={context.paywallInstanceId}
      data-paywall-placement={context.placement}
      data-paywall-mode={embedded ? 'embedded' : 'overlay'}
      data-close-label={ru ? 'Закрыть' : 'Close'}
    >
      {!embedded ? <AppTopBar title="Premium" onBack={onClose} /> : null}
      <div className="pw2-content">
        <div className="pw2-intro">
          <p className="pw2-kicker">NEBO Premium</p>
          <h1 className="pw2-title">
            {alreadyPremium
              ? (ru ? 'Всё уже открыто' : 'You have full access')
              : natalAnswerTitle
                ? (ru ? 'Больше о тебе' : 'More about you')
                : (ru ? 'Больше о себе и о вас двоих' : 'More about you. And the two of you.')}
          </h1>
          <p className="pw2-sub">
            {alreadyPremium
              ? (ru ? 'Пользуйся всеми возможностями Premium.' : 'Enjoy every Premium feature.')
              : natalAnswerTitle
                ? (ru ? `Продолжим с «${natalAnswerTitle}».` : `Continue with “${natalAnswerTitle}”.`)
                : CONTEXT_COPY[context.placement][language]}
          </p>
        </div>

        {resumeNotice ? <p className="pw2-state" role="status">{resumeNotice}</p> : null}
        {alreadyPremium && previewNotice ? <p className="pw2-state" role="status">{previewNotice}</p> : null}

        {alreadyPremium ? (
          <section className="pw2-active" aria-labelledby="pw2-active-title">
            <h2 id="pw2-active-title">{ru ? 'Premium уже активен' : 'Premium is already active'}</h2>
            {canManageInRuStore ? (
              <p>{ru ? 'Управление и отмена — в RuStore: Профиль → Подписки.' : 'Manage or cancel in RuStore: Profile → Subscriptions.'}</p>
            ) : null}
            {canManageInRuStore && onManageSubscription ? (
              <button type="button" className="pw2-cta" onClick={() => void manageSubscription()} disabled={managingSubscription} aria-busy={managingSubscription}>
                {managingSubscription
                  ? (ru ? 'Открываем RuStore…' : 'Opening RuStore…')
                  : (ru ? 'Управлять подпиской' : 'Manage subscription')}
              </button>
            ) : !embedded ? (
              <button type="button" className="pw2-cta" onClick={onClose}>{ru ? 'Продолжить' : 'Continue'}</button>
            ) : null}
            {manageError ? (
              <p className="pw2-state" role="alert">{ru ? 'Не удалось открыть управление подпиской. Открой раздел подписок в RuStore.' : 'Could not open subscription management. Open Subscriptions in RuStore.'}</p>
            ) : null}
          </section>
        ) : (
          <section className="pw2-purchase" aria-labelledby="pw2-plan-title">
            <div className="pw2-section-heading">
              <h2 id="pw2-plan-title" className="pw2-section-title">{ru ? 'Выбери срок' : 'Choose a term'}</h2>
              <p>{ru ? 'Все функции в каждом тарифе' : 'Every plan includes all features'}</p>
            </div>
            <div className={`pw2-plans${visiblePlans.length === 4 ? ' pw2-plans--four' : ''}`} role="radiogroup" aria-label={ru ? 'Тариф Premium' : 'Premium plan'}>
              {visiblePlans.map((plan) => {
                const isSelected = plan.id === selected;
                const hasCatalogPrice = Boolean(plans[plan.id]);
                const price = hasCatalogPrice ? plan.priceLabel : missingPriceLabel;
                return (
                  <label key={plan.id} data-plan-id={plan.id} className={`pw2-plan ${isSelected ? 'is-sel' : ''}`}>
                    <input
                      className="pw2-plan-control"
                      type="radio"
                      name={`premium-plan-${context.paywallInstanceId}`}
                      aria-label={`${plan.periodLabel} — ${price}`}
                      checked={isSelected}
                      disabled={planSelectionLocked || !hasCatalogPrice}
                      onChange={() => selectPlan(plan.id)}
                    />
                    <div className="pw2-plan-heading">
                      <p className="pw2-plan-period">{plan.periodLabel}</p>
                      <p className="pw2-plan-selected" aria-hidden="true">{isSelected ? (ru ? 'Выбрано' : 'Selected') : (ru ? 'Полный доступ' : 'Full access')}</p>
                    </div>
                    <p className={`pw2-plan-price ${hasCatalogPrice ? '' : 'is-placeholder'}`}>{price}</p>
                  </label>
                );
              })}
            </div>
            {catalogLoading ? <p className="pw2-state" role="status">{telegramPaymentsEnabled ? (ru ? 'Получаем цены в Stars…' : 'Loading Stars prices…') : (ru ? 'Получаем цены из RuStore…' : 'Loading RuStore prices…')}</p> : null}
            {catalogState === 'not_configured' ? <p className="pw2-state" role="status">{ru ? 'Покупки недоступны в этой версии приложения.' : 'Purchases are unavailable in this version of the app.'}</p> : null}
            {catalogState === 'empty' ? <p className="pw2-state" role="status">{ru ? 'Сейчас нет доступных тарифов. Попробуй зайти позже.' : 'No plans are available right now. Please try again later.'}</p> : null}
            {catalogState === 'error' ? (
              <div className="pw2-catalog-error" role="alert">
                <p className="pw2-state">{ru ? 'Не удалось загрузить цены. Проверь интернет и попробуй ещё раз.' : 'Could not load prices. Check your connection and try again.'}</p>
                <button type="button" className="pw2-retry" onClick={() => setCatalogRetryToken((value) => value + 1)}>{ru ? 'Загрузить цены' : 'Reload prices'}</button>
              </div>
            ) : null}
          </section>
        )}

        <section className="pw2-included" aria-labelledby="pw2-benefits-title">
          <h2 id="pw2-benefits-title" className="pw2-section-title">{ru ? 'Что откроется' : 'What’s included'}</h2>
          <dl className="pw2-benefits">
            {benefits.map((benefit) => <div key={benefit.title}><dt>{benefit.title}</dt><dd>{benefit.description}</dd></div>)}
          </dl>
        </section>
        <div className="pw2-foot">
          <p>{ru ? 'Базовый разбор своей карты остаётся бесплатным.' : 'Your basic birth chart reading stays free.'}</p>
          <a href={STORE_RELEASE_CONFIG.termsUrl} target="_blank" rel="noreferrer" onClick={blockPreviewLink}>{ru ? 'Условия использования' : 'Terms of use'}</a>
          {' · '}
          <a href={STORE_RELEASE_CONFIG.privacyUrl} target="_blank" rel="noreferrer" onClick={blockPreviewLink}>{ru ? 'Политика конфиденциальности' : 'Privacy policy'}</a>
        </div>
      </div>

      {!alreadyPremium ? (
        <footer className="pw2-checkout" aria-label={ru ? 'Оформление Premium' : 'Premium checkout'}>
          <div className="pw2-checkout-inner">
            <div className="pw2-selection-summary" aria-live="polite" aria-atomic="true">
              <p>{selectedPlan ? `${selectedPlan.periodLabel} Premium` : (ru ? 'Premium' : 'Premium')}</p>
              <p className="pw2-selection-price">{selectedPlan?.priceLabel || missingPriceLabel}</p>
            </div>
            <p id={renewalId} className="pw2-legal">
              {selectedPlan
                ? selectedPlan.autoRenew
                  ? (ru
                      ? `Автопродление: ${selectedPlan.priceLabel} за ${selectedPlan.periodLabel}. Отмена в RuStore: Профиль → Подписки.`
                      : `Renews at ${selectedPlan.priceLabel} per ${selectedPlan.periodLabel}. Cancel in RuStore: Profile → Subscriptions.`)
                  : (ru ? `Разовая оплата: ${selectedPlan.priceLabel}. Без автопродления.` : `One-time payment: ${selectedPlan.priceLabel}. No auto-renewal.`)
                : (ru ? 'Оплата будет доступна после загрузки цены.' : 'Checkout is available once the price loads.')}
            </p>
            <button
              type="button"
              className="pw2-cta"
              onClick={() => void buy()}
              aria-busy={paying}
              aria-describedby={renewalId}
              disabled={purchaseActionLocked || catalogLoading || !selectedPlan}
            >
              {paying
                ? (telegramPaymentsEnabled ? (ru ? 'Открываем Telegram…' : 'Opening Telegram…') : (ru ? 'Открываем RuStore…' : 'Opening RuStore…'))
                : purchaseState === 'pending'
                  ? (telegramPaymentsEnabled
                      ? (ru ? 'Проверить оплату' : 'Check payment')
                      : (ru ? 'Оплата обрабатывается' : 'Payment is processing'))
                  : selectedPlan
                    ? (telegramPaymentsEnabled ? (ru ? 'Оплатить Stars' : 'Pay with Stars') : (ru ? 'Оформить подписку' : 'Subscribe'))
                    : (ru ? 'Покупка сейчас недоступна' : 'Purchase is unavailable')}
            </button>
            {previewNotice ? <p className="pw2-state" role="status">{previewNotice}</p> : null}
            {purchaseState === 'pending' ? (
              <p className="pw2-state" role="status">{telegramPaymentsEnabled
                ? (ru ? 'Telegram подтверждает оплату. Нажми «Проверить оплату» — новый счёт не откроется.' : 'Telegram is confirming payment. Check payment without opening another invoice.')
                : (ru ? 'RuStore подтверждает оплату. Проверь статус через «Восстановить покупку» — повторно платить не нужно.' : 'RuStore is confirming payment. Use Restore purchase to check — do not pay again.')}</p>
            ) : null}
            {purchaseState === 'failed' ? <p className="pw2-state" role="alert">{ru ? 'Не удалось открыть оплату. Проверь интернет и попробуй ещё раз.' : 'Could not open checkout. Check your connection and try again.'}</p> : null}
            {!embedded || rustorePaymentsEnabled ? (
              <div className="pw2-secondary-actions">
                {!embedded ? <button type="button" className="pw2-free" onClick={onContinueFree}>{ru ? 'Остаться на Free' : 'Stay on Free'}</button> : null}
                {rustorePaymentsEnabled ? (
                  <button type="button" className="pw2-free" onClick={() => void restore()} disabled={restoring || paying || managingSubscription} aria-busy={restoring}>
                    {restoring ? (ru ? 'Проверяем покупки…' : 'Checking purchases…') : (ru ? 'Восстановить покупку' : 'Restore purchase')}
                  </button>
                ) : null}
              </div>
            ) : null}
            {rustorePaymentsEnabled && restoreError ? (
              <p className="pw2-state" role="alert">{paymentFailureCopy(restoreFailureReason, language) || (ru ? 'Не удалось восстановить покупку. Проверь RuStore и интернет.' : 'Could not restore the purchase. Check RuStore and your connection.')}</p>
            ) : rustorePaymentsEnabled && restorePending ? (
              <p className="pw2-state" role="status">{ru ? 'RuStore ещё подтверждает покупку. Проверь чуть позже — повторно покупать не нужно.' : 'RuStore is still confirming the purchase. Check again shortly — do not buy it again.'}</p>
            ) : null}
          </div>
        </footer>
      ) : null}
    </div>
  );
};
