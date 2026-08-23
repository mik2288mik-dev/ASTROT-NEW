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

interface PaywallProps {
  profile: UserProfile;
  context: PaywallContext;
  onPurchase: (planId: PremiumPlanId) => Promise<void>;
  onClose: () => void;
  onContinueFree: () => void;
  onRestore: () => Promise<void>;
  onPlanSelected?: (planId: PremiumPlanId) => void;
  initialPlanId?: PremiumPlanId;
  resumeNotice?: string | null;
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

const CONTEXT_COPY: Record<PaywallContext['placement'], { ru: string; en: string }> = {
  today: {
    ru: 'Продолжение личного Today останется на том же месте в ленте.',
    en: 'The rest of your personal Today will open at the same place in the feed.',
  },
  week: { ru: 'Откроется твоя личная неделя.', en: 'Your personal week will open.' },
  month: { ru: 'Откроется твой личный месяц.', en: 'Your personal month will open.' },
  deep_natal: { ru: 'Откроется глубокий разбор натальной карты.', en: 'Your deep natal reading will open.' },
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
  onPlanSelected,
  initialPlanId = 'premium_quarter',
  resumeNotice,
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
  const [catalogLoading, setCatalogLoading] = useState(!previewFixture);
  const [catalogState, setCatalogState] = useState<'ready' | 'unavailable' | 'empty'>(
    previewFixture ? 'ready' : 'unavailable',
  );
  const [paying, setPaying] = useState(false);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [previewNotice, setPreviewNotice] = useState('');

  useEffect(() => {
    if (previewFixture) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogState('unavailable');

    const loadCatalog = rustorePaymentsEnabled
      ? loadRuStoreProducts().then((products) => {
          const entries: Array<readonly [PremiumPlanId, CatalogPlan]> = [];
          for (const [rawId, product] of Object.entries(products)) {
            const id = rawId as PremiumPlanId;
            if (
              !product
              || product.type !== 'SUBSCRIPTION'
              || !product.amountLabel
              || !product.subscriptionInfo
            ) continue;
              const mainPeriod = product.subscriptionInfo?.periods.find(
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
      : Promise.reject(new Error('RUSTORE_CATALOG_UNAVAILABLE'));

    void loadCatalog
      .then((nextPlans) => {
        if (cancelled) return;
        setPlans(nextPlans);
        const available = ORDER.filter((id) => nextPlans[id]);
        if (!nextPlans.premium_quarter && available[0]) setSelected(available[0]);
        setCatalogState(available.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setCatalogState('unavailable');
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => { cancelled = true; };
  }, [language, rustorePaymentsEnabled, previewFixture]);

  const visiblePlans = useMemo(
    () => ORDER.map((id) => plans[id]).filter((plan): plan is CatalogPlan => Boolean(plan)),
    [plans],
  );
  const selectedPlan = plans[selected] || null;

  const selectPlan = (planId: PremiumPlanId) => {
    lumiaSelectionHaptic();
    setSelected(planId);
    setPurchaseState('idle');
    if (previewFixture) return;
    onPlanSelected?.(planId);
  };

  const buy = async () => {
    if (paying || purchaseState === 'pending' || !selectedPlan) return;
    if (previewFixture) {
      setPreviewNotice('Оплата отключена в локальном Preview.');
      return;
    }
    lumiaSelectionHaptic();
    setPurchaseState('idle');
    setPaying(true);
    try {
      await onPurchase(selectedPlan.id);
      // The parent closes this view for success, cancellation and known failures.
      // If it remains mounted, RuStore is still confirming a pending purchase.
      setPurchaseState('pending');
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
    setRestoring(true);
    try {
      await onRestore();
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

  const reasons = ru
    ? [
        ['Личный прогноз', 'Полный Today, личные неделя и месяц.'],
        ['Натальная карта', 'Глубокий разбор карты и личности.'],
        ['Вопросы и совместимость', 'Вопросы по карте и совместимость по данным рождения.'],
        ['Дополнительные карты', 'До 5 сохранённых карт помимо своей.'],
      ]
    : [
        ['Personal forecast', 'Full Today, plus your personal week and month.'],
        ['Natal chart', 'Deep chart and personality readings.'],
        ['Questions and compatibility', 'Questions about your chart and birth-data compatibility.'],
        ['Additional charts', 'Up to 5 saved charts in addition to your own.'],
      ];

  return (
    <div
      className="fresh-page lumia-main-scroll pw2"
      data-paywall-instance-id={context.paywallInstanceId}
      data-paywall-placement={context.placement}
      data-close-label={ru ? 'Закрыть' : 'Close'}
    >
      <AppTopBar title="Premium" onBack={onClose} />

      <div className="pw2-intro">
        <p className="pw2-kicker">MEOU Premium</p>
        <h1 className="pw2-title">{ru ? 'Твой прогноз — без обрезанной версии.' : 'Your forecast, without the cut-down version.'}</h1>
      </div>
      <p className="pw2-sub">{CONTEXT_COPY[context.placement][language]}</p>

      {previewNotice ? <p className="pw2-foot" role="status">{previewNotice}</p> : null}
      {resumeNotice ? <p className="pw2-foot" role="status">{resumeNotice}</p> : null}

      {alreadyPremium ? (
        <section className="pw2-active" aria-labelledby="pw2-active-title">
          <h2 id="pw2-active-title">{ru ? 'Premium уже активен' : 'Premium is already active'}</h2>
          <p>{ru ? 'Полный доступ открыт для этого аккаунта.' : 'Full access is open for this account.'}</p>
          {canManageInRuStore ? (
            <p>{ru ? 'Управление и отмена — в RuStore: Профиль → Подписки.' : 'Manage or cancel in RuStore: Profile → Subscriptions.'}</p>
          ) : null}
          <button type="button" className="pw2-cta" onClick={onClose}>
            {ru ? 'Продолжить' : 'Continue'}
          </button>
        </section>
      ) : (
        <>
          <dl className="pw2-compare" aria-label={ru ? 'Что входит в Premium' : 'What Premium includes'}>
            {reasons.map(([title, description]) => (
              <div className="pw2-row" key={title}>
                <dt className="pw2-feat">{title}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>

          <section className="pw2-purchase" aria-labelledby="pw2-plan-title">
            <h2 id="pw2-plan-title" className="pw2-section-title">{ru ? 'Выбери подписку' : 'Choose a subscription'}</h2>
            {catalogLoading ? (
              <p className="pw2-state" role="status">{ru ? 'Загружаем цены из RuStore…' : 'Loading prices from RuStore…'}</p>
            ) : visiblePlans.length ? (
              <div className="pw2-plans" role="radiogroup" aria-label={ru ? 'Тариф Premium' : 'Premium plan'}>
                {visiblePlans.map((plan) => {
                  const isSelected = plan.id === selected;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      data-plan-id={plan.id}
                      className={`pw2-plan ${isSelected ? 'is-sel' : ''}`}
                      onClick={() => selectPlan(plan.id)}
                    >
                      <span className="pw2-plan-period">{plan.periodLabel}</span>
                      <span className="pw2-plan-price">{plan.priceLabel}</span>
                      {isSelected ? <span className="pw2-plan-selected">{ru ? 'Выбрано' : 'Selected'}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {catalogState === 'unavailable' && !catalogLoading ? (
              <p className="pw2-state" role="status">
                {ru ? 'RuStore сейчас недоступен. Проверь подключение и попробуй позже.' : 'RuStore is unavailable. Check your connection and try again later.'}
              </p>
            ) : null}
            {catalogState === 'empty' && !catalogLoading ? (
              <p className="pw2-state" role="status">
                {ru ? 'Подписки для этого приложения ещё не настроены в RuStore.' : 'No subscriptions are configured for this app in RuStore yet.'}
              </p>
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
              disabled={paying || purchaseState === 'pending' || catalogLoading || !selectedPlan}
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
            <button type="button" className="pw2-free" onClick={onContinueFree}>
              {ru ? 'Остаться на Free' : 'Stay on Free'}
            </button>
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
