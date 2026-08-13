import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../types';
import type { PremiumPlanId } from '../lib/premiumPricing';
import type { PaywallContext } from '../lib/paywallContext';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { apiFetch } from '../services/apiClient';
import { canUseRuStorePay, resolveDistributionChannel } from '../lib/distributionChannel';
import {
  loadRuStoreProducts,
  type RuStoreProduct,
} from '../services/rustorePayService';
import { STORE_RELEASE_CONFIG } from '../lib/storeReleaseConfig';

interface PaywallProps {
  profile: UserProfile;
  context: PaywallContext;
  onPurchase: (planId: PremiumPlanId) => Promise<void>;
  onClose: () => void;
  onContinueFree: () => void;
  onRestore: () => Promise<void>;
  onPlanSelected?: (planId: PremiumPlanId) => void;
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

function periodFromDays(days: number, language: 'ru' | 'en'): string {
  if (days >= 360) return language === 'ru' ? '1 год' : '1 year';
  if (days >= 85) return language === 'ru' ? '3 месяца' : '3 months';
  return language === 'ru' ? '1 месяц' : '1 month';
}

export const Paywall: React.FC<PaywallProps> = ({
  profile,
  context,
  onPurchase,
  onClose,
  onContinueFree,
  onRestore,
  onPlanSelected,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const distributionChannel = resolveDistributionChannel();
  const isRuStoreChannel = distributionChannel === 'rustore';
  const rustorePaymentsEnabled = canUseRuStorePay(distributionChannel);
  const [selected, setSelected] = useState<PremiumPlanId>('premium_quarter');
  const [plans, setPlans] = useState<Partial<Record<PremiumPlanId, CatalogPlan>>>({});
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [paying, setPaying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(false);

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
      : isRuStoreChannel
        ? Promise.reject(new Error('RUSTORE_CATALOG_UNAVAILABLE'))
        : apiFetch('/api/subscriptions/plans')
          .then((response) => response.ok ? response.json() : Promise.reject(new Error('CATALOG_UNAVAILABLE')))
          .then((payload) => Object.fromEntries(
            (Array.isArray(payload?.plans) ? payload.plans : [])
              .filter((plan: any) => ORDER.includes(plan?.id) && plan?.isActive !== false && Number(plan?.stars) > 0)
              .map((plan: any) => [plan.id, {
                id: plan.id,
                periodLabel: periodFromDays(Number(plan.days), language),
                priceLabel: `${Number(plan.stars)} Stars`,
                autoRenew: false,
              }]),
          ) as Partial<Record<PremiumPlanId, CatalogPlan>>);

    void loadCatalog
      .then((nextPlans) => {
        if (cancelled) return;
        setPlans(nextPlans);
        const available = ORDER.filter((id) => nextPlans[id]);
        if (!nextPlans.premium_quarter && available[0]) setSelected(available[0]);
        if (!available.length) setCatalogError(true);
      })
      .catch(() => {
        if (!cancelled) setCatalogError(true);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => { cancelled = true; };
  }, [isRuStoreChannel, language, rustorePaymentsEnabled]);

  const visiblePlans = useMemo(
    () => ORDER.map((id) => plans[id]).filter((plan): plan is CatalogPlan => Boolean(plan)),
    [plans],
  );
  const selectedPlan = plans[selected] || null;

  const selectPlan = (planId: PremiumPlanId) => {
    lumiaSelectionHaptic();
    setSelected(planId);
    onPlanSelected?.(planId);
  };

  const buy = async () => {
    if (paying || !selectedPlan) return;
    lumiaSelectionHaptic();
    setPaying(true);
    try {
      await onPurchase(selectedPlan.id);
    } finally {
      setPaying(false);
    }
  };

  const restore = async () => {
    if (restoring) return;
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

  const reasons = ru
    ? [
        'Весь личный Today.',
        'Личная неделя и месяц.',
        'Глубокий разбор карты и личности.',
        'Совместимость по данным рождения и сохранённые люди.',
      ]
    : [
        'All of your personal Today.',
        'Your personal week and month.',
        'Deep chart and personality readings.',
        'Birth-data compatibility and saved people.',
      ];

  return (
    <div
      className="fresh-page lumia-main-scroll pw2"
      data-paywall-instance-id={context.paywallInstanceId}
      data-paywall-placement={context.placement}
    >
      <div className="pw2-topbar">
        <button
          type="button"
          onClick={onClose}
          aria-label={ru ? 'Закрыть' : 'Close'}
          className="pw2-close"
          style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <h1 className="pw2-title">{ru ? 'Больше личного. Меньше общего.' : 'More personal. Less generic.'}</h1>
      <p className="pw2-sub">{CONTEXT_COPY[context.placement][language]}</p>

      <ol className="pw2-compare" aria-label={ru ? 'Что входит в Premium' : 'What Premium includes'}>
        {reasons.map((reason) => (
          <li className="pw2-row" key={reason}>
            <span className="pw2-feat">{reason}</span>
          </li>
        ))}
      </ol>

      {catalogLoading ? (
        <p className="pw2-foot" role="status">{ru ? 'Загружаем планы из магазина…' : 'Loading plans from the store…'}</p>
      ) : visiblePlans.length ? (
        <div className="pw2-plans" role="radiogroup" aria-label={ru ? 'Выбери период Premium' : 'Choose a Premium period'}>
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
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedPlan ? (
        <div className="pw2-foot">
          <p>
            {selectedPlan.autoRenew
              ? (ru
                  ? `Автопродление включено: ${selectedPlan.priceLabel} за ${selectedPlan.periodLabel}.`
                  : `Auto-renewal is on: ${selectedPlan.priceLabel} per ${selectedPlan.periodLabel}.`)
              : (ru
                  ? `Разовая оплата: ${selectedPlan.priceLabel} за ${selectedPlan.periodLabel}.`
                  : `One-time payment: ${selectedPlan.priceLabel} for ${selectedPlan.periodLabel}.`)}
          </p>
          {rustorePaymentsEnabled ? (
            <p>{ru ? 'Управлять или отменить подписку можно в RuStore.' : 'Manage or cancel the subscription in RuStore.'}</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="pw2-cta"
        onClick={() => void buy()}
        aria-busy={paying}
        disabled={paying || catalogLoading || !selectedPlan}
      >
        {paying
          ? (ru ? 'Открываем RuStore…' : 'Opening RuStore…')
          : selectedPlan
            ? `${ru ? 'Оформить' : 'Get'} ${selectedPlan.periodLabel} · ${selectedPlan.priceLabel}`
            : (ru ? 'Покупка сейчас недоступна' : 'Purchase is unavailable')}
      </button>

      {catalogError ? (
        <p className="pw2-foot" role="status">
          {ru
            ? 'Покупка сейчас недоступна. Уже действующий Premium продолжит работать.'
            : 'Purchase is unavailable right now. Existing Premium access keeps working.'}
        </p>
      ) : null}

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
      {restoreError ? (
        <p className="pw2-foot" role="alert">
          {ru ? 'Не удалось восстановить покупку. Проверь RuStore и интернет.' : 'Could not restore the purchase. Check RuStore and your connection.'}
        </p>
      ) : null}

      <div className="pw2-foot">
        <a href={STORE_RELEASE_CONFIG.termsUrl} target="_blank" rel="noreferrer">
          {ru ? 'Условия использования' : 'Terms of use'}
        </a>
        {' · '}
        <a href={STORE_RELEASE_CONFIG.privacyUrl} target="_blank" rel="noreferrer">
          {ru ? 'Политика конфиденциальности' : 'Privacy policy'}
        </a>
      </div>
    </div>
  );
};
