import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../types';
import { PREMIUM_PLANS, type PremiumPlan, type PremiumPlanId } from '../lib/premiumPricing';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { apiFetch } from '../services/apiClient';
import { canUseRuStorePay, resolveDistributionChannel } from '../lib/distributionChannel';
import { getRuStoreProductId, loadRuStoreProducts } from '../services/rustorePayService';
import { CosmicSurface } from '../components/lumia-ui/CosmicSurface';

interface PaywallProps {
  profile: UserProfile;
  onPurchase: (planId: PremiumPlanId) => void;
  onClose: () => void;
  /** Provided in the post-onboarding flow: continue into the app on the free/trial plan. */
  onContinueFree?: () => void;
}

const ORDER: PremiumPlanId[] = ['premium_month', 'premium_quarter', 'premium_year'];

type PaywallPlan = PremiumPlan & {
  isActive?: boolean;
  sortOrder?: number;
  badge?: string | null;
};

const PERIOD: Record<PremiumPlanId, { ru: string; en: string }> = {
  premium_week: { ru: 'Неделя', en: '1 week' },
  premium_month: { ru: 'Месяц', en: 'Month' },
  premium_quarter: { ru: '3 месяца', en: '3 months' },
  premium_year: { ru: 'Год', en: 'Year' },
};

const Check: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Cross: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);

function pluralDays(n: number, ru: boolean): string {
  if (!ru) return n === 1 ? 'day' : 'days';
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

export const Paywall: React.FC<PaywallProps> = ({ profile, onPurchase, onClose, onContinueFree }) => {
  const ru = profile.language !== 'en';
  const distributionChannel = resolveDistributionChannel();
  const rustorePaymentsEnabled = canUseRuStorePay(distributionChannel);
  const [selected, setSelected] = useState<PremiumPlanId>('premium_year');
  const [paying, setPaying] = useState(false);
  const [plans, setPlans] = useState<Record<PremiumPlanId, PaywallPlan>>(PREMIUM_PLANS);
  const [rustoreLabels, setRustoreLabels] = useState<Partial<Record<PremiumPlanId, string>>>({});
  const [rustoreProductsLoaded, setRustoreProductsLoaded] = useState(!rustorePaymentsEnabled);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/subscriptions/plans')
      .then((res) => res.ok ? res.json() : null)
      .then((payload) => {
        if (cancelled || !Array.isArray(payload?.plans)) return;
        const next = { ...PREMIUM_PLANS } as Record<PremiumPlanId, PaywallPlan>;
        for (const plan of payload.plans) {
          if (plan?.id && next[plan.id as PremiumPlanId]) {
            next[plan.id as PremiumPlanId] = { ...next[plan.id as PremiumPlanId], ...plan };
          }
        }
        setPlans(next);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!rustorePaymentsEnabled) return;
    let cancelled = false;
    void loadRuStoreProducts()
      .then((products) => {
        if (cancelled) return;
        setRustoreLabels(Object.fromEntries(
          Object.entries(products)
            .filter(([, product]) => !!product?.amountLabel)
            .map(([planId, product]) => [planId, product!.amountLabel!]),
        ));
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setRustoreProductsLoaded(true); });
    return () => { cancelled = true; };
  }, [rustorePaymentsEnabled]);

  const visibleOrder = useMemo(() => {
    const ids = ORDER.filter((id) => plans[id]?.isActive !== false);
    return ids.length ? ids : ORDER;
  }, [plans]);

  useEffect(() => {
    if (!visibleOrder.includes(selected)) setSelected(visibleOrder[0]);
  }, [selected, visibleOrder]);

  const premiumUntil = profile.premiumUntil ? new Date(profile.premiumUntil) : null;
  const daysLeft = premiumUntil ? Math.max(0, Math.ceil((premiumUntil.getTime() - Date.now()) / 86_400_000)) : 0;
  const trialActive = daysLeft > 0;

  const features: Array<{ label: string; free: boolean }> = ru
    ? [
        { label: 'Гороскоп знака на день', free: true },
        { label: 'Натальная карта — базовый портрет', free: true },
        { label: 'Личный гороскоп по твоей карте', free: false },
        { label: 'Полный разбор натала — 10 тем', free: false },
        { label: 'Совместимость по двум картам', free: false },
        { label: 'Гороскоп на неделю и месяц для всех знаков', free: false },
      ]
    : [
        { label: 'Daily sign horoscope', free: true },
        { label: 'Natal chart — base portrait', free: true },
        { label: 'Your personal horoscope, from your chart', free: false },
        { label: 'Full natal reading — 10 topics', free: false },
        { label: 'Two-chart compatibility', free: false },
        { label: 'Weekly and monthly horoscope for every sign', free: false },
      ];

  const priceText = (id: PremiumPlanId) => (
    rustorePaymentsEnabled
      ? (rustoreLabels[id] || '—')
      : (ru ? `${plans[id].priceRub} ₽` : `$${plans[id].priceUsd}`)
  );
  const savings = (id: PremiumPlanId) => {
    const base = plans.premium_month.priceRub;
    const months = plans[id].days / 30;
    const perMonth = plans[id].priceRub / months;
    return Math.max(0, Math.round((1 - perMonth / base) * 100));
  };

  const buy = () => {
    const canPurchase = distributionChannel === 'telegram'
      || (rustorePaymentsEnabled && rustoreProductsLoaded && !!rustoreLabels[selected]);
    if (paying || !canPurchase) return;
    lumiaSelectionHaptic();
    setPaying(true);
    onPurchase(selected);
    setTimeout(() => setPaying(false), 5000);
  };

  return (
    <CosmicSurface
      variant="paywall"
      className="fresh-page lumia-main-scroll pw2"
      planeClassName="pw2-plane"
    >
      <div className="pw2-topbar">
        <button type="button" onClick={onClose} aria-label={ru ? 'Закрыть' : 'Close'} className="pw2-close">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <h1 className="pw2-title">{ru ? 'Тарифы' : 'Pricing'}</h1>
      <p className="pw2-sub">{ru ? 'Premium открывает личные прогнозы, полный натальный разбор и совместимость по двум картам.' : 'Premium unlocks personal forecasts, the full natal reading, and two-chart compatibility.'}</p>

      {trialActive ? (
        <div className="pw2-trial">
          <span className="pw2-trial-dot" />
          {ru
            ? `Premium активен — осталось ${daysLeft} ${pluralDays(daysLeft, true)}. Пробуй всё бесплатно.`
            : `Premium is active — ${daysLeft} ${pluralDays(daysLeft, false)} left. Try everything free.`}
        </div>
      ) : null}

      <div className="pw2-compare">
        <div className="pw2-compare-head">
          <span />
          <span className="pw2-col">Free</span>
          <span className="pw2-col pw2-col--prem">Premium</span>
        </div>
        {features.map((f, i) => (
          <div className="pw2-row" key={i}>
            <span className="pw2-feat">{f.label}</span>
            <span className={`pw2-cell ${f.free ? 'is-yes' : 'is-no'}`}>{f.free ? <Check /> : <Cross />}</span>
            <span className="pw2-cell pw2-cell--prem is-yes"><Check /></span>
          </div>
        ))}
      </div>

      <div className="pw2-plans">
        {visibleOrder.map((id) => {
          const best = id === 'premium_year';
          const save = savings(id);
          const sel = selected === id;
          return (
            <button
              key={id}
              type="button"
              className={`pw2-plan ${sel ? 'is-sel' : ''} ${best ? 'is-best' : ''}`}
              onClick={() => { lumiaSelectionHaptic(); setSelected(id); }}
            >
              {best ? <span className="pw2-plan-badge">{ru ? 'Выгодно' : 'Best'}</span> : null}
              <span className="pw2-plan-period">{ru ? PERIOD[id].ru : PERIOD[id].en}</span>
              <span className="pw2-plan-price">{priceText(id)}</span>
              {save > 0 ? <span className="pw2-plan-save">−{save}%</span> : <span className="pw2-plan-save pw2-plan-save--ghost">·</span>}
            </button>
          );
        })}
      </div>

      {(distributionChannel === 'telegram' || rustorePaymentsEnabled) ? <button type="button" className="pw2-cta" onClick={buy} disabled={paying || (rustorePaymentsEnabled && (!rustoreProductsLoaded || !rustoreLabels[selected] || !getRuStoreProductId(selected)))}>
        {paying
          ? (ru ? 'Открываю оплату…' : 'Opening…')
          : (rustorePaymentsEnabled && (!rustoreProductsLoaded || !rustoreLabels[selected] || !getRuStoreProductId(selected))
            ? (ru ? 'Покупка временно недоступна' : 'Purchase is temporarily unavailable')
            : `${ru ? 'Оформить Premium' : 'Get Premium'} · ${priceText(selected)}`)}
      </button> : <p className="pw2-foot">{ru ? 'Premium, который уже есть у аккаунта, доступен в этом приложении. Новые покупки здесь пока не подключены.' : 'Premium already linked to your account is available here. New purchases are not connected in this build yet.'}</p>}

      {onContinueFree ? (
        <button type="button" className="pw2-free" onClick={() => { lumiaSelectionHaptic(); onContinueFree(); }}>
          {trialActive
            ? (ru ? 'Продолжить бесплатно — 14 дней Premium включены' : 'Continue free — 14 days of Premium included')
            : (ru ? 'Продолжить бесплатно' : 'Continue free')}
        </button>
      ) : null}

      {distributionChannel === 'telegram' ? <p className="pw2-foot">{ru ? 'Оплата в Telegram Stars. Подписку можно не продлевать.' : 'Pay with Telegram Stars. No auto-renewal.'}</p> : null}
    </CosmicSurface>
  );
};
