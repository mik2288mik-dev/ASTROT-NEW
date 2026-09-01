import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../types';
import type { PremiumPlanId } from '../lib/premiumPricing';
import type { PaywallContext } from '../lib/paywallContext';
import { hasActivePremium } from '../lib/accessMatrix';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { canUseRuStorePay, resolveDistributionChannel } from '../lib/distributionChannel';
import {
  loadRuStoreProducts,
  type RuStoreProduct,
} from '../services/rustorePayService';
import { STORE_RELEASE_CONFIG } from '../lib/storeReleaseConfig';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import { NeboLogo } from '../components/brand/NeboLogo';
import type { PurchaseRestoreStatus } from '../services/paymentProvider';

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
  onManageSubscription?: () => Promise<void> | void;
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

const ORDER: PremiumPlanId[] = ['premium_month', 'premium_quarter', 'premium_year'];
const DEFAULT_PERIODS: Record<PremiumPlanId, { ru: string; en: string }> = {
  premium_week: { ru: '1 неделя', en: '1 week' },
  premium_month: { ru: '1 месяц', en: '1 month' },
  premium_quarter: { ru: '3 месяца', en: '3 months' },
  premium_year: { ru: '1 год', en: '1 year' },
};
const PLAN_ADVANTAGES: Record<PremiumPlanId, {
  ru: { label: string; description: string };
  en: { label: string; description: string };
}> = {
  premium_week: {
    ru: { label: 'Короткий доступ', description: 'Premium на одну неделю.' },
    en: { label: 'Short access', description: 'Premium for one week.' },
  },
  premium_month: {
    ru: { label: 'Короткий срок', description: 'Все функции Premium на один месяц.' },
    en: { label: 'Short term', description: 'Every Premium feature for one month.' },
  },
  premium_quarter: {
    ru: { label: 'Реже продлевать', description: 'Все функции Premium на три месяца.' },
    en: { label: 'Renew less often', description: 'Every Premium feature for three months.' },
  },
  premium_year: {
    ru: { label: 'На весь год', description: 'Все функции Premium на двенадцать месяцев.' },
    en: { label: 'A full year', description: 'Every Premium feature for twelve months.' },
  },
};

const CONTEXT_COPY: Record<PaywallContext['placement'], { ru: string; en: string }> = {
  today: {
    ru: 'Продолжение личного Today останется на том же месте в ленте.',
    en: 'The rest of your personal Today will open at the same place in the feed.',
  },
  week: { ru: 'Откроется твоя личная неделя.', en: 'Your personal week will open.' },
  month: { ru: 'Откроется твой личный месяц.', en: 'Your personal month will open.' },
  deep_natal: { ru: 'Откроются все разделы твоей натальной карты.', en: 'Every topic in your natal chart will open.' },
  personality_deep: { ru: 'Откроется глубокий разбор личности.', en: 'Your deep personality reading will open.' },
  natal_questions: { ru: 'Вернёмся к вопросу по сохранённой карте.', en: 'We will return to your saved-chart question.' },
  compatibility_by_charts: { ru: 'Откроется совместимость по двум рассчитанным картам.', en: 'Two-chart compatibility will open.' },
  saved_people: { ru: 'Откроются дополнительные сохранённые люди.', en: 'Additional saved people will open.' },
  settings: { ru: 'После оплаты статус обновится здесь.', en: 'Your status will update here after payment.' },
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
  const alreadyPremium = hasActivePremium(profile);
  const canManageInRuStore = profile.premiumEntitlement?.source === 'rustore';
  const [selected, setSelected] = useState<PremiumPlanId>(initialPlanId);
  const [plans, setPlans] = useState<Partial<Record<PremiumPlanId, CatalogPlan>>>(() => (
    previewFixture
      ? Object.fromEntries(previewFixture.plans.map((plan) => [plan.id, plan]))
      : {}
  ));
  const [catalogState, setCatalogState] = useState<
    'loading' | 'ready' | 'not_configured' | 'empty' | 'error'
  >(
    previewFixture ? 'ready' : rustorePaymentsEnabled ? 'loading' : 'not_configured',
  );
  const [catalogRetryToken, setCatalogRetryToken] = useState(0);
  const [paying, setPaying] = useState(false);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const [previewNotice, setPreviewNotice] = useState('');

  useEffect(() => {
    if (previewFixture) return;
    let cancelled = false;
    setPlans({});
    if (!rustorePaymentsEnabled) {
      setCatalogState('not_configured');
      return;
    }
    setCatalogState('loading');

    void loadRuStoreProducts()
      .then((products) => {
        const entries: Array<readonly [PremiumPlanId, CatalogPlan]> = [];
        for (const [rawId, product] of Object.entries(products)) {
          const id = rawId as PremiumPlanId;
          if (
            !ORDER.includes(id)
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
      .then((nextPlans) => {
        if (cancelled) return;
        setPlans(nextPlans);
        const available = ORDER.filter((id) => nextPlans[id]);
        if (!nextPlans.premium_quarter && available[0]) setSelected(available[0]);
        setCatalogState(available.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setCatalogState('error');
      });

    return () => { cancelled = true; };
  }, [catalogRetryToken, language, rustorePaymentsEnabled, previewFixture]);

  const visiblePlans = useMemo(
    () => ORDER.map((id): CatalogPlan => plans[id] || ({
      id,
      periodLabel: DEFAULT_PERIODS[id][language],
      priceLabel: '',
      autoRenew: true,
    })),
    [language, plans],
  );
  const selectedPlan = plans[selected] || null;
  const selectedOption = visiblePlans.find((plan) => plan.id === selected) || visiblePlans[0];
  const catalogLoading = catalogState === 'loading';

  const missingPriceLabel = catalogLoading
    ? (ru ? 'Загрузка…' : 'Loading…')
    : catalogState === 'error'
      ? (ru ? 'Нет цены' : 'No price')
      : (ru ? 'Цена позже' : 'Price later');

  const selectPlan = (planId: PremiumPlanId) => {
    lumiaSelectionHaptic();
    setSelected(planId);
    setPurchaseState('idle');
    if (previewFixture) return;
    onPlanSelected?.(planId);
  };

  const buy = async () => {
    if (paying || purchaseState === 'pending' || restorePending || !selectedPlan) return;
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
    if (restoring) return;
    if (previewFixture) {
      setPreviewNotice('Восстановление покупок отключено в локальном Preview.');
      return;
    }
    setRestoreError(false);
    setRestorePending(false);
    setRestoring(true);
    try {
      const result = await onRestore();
      if (result === 'pending') setRestorePending(true);
    } catch {
      setRestoreError(true);
    } finally {
      setRestoring(false);
    }
  };

  const blockPreviewLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!previewFixture) return;
    event.preventDefault();
    setPreviewNotice('Внешние ссылки отключены в локальном Preview.');
  };

  const benefits = embedded
    ? (ru
        ? [
            { title: 'Персональный прогноз', description: 'Полный Today, личная неделя и месяц — с учётом данных твоей натальной карты.' },
            { title: 'Натальная карта', description: 'Характер, сильные стороны, зоны роста, общение, решения, отношения и работа.' },
            { title: 'Другие люди', description: 'До 5 сохранённых карт. Для каждого человека — отдельный разбор.' },
            { title: 'Совместимость', description: 'Сравнение двух натальных карт: в чём вы похожи, чем различаетесь, где возникают трения и как вам легче общаться.' },
          ]
        : [
            { title: 'Personal forecast', description: 'Full Today, your personal week and month, informed by your saved birth chart data.' },
            { title: 'Birth chart', description: 'Character, strengths, growth areas, communication, decisions, relationships, and work.' },
            { title: 'Other people', description: 'Up to 5 saved charts. Each person has their own individual reading.' },
            { title: 'Compatibility', description: 'Compare two birth charts: similarities, differences, friction points, and communication.' },
          ])
    : (ru
        ? [
            { title: 'Прогноз', description: 'Полный Today, личные неделя и месяц' },
            { title: 'Карта', description: 'Глубокая карта, вопросы и совместимость' },
            { title: 'Сохранения', description: 'До 5 дополнительных сохранённых карт' },
          ]
        : [
            { title: 'Forecast', description: 'Full Today plus your personal week and month' },
            { title: 'Chart', description: 'Deep chart, questions and compatibility' },
            { title: 'Saved charts', description: 'Up to 5 additional saved charts' },
          ]);

  return (
    <div
      className={`fresh-page pw2 ${embedded ? 'pw2--embedded' : 'lumia-main-scroll'}`}
      data-paywall-instance-id={context.paywallInstanceId}
      data-paywall-placement={context.placement}
      data-paywall-mode={embedded ? 'embedded' : 'overlay'}
      data-close-label={ru ? 'Закрыть' : 'Close'}
    >
      {!embedded ? <AppTopBar title="Premium" onBack={onClose} /> : null}

      <div className="pw2-intro">
        {!embedded ? (
          <p className="pw2-kicker">NEBO Premium</p>
        ) : null}
        <h1 className="pw2-title">
          {embedded
            ? (ru ? 'Персональный прогноз, натальная карта и совместимость' : 'Personal forecast, birth chart, and compatibility')
            : (ru ? 'Твой прогноз — без обрезанной версии.' : 'Your forecast, without the cut-down version.')}
        </h1>
      </div>
      <p className="pw2-sub">
        {embedded
          ? (ru
              ? 'Полный прогноз на сегодня, неделю и месяц с учётом данных твоей натальной карты. Подробные разборы тебя и других людей и сравнение двух карт.'
              : 'A full daily, weekly, and monthly forecast informed by your birth chart data. Detailed readings for you and other people, plus two-chart compatibility.')
          : CONTEXT_COPY[context.placement][language]}
      </p>

      {previewNotice ? <p className="pw2-foot" role="status">{previewNotice}</p> : null}
      {resumeNotice ? <p className="pw2-foot" role="status">{resumeNotice}</p> : null}

      {alreadyPremium ? (
        <section className="pw2-active" aria-labelledby="pw2-active-title">
          <h2 id="pw2-active-title">{ru ? 'Premium уже активен' : 'Premium is already active'}</h2>
          <p>{ru ? 'Полный доступ открыт для этого аккаунта.' : 'Full access is open for this account.'}</p>
          {canManageInRuStore ? (
            <p>{ru ? 'Управление и отмена — в RuStore: Профиль → Подписки.' : 'Manage or cancel in RuStore: Profile → Subscriptions.'}</p>
          ) : null}
          {canManageInRuStore && onManageSubscription ? (
            <button type="button" className="pw2-cta" onClick={() => void onManageSubscription()}>
              {ru ? 'Управлять подпиской' : 'Manage subscription'}
            </button>
          ) : !embedded ? (
            <button type="button" className="pw2-cta" onClick={onClose}>
              {ru ? 'Продолжить' : 'Continue'}
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <section className="pw2-purchase" aria-labelledby="pw2-plan-title">
            <h2 id="pw2-plan-title" className="pw2-section-title">
              {embedded
                ? (ru ? 'Срок подписки' : 'Subscription term')
                : (ru ? 'Выбери подписку' : 'Choose a subscription')}
            </h2>
            <div className="pw2-plans" role="radiogroup" aria-label={ru ? 'Тариф Premium' : 'Premium plan'}>
              {visiblePlans.map((plan) => {
                const isSelected = plan.id === selected;
                const hasCatalogPrice = Boolean(plans[plan.id]);
                const advantage = PLAN_ADVANTAGES[plan.id][language];
                return (
                  <label
                    key={plan.id}
                    data-plan-id={plan.id}
                    className={`pw2-plan ${isSelected ? 'is-sel' : ''}`}
                  >
                    <input
                      className="pw2-plan-control"
                      type="radio"
                      name={`premium-plan-${context.paywallInstanceId}`}
                      checked={isSelected}
                      onChange={() => selectPlan(plan.id)}
                    />
                    <div className="pw2-plan-heading">
                      <p className="pw2-plan-period">{plan.periodLabel}</p>
                      <p className="pw2-plan-advantage">{advantage.label}</p>
                    </div>
                    <p className={`pw2-plan-price ${hasCatalogPrice ? '' : 'is-placeholder'}`}>
                      {hasCatalogPrice ? plan.priceLabel : missingPriceLabel}
                    </p>
                    <p className="pw2-plan-description">{advantage.description}</p>
                    {!embedded ? (
                      <dl className="pw2-plan-features">
                        {benefits.map((benefit) => (
                          <div key={benefit.title}>
                            <dt>{benefit.title}</dt>
                            <dd>{benefit.description}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    <span className="pw2-plan-selected" aria-hidden="true">
                      {isSelected ? (ru ? 'Выбрано' : 'Selected') : (ru ? 'Выбрать' : 'Select')}
                    </span>
                  </label>
                );
              })}
            </div>

            {embedded ? (
              <>
                <div className="pw2-selection-summary" aria-live="polite">
                  <div className="pw2-selection-brand" aria-hidden="true">
                    <NeboLogo
                      decorative
                      fullCloud
                      size="standard"
                      className="pw2-selection-logo"
                    />
                    <span className="pw2-selection-brand-label">Premium</span>
                  </div>
                  <p className="pw2-selection-kicker">{ru ? 'Твой выбор' : 'Your choice'}</p>
                  <h3>{selectedOption.periodLabel} Premium</h3>
                  <p>
                    {ru
                      ? `На ${selectedOption.periodLabel} откроются:`
                      : `For ${selectedOption.periodLabel}, you get:`}
                  </p>
                </div>
                <dl className="pw2-benefits" aria-label={ru ? 'Что входит в Premium' : 'Premium benefits'}>
                  {benefits.map((benefit) => (
                    <div key={benefit.title}>
                      <dt>{benefit.title}</dt>
                      <dd>{benefit.description}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            {catalogLoading ? (
              <p className="pw2-state" role="status">
                {ru ? 'Получаем цены из RuStore. Остальные разделы приложения уже доступны.' : 'Loading prices from RuStore. The rest of the app remains available.'}
              </p>
            ) : null}
            {catalogState === 'not_configured' ? (
              <p className="pw2-state" role="status">
                {ru ? 'Цена появится после подключения RuStore. Покупка пока недоступна.' : 'Prices appear after RuStore is connected. Purchase is unavailable for now.'}
              </p>
            ) : null}
            {catalogState === 'empty' ? (
              <p className="pw2-state" role="status">
                {ru ? 'В RuStore пока нет доступных подписок. Цена появится после подключения товаров.' : 'No subscriptions are available in RuStore yet. Prices appear after products are connected.'}
              </p>
            ) : null}
            {catalogState === 'error' ? (
              <div className="pw2-catalog-error" role="alert">
                <p className="pw2-state">
                  {ru ? 'Не удалось получить цены из RuStore.' : 'Unable to load prices from RuStore.'}
                </p>
                <button
                  type="button"
                  className="pw2-retry"
                  onClick={() => setCatalogRetryToken((value) => value + 1)}
                >
                  {ru ? 'Повторить' : 'Try again'}
                </button>
              </div>
            ) : null}

            {selectedPlan ? (
              <p className="pw2-legal">
                {selectedPlan.autoRenew
                  ? (ru
                      ? `Подписка продлевается автоматически: ${selectedPlan.priceLabel} за ${selectedPlan.periodLabel}. Управлять или отменить подписку можно в RuStore: Профиль → Подписки.`
                      : `Your subscription renews automatically: ${selectedPlan.priceLabel} per ${selectedPlan.periodLabel}. Manage or cancel it in RuStore: Profile → Subscriptions.`)
                  : (ru
                      ? `Разовая оплата: ${selectedPlan.priceLabel} за ${selectedPlan.periodLabel}.`
                      : `One-time payment: ${selectedPlan.priceLabel} for ${selectedPlan.periodLabel}.`)}
              </p>
            ) : null}

            <button
              type="button"
              className="pw2-cta"
              onClick={() => void buy()}
              aria-busy={paying}
              disabled={paying || purchaseState === 'pending' || restorePending || catalogLoading || !selectedPlan}
            >
              {paying
                ? (ru ? 'Открываем RuStore…' : 'Opening RuStore…')
                : purchaseState === 'pending'
                  ? (ru ? 'Оплата обрабатывается' : 'Payment is processing')
                  : selectedPlan
                    ? `${ru ? 'Оформить подписку' : 'Subscribe'} · ${selectedPlan.priceLabel}`
                    : (ru ? 'Покупка сейчас недоступна' : 'Purchase is unavailable')}
            </button>

            {purchaseState === 'pending' ? (
              <p className="pw2-state" role="status">
                {ru ? 'RuStore подтверждает оплату. Не покупай повторно — проверь статус через «Восстановить покупку».' : 'RuStore is confirming the payment. Do not buy again — check through Restore purchase.'}
              </p>
            ) : null}
            {purchaseState === 'failed' ? (
              <p className="pw2-state" role="alert">
                {ru ? 'Не удалось открыть оплату. Проверь RuStore и подключение к интернету.' : 'Could not open checkout. Check RuStore and your internet connection.'}
              </p>
            ) : null}
          </section>

          <div className="pw2-secondary-actions">
            {!embedded ? (
              <button type="button" className="pw2-free" onClick={onContinueFree}>
                {ru ? 'Остаться на Free' : 'Stay on Free'}
              </button>
            ) : null}
            <button
              type="button"
              className="pw2-free"
              onClick={() => void restore()}
              disabled={restoring}
              aria-busy={restoring}
            >
              {restoring
                ? (ru ? 'Проверяем покупки…' : 'Checking purchases…')
                : (ru ? 'Восстановить покупку' : 'Restore purchase')}
            </button>
          </div>
          {restoreError ? (
            <p className="pw2-state" role="alert">
              {ru ? 'Не удалось восстановить покупку. Проверь RuStore и интернет.' : 'Could not restore the purchase. Check RuStore and your connection.'}
            </p>
          ) : restorePending ? (
            <p className="pw2-state" role="status">
              {ru
                ? 'RuStore ещё подтверждает покупку. Подожди немного и проверь снова — повторно покупать не нужно.'
                : 'RuStore is still confirming the purchase. Wait a moment and check again — do not buy it again.'}
            </p>
          ) : null}
        </>
      )}

      <div className="pw2-foot">
        <a href={STORE_RELEASE_CONFIG.termsUrl} target="_blank" rel="noreferrer" onClick={blockPreviewLink}>
          {ru ? 'Условия использования' : 'Terms of use'}
        </a>
        {' · '}
        <a href={STORE_RELEASE_CONFIG.privacyUrl} target="_blank" rel="noreferrer" onClick={blockPreviewLink}>
          {ru ? 'Политика конфиденциальности' : 'Privacy policy'}
        </a>
      </div>
    </div>
  );
};
