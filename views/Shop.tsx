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
      {/* Balance */}
      <div className="mt-4 mb-6 p-5 rounded-2xl bg-astro-card/60 border border-astro-border text-center">
        <div className="text-xs font-medium text-astro-text/50 uppercase tracking-wider mb-1">
          {getText(lang, 'shop.balance')}
        </div>
        <div className="text-3xl font-bold text-astro-text tabular-nums">
          {loadingBalance ? '—' : balance}
          <span className="text-base font-medium text-astro-text/50 ml-1.5">Lumi</span>
        </div>
      </div>

      {/* Lumi Packs */}
      <h3 className="text-sm font-semibold text-astro-text/60 uppercase tracking-wider mb-3">
        {getText(lang, 'shop.lumi_packs')}
      </h3>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {LUMI_PACKS.map(({ amount, pack }) => {
          const loading = buyingPack === pack;
          return (
            <div
              key={pack}
              className="flex flex-col items-center p-4 rounded-2xl bg-astro-card/50 border border-astro-border"
            >
              <span className="text-2xl font-bold text-astro-text tabular-nums">{amount}</span>
              <span className="text-xs text-astro-text/50 mb-3">Lumi</span>
              <button
                onClick={() => handleBuyLumi(pack)}
                disabled={!!buyingPack}
                className="w-full py-2 rounded-xl bg-astro-highlight text-white text-xs font-semibold transition-opacity disabled:opacity-50"
              >
                {loading ? '...' : getText(lang, 'shop.buy')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Premium */}
      <h3 className="text-sm font-semibold text-astro-text/60 uppercase tracking-wider mb-3">
        {getText(lang, 'shop.premium')}
      </h3>
      <div className="space-y-3 mb-8">
        {PREMIUM_PLANS.map(({ plan, labelKey }) => {
          const loading = activatingPlan === plan;
          return (
            <div
              key={plan}
              className="flex items-center justify-between p-4 rounded-2xl bg-astro-card/50 border border-astro-border"
            >
              <span className="text-sm font-medium text-astro-text">
                {getText(lang, labelKey)}
              </span>
              <button
                onClick={() => handleActivatePremium(plan)}
                disabled={!!activatingPlan}
                className="px-5 py-2 rounded-xl border border-astro-highlight/40 text-astro-highlight text-xs font-semibold transition-opacity disabled:opacity-50"
              >
                {loading ? '...' : getText(lang, 'shop.activate')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Back */}
      <button
        onClick={onBack}
        className="w-full py-3 rounded-2xl border border-astro-border text-astro-text/60 text-sm transition-colors active:bg-astro-card/40"
      >
        {getText(lang, 'shop.back')}
      </button>
    </div>
  );
};
