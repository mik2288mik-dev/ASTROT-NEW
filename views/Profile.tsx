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
      {/* User info */}
      <div className="mt-4 mb-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-astro-highlight/15 flex items-center justify-center mb-3">
          <span className="text-xl font-bold text-astro-highlight">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-astro-text">{displayName}</h2>
      </div>

      {/* Balance */}
      <div className="mb-6 p-5 rounded-2xl bg-astro-card/60 border border-astro-border text-center">
        <div className="text-xs font-medium text-astro-text/50 uppercase tracking-wider mb-1">
          {getText(lang, 'profile.balance')}
        </div>
        <div className="text-3xl font-bold text-astro-text tabular-nums">
          {balance === null ? '—' : balance}
          <span className="text-base font-medium text-astro-text/50 ml-1.5">Lumi</span>
        </div>
      </div>

      {/* Referral */}
      <div className="mb-6 p-5 rounded-2xl bg-astro-card/60 border border-astro-border">
        <h3 className="text-sm font-semibold text-astro-text/60 uppercase tracking-wider mb-3">
          {getText(lang, 'profile.invite')}
        </h3>

        {loadingLink ? (
          <div className="text-sm text-astro-text/40 py-2">...</div>
        ) : refLink ? (
          <>
            <div className="text-xs text-astro-text/50 mb-1.5">{getText(lang, 'profile.your_link')}</div>
            <div className="p-3 rounded-xl bg-astro-bg/80 border border-astro-border/60 text-xs text-astro-text/70 break-all select-all mb-4">
              {refLink}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl bg-astro-highlight text-white text-sm font-semibold"
              >
                {getText(lang, 'profile.copy')}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 py-2.5 rounded-xl border border-astro-highlight/40 text-astro-highlight text-sm font-semibold"
              >
                {getText(lang, 'profile.share')}
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm text-astro-text/40 py-2">—</div>
        )}
      </div>

      {/* Settings link */}
      <button
        onClick={onOpenSettings}
        className="w-full mb-3 py-3 rounded-2xl border border-astro-border text-astro-text/70 text-sm transition-colors active:bg-astro-card/40"
      >
        {getText(lang, 'profile.settings')}
      </button>

      {/* Back */}
      <button
        onClick={onBack}
        className="w-full py-3 rounded-2xl border border-astro-border text-astro-text/60 text-sm transition-colors active:bg-astro-card/40"
      >
        {getText(lang, 'profile.back')}
      </button>
    </div>
  );
};
