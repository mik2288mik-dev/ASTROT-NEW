import React, { useEffect, useState, useCallback } from 'react';
import { getText } from '../constants';
import { getBalance } from '../services/lumiService';
import { getReferralLink } from '../services/referralService';
import type { Language, UserProfile } from '../types';

interface ProfileProps {
  userId: string;
  userProfile: UserProfile;
  onBack: () => void;
  onOpenSettings: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ userId, userProfile, onBack, onOpenSettings }) => {
  const lang = (userProfile.language || 'ru') as Language;
  const [balance, setBalance] = useState<number | null>(null);
  const [refLink, setRefLink] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await getBalance(userId);
      setBalance(res.balance ?? 0);
    } catch (e: any) {
      console.error('[Profile] Balance error:', e);
    }
  }, [userId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    const fetchLink = async () => {
      try {
        const res = await getReferralLink(userId);
        setRefLink(res.link || null);
      } catch (e: any) {
        console.error('[Profile] Referral link error:', e);
      } finally {
        setLoadingLink(false);
      }
    };
    fetchLink();
  }, [userId]);

  const handleCopy = async () => {
    if (!refLink) return;
    try {
      await navigator.clipboard.writeText(refLink);
      alert(getText(lang, 'profile.copied'));
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = refLink;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert(getText(lang, 'profile.copied'));
      } catch (e: any) {
        console.error('[Profile] Copy failed:', e);
      }
    }
  };

  const handleShare = async () => {
    if (!refLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ url: refLink });
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('[Profile] Share failed:', e);
        }
      }
    } else {
      await handleCopy();
    }
  };

  const displayName = userProfile.name || 'User';

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-10">
      <header className="pt-4 pb-4">
        <h2 className="text-xl font-semibold text-astro-text">
          {getText(lang, 'profile.title')}
        </h2>
      </header>

      <section className="mb-4 flex items-center gap-4 p-4 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/50">
        <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="font-medium text-astro-text">{displayName}</div>
      </section>

      <section className="mb-6 p-4 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/50">
        <div className="text-xs font-medium text-astro-text/50 uppercase tracking-wider mb-1">
          {getText(lang, 'profile.balance')}
        </div>
        <div className="text-2xl font-semibold text-astro-text tabular-nums">
          {balance === null ? '—' : balance}
          <span className="text-sm font-medium text-astro-text/55 ml-1.5">Lumi</span>
        </div>
      </section>

      <section className="mb-6 p-4 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-astro-border/50">
        <h3 className="text-sm font-medium text-astro-text/70 mb-3">
          {getText(lang, 'profile.invite')}
        </h3>

        {loadingLink ? (
          <div className="text-sm text-astro-text/50 py-2">...</div>
        ) : refLink ? (
          <>
            <div className="text-xs text-astro-text/55 mb-1.5">{getText(lang, 'profile.your_link')}</div>
            <div className="p-3 rounded-xl bg-astro-bg/50 border border-astro-border/50 text-xs text-astro-text/75 break-all select-all mb-4">
              {refLink}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                {getText(lang, 'profile.copy')}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 py-2.5 rounded-xl border border-astro-border/60 text-astro-text/80 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                {getText(lang, 'profile.share')}
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm text-astro-text/50 py-2">—</div>
        )}
      </section>

      <button
        onClick={onOpenSettings}
        className="w-full mb-3 py-3 rounded-xl border border-astro-border/60 text-astro-text/75 text-sm font-medium hover:bg-white/5 transition-colors"
      >
        {getText(lang, 'profile.settings')}
      </button>

      <button
        onClick={onBack}
        className="w-full py-3 rounded-xl border border-astro-border/60 text-astro-text/60 text-sm font-medium hover:bg-white/5 transition-colors"
      >
        {getText(lang, 'profile.back')}
      </button>
    </div>
  );
};
