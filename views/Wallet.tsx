import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile, LumiTransaction } from '../types';
import { getLumiWallet } from '../services/storageService';
import { getAllLumiPacks, type LumiPack } from '../services/lumiPacks';
import { requestLumiPackPayment } from '../services/telegramService';
import { Loading } from '../components/ui/Loading';

interface WalletProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

const formatTransactionReason = (lang: 'ru' | 'en', reason: string): string => {
  const map: Record<string, { ru: string; en: string }> = {
    daily_login: { ru: 'Ежедневный вход', en: 'Daily login' },
    streak_bonus: { ru: 'Бонус за серию входов', en: 'Streak bonus' },
    referral_bonus: { ru: 'Реферальный бонус', en: 'Referral bonus' },
    roulette_win: { ru: 'Выигрыш в рулетке', en: 'Roulette win' },
    deep_dive: { ru: 'Глубокий разбор', en: 'Deep dive' },
    synastry: { ru: 'Синастрия', en: 'Synastry' },
    question: { ru: 'Вопрос к Lumia', en: 'Question to Lumia' },
    daily_card: { ru: 'Ежедневная карта', en: 'Daily card' },
    chart_slot: { ru: 'Покупка слота для карты', en: 'Chart slot purchase' },
    regenerate_natal: { ru: 'Повторная генерация натальной карты', en: 'Natal regeneration' },
    regenerate_deep_dive: { ru: 'Повторная генерация deep dive', en: 'Deep dive regeneration' },
    regenerate_synastry: { ru: 'Повторная генерация синастрии', en: 'Synastry regeneration' },
    refresh_natal_intro: { ru: 'Обновление разбора карты', en: 'Chart summary refresh' },
    premium_bonus: { ru: 'Бонус Premium', en: 'Premium bonus' },
    admin_lumi_add: { ru: 'Начисление Lumi от admin', en: 'Admin Lumi credit' },
    admin_lumi_subtract: { ru: 'Списание Lumi от admin', en: 'Admin Lumi deduction' },
    refund: { ru: 'Возврат', en: 'Refund' },
    lumi_pack_starter: { ru: 'Пакет Lumi: Стартовый', en: 'Lumi pack: Starter' },
    lumi_pack_plus: { ru: 'Пакет Lumi: Plus', en: 'Lumi pack: Plus' },
    lumi_pack_max: { ru: 'Пакет Lumi: Max', en: 'Lumi pack: Max' },
  };

  return map[reason]?.[lang] || reason.replace(/_/g, ' ');
};

const formatTransactionTime = (lang: 'ru' | 'en', value: string) =>
  new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export const Wallet: React.FC<WalletProps> = ({ profile, onUpdateProfile }) => {
  const lang = profile.language === 'ru' ? 'ru' : 'en';
  const [wallet, setWallet] = useState<{ lumi_balance: number; transactions: LumiTransaction[] }>({
    lumi_balance: profile.lumiBalance ?? 0,
    transactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const packs = useMemo(() => getAllLumiPacks(), []);

  const loadWallet = async (showLoader = true) => {
    if (!profile.id) return;
    if (showLoader) setLoading(true);
    try {
      const data = await getLumiWallet(profile.id, 40);
      setWallet(data);
      onUpdateProfile({ ...profile, lumiBalance: data.lumi_balance });
    } catch (walletError: any) {
      setError(walletError?.message || T(lang, 'Не удалось загрузить кошелёк', 'Failed to load wallet'));
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void loadWallet();
  }, [profile.id]);

  const handleTopUp = async (pack: LumiPack) => {
    setActionLoading(pack.id);
    setError(null);
    try {
      const ok = await requestLumiPackPayment(profile, pack.id);
      if (!ok) {
        setError(T(lang, 'Покупка не была завершена', 'Purchase was not completed'));
        return;
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
        await loadWallet(false);
      }
    } catch (purchaseError: any) {
      setError(purchaseError?.message || T(lang, 'Не удалось купить Lumi', 'Failed to buy Lumi'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <Loading message={T(lang, 'Загружаем Lumi Wallet...', 'Loading Lumi Wallet...')} />;
  }

  return (
    <div className="p-4 space-y-6 screen-pb">
      <div className="rounded-2xl border border-astro-border bg-astro-card p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
          Lumi Wallet
        </p>
        <p className="font-serif text-3xl text-astro-text">{wallet.lumi_balance} Lumi</p>
        <p className="text-sm text-astro-subtext">
          {T(
            lang,
            'Lumi — внутренняя валюта Lumia для слотов, повторных действий и следующих product flow.',
            'Lumi is Lumia’s internal currency for slots, repeat actions, and next product flows.'
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-astro-border bg-astro-card p-5 space-y-4">
        <div>
          <h2 className="font-serif text-lg text-astro-text">
            {T(lang, 'Пополнить Lumi', 'Top up Lumi')}
          </h2>
          <p className="text-sm text-astro-subtext">
            {T(lang, 'Выберите пакет, чтобы пополнить баланс через Telegram Stars.', 'Choose a pack to top up with Telegram Stars.')}
          </p>
        </div>

        <div className="space-y-3">
          {packs.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handleTopUp(pack)}
              disabled={!!actionLoading}
              className="w-full rounded-xl border border-astro-border bg-astro-bg/30 p-4 text-left hover:border-astro-highlight/40 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-astro-text">{pack.title[lang]}</p>
                  <p className="mt-1 text-sm text-astro-subtext">{pack.description[lang]}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-astro-text">{pack.lumiAmount} Lumi</p>
                  <p className="text-xs text-astro-highlight">{pack.starsAmount} Stars</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-astro-border bg-astro-card p-5 space-y-3">
        <h2 className="font-serif text-lg text-astro-text">
          {T(lang, 'Где используется Lumi', 'Where Lumi is used')}
        </h2>
        <div className="space-y-2 text-sm text-astro-subtext">
          <p>{T(lang, 'Покупка дополнительных слотов для сохранённых карт', 'Buying extra slots for saved charts')}</p>
          <p>{T(lang, 'Повторные платные действия и генерации внутри Lumia', 'Repeat paid actions and regenerations inside Lumia')}</p>
          <p>{T(lang, 'Следующие продуктовые действия, завязанные на внутреннюю экономику', 'Next product actions connected to the in-app economy')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-astro-border bg-astro-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-lg text-astro-text">
            {T(lang, 'История операций', 'Transaction history')}
          </h2>
          <span className="text-xs text-astro-subtext">{wallet.transactions.length}</span>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {wallet.transactions.length === 0 ? (
          <p className="text-sm text-astro-subtext">
            {T(lang, 'История пока пуста.', 'History is empty for now.')}
          </p>
        ) : (
          <div className="space-y-3">
            {wallet.transactions.map((transaction, index) => {
              const isIncome = transaction.amount >= 0;
              return (
                <div
                  key={`${transaction.created_at}-${transaction.reason}-${index}`}
                  className="flex items-start justify-between gap-4 rounded-xl border border-astro-border/70 bg-astro-bg/20 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-astro-text">
                      {formatTransactionReason(lang, transaction.reason)}
                    </p>
                    <p className="mt-1 text-xs text-astro-subtext">
                      {formatTransactionTime(lang, transaction.created_at)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${isIncome ? 'text-emerald-400' : 'text-red-300'}`}>
                    {isIncome ? '+' : ''}
                    {transaction.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
