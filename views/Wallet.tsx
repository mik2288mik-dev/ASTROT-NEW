import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile, LumiTransaction } from '../types';
import {
  getLumiWallet,
  getProfile,
} from '../services/storageService';
import { getAllLumiPacks, type LumiPack } from '../services/lumiPacks';
import { requestLumiPackPayment } from '../services/telegramService';
import { Loading } from '../components/ui/Loading';
import { formatLumiReasonLabel, listLumiReasonKeysByFlow } from '../lib/lumiReasonTaxonomy';
import { getText } from '../constants';
import { REFERRAL_INVITEE_LUMI, REFERRAL_INVITER_LUMI } from '../lib/referralEconomy';
import { ScreenShell, AIR_GLASS_PANEL_CLASS } from '../components/layout/ScreenShell';
import { DailyLumiWheelCard } from '../components/lumi/DailyLumiWheelCard';
import { DailyLumiTasksCard } from '../components/lumi/DailyLumiTasksCard';

interface WalletProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

function ruStreakPhrase(days: number): string {
  const mod100 = days % 100;
  const mod10 = days % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${days} дней подряд`;
  if (mod10 === 1) return `${days} день подряд`;
  if (mod10 >= 2 && mod10 <= 4) return `${days} дня подряд`;
  return `${days} дней подряд`;
}

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
  const [copyHint, setCopyHint] = useState<'link' | 'code' | null>(null);

  const packs = useMemo(() => getAllLumiPacks(), []);
  const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
  const inviteLink =
    botUsername && profile.refCode
      ? `https://t.me/${botUsername}?startapp=${encodeURIComponent(profile.refCode)}`
      : '';

  const streak = profile.loginStreak ?? 0;
  const streakMilestones = [3, 7, 30] as const;
  const nextStreakBonusDay = useMemo(() => {
    const next = streakMilestones.find((d) => streak < d);
    return next ?? null;
  }, [streak]);

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

  const wt = (key: string, vars?: Record<string, string>) => {
    let s = getText(profile.language, `lumi_wallet.${key}`);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(`{${k}}`, v);
      }
    }
    return s;
  };

  const copyToClipboard = async (text: string, kind: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(kind);
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setError(T(lang, 'Не удалось скопировать', 'Could not copy'));
    }
  };

  const openTelegramShare = () => {
    if (!inviteLink) return;
    const url = encodeURIComponent(inviteLink);
    const text = encodeURIComponent(wt('referral_share_text'));
    const tgUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    const tw = (window as any).Telegram?.WebApp;
    if (tw?.openTelegramLink) {
      tw.openTelegramLink(tgUrl);
    } else {
      window.open(tgUrl, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    void loadWallet();
  }, [profile.id]);

  useEffect(() => {
    if (!profile.id || (profile.refCode && profile.refCode.length > 0)) return;
    let cancelled = false;
    void (async () => {
      try {
        const p = await getProfile();
        if (cancelled || !p?.refCode) return;
        onUpdateProfile({
          ...profile,
          refCode: p.refCode,
          referralApplied: p.referralApplied ?? profile.referralApplied,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.id, profile.refCode]);

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
    <ScreenShell className="pt-2">
      <div className={`${AIR_GLASS_PANEL_CLASS} space-y-3`}>
        <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
          Lumi Wallet
        </p>
        <p className="font-serif text-3xl text-astro-text">{wallet.lumi_balance} Lumi</p>
        <p className="text-sm text-astro-subtext leading-relaxed">
          {T(
            lang,
            'Lumi — не «монетки ради монеток», а понятная валюта точечных действий: слоты карт, разовые вопросы, синастрия и обновления разборов. Часть Lumi можно получать за регулярный вход; часть — купить пакетом.',
            'Lumi is not random coins — it is the currency for specific actions: chart slots, one-off questions, synastry, and content refreshes. You can earn some through regular visits, and buy more when you need a boost.'
          )}
        </p>
      </div>

      <DailyLumiWheelCard
        userId={profile.id}
        language={profile.language}
        onBalanceUpdate={(balance) => {
          setWallet((current) => ({ ...current, lumi_balance: balance }));
          onUpdateProfile({ ...profile, lumiBalance: balance });
        }}
        onSpinComplete={() => loadWallet(false)}
      />

      <DailyLumiTasksCard
        userId={profile.id}
        language={profile.language}
        onBalanceUpdate={(balance) => {
          setWallet((current) => ({ ...current, lumi_balance: balance }));
          onUpdateProfile({ ...profile, lumiBalance: balance });
        }}
      />

      <div className={`${AIR_GLASS_PANEL_CLASS} space-y-4`}>
        <div>
          <h2 className="font-serif text-lg text-astro-text">{wt('referral_title')}</h2>
          <p className="mt-2 text-sm text-astro-subtext leading-relaxed">
            {wt('referral_body')}{' '}
            <span className="text-astro-text">
              +{REFERRAL_INVITER_LUMI} / +{REFERRAL_INVITEE_LUMI} Lumi
            </span>
          </p>
        </div>
        {profile.referralApplied ? (
          <p className="text-sm text-astro-highlight/90">{wt('referral_applied')}</p>
        ) : (
          <>
            {profile.refCode && (
              <p className="font-mono text-lg tracking-widest text-astro-text">{profile.refCode}</p>
            )}
            {!botUsername && (
              <p className="text-xs text-astro-subtext">{wt('referral_bot_hint')}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {inviteLink ? (
                <>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(inviteLink, 'link')}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-astro-border px-4 py-2 text-sm font-medium text-astro-text hover:border-astro-highlight/50"
                  >
                    {copyHint === 'link' ? wt('referral_copied') : wt('referral_copy_link')}
                  </button>
                  <button
                    type="button"
                    onClick={openTelegramShare}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-astro-highlight/15 px-4 py-2 text-sm font-medium text-astro-highlight hover:bg-astro-highlight/25"
                  >
                    Telegram
                  </button>
                </>
              ) : null}
              {profile.refCode ? (
                <button
                  type="button"
                  onClick={() => void copyToClipboard(profile.refCode!, 'code')}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-astro-border px-4 py-2 text-sm font-medium text-astro-text hover:border-astro-highlight/50"
                >
                  {copyHint === 'code' ? wt('referral_copied') : wt('referral_copy_code')}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className={`${AIR_GLASS_PANEL_CLASS} space-y-4`}>
        <div>
          <h2 className="font-serif text-lg text-astro-text">{wt('taxonomy_title')}</h2>
          <p className="mt-2 text-sm text-astro-subtext leading-relaxed">{wt('taxonomy_intro')}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {(['earn', 'spend', 'purchase'] as const).map((flow) => {
            const titleKey = flow === 'earn' ? 'taxonomy_earn' : flow === 'spend' ? 'taxonomy_spend' : 'taxonomy_purchase';
            return (
              <div key={flow}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-astro-subtext">{wt(titleKey)}</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-astro-text/90">
                  {listLumiReasonKeysByFlow(flow).map((key) => (
                    <li key={key}>{formatLumiReasonLabel(lang, key)}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${AIR_GLASS_PANEL_CLASS} space-y-3`}>
        <h2 className="font-serif text-lg text-astro-text">
          {T(lang, 'Как получать Lumi', 'How you earn Lumi')}
        </h2>
        <ul className="list-disc space-y-2 pl-4 text-sm text-astro-subtext leading-relaxed">
          <li>
            {T(
              lang,
              'Ежедневное колесо Lumi можно крутить раз в 24 часа после спина. Чаще выпадет небольшой выигрыш, но иногда приходит крупный бонус.',
              'The daily Lumi wheel can be spun once every 24 hours after your last spin. Most wins stay small, but sometimes you can hit a much bigger bonus.'
            )}
          </li>
          <li>
            {T(
              lang,
              'Серия дней подряд даёт дополнительные бонусы на отметках 3, 7 и 30 дней.',
              'Login streaks add extra bonuses at 3, 7, and 30 consecutive days.'
            )}
          </li>
          <li>
            {T(
              lang,
              'Ежедневная награда в кошельке и приглашение друга по ссылке — см. блоки выше.',
              'Daily reward in the wallet and inviting a friend via link — see the sections above.'
            )}
          </li>
        </ul>
        {streak > 0 && (
          <div className="rounded-xl border border-astro-highlight/25 bg-astro-highlight/5 px-3 py-3 space-y-2">
            <p className="text-sm text-astro-text">
              {lang === 'ru'
                ? `Сейчас серия: ${ruStreakPhrase(streak)}.`
                : `Current streak: ${streak} day${streak === 1 ? '' : 's'}.`}
              {nextStreakBonusDay != null
                ? ` ${T(lang, `Следующий бонус серии — на ${nextStreakBonusDay}-м дне.`, `Next streak bonus unlocks on day ${nextStreakBonusDay}.`)}`
                : ` ${T(lang, 'Вы уже прошли все стандартные вехи серии — держите ритм.', 'You have passed the usual streak milestones — keep the rhythm.')}`}
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] uppercase tracking-wider text-astro-subtext">
                <span>0</span>
                <span>3</span>
                <span>7</span>
                <span>30</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-astro-border">
                <div
                  className="h-full rounded-full bg-astro-highlight/85 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (streak / 30) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`${AIR_GLASS_PANEL_CLASS} space-y-4`}>
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
              className="flex min-h-[44px] w-full items-center rounded-xl border border-astro-border bg-astro-bg/30 p-4 text-left hover:border-astro-highlight/40 transition-colors disabled:opacity-50"
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

      <div className={`${AIR_GLASS_PANEL_CLASS} space-y-3`}>
        <h2 className="font-serif text-lg text-astro-text">
          {T(lang, 'На что тратится Lumi', 'What Lumi is spent on')}
        </h2>
        <ul className="list-disc space-y-2 pl-4 text-sm text-astro-subtext leading-relaxed">
          <li>{T(lang, 'Дополнительные слоты для сохранённых карт.', 'Extra slots for saved charts.')}</li>
          <li>
            {T(
              lang,
              'Разовый полный ответ на вопрос и полный разбор синастрии (когда открыт за Lumi).',
              'One-off full question answers and full synastry readings (when unlocked with Lumi).'
            )}
          </li>
          <li>
            {T(
              lang,
              'Обновления и пересчёты контента там, где в продукте явно стоит цена в Lumi.',
              'Content refreshes and recalculations wherever the product shows a Lumi price.'
            )}
          </li>
        </ul>
      </div>

      <div className={`${AIR_GLASS_PANEL_CLASS} space-y-4`}>
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
                      {formatLumiReasonLabel(lang, transaction.reason)}
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
    </ScreenShell>
  );
};
