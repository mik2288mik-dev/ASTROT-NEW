import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Bookmark, Check, ChevronLeft, ChevronRight, Info, Lock, Maximize2, MoreHorizontal, Share2, Sparkles, X } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion';
import type {
  InterpretationSection,
  NatalChartData,
  ProfileCard,
  NatalStoryCard,
  NatalStoryCardId,
  UserProfile,
} from '../../types';
import {
  isHumanPaidSectionKey,
  type HumanPaidSectionKey,
} from '../../lib/natalHumanShared';
import {
  adaptProfileCardsToStoryCards,
  getSavedNatalStoryState,
  markNatalStoryCompleted,
  saveNatalStoryCard,
  setNatalStoryExpandedCard,
  setLastNatalStoryCard,
  syncNatalStoryStateFromCloud,
} from '../../lib/natalStory';
import { buildNatalProfileCards } from '../../lib/natalProfileCards';
import {
  loadNatalStoryShareImage,
  loadNatalProfileCards,
  loadHumanPaidSection,
  type HumanReadingError,
} from '../../services/natalReadingService';
import { recordUserAppEvent, updateUserNotificationSettings } from '../../services/sessionService';
import { hasActivePremium } from '../../lib/accessMatrix';
import { cn } from '../../lib/cn';
import { FormattedAiText } from '../ui/FormattedAiText';
import { NatalUnlockSheet } from './HumanReport';

type NatalStoryDeckProps = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  requestPremium: (source?: string, payload?: Record<string, any>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenTodaySection: (section: 'pulse' | 'checkin') => void;
  onScrollToFullReport: () => void;
  onBack?: () => void;
  initialCardId?: NatalStoryCardId | null;
};

type PaidSectionState = Partial<Record<HumanPaidSectionKey, InterpretationSection>>;

const COACHMARK_KEY = 'lumia_natal_story_coachmark_seen';
const NOTIFICATION_PROMPT_KEY = 'lumia_natal_story_notifications_prompted';
const PAYWALL_DISMISS_KEY = 'lumia_natal_story_paywall_dismissed';
const PAYWALL_DISMISS_SESSION_KEY = 'lumia_natal_story_paywall_dismissed_sessions';

function formatStoryError(error: unknown): string {
  const e = error as HumanReadingError;
  if (e?.code === 'PREMIUM_REQUIRED' || e?.code === 'HUMAN_SECTION_LOCKED') {
    return 'Этот раздел доступен в Premium.';
  }
  return e?.message || 'Не удалось открыть карточку. Попробуйте ещё раз.';
}

function hapticSelection() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* optional */
  }
}

function hapticImpact(style: 'light' | 'medium' = 'light') {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    /* optional */
  }
}

function hapticSuccess() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
  } catch {
    /* optional */
  }
}

function firstTextLine(text: string): string {
  return String(text || '').split(/\n\s*\n/)[0]?.trim() || '';
}

function buildShareUrl(cardId: NatalStoryCardId): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'chart');
  url.searchParams.set('storyCard', cardId);
  return url.toString();
}

function fireStoryEvent(eventType: string, payload: Record<string, any> = {}) {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const source = params?.get('source') || null;
  const startParam = typeof window !== 'undefined'
    ? ((window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || params?.get('startapp') || null)
    : null;
  void recordUserAppEvent({
    eventType,
    section: 'natal_story',
    source,
    eventPayload: {
      source,
      start_param: startParam,
      ...payload,
    },
  });
}

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* optional */
  }
}

function isPaywallInCooldown() {
  const dismissedAt = Number(storageGet(PAYWALL_DISMISS_KEY) || 0);
  const dismissedSessions = Number(storageGet(PAYWALL_DISMISS_SESSION_KEY) || 0);
  if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return true;
  return Number.isFinite(dismissedSessions) && dismissedSessions > 0 && dismissedSessions < 3;
}

function recordPaywallDismiss() {
  storageSet(PAYWALL_DISMISS_KEY, String(Date.now()));
  storageSet(PAYWALL_DISMISS_SESSION_KEY, '1');
}

function advancePaywallDismissSession() {
  const current = Number(storageGet(PAYWALL_DISMISS_SESSION_KEY) || 0);
  if (Number.isFinite(current) && current > 0 && current < 3) {
    storageSet(PAYWALL_DISMISS_SESSION_KEY, String(current + 1));
  }
}

function getPaidKey(card: NatalStoryCard): HumanPaidSectionKey | null {
  return card.paidSectionKey && isHumanPaidSectionKey(card.paidSectionKey)
    ? card.paidSectionKey
    : null;
}

function buildLocalProfileCardsFallback(
  profile: UserProfile,
  chartData: NatalChartData,
  localHour: number
): ProfileCard[] {
  try {
    const isPremium = hasActivePremium(profile);
    return buildNatalProfileCards({
      profile: { ...profile, isPremium },
      chartData,
      isPremium,
      todayContext: { localHour },
    });
  } catch {
    return [];
  }
}

function HeroVisual({ card }: { card: NatalStoryCard }) {
  const tone = {
    hero_halo_portrait: {
      base: 'from-[#f4edff] via-[#f8f5ff] to-[#fff8f3]',
      accent: 'bg-[#8c6be8]',
      line: 'border-[#a78cf1]/30',
    },
    hero_core_rings: {
      base: 'from-[#eaf5ff] via-[#f7fbff] to-[#fffaf1]',
      accent: 'bg-[#3d8edb]',
      line: 'border-[#6ab6dc]/30',
    },
    hero_strength_spark: {
      base: 'from-[#fff5d8] via-[#fffaf1] to-[#f5fbff]',
      accent: 'bg-[#d3a735]',
      line: 'border-[#e2bf5a]/35',
    },
    hero_noise_fade: {
      base: 'from-[#fff1f4] via-[#fff9f9] to-[#f7fbff]',
      accent: 'bg-[#d8748a]',
      line: 'border-[#d8748a]/28',
    },
    hero_dual_orbit: {
      base: 'from-[#fff0e8] via-[#fff8f3] to-[#f4f8ff]',
      accent: 'bg-[#e0785e]',
      line: 'border-[#e0785e]/28',
    },
    hero_path_focus: {
      base: 'from-[#edf1ff] via-[#f7f8ff] to-[#fff8ef]',
      accent: 'bg-[#5268d8]',
      line: 'border-[#5268d8]/28',
    },
  }[card.illustrationKey];

  return (
    <div className={cn('relative h-[7.65rem] overflow-hidden rounded-[20px] bg-gradient-to-br min-[390px]:h-[8.65rem]', tone.base)}>
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.92),transparent_28%),radial-gradient(circle_at_84%_26%,rgba(255,255,255,0.54),transparent_22%),radial-gradient(circle_at_62%_86%,rgba(255,255,255,0.78),transparent_32%)]" />
      <div className={cn('absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border', tone.line)} />
      <div className={cn('absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border', tone.line)} />
      <div className={cn('absolute right-10 top-9 h-3 w-3 rounded-full shadow-[0_0_26px_rgba(140,107,232,0.35)]', tone.accent)} />
      <div className={cn('absolute bottom-8 left-10 h-2.5 w-2.5 rounded-full opacity-70', tone.accent)} />
      <div className="absolute left-[21%] top-[32%] h-12 w-12 rounded-full bg-white/55 shadow-[0_18px_48px_rgba(80,68,95,0.12)] backdrop-blur-md" />
      <div className="absolute bottom-7 right-[21%] h-16 w-16 rounded-full bg-white/38 shadow-[0_18px_54px_rgba(80,68,95,0.13)] backdrop-blur-md" />
      <svg aria-hidden="true" className="absolute inset-x-7 bottom-8 h-16 text-[#1f1f1f]/16" viewBox="0 0 260 80" fill="none">
        <path
          d="M8 56C45 16 78 21 111 45C143 68 176 71 214 33C228 19 240 14 252 14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M38 38C72 19 108 17 140 32C169 46 193 48 224 28"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity=".62"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/44 to-transparent" />
    </div>
  );
}

function ProgressDots({ activeIndex, total, onSelect }: { activeIndex: number; total: number; onSelect: (index: number) => void }) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <span className="shrink-0 rounded-full border border-[#e6dcfb] bg-white/76 px-4 py-2 text-[18px] font-semibold leading-none text-[#7654c8] shadow-[0_10px_28px_rgba(118,84,200,0.08)]">
        {activeIndex + 1} / {total}
      </span>
      <div className="relative flex min-w-0 flex-1 items-center justify-between">
        <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-[#e4e1e7]" />
        {Array.from({ length: total }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              'relative z-10 h-4 w-4 rounded-full border bg-white transition',
              index === activeIndex
                ? 'border-[#8c6be8] bg-[#8c6be8] shadow-[0_0_0_5px_rgba(140,107,232,0.16)]'
                : 'border-[#d4d2d6] bg-[#d4d2d6]'
            )}
            aria-label={`Открыть карточку ${index + 1}`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSelect(total - 1)}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#f0edf3] bg-white/78 text-[#8d8795] shadow-[0_10px_28px_rgba(28,24,36,0.05)]"
        aria-label="К последней карточке"
      >
        <Sparkles size={18} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function StoryCardSurface({
  card,
  activeChip,
  onChip,
  onRead,
}: {
  card: NatalStoryCard;
  activeChip: string | null;
  onChip: (chip: string) => void;
  onRead: () => void;
}) {
  const hint = activeChip ? card.chipHints?.[activeChip] : null;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-white/80 bg-white/88 p-3.5 shadow-[0_24px_70px_rgba(47,37,70,0.13)] backdrop-blur-xl min-[390px]:p-4">
      <HeroVisual card={card} />
      <div className="mt-3 flex items-center gap-2 min-[390px]:mt-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8c6be8] text-white shadow-[0_10px_24px_rgba(140,107,232,0.25)] min-[390px]:h-9 min-[390px]:w-9">
          <Sparkles size={17} strokeWidth={1.9} />
        </span>
        <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8c6be8]">
          {card.eyebrow}
        </p>
      </div>
      <h2
        className="mt-2.5 font-sans text-[clamp(1.55rem,6.5vw,2rem)] font-semibold leading-[1.02] tracking-normal text-[#111117]"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {card.title}
      </h2>
      <p
        className="mt-2.5 text-[14.5px] leading-[1.42] text-[#4b4b56] min-[390px]:text-[15.5px]"
        style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {card.summaryShort}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5 min-[390px]:gap-2">
        {card.chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onChip(chip)}
            className={cn(
              'min-h-[32px] rounded-full border px-2.5 text-[12.5px] font-medium transition min-[390px]:min-h-[34px] min-[390px]:px-3 min-[390px]:text-[13px]',
              activeChip === chip
                ? 'border-[#8c6be8]/45 bg-[#f1ebff] text-[#6242a8]'
                : 'border-[#ece8f2] bg-white/72 text-[#5b5962]'
            )}
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="mt-2.5 min-h-[2.15rem]">
        {hint ? (
          <p className="rounded-[16px] bg-[#f8f6fb] px-3 py-2 text-[12.5px] leading-relaxed text-[#5a5562]">
            {hint}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRead}
        className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-[14px] font-semibold text-white transition-transform active:scale-[0.98]"
      >
        {card.ctaPrimary.type === 'read_deeper' ? 'Читать дальше' : card.ctaPrimary.label}
        <ChevronRight size={17} strokeWidth={2.1} />
      </button>
    </div>
  );
}

function StorySheet({
  card,
  isPremium,
  paidSection,
  isPaidLoading,
  isLocked,
  error,
  onClose,
  onUnlock,
  onSave,
  onFullReport,
  onScrollDepth,
}: {
  card: NatalStoryCard;
  isPremium: boolean;
  paidSection?: InterpretationSection;
  isPaidLoading: boolean;
  isLocked: boolean;
  error: string | null;
  onClose: () => void;
  onUnlock: () => void;
  onSave: () => void;
  onFullReport: () => void;
  onScrollDepth: (depthPct: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const depthRef = useRef(0);
  const body = isLocked
    ? firstTextLine(card.bodyFree)
    : paidSection?.content || (isPremium && card.bodyPremium ? card.bodyPremium : card.bodyFree);
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const maxScroll = Math.max(1, target.scrollHeight - target.clientHeight);
    const depth = Math.min(100, Math.round((target.scrollTop / maxScroll) * 100));
    const bucket = depth >= 95 ? 100 : depth >= 75 ? 75 : depth >= 50 ? 50 : depth >= 25 ? 25 : 0;
    if (bucket > depthRef.current) {
      depthRef.current = bucket;
      onScrollDepth(bucket);
    }
  }, [onScrollDepth]);

  return (
    <div className="fixed inset-0 z-[68] flex items-end justify-center bg-black/32 px-3 pb-[max(0.75rem,var(--tg-content-safe-area-inset-bottom,0px))]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <section
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-[30px] bg-white shadow-[0_24px_90px_rgba(0,0,0,0.28)]"
        style={{
          maxHeight: expanded
            ? 'calc(var(--tg-viewport-stable-height, 100dvh) - max(0.75rem,var(--tg-content-safe-area-inset-bottom,0px)))'
            : 'min(34rem, calc(var(--tg-viewport-stable-height, 100dvh) * 0.7))',
          minHeight: expanded
            ? 'calc(var(--tg-viewport-stable-height, 100dvh) * 0.86)'
            : 'min(25rem, calc(var(--tg-viewport-stable-height, 100dvh) * 0.54))',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 px-5 pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#dfdfdf]" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5] text-[#444]"
            aria-label="Закрыть"
          >
            <X size={17} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="absolute right-14 top-4 flex h-9 min-w-9 items-center justify-center gap-1 rounded-full bg-[#f5f2fb] px-3 text-[12px] font-semibold text-[#6548a5]"
          >
            <Maximize2 size={14} strokeWidth={2} />
            {expanded ? 'Свернуть' : 'Развернуть'}
          </button>
          <p className="pr-10 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6be8]">{card.eyebrow}</p>
          <h3 className="mt-2 pr-10 text-[28px] font-semibold leading-[1.05] tracking-normal text-[#15151b]">
            {card.title}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {card.chips.map((chip) => (
              <span key={chip} className="rounded-full bg-[#f5f2fb] px-3 py-1.5 text-[12px] font-medium text-[#6548a5]">
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.25rem+var(--tg-content-safe-area-inset-bottom,0px))] pt-5" onScroll={handleScroll}>
          {isPaidLoading ? (
            <div className="space-y-3 py-3">
              <div className="h-4 w-11/12 rounded-full bg-[#f1f1f1]" />
              <div className="h-4 w-10/12 rounded-full bg-[#f1f1f1]" />
              <div className="h-4 w-8/12 rounded-full bg-[#f1f1f1]" />
            </div>
          ) : (
            <FormattedAiText
              text={body}
              paragraphClassName="font-sans text-[16px] leading-[1.76] text-[#2d2d2d] [text-wrap:pretty]"
              className="max-w-none"
            />
          )}
          {card.previewBullet ? (
            <p className="mt-5 rounded-[18px] bg-[#faf8f2] px-4 py-3 text-[14px] leading-relaxed text-[#574d39]">
              {card.previewBullet}
            </p>
          ) : null}
          {isLocked ? (
            <div className="relative mt-5 overflow-hidden rounded-[22px] border border-[#eee8f6] bg-[#faf8ff] p-4">
              <div className="absolute inset-x-4 top-4 h-16 rounded-full bg-white/70 blur-xl" />
              <div className="relative">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#efe8fb] text-[#6b48a7]">
                    <Lock size={16} strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-[#24212b]">Прочитать всё о себе</p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#675f70]">{card.tease}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onUnlock}
                  className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-[14px] font-semibold text-white"
                >
                  <Sparkles size={15} strokeWidth={2} />
                  Прочитать всё о себе
                </button>
              </div>
            </div>
          ) : null}
          {error ? <p className="mt-4 text-[13px] leading-relaxed text-[#b05c5c]">{error}</p> : null}
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onSave}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#f5f5f5] px-4 text-[13px] font-semibold text-[#2f2f35]"
            >
              <Bookmark size={15} strokeWidth={2} />
              Сохранить
            </button>
            <button
              type="button"
              onClick={onFullReport}
              className="flex min-h-[44px] items-center justify-center rounded-full bg-[#f5f2fb] px-4 text-[13px] font-semibold text-[#6548a5]"
            >
              Полный разбор
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StoryInfoSheet({
  profile,
  chartData,
  onClose,
}: {
  profile: UserProfile;
  chartData: NatalChartData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[69] flex items-end justify-center bg-black/30 px-3 pb-[max(0.75rem,var(--tg-content-safe-area-inset-bottom,0px))]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <section className="relative w-full max-w-md rounded-t-[30px] bg-white px-5 pb-5 pt-4 shadow-[0_24px_90px_rgba(0,0,0,0.26)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#dfdfdf]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5] text-[#444]"
          aria-label="Закрыть"
        >
          <X size={17} strokeWidth={2} />
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6be8]">О расчёте</p>
        <h3 className="mt-2 max-w-[18rem] text-[25px] font-semibold leading-[1.08] text-[#1f1f1f]">
          На чём основана карта
        </h3>
        <div className="mt-5 space-y-3 rounded-[22px] bg-[#fafafa] p-4 text-[14px] leading-relaxed text-[#4f4f57]">
          <p>Дата: {profile.birthDate || 'не указана'}</p>
          {profile.birthTime ? <p>Время: {profile.birthTime}</p> : null}
          {profile.birthPlace ? <p>Место: {profile.birthPlace}</p> : null}
          <p>Основные опоры: {chartData.sun?.sign || '—'} / {chartData.moon?.sign || '—'} / {chartData.rising?.sign || '—'}</p>
        </div>
        <p className="mt-5 text-[14px] leading-relaxed text-[#5f5f66]">
          Разбор основан на расчётах по дате, времени и месту рождения. Это ознакомательная интерпретация, не прямое указание и не медицинская, юридическая или финансовая рекомендация.
        </p>
      </section>
    </div>
  );
}

function StorySkeleton() {
  return (
    <section className="relative overflow-hidden bg-[#fbfafc] px-5 pb-8 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8c6be8]">О тебе</p>
      <div className="mt-5 h-10 w-10/12 rounded-full bg-[#f0edf5]" />
      <div className="mt-3 h-10 w-8/12 rounded-full bg-[#f0edf5]" />
      <div className="mt-7 h-[28rem] rounded-[28px] bg-white shadow-[0_24px_70px_rgba(47,37,70,0.08)]">
        <div className="p-4">
          <div className="h-40 rounded-[22px] bg-[#f0edf5]" />
          <div className="mt-5 h-8 w-8/12 rounded-full bg-[#f0edf5]" />
          <div className="mt-4 h-4 w-full rounded-full bg-[#f0edf5]" />
          <div className="mt-3 h-4 w-9/12 rounded-full bg-[#f0edf5]" />
        </div>
      </div>
    </section>
  );
}

export const NatalStoryDeck = memo<NatalStoryDeckProps>(
  ({
    profile,
    chartData,
    chartId,
    requestPremium,
    onUpdateProfile: _onUpdateProfile,
    onOpenTodaySection,
    onScrollToFullReport,
    onBack,
    initialCardId,
  }) => {
    const userId = profile.id ? String(profile.id) : '';
    const isPremium = hasActivePremium(profile);
    const [profileCards, setProfileCards] = useState<ProfileCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeChip, setActiveChip] = useState<string | null>(null);
    const [sheetCardId, setSheetCardId] = useState<NatalStoryCardId | null>(null);
    const [infoOpen, setInfoOpen] = useState(false);
    const [savedCards, setSavedCards] = useState<NatalStoryCardId[]>([]);
    const [showCoachmark, setShowCoachmark] = useState(false);
    const [paidSections, setPaidSections] = useState<PaidSectionState>({});
    const [paidLoading, setPaidLoading] = useState<HumanPaidSectionKey | null>(null);
    const [unlockTarget, setUnlockTarget] = useState<HumanPaidSectionKey | null>(null);
    const [sectionError, setSectionError] = useState<string | null>(null);
    const [showNotificationOptIn, setShowNotificationOptIn] = useState(false);
    const [dragEnabled, setDragEnabled] = useState(true);
    const initializedCardRef = useRef(false);
    const openedRef = useRef(false);
    const completedRef = useRef(false);
    const impressionsRef = useRef<Set<NatalStoryCardId>>(new Set());
    const viewedCardsRef = useRef<Set<NatalStoryCardId>>(new Set());
    const dragX = useMotionValue(0);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        tg?.expand?.();
        tg?.disableVerticalSwipes?.();
        tg?.setupSwipeBehavior?.({ allow_vertical_swipe: false });
      } catch {
        /* optional */
      }
      advancePaywallDismissSession();
      return () => {
        try {
          const tg = (window as any).Telegram?.WebApp;
          tg?.enableVerticalSwipes?.();
          tg?.setupSwipeBehavior?.({ allow_vertical_swipe: true });
        } catch {
          /* optional */
        }
      };
    }, []);

    useEffect(() => {
      const saved = getSavedNatalStoryState();
      setSavedCards(saved.savedCardIds);
      try {
        setShowCoachmark(window.localStorage.getItem(COACHMARK_KEY) !== '1');
      } catch {
        setShowCoachmark(false);
      }
      void syncNatalStoryStateFromCloud().then((cloudSaved) => {
        setSavedCards(cloudSaved.savedCardIds);
      });
    }, []);

    useEffect(() => {
      const localHour = new Date().getHours();
      if (!userId) {
        setProfileCards(buildLocalProfileCardsFallback(profile, chartData, localHour));
        setLoading(false);
        setError(null);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      loadNatalProfileCards(userId, chartId, { localHour })
        .then((result) => {
          if (!cancelled) setProfileCards(result.profileCards || []);
        })
        .catch((err) => {
          if (!cancelled) {
            const fallbackCards = buildLocalProfileCardsFallback(profile, chartData, localHour);
            setProfileCards(fallbackCards);
            setError(fallbackCards.length ? null : formatStoryError(err));
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [chartData, chartId, profile, userId]);

    const cards = useMemo(
      () => adaptProfileCardsToStoryCards(profileCards),
      [profileCards]
    );
    const activeCard = cards[activeIndex] || null;
    const sheetCard = sheetCardId ? cards.find((card) => card.id === sheetCardId) || null : null;

    useEffect(() => {
      if (!cards.length || initializedCardRef.current) return;
      initializedCardRef.current = true;
      const saved = getSavedNatalStoryState();
      const targetId = initialCardId || saved.lastCardId;
      const targetIndex = targetId ? cards.findIndex((card) => card.id === targetId) : -1;
      if (targetIndex >= 0) setActiveIndex(targetIndex);
    }, [cards, initialCardId]);

    useEffect(() => {
      if (!activeCard) return;
      setLastNatalStoryCard(activeCard.id);
      setActiveChip(null);
      viewedCardsRef.current.add(activeCard.id);
      if (!openedRef.current) {
        openedRef.current = true;
        fireStoryEvent('natal_story_open', {
          card_id: activeCard.id,
          is_first_time: !getSavedNatalStoryState().lastCardId,
        });
      }
      if (!impressionsRef.current.has(activeCard.id)) {
        impressionsRef.current.add(activeCard.id);
        fireStoryEvent('natal_card_impression', {
          card_id: activeCard.id,
          index: activeCard.index,
        });
      }
      if (cards.length && activeIndex === cards.length - 1 && !completedRef.current) {
        completedRef.current = true;
        markNatalStoryCompleted();
        fireStoryEvent('natal_story_completed', {
          card_id: activeCard.id,
          index: activeCard.index,
          viewed_count: viewedCardsRef.current.size,
        });
        if (storageGet(NOTIFICATION_PROMPT_KEY) !== '1') {
          setShowNotificationOptIn(true);
        }
      }
    }, [activeCard, activeIndex, cards.length]);

    const moveTo = useCallback(
      (nextIndex: number, reason: 'button' | 'swipe' | 'dot' = 'button') => {
        if (!cards.length) return;
        const clamped = Math.max(0, Math.min(cards.length - 1, nextIndex));
        if (clamped === activeIndex) return;
        const from = cards[activeIndex];
        const to = cards[clamped];
        hapticSelection();
        setActiveIndex(clamped);
        dragX.set(0);
        fireStoryEvent('natal_card_swipe_next', {
          from_card: from?.id,
          to_card: to?.id,
          reason,
        });
      },
      [activeIndex, cards, dragX]
    );

    const loadPaid = useCallback(
      async (key: HumanPaidSectionKey) => {
        if (!userId || paidLoading) return null;
        setSectionError(null);
        setPaidLoading(key);
        try {
          const result = await loadHumanPaidSection(userId, key, chartId, {
            accessTier: 'premium',
          });
          setPaidSections((current) => ({ ...current, [key]: result.content }));
          return result.content;
        } catch (err) {
          setSectionError(formatStoryError(err));
          return null;
        } finally {
          setPaidLoading(null);
        }
      },
      [chartId, paidLoading, userId]
    );

    const openDepth = useCallback(
      (card: NatalStoryCard) => {
        hapticImpact();
        setSheetCardId(card.id);
        setNatalStoryExpandedCard(card.id);
        fireStoryEvent('natal_readmore_tap', {
          card_id: card.id,
          index: card.index,
          viewed_count: viewedCardsRef.current.size,
        });
        fireStoryEvent('natal_sheet_open', {
          card_id: card.id,
          is_premium_teaser: !!getPaidKey(card) && !isPremium,
        });
        const paidKey = getPaidKey(card);
        if (paidKey && isPremium && !paidSections[paidKey]) {
          void loadPaid(paidKey);
        }
      },
      [isPremium, loadPaid, paidSections]
    );

    const handlePrimary = useCallback(
      (card: NatalStoryCard) => {
        if (card.ctaPrimary.type === 'open_today') {
          hapticImpact();
          fireStoryEvent('natal_today_cta_tap', { card_id: card.id, time_of_day: 'day' });
          onOpenTodaySection('pulse');
          return;
        }
        if (card.ctaPrimary.type === 'open_checkin') {
          hapticImpact();
          fireStoryEvent('natal_checkin_cta_tap', { card_id: card.id, time_of_day: 'evening' });
          onOpenTodaySection('checkin');
          return;
        }
        openDepth(card);
      },
      [onOpenTodaySection, openDepth]
    );

    const handleStoryBack = useCallback(() => {
      if (sheetCardId) {
        setSheetCardId(null);
        setNatalStoryExpandedCard(null);
        return;
      }
      if (infoOpen) {
        setInfoOpen(false);
        return;
      }
      if (activeIndex > 0) {
        moveTo(activeIndex - 1, 'button');
        return;
      }
      onBack?.();
    }, [activeIndex, infoOpen, moveTo, onBack, sheetCardId]);

    useEffect(() => {
      const tg = (window as any).Telegram?.WebApp;
      const backButton = tg?.BackButton;
      if (!backButton?.show || !backButton?.onClick) return;
      backButton.show();
      backButton.onClick(handleStoryBack);
      return () => {
        backButton.offClick?.(handleStoryBack);
      };
    }, [handleStoryBack]);

    useEffect(() => {
      if (!activeCard) return;
      const tg = (window as any).Telegram?.WebApp;
      const mainButton = tg?.MainButton;
      if (!mainButton?.setText || !mainButton?.onClick) return;
      mainButton.setText(activeCard.ctaPrimary.label);
      mainButton.show?.();
      const handler = () => handlePrimary(activeCard);
      mainButton.onClick(handler);
      return () => {
        mainButton.offClick?.(handler);
        mainButton.hide?.();
      };
    }, [activeCard, handlePrimary]);

    const handleDragEnd = useCallback(
      (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 72;
        const direction =
          info.offset.x < -threshold || info.velocity.x < -440
            ? 1
            : info.offset.x > threshold || info.velocity.x > 440
              ? -1
              : 0;

        if (direction) {
          moveTo(activeIndex + direction, 'swipe');
        }
        animate(dragX, 0, reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28 });
      },
      [activeIndex, dragX, moveTo, reduceMotion]
    );

    const handlePointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setDragEnabled(event.clientX - rect.left >= 24);
    }, []);

    const handleSave = useCallback(
      (card: NatalStoryCard) => {
        const next = saveNatalStoryCard(card.id);
        setSavedCards(next.savedCardIds);
        hapticSuccess();
        fireStoryEvent('natal_save_tap', {
          card_id: card.id,
        });
      },
      []
    );

    const handleShare = useCallback(async (card: NatalStoryCard) => {
      hapticImpact();
      const payload = {
        title: `LUMIA: ${card.title}`,
        text: `${card.title}\n\n${card.summaryShort}`,
        url: buildShareUrl(card.id),
      };
      try {
        const image = userId ? await loadNatalStoryShareImage(userId, card.id, chartId, 'story').catch(() => null) : null;
        const files = image && typeof File !== 'undefined'
          ? [new File([image], `lumia-${card.id}.png`, { type: 'image/png' })]
          : [];
        if (files.length && navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
          fireStoryEvent('natal_share_tap', {
            card_id: card.id,
            format: 'story_png',
          });
          await navigator.share({ ...payload, files });
        } else if (navigator.share) {
          fireStoryEvent('natal_share_tap', {
            card_id: card.id,
            format: 'web_share',
          });
          await navigator.share(payload);
        } else if (navigator.clipboard) {
          fireStoryEvent('natal_share_tap', {
            card_id: card.id,
            format: 'clipboard',
          });
          await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
          hapticSuccess();
        }
      } catch {
        /* share dismissed */
      }
    }, [chartId, userId]);

    const dismissCoachmark = useCallback(() => {
      setShowCoachmark(false);
      try {
        window.localStorage.setItem(COACHMARK_KEY, '1');
      } catch {
        /* ignore */
      }
    }, []);

    const handleNotificationOptIn = useCallback(async (enabled: boolean) => {
      storageSet(NOTIFICATION_PROMPT_KEY, '1');
      setShowNotificationOptIn(false);
      fireStoryEvent('natal_notifications_optin', {
        enabled,
        placement: 'story_completed',
        card_id: activeCard?.id,
      });
      if (!enabled) return;

      const timezone = chartData.timezone || undefined;
      const ok = await updateUserNotificationSettings({
        enabled: true,
        morningEnabled: true,
        eveningEnabled: true,
        timezone,
      });
      if (ok) hapticSuccess();
    }, [activeCard?.id, chartData.timezone]);

    if (loading) return <StorySkeleton />;

    if (error || !activeCard) {
      return (
        <section className="relative bg-white px-5 py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6be8]">О тебе</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-tight text-[#1f1f1f]">Короткие карточки пока не готовы</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-[#666]">
            {error || 'Попробуйте открыть карту ещё раз через несколько секунд.'}
          </p>
          <button
            type="button"
            onClick={onScrollToFullReport}
            className="mt-6 rounded-full bg-[#1f1f1f] px-5 py-3 text-[14px] font-semibold text-white"
          >
            Перейти к полному разбору
          </button>
        </section>
      );
    }

    const paidKeyForSheet = sheetCard ? getPaidKey(sheetCard) : null;
    const paidSectionForSheet = paidKeyForSheet ? paidSections[paidKeyForSheet] : undefined;
    const isSheetLocked = !!paidKeyForSheet && !isPremium && !paidSectionForSheet;
    const nextCards = [1, 2].map((offset) => cards[Math.min(cards.length - 1, activeIndex + offset)]).filter(Boolean);

    return (
      <section
        className="relative isolate overflow-hidden bg-[#fbfafc] px-4 pb-[calc(1rem+var(--tg-content-safe-area-inset-bottom,0px))] pt-2 min-[390px]:px-5 min-[390px]:pt-3"
        style={{ minHeight: 'calc(var(--tg-viewport-stable-height, 100dvh) - 7.75rem)' }}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_6%,rgba(140,107,232,0.16),transparent_32%),radial-gradient(circle_at_96%_28%,rgba(239,184,114,0.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#fbfafc_48%,#f7f4fb_100%)]" />

        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8c6be8]">О тебе</p>
          <button
            type="button"
            onClick={() => {
              hapticImpact();
              setInfoOpen(true);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/75 text-[#6f6878] shadow-[0_10px_28px_rgba(28,24,36,0.05)]"
            aria-label="Информация о расчёте"
          >
            <MoreHorizontal size={20} strokeWidth={2} />
          </button>
        </div>

        <h1 className="mt-3 max-w-[20rem] text-[clamp(2rem,8.4vw,2.5rem)] font-semibold leading-[1.04] tracking-normal text-[#111117] min-[390px]:mt-4">
          Твоя карта в коротких карточках
        </h1>

        <ProgressDots activeIndex={activeIndex} total={cards.length} onSelect={(index) => moveTo(index, 'dot')} />

        {showCoachmark ? (
          <button
            type="button"
            onClick={dismissCoachmark}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white/74 px-4 py-2.5 text-[14px] italic leading-relaxed text-[#73717a] shadow-[0_8px_24px_rgba(28,24,36,0.05)]"
          >
            <Info size={16} strokeWidth={1.8} />
            Листай влево или жми «Дальше»
          </button>
        ) : null}

        <div
          className="relative mt-4 min-h-[24.25rem] min-[390px]:mt-5"
          style={{ height: 'clamp(24.25rem, calc(var(--tg-viewport-stable-height, 100dvh) - 18.75rem), 30rem)' }}
        >
          {nextCards.reverse().map((card, stackIndex) => (
            <div
              key={`${card.id}-stack-${stackIndex}`}
              className="absolute inset-x-3 top-7 rounded-[28px] border border-white/80 bg-white/62 shadow-[0_20px_54px_rgba(47,37,70,0.08)]"
              style={{
                height: 'calc(100% - 1.9rem)',
                transform: `translateY(${(nextCards.length - stackIndex) * 20}px) rotate(${stackIndex === 0 ? '-2deg' : '2deg'}) scale(${0.96 - stackIndex * 0.035})`,
                opacity: 0.92 - stackIndex * 0.18,
              }}
            >
              <div className="flex items-center justify-between px-5 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6be8]/70">{card.eyebrow}</p>
                <span className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold text-[#77707d]">
                  {card.index + 1} / {cards.length}
                </span>
              </div>
              <p className="px-5 pt-3 text-[22px] font-semibold leading-tight text-[#211f28]/82">{card.title}</p>
            </div>
          ))}

          <motion.div
            className="absolute inset-x-0 top-0 z-20 h-full touch-pan-y"
            drag={reduceMotion || !dragEnabled ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            dragMomentum={false}
            onPointerDownCapture={handlePointerDownCapture}
            onDragEnd={handleDragEnd}
            style={{ x: dragX }}
          >
            <StoryCardSurface
              card={activeCard}
              activeChip={activeChip}
              onChip={(chip) => {
                hapticSelection();
                setActiveChip((current) => (current === chip ? null : chip));
              }}
              onRead={() => handlePrimary(activeCard)}
            />
          </motion.div>
        </div>

        <div className="mt-5 grid grid-cols-[4.5rem_1fr_4.5rem] gap-2.5">
          <button
            type="button"
            onClick={() => (activeIndex > 0 ? moveTo(activeIndex - 1, 'button') : onBack?.())}
            className="flex min-h-[54px] items-center justify-center rounded-full bg-white/86 text-[13px] font-semibold text-[#605d67] shadow-[0_12px_28px_rgba(28,24,36,0.06)]"
          >
            <ChevronLeft size={18} strokeWidth={2.2} />
            <span className="sr-only">Назад</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrimary(activeCard)}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-[#8c6be8] px-5 text-[17px] font-semibold text-white shadow-[0_16px_34px_rgba(140,107,232,0.28)] transition-transform active:scale-[0.98]"
          >
            <Sparkles size={18} strokeWidth={2} />
            {activeCard.ctaPrimary.label}
          </button>
          <button
            type="button"
            onClick={() => (activeIndex < cards.length - 1 ? moveTo(activeIndex + 1, 'button') : onScrollToFullReport())}
            className="flex min-h-[54px] items-center justify-center rounded-full bg-white/86 text-[13px] font-semibold text-[#605d67] shadow-[0_12px_28px_rgba(28,24,36,0.06)]"
          >
            <span className="sr-only">Дальше</span>
            <ChevronRight size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => handleSave(activeCard)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-white/74 px-4 text-[13px] font-medium text-[#5f5b66] shadow-[0_8px_22px_rgba(28,24,36,0.04)]"
          >
            {savedCards.includes(activeCard.id) ? <Check size={15} strokeWidth={2.1} /> : <Bookmark size={15} strokeWidth={2} />}
            {savedCards.includes(activeCard.id) ? 'Сохранено' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => void handleShare(activeCard)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-white/74 px-4 text-[13px] font-medium text-[#5f5b66] shadow-[0_8px_22px_rgba(28,24,36,0.04)]"
          >
            <Share2 size={15} strokeWidth={2} />
            Поделиться
          </button>
          <button
            type="button"
            onClick={onScrollToFullReport}
            className="inline-flex min-h-[42px] items-center rounded-full bg-white/74 px-4 text-[13px] font-medium text-[#5f5b66] shadow-[0_8px_22px_rgba(28,24,36,0.04)]"
          >
            Полный разбор
          </button>
        </div>

        {showNotificationOptIn ? (
          <div className="mt-4 rounded-[24px] border border-white/80 bg-white/78 p-4 shadow-[0_14px_34px_rgba(28,24,36,0.07)] backdrop-blur-md">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1ebff] text-[#7254c7]">
                <Bell size={18} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#201f26]">Мягко напоминать о ритме?</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#69636f]">
                  Утром короткий акцент, вечером check-in. Без спама и без тяжёлых формулировок.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleNotificationOptIn(true)}
                className="min-h-[42px] rounded-full bg-[#1f1f1f] px-4 text-[13px] font-semibold text-white"
              >
                Включить мягко
              </button>
              <button
                type="button"
                onClick={() => void handleNotificationOptIn(false)}
                className="min-h-[42px] rounded-full bg-white px-4 text-[13px] font-semibold text-[#5f5b66]"
              >
                Позже
              </button>
            </div>
          </div>
        ) : null}

        {sheetCard ? (
          <StorySheet
            card={sheetCard}
            isPremium={isPremium}
            paidSection={paidSectionForSheet}
            isPaidLoading={paidLoading === paidKeyForSheet}
            isLocked={isSheetLocked}
            error={sectionError}
            onClose={() => {
              setSheetCardId(null);
              setNatalStoryExpandedCard(null);
            }}
            onUnlock={() => {
              const key = getPaidKey(sheetCard);
              if (key) {
                if (isPaywallInCooldown()) {
                  setSectionError('Вернёмся к полному открытию чуть позже. Сейчас можно дочитать краткий разбор или перейти к полному разбору ниже.');
                  fireStoryEvent('natal_paywall_open', {
                    card_id: sheetCard.id,
                    trigger_type: 'story_sheet',
                    suppressed: true,
                    reason: 'dismiss_cooldown',
                  });
                  return;
                }
                setUnlockTarget(key);
                fireStoryEvent('natal_paywall_open', { card_id: sheetCard.id, trigger_type: 'story_sheet' });
              }
            }}
            onSave={() => handleSave(sheetCard)}
            onScrollDepth={(depthPct) => fireStoryEvent('natal_sheet_scroll_depth', {
              card_id: sheetCard.id,
              depth_pct: depthPct,
            })}
            onFullReport={() => {
              setSheetCardId(null);
              setNatalStoryExpandedCard(null);
              onScrollToFullReport();
            }}
          />
        ) : null}

        {infoOpen ? <StoryInfoSheet profile={profile} chartData={chartData} onClose={() => setInfoOpen(false)} /> : null}

        {unlockTarget ? (
          <NatalUnlockSheet
            sectionKey={unlockTarget}
            isLoading={paidLoading === unlockTarget}
            onClose={() => {
              const card = cards.find((item) => getPaidKey(item) === unlockTarget);
              recordPaywallDismiss();
              fireStoryEvent('natal_paywall_dismiss', {
                card_id: card?.id,
                trigger_type: 'story_unlock_sheet',
              });
              setUnlockTarget(null);
            }}
            onPremium={() => {
              const card = cards.find((item) => getPaidKey(item) === unlockTarget);
              fireStoryEvent('natal_trial_start', {
                card_id: card?.id,
                source: 'story_unlock_sheet',
                trial_supported: false,
              });
              setUnlockTarget(null);
              void requestPremium('natal_story_unlock', {
                card_id: card?.id,
                section_key: unlockTarget,
              });
            }}
          />
        ) : null}
      </section>
    );
  }
);

NatalStoryDeck.displayName = 'NatalStoryDeck';
