import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import { PREMIUM_PLANS, type PremiumPlanId } from '../lib/premiumPricing';
import { lumiaSelectionHaptic } from '../lib/haptics';

interface PaywallProps {
  profile: UserProfile;
  onPurchase: (planId: PremiumPlanId) => void;
  onClose: () => void;
}

const ORDER: PremiumPlanId[] = ['premium_month', 'premium_quarter', 'premium_year'];

const PERIOD: Record<PremiumPlanId, { ru: string; en: string }> = {
  premium_week: { ru: 'Неделя', en: '1 week' },
  premium_month: { ru: 'Месяц', en: '1 month' },
  premium_quarter: { ru: '3 месяца', en: '3 months' },
  premium_year: { ru: 'Год', en: '1 year' },
};

export const Paywall: React.FC<PaywallProps> = ({ profile, onPurchase, onClose }) => {
  const ru = profile.language !== 'en';
  const [paying, setPaying] = useState<PremiumPlanId | null>(null);

  const benefits = ru
    ? ['Личный гороскоп каждый день — по твоей карте', 'Окна дня: лучшее время для действий', 'Глубокий разбор карты по сферам жизни', 'Совместимость по двум картам', 'Годовые прогнозы и без лимитов']
    : ['Personal daily horoscope from your chart', 'Day windows: best time to act', 'Deep chart reading by life area', 'Two-chart compatibility', 'Yearly forecasts and no limits'];

  const priceText = (id: PremiumPlanId) => (ru ? `${PREMIUM_PLANS[id].priceRub} ₽` : `$${PREMIUM_PLANS[id].priceUsd}`);
  const savings = (id: PremiumPlanId) => {
    const base = PREMIUM_PLANS.premium_month.priceRub;
    const months = PREMIUM_PLANS[id].days / 30;
    const perMonth = PREMIUM_PLANS[id].priceRub / months;
    return Math.max(0, Math.round((1 - perMonth / base) * 100));
  };

  const buy = (id: PremiumPlanId) => {
    if (paying) return;
    lumiaSelectionHaptic();
    setPaying(id);
    onPurchase(id);
    setTimeout(() => setPaying(null), 5000);
  };

  return (
    <div className="fresh-page lumia-main-scroll" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 4px' }}>
        <button type="button" onClick={onClose} aria-label={ru ? 'Закрыть' : 'Close'} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--fresh-surface)', color: 'var(--fresh-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div style={{ padding: '0 20px' }}>
        <h1 className="pw-title">Lumia Premium</h1>
        <p className="pw-sub">{ru ? 'Полный доступ к личным разборам по твоей карте.' : 'Full access to personal readings from your chart.'}</p>
      </div>

      <div className="pw-benefits">
        {benefits.map((b, i) => (
          <motion.div key={i} className="pw-benefit" initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.05 * i }}>
            <span className="pw-benefit-check" aria-hidden>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="pw-benefit-text">{b}</span>
          </motion.div>
        ))}
      </div>

      <div className="pw-plans">
        {ORDER.map((id) => {
          const best = id === 'premium_year';
          const save = savings(id);
          return (
            <button key={id} type="button" className={`pw-plan ${best ? 'is-best' : ''}`} onClick={() => buy(id)} disabled={paying === id}>
              <div className="pw-plan-left">
                <div className="pw-plan-period">
                  {ru ? PERIOD[id].ru : PERIOD[id].en}
                  {best ? <span className="pw-plan-badge">{ru ? 'Выгоднее всего' : 'Best value'}</span> : null}
                </div>
                <div className="pw-plan-stars">{paying === id ? (ru ? 'Открываю оплату…' : 'Opening…') : `≈ ${PREMIUM_PLANS[id].stars} Telegram Stars`}</div>
              </div>
              <div className="pw-plan-right">
                <div className="pw-plan-price">{priceText(id)}</div>
                {save > 0 ? <div className="pw-plan-save">−{save}%</div> : null}
              </div>
            </button>
          );
        })}
      </div>

      <p className="pw-foot">{ru ? 'Оплата в Telegram Stars. Подписка продлевается вручную.' : 'Pay with Telegram Stars. Renews manually.'}</p>
    </div>
  );
};
