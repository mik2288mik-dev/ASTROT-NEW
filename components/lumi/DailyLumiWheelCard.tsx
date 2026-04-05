import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getText } from '../../constants';
import type { Language } from '../../types';
import {
  getDailyRouletteStatus,
  postDailyRouletteSpin,
  type DailyRouletteStatus,
} from '../../services/storageService';
import { cn } from '../../lib/cn';

type RouletteTier = 'spark' | 'glow' | 'beam' | 'aurora';

type WheelSegment = {
  tier: RouletteTier;
  label: string;
  color: string;
};

const SPIN_DURATION_MS = 4600;
const SEGMENTS: WheelSegment[] = [
  { tier: 'spark', label: '5-12', color: '#f4d5a6' },
  { tier: 'glow', label: '15-25', color: '#d4af37' },
  { tier: 'spark', label: '5-12', color: '#f1cf98' },
  { tier: 'beam', label: '28-45', color: '#b98532' },
  { tier: 'spark', label: '5-12', color: '#efc98b' },
  { tier: 'glow', label: '15-25', color: '#dcb85b' },
  { tier: 'spark', label: '5-12', color: '#f6d7aa' },
  { tier: 'aurora', label: '55-80', color: '#8c5bff' },
  { tier: 'spark', label: '5-12', color: '#f1d19c' },
  { tier: 'glow', label: '15-25', color: '#d4af37' },
  { tier: 'spark', label: '5-12', color: '#edc482' },
  { tier: 'beam', label: '28-45', color: '#bb8a39' },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length;

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function getWheelGradient() {
  let cursor = 0;
  const parts = SEGMENTS.map((segment) => {
    const start = cursor;
    cursor += SEGMENT_ANGLE;
    return `${segment.color} ${start}deg ${cursor}deg`;
  });
  return `conic-gradient(from -90deg, ${parts.join(', ')})`;
}

function getRandomSegmentIndex(tier: RouletteTier) {
  const matches = SEGMENTS
    .map((segment, index) => ({ segment, index }))
    .filter((item) => item.segment.tier === tier);
  return matches[Math.floor(Math.random() * matches.length)]?.index ?? 0;
}

function buildTargetRotation(currentRotation: number, segmentIndex: number) {
  const currentNormalized = ((currentRotation % 360) + 360) % 360;
  const targetCenter = segmentIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
  const desiredNormalized = (360 - targetCenter) % 360;
  let delta = desiredNormalized - currentNormalized;
  if (delta < 0) delta += 360;
  return currentRotation + 360 * 6 + delta;
}

interface DailyLumiWheelCardProps {
  userId?: string;
  language: Language;
  onBalanceUpdate?: (balance: number) => void;
  onSpinComplete?: () => void | Promise<void>;
  compact?: boolean;
  className?: string;
}

export const DailyLumiWheelCard: React.FC<DailyLumiWheelCardProps> = ({
  userId,
  language,
  onBalanceUpdate,
  onSpinComplete,
  compact = false,
  className,
}) => {
  const [status, setStatus] = useState<DailyRouletteStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [countdownMs, setCountdownMs] = useState(0);
  const [lastWin, setLastWin] = useState<{ amount: number; tier: RouletteTier } | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);

  const gradient = useMemo(() => getWheelGradient(), []);
  const titleKey = compact ? 'lumi_wallet.roulette_dashboard_title' : 'lumi_wallet.roulette_title';
  const subtitleKey = compact ? 'lumi_wallet.roulette_dashboard_body' : 'lumi_wallet.roulette_subtitle';

  const syncStatus = useCallback(
    (nextStatus: DailyRouletteStatus) => {
      setStatus(nextStatus);
      if (typeof nextStatus.lumiBalance === 'number') {
        onBalanceUpdate?.(nextStatus.lumiBalance);
      }
      if (!nextStatus.canSpin && nextStatus.lastWinAmount && nextStatus.lastWinTier) {
        setLastWin({
          amount: nextStatus.lastWinAmount,
          tier: nextStatus.lastWinTier as RouletteTier,
        });
      }
    },
    [onBalanceUpdate]
  );

  const loadStatus = useCallback(async () => {
    if (!userId) return;
    try {
      const nextStatus = await getDailyRouletteStatus(userId);
      syncStatus(nextStatus);
      setError(null);
    } catch (statusError: any) {
      setError(
        statusError?.message ||
          getText(language, 'lumi_wallet.roulette_error')
      );
    }
  }, [language, syncStatus, userId]);

  useEffect(() => {
    void loadStatus();
    return () => {
      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current);
      }
    };
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.nextAvailableAt) {
      setCountdownMs(0);
      return;
    }

    const tick = () => {
      const diff = new Date(status.nextAvailableAt || '').getTime() - Date.now();
      if (diff <= 0) {
        setCountdownMs(0);
        setStatus((current) =>
          current
            ? {
                ...current,
                canSpin: true,
                nextAvailableAt: null,
              }
            : current
        );
        return;
      }
      setCountdownMs(diff);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [status?.nextAvailableAt]);

  const handleSpin = async () => {
    if (!userId || !status?.canSpin || busy) return;

    setBusy(true);
    setError(null);

    try {
      const result = await postDailyRouletteSpin(userId);
      onBalanceUpdate?.(result.lumiBalance);

      if (!result.ok) {
        syncStatus({
          canSpin: false,
          nextAvailableAt: result.nextAvailableAt,
          lastSpinAt: status.lastSpinAt,
          lastWinAmount: status.lastWinAmount,
          lastWinTier: status.lastWinTier,
          lumiBalance: result.lumiBalance,
        });
        setBusy(false);
        return;
      }

      const targetIndex = getRandomSegmentIndex(result.tier as RouletteTier);
      const nextRotation = buildTargetRotation(rotation, targetIndex);
      setRotation(nextRotation);

      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current);
      }

      spinTimeoutRef.current = window.setTimeout(() => {
        setBusy(false);
        setLastWin({ amount: result.amount, tier: result.tier as RouletteTier });
        syncStatus({
          canSpin: false,
          nextAvailableAt: result.nextAvailableAt,
          lastSpinAt: new Date().toISOString(),
          lastWinAmount: result.amount,
          lastWinTier: result.tier,
          lumiBalance: result.lumiBalance,
        });
        void onSpinComplete?.();
      }, SPIN_DURATION_MS + 80);
    } catch (spinError: any) {
      setBusy(false);
      setError(
        spinError?.message ||
          getText(language, 'lumi_wallet.roulette_error')
      );
    }
  };

  const canSpin = Boolean(userId && status?.canSpin && !busy);
  const countdownLabel =
    countdownMs > 0
      ? getText(language, 'lumi_wallet.roulette_next_in').replace('{time}', formatCountdown(countdownMs))
      : null;
  const statusLabel = !status
    ? getText(language, 'lumi_wallet.roulette_ready')
    : busy
      ? getText(language, 'lumi_wallet.roulette_spinning')
      : canSpin
        ? getText(language, 'lumi_wallet.roulette_ready')
        : countdownLabel || getText(language, 'lumi_wallet.roulette_done');

  return (
    <section
      className={cn(
        'rounded-[28px] border border-astro-highlight/24 bg-gradient-to-b from-white/92 via-[#fff9ef] to-white/86 shadow-[0_18px_44px_rgba(0,0,0,0.08)]',
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="lumia-label tracking-[0.18em]">{getText(language, 'lumi_wallet.roulette_kicker')}</p>
          <h2 className={cn('mt-1.5 font-serif text-astro-text', compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl')}>
            {getText(language, titleKey)}
          </h2>
          <p className={cn('mt-2 leading-relaxed text-astro-subtext', compact ? 'text-sm' : 'text-sm sm:text-[15px]')}>
            {getText(language, subtitleKey)}
          </p>
        </div>
        <div className="rounded-full border border-black/8 bg-white/78 px-3 py-1 text-[11px] font-medium text-astro-text shadow-sm">
          {status?.lumiBalance ?? 0} Lumi
        </div>
      </div>

      <div className={cn('mt-5 flex flex-col items-center', compact ? 'gap-4' : 'gap-5')}>
        <div className="relative">
          <div
            className={cn(
              'absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2',
              'h-0 w-0 border-l-[12px] border-r-[12px] border-t-0 border-b-[18px] border-l-transparent border-r-transparent border-b-astro-text drop-shadow-[0_6px_8px_rgba(0,0,0,0.18)]'
            )}
          />
          <div
            className={cn(
              'relative overflow-hidden rounded-full border border-black/10 shadow-[0_18px_32px_rgba(0,0,0,0.12)]',
              compact ? 'h-[196px] w-[196px]' : 'h-[232px] w-[232px]'
            )}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: busy ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)` : 'transform 320ms ease-out',
            }}
          >
            <div className="absolute inset-0" style={{ backgroundImage: gradient }} />
            {SEGMENTS.map((segment, index) => {
              const angle = index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
              return (
                <div
                  key={`${segment.tier}-${index}`}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <span
                    className={cn(
                      'absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/86 px-1.5 py-0.5 text-center font-semibold text-astro-text shadow-sm',
                      compact ? 'text-[8px]' : 'text-[9px]'
                    )}
                    style={{ transform: `translateX(-50%) rotate(${-angle}deg)` }}
                  >
                    {segment.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              'absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/80 bg-white/92 text-center shadow-[0_8px_18px_rgba(0,0,0,0.08)]',
              compact ? 'h-[84px] w-[84px] px-2' : 'h-[96px] w-[96px] px-3'
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-astro-subtext">
              {busy ? getText(language, 'lumi_wallet.roulette_spinning_label') : 'Lumi'}
            </p>
            <p className={cn('mt-1 font-serif text-astro-text', compact ? 'text-base' : 'text-lg')}>
              {lastWin ? `+${lastWin.amount}` : getText(language, 'lumi_wallet.roulette_center_idle')}
            </p>
          </div>
        </div>

        <div className="w-full space-y-3">
          <div className="rounded-2xl border border-black/8 bg-white/72 px-4 py-3 text-center shadow-sm">
            <p className="text-sm font-medium text-astro-text">{statusLabel}</p>
            {lastWin ? (
              <p className="mt-1 text-xs text-astro-subtext">
                {getText(language, 'lumi_wallet.roulette_won').replace('{amount}', String(lastWin.amount))} -{' '}
                {getText(language, `lumi_wallet.roulette_tier_${lastWin.tier}`)}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleSpin()}
            disabled={!canSpin}
            className={cn(
              'flex min-h-[46px] w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition-[transform,opacity,box-shadow] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
              canSpin
                ? 'bg-astro-highlight text-white shadow-[0_14px_28px_rgba(180,126,41,0.28)] hover:opacity-95'
                : 'border border-astro-border/70 bg-white/72 text-astro-subtext'
            )}
          >
            {busy
              ? getText(language, 'lumi_wallet.roulette_spinning')
              : canSpin
                ? getText(language, 'lumi_wallet.roulette_cta')
                : getText(language, 'lumi_wallet.roulette_cta_done')}
          </button>

          {error ? (
            <div className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

