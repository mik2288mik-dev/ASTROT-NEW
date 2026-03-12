import React, { useEffect, useState, useCallback } from 'react';
import { getText } from '../constants';
import { getBalance, purchaseLumi, purchasePremium } from '../services/lumiService';
import type { Language } from '../types';

interface ShopProps {
  userId: string;
  language: string;
  onBack: () => void;
}

const LUMI_PACKS = [
  { amount: 100, pack: '100' },
  { amount: 500, pack: '500' },
  { amount: 1200, pack: '1200' },
];

const PREMIUM_PLANS = [
  { plan: '1m', labelKey: 'shop.month_1' },
  { plan: '3m', labelKey: 'shop.month_3' },
  { plan: '6m', labelKey: 'shop.month_6' },
  { plan: '12m', labelKey: 'shop.month_12' },
];

export const Shop: React.FC<ShopProps> = ({ userId, language, onBack }) => {
  const lang = (language || 'ru') as Language;
  const [balance, setBalance] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [activatingPlan, setActivatingPlan] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await getBalance(userId);
      setBalance(res.balance ?? 0);
      setIsPremium(!!res.is_premium);
    } catch (e: any) {
      console.error('[Shop] Balance fetch error:', e);
    } finally {
      setLoadingBalance(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleBuyLumi = async (pack: string) => {
    if (buyingPack) return;
    setBuyingPack(pack);
    try {
      await purchaseLumi(userId, pack);
      await fetchBalance();
      alert(getText(lang, 'shop.lumi_added'));
    } catch (e: any) {
      console.error('[Shop] Lumi purchase error:', e);
      alert(e?.message || getText(lang, 'basic_result.error_generic'));
    } finally {
      setBuyingPack(null);
    }
  };

  const handleActivatePremium = async (plan: string) => {
    if (activatingPlan) return;
    setActivatingPlan(plan);
    try {
      await purchasePremium(userId, plan);
      await fetchBalance();
      alert(getText(lang, 'shop.premium_activated'));
    } catch (e: any) {
      console.error('[Shop] Premium purchase error:', e);
      alert(e?.message || getText(lang, 'basic_result.error_generic'));
    } finally {
      setActivatingPlan(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-10">
      <header className="pt-4 pb-4">
        <h2 className="text-xl font-semibold text-astro-text">
          {getText(lang, 'shop.title')}
        </h2>
      </header>

      <section className="mb-6 p-4 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/50">
        <div className="text-xs font-medium text-astro-text/50 uppercase tracking-wider mb-1">
          {getText(lang, 'shop.balance')}
        </div>
        <div className="text-2xl font-semibold text-astro-text tabular-nums">
          {loadingBalance ? '—' : balance}
          <span className="text-sm font-medium text-astro-text/55 ml-1.5">Lumi</span>
        </div>
      </section>

      <h3 className="text-sm font-medium text-astro-text/70 mb-3">
        {getText(lang, 'shop.lumi_packs')}
      </h3>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {LUMI_PACKS.map(({ amount, pack }) => {
          const loading = buyingPack === pack;
          return (
            <div
              key={pack}
              className="flex flex-col items-center p-4 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/50"
            >
              <span className="text-2xl font-semibold text-astro-text tabular-nums">{amount}</span>
              <span className="text-xs text-astro-text/55 mb-3">Lumi</span>
              <button
                onClick={() => handleBuyLumi(pack)}
                disabled={!!buyingPack}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '...' : getText(lang, 'shop.buy')}
              </button>
            </div>
          );
        })}
      </div>

      <h3 className="text-sm font-medium text-astro-text/70 mb-3">
        {getText(lang, 'shop.premium')}
      </h3>
      <div className="space-y-3 mb-8">
        {PREMIUM_PLANS.map(({ plan, labelKey }) => {
          const loading = activatingPlan === plan;
          return (
            <div
              key={plan}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/50"
            >
              <span className="text-sm font-medium text-astro-text">
                {getText(lang, labelKey)}
              </span>
              <button
                onClick={() => handleActivatePremium(plan)}
                disabled={!!activatingPlan}
                className="px-5 py-2.5 rounded-xl border border-blue-500/50 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
              >
                {loading ? '...' : getText(lang, 'shop.activate')}
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="w-full py-3 rounded-xl border border-astro-border/60 text-astro-text/60 text-sm font-medium hover:bg-white/5 transition-colors"
      >
        {getText(lang, 'shop.back')}
      </button>
    </div>
  );
};
