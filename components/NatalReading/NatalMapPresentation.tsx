import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, Crown, Lock, MoreHorizontal, Share2, WalletCards, X } from 'lucide-react';
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion';
import type {
  InterpretationSection,
  NatalChartData,
  NatalStoryCard,
  NatalStoryCardId,
  ProfileCard,
  UserProfile,
} from '../../types';
import { cn } from '../../lib/cn';
import { buildNatalProfileCards } from '../../lib/natalProfileCards';
import {
  adaptProfileCardsToStoryCards,
  getSavedNatalStoryState,
  markNatalStoryCompleted,
  saveNatalStoryCard,
  setLastNatalStoryCard,
  setNatalStoryExpandedCard,
  syncNatalStoryStateFromCloud,
} from '../../lib/natalStory';
import {
  HUMAN_PAID_LUMI_COST,
  isHumanPaidSectionKey,
  type HumanPaidSectionKey,
} from '../../lib/natalHumanShared';
import {
  loadHumanPaidSection,
  loadNatalProfileCards,
  loadNatalStoryShareImage,
  type HumanReadingError,
} from '../../services/natalReadingService';
import { recordUserAppEvent } from '../../services/sessionService';
import { FormattedAiText } from '../ui/FormattedAiText';

type NatalMapPresentationProps = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  requestPremium: (source?: string, payload?: Record<string, any>) => void | Promise<void>;
  onOpenWallet?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenTodaySection: (section: 'pulse' | 'checkin') => void;
  onScrollToFullReport: () => void;
  onBack?: () => void;
  onViewerOpenChange?: (open: boolean) => void;
  initialCardId?: NatalStoryCardId | null;
};

type PaidSectionState = Partial<Record<HumanPaidSectionKey, InterpretationSection>>;

const CARD_ASSET: Record<string, string> = {
  first_impression: 'first-impression',
  inner_base: 'decisions',
  strengths: 'communication',
  overload: 'relationships',
  relationships: 'blockers',
  today_bridge: 'strengths',
};

const PAID_KEY_BY_CARD: Partial<Record<NatalStoryCardId, HumanPaidSectionKey>> = {};

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

function hideBrokenImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none';
}

function formatStoryError(error: unknown): string {
  const e = error as HumanReadingError;
  if (e?.code === 'INSUFFICIENT_LUMI') {
    return `Недостаточно Lumi. Нужно ${e.lumiCost ?? HUMAN_PAID_LUMI_COST}, сейчас ${e.lumiBalance ?? 0}.`;
  }
  if (e?.code === 'PREMIUM_REQUIRED' || e?.code === 'HUMAN_SECTION_LOCKED') {
    return 'Этот раздел можно открыть через Premium или за Lumi.';
  }
  return e?.message || 'Не удалось открыть полный разбор. Попробуй ещё раз.';
}

function assetPath(assetKey: string | undefined, fallback: string) {
  return `/lumia-natal-viewer/${assetKey || fallback}.webp`;
}

function getPaidKey(card: NatalStoryCard): HumanPaidSectionKey | null {
  if (!card.isPremiumLocked) return null;
  const key = PAID_KEY_BY_CARD[card.id] || card.paidSectionKey;
  return key && isHumanPaidSectionKey(key) ? key : null;
}

function buildLocalProfileCardsFallback(profile: UserProfile, chartData: NatalChartData, localHour: number): ProfileCard[] {
  try {
    return buildNatalProfileCards({
      profile: { ...profile, isPremium: !!profile.isPremium },
      chartData,
      isPremium: !!profile.isPremium,
      todayContext: { localHour },
    });
  } catch {
    return [];
  }
}

function buildShareUrl(cardId: NatalStoryCardId) {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'chart');
  url.searchParams.set('storyCard', cardId);
  return url.toString();
}

function fireViewerEvent(eventType: string, payload: Record<string, any> = {}) {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const source = params?.get('source') || null;
  const startParam = typeof window !== 'undefined'
    ? ((window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || params?.get('startapp') || null)
    : null;

  void recordUserAppEvent({
    eventType,
    section: 'natal_card_viewer',
    source,
    eventPayload: {
      source,
      start_param: startParam,
      ...payload,
    },
  });
}

function structuredPremiumText(card: NatalStoryCard, paidSection?: InterpretationSection | null) {
  if (paidSection?.content) return paidSection.content;
  const body = card.premiumBody;
  if (!body) return card.bodyPremium || card.premiumText || card.bodyFree || card.freeText;
  return [
    `Работа: ${body.work}`,
    `Отношения: ${body.relationships}`,
    `Деньги: ${body.money}`,
    `Что делать: ${body.recommendation}`,
    `Почему так по карте: ${body.why}`,
  ].join('\n\n');
}

function BodyRows({ card }: { card: NatalStoryCard }) {
  const rows = [
    ['Где это видно', card.body?.life],
    ['Пример', card.body?.plus],
    ['Что может мешать', card.body?.risk],
    ['Что делать', card.body?.action],
  ].filter((row): row is [string, string] => !!row[1]);

  return (
    <div className="mt-3 space-y-2">
      {rows.map(([label, text]) => (
        <div key={label} className="rounded-[1rem] bg-white/78 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(31,22,54,0.08)]">
          <p className="mb-0 font-lumiaHome text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-[#5E35FF]">
            {label}
          </p>
          <p className="mb-0 mt-1 line-clamp-2 font-lumiaHome text-[0.78rem] font-semibold leading-snug text-[#2b2439]">
            {text}
          </p>
        </div>
      ))}
    </div>
  );
}

function CoverCard({
  cards,
  loading,
  error,
  onOpen,
  onInfo,
  onFullReport,
}: {
  cards: NatalStoryCard[];
  loading: boolean;
  error: string | null;
  onOpen: () => void;
  onInfo: () => void;
  onFullReport: () => void;
}) {
  const first = cards[0];
  return (
    <section className="relative overflow-hidden bg-[#fffaf7] px-4 pb-9 pt-4">
      <div className="mx-auto w-full max-w-[27rem]">
        <div className="relative min-h-[35rem] overflow-hidden rounded-[2rem] bg-[#171126] text-white shadow-[0_24px_74px_rgba(31,22,54,0.24)]">
          <img
            src="/lumia-natal-viewer/cover.webp"
            alt=""
            draggable={false}
            onError={hideBrokenImage}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,17,38,0.22)_0%,rgba(23,17,38,0.48)_44%,rgba(23,17,38,0.94)_100%)]" />
          <div className="relative z-10 flex min-h-[35rem] flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-0 font-lumiaHome text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[#B6FF3B]">
                  Общая натальная карта
                </p>
                <h1 className="mb-0 mt-3 max-w-[20rem] font-lumiaHomeDisplay text-[clamp(2.05rem,9vw,2.95rem)] font-extrabold leading-[0.96] tracking-normal">
                  Разбор по твоим данным
                </h1>
              </div>
              <button
                type="button"
                onClick={onInfo}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur-md"
                aria-label="Информация о расчёте"
              >
                <MoreHorizontal size={21} strokeWidth={2.2} />
              </button>
            </div>

            <div className="mt-auto">
              <p className="mb-0 max-w-[21rem] font-lumiaHome text-[0.98rem] font-semibold leading-snug text-white/88">
                {first?.shortText || 'Коротко и по делу: как ты общаешься, принимаешь решения, строишь отношения и где чаще ошибаешься.'}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {(cards.length ? cards.slice(0, 6) : Array.from({ length: 6 }, () => null)).map((card, index) => (
                  <div key={card ? card.id : index} className="rounded-[1rem] bg-white/12 px-3 py-2.5 backdrop-blur-md">
                    <p className="mb-0 font-lumiaHome text-[0.7rem] font-extrabold text-white/56">{index + 1}/6</p>
                    <p className="mb-0 mt-1 line-clamp-2 font-lumiaHome text-[0.75rem] font-extrabold leading-tight text-white">
                      {card ? card.title : 'Загрузка'}
                    </p>
                  </div>
                ))}
              </div>
              {error ? (
                <p className="mb-0 mt-4 rounded-[1rem] bg-white/14 px-3 py-2 font-lumiaHome text-[0.78rem] font-semibold leading-snug text-white/82">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                disabled={loading || !cards.length}
                onClick={onOpen}
                className="mt-5 flex min-h-[3.35rem] w-full items-center justify-center rounded-full bg-white px-5 font-lumiaHome text-[1rem] font-extrabold text-[#171126] disabled:opacity-60"
              >
                Смотреть карты
              </button>
              <button
                type="button"
                onClick={onFullReport}
                className="mt-3 flex min-h-[2.7rem] w-full items-center justify-center rounded-full bg-white/13 px-5 font-lumiaHome text-[0.86rem] font-extrabold text-white/80"
              >
                Читать подробный разбор ↓
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ViewerCard({
  card,
  saved,
  onPrimary,
  onSave,
  onShare,
  showPrimaryCta = true,
}: {
  card: NatalStoryCard;
  saved: boolean;
  onPrimary: () => void;
  onSave: () => void;
  onShare: () => void;
  showPrimaryCta?: boolean;
}) {
  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.8rem] bg-[#FFF7F2] p-3.5 text-[#171126] shadow-[0_20px_58px_rgba(31,22,54,0.18)]">
      <div className="relative h-[20%] min-h-[6rem] overflow-hidden rounded-[1.35rem] bg-[#171126] sm:min-h-[8rem]">
        <img
          src={assetPath(card.assetKey, CARD_ASSET[card.id])}
          alt=""
          draggable={false}
          onError={hideBrokenImage}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,17,38,0)_40%,rgba(23,17,38,0.42)_100%)]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {card.chips.slice(0, 3).map((chip) => (
          <span key={chip} className="rounded-full bg-white px-3 py-1.5 font-lumiaHome text-[0.68rem] font-extrabold text-[#5E35FF] shadow-[inset_0_0_0_1px_rgba(94,53,255,0.1)]">
            {chip}
          </span>
        ))}
      </div>
      <h2 className="mb-0 mt-2 font-lumiaHomeDisplay text-[clamp(1.42rem,7vw,2.12rem)] font-extrabold leading-[0.98] tracking-normal">
        {card.title}
      </h2>
      <p className="mb-0 mt-1.5 line-clamp-3 font-lumiaHome text-[0.83rem] font-semibold leading-snug text-[#3c304f]">
        {card.shortText}
      </p>
      <BodyRows card={card} />
      <div className="mt-auto pt-2.5">
        {showPrimaryCta ? (
          <button
            type="button"
            onClick={onPrimary}
            className="flex min-h-[2.85rem] w-full items-center justify-center rounded-full bg-[#171126] px-5 font-lumiaHome text-[0.9rem] font-extrabold text-white"
          >
            {card.ctaPrimary.label}
          </button>
        ) : null}
        <div className={cn('grid grid-cols-2 gap-2', showPrimaryCta ? 'mt-2' : '')}>
          <button
            type="button"
            onClick={onSave}
            className="flex min-h-[2.35rem] items-center justify-center gap-2 rounded-full bg-white px-4 font-lumiaHome text-[0.74rem] font-extrabold text-[#332846]"
          >
            {saved ? <Check size={15} strokeWidth={2.4} /> : <Bookmark size={15} strokeWidth={2.2} />}
            {saved ? 'Сохранено' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="flex min-h-[2.35rem] items-center justify-center gap-2 rounded-full bg-white px-4 font-lumiaHome text-[0.74rem] font-extrabold text-[#332846]"
          >
            <Share2 size={15} strokeWidth={2.2} />
            Поделиться
          </button>
        </div>
      </div>
    </article>
  );
}

function DetailsSheet({
  card,
  isPremium,
  isLocked,
  paidSection,
  isLoading,
  error,
  onClose,
  onPremium,
  onLumi,
  onWallet,
  onFullReport,
  lumiBalance,
}: {
  card: NatalStoryCard;
  isPremium: boolean;
  isLocked: boolean;
  paidSection?: InterpretationSection;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onPremium: () => void;
  onLumi: () => void;
  onWallet?: () => void;
  onFullReport: () => void;
  lumiBalance: number;
}) {
  const text = isLocked ? card.freeText : structuredPremiumText(card, paidSection);
  const hasEnoughLumi = lumiBalance >= HUMAN_PAID_LUMI_COST;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#171126]/44 px-3 pb-[max(0.75rem,var(--tg-content-safe-area-inset-bottom,0px))]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <section
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-[0_24px_84px_rgba(0,0,0,0.28)]"
        style={{ maxHeight: 'min(42rem, calc(var(--tg-viewport-stable-height, 100dvh) * 0.78))' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 px-5 pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#d8d2e3]" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f2fb] text-[#171126]"
            aria-label="Закрыть"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
          <p className="mb-0 font-lumiaHome text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-[#5E35FF]">
            Подробный слой
          </p>
          <h3 className="mb-0 mt-2 max-w-[20rem] font-lumiaHomeDisplay text-[1.75rem] font-extrabold leading-[1] tracking-normal text-[#171126]">
            {card.title}
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.3rem+var(--tg-content-safe-area-inset-bottom,0px))] pt-5">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-11/12 rounded-full bg-[#eee9f8]" />
              <div className="h-4 w-10/12 rounded-full bg-[#eee9f8]" />
              <div className="h-4 w-8/12 rounded-full bg-[#eee9f8]" />
            </div>
          ) : (
            <FormattedAiText
              text={text}
              paragraphClassName="font-lumiaHome text-[1rem] leading-[1.65] text-[#2d253b] [text-wrap:pretty]"
              className="max-w-none"
            />
          )}
          {card.freeBullets?.[0] ? (
            <p className="mb-0 mt-4 rounded-[1rem] bg-[#FFF7F2] px-4 py-3 font-lumiaHome text-[0.9rem] font-bold leading-snug text-[#4a365d]">
              {card.freeBullets[0]}
            </p>
          ) : null}
          {isLocked ? (
            <div className="mt-5 rounded-[1.25rem] bg-[#f5f2fb] p-4 shadow-[inset_0_0_0_1px_rgba(94,53,255,0.08)]">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#5E35FF]">
                  <Lock size={17} strokeWidth={2.3} />
                </span>
                <div className="min-w-0">
                  <p className="mb-0 font-lumiaHome text-[1rem] font-extrabold text-[#171126]">Доступно в полной версии</p>
                  <p className="mb-0 mt-1 font-lumiaHome text-[0.84rem] font-semibold leading-snug text-[#5b526a]">{card.tease}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2.5">
                {!isPremium ? (
                  <button
                    type="button"
                    onClick={onPremium}
                    disabled={isLoading}
                    className="flex min-h-[2.9rem] w-full items-center justify-center gap-2 rounded-full bg-[#171126] px-5 font-lumiaHome text-[0.9rem] font-extrabold text-white disabled:opacity-60"
                  >
                    <Crown size={16} strokeWidth={2} />
                    Открыть Premium
                  </button>
                ) : null}
                {hasEnoughLumi ? (
                  <button
                    type="button"
                    onClick={onLumi}
                    disabled={isLoading}
                    className="flex min-h-[2.9rem] w-full items-center justify-center gap-2 rounded-full bg-white px-5 font-lumiaHome text-[0.9rem] font-extrabold text-[#332846] disabled:opacity-60"
                  >
                    <WalletCards size={16} strokeWidth={2} />
                    {isLoading ? 'Открываем...' : `Открыть за ${HUMAN_PAID_LUMI_COST} Lumi`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onWallet}
                    disabled={!onWallet || isLoading}
                    className="flex min-h-[2.9rem] w-full items-center justify-center gap-2 rounded-full bg-white px-5 font-lumiaHome text-[0.9rem] font-extrabold text-[#332846] disabled:opacity-50"
                  >
                    <WalletCards size={16} strokeWidth={2} />
                    Пополнить Lumi
                  </button>
                )}
              </div>
              <p className="mt-3 text-center font-lumiaHome text-[0.78rem] font-semibold text-[#6f6582]">
                На балансе {lumiBalance} Lumi. Разовое открытие сохраняется для этой темы.
              </p>
            </div>
          ) : null}
          {error ? <p className="mb-0 mt-4 font-lumiaHome text-[0.84rem] font-semibold leading-snug text-[#b54747]">{error}</p> : null}
          <button
            type="button"
            onClick={onFullReport}
            className="mt-5 min-h-[2.75rem] w-full rounded-full bg-[#f5f2fb] px-4 font-lumiaHome text-[0.86rem] font-extrabold text-[#5E35FF]"
          >
            К полному разбору ↓
          </button>
        </div>
      </section>
    </div>
  );
}

function InfoSheet({ profile, chartData, onClose }: { profile: UserProfile; chartData: NatalChartData; onClose: () => void }) {
  const hasBirthTime = !!String(profile.birthTime || '').trim();
  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center bg-[#171126]/36 px-3 pb-[max(0.75rem,var(--tg-content-safe-area-inset-bottom,0px))]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <section className="relative w-full max-w-md rounded-t-[2rem] bg-white px-5 pb-5 pt-4 shadow-[0_24px_84px_rgba(0,0,0,0.28)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#d8d2e3]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f2fb] text-[#171126]"
          aria-label="Закрыть"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
        <p className="mb-0 font-lumiaHome text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-[#5E35FF]">О расчёте</p>
        <h3 className="mb-0 mt-2 max-w-[19rem] font-lumiaHomeDisplay text-[1.6rem] font-extrabold leading-[1] tracking-normal text-[#171126]">
          На чём основан разбор
        </h3>
        <div className="mt-5 space-y-2 rounded-[1.25rem] bg-[#f8f6fb] p-4 font-lumiaHome text-[0.9rem] font-semibold leading-snug text-[#3d344d]">
          {profile.birthDate ? <p className="mb-0">Дата: {profile.birthDate}</p> : null}
          {profile.birthTime ? <p className="mb-0">Время: {profile.birthTime}</p> : null}
          {profile.birthPlace ? <p className="mb-0">Место: {profile.birthPlace}</p> : null}
          <p className="mb-0">На основе: {chartData.sun?.sign || '-'} / {chartData.moon?.sign || '-'} / {chartData.rising?.sign || '-'}</p>
        </div>
        {!hasBirthTime ? (
          <p className="mb-0 mt-4 rounded-[1rem] bg-[#fff6df] px-4 py-3 font-lumiaHome text-[0.86rem] font-bold leading-snug text-[#6c4a17]">
            Без времени рождения можно разобрать планеты, но нельзя точно рассчитать дома и Асцендент. Часть вывода будет менее точной.
          </p>
        ) : null}
        <p className="mb-0 mt-5 font-lumiaHome text-[0.9rem] font-semibold leading-relaxed text-[#5d5468]">
          Разбор основан на расчётах по дате, времени и месту рождения. Это ознакомительная интерпретация, не прямое указание и не медицинская, юридическая или финансовая рекомендация.
        </p>
      </section>
    </div>
  );
}

function NatalCardViewer({
  cards,
  initialCardId,
  profile,
  chartData,
  chartId,
  onClose,
  onOpenTodaySection,
  onScrollToFullReport,
  requestPremium,
  onOpenWallet,
  onUpdateProfile,
}: {
  cards: NatalStoryCard[];
  initialCardId?: NatalStoryCardId | null;
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  onClose: () => void;
  onBack?: () => void;
  onOpenTodaySection: (section: 'pulse' | 'checkin') => void;
  onScrollToFullReport: () => void;
  requestPremium: (source?: string, payload?: Record<string, any>) => void | Promise<void>;
  onOpenWallet?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
}) {
  const isPremium = !!profile.isPremium;
  const initialIndex = Math.max(0, initialCardId ? cards.findIndex((card) => card.id === initialCardId) : 0);
  const [activeIndex, setActiveIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [sheetCardId, setSheetCardId] = useState<NatalStoryCardId | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [savedCards, setSavedCards] = useState<NatalStoryCardId[]>(() => getSavedNatalStoryState().savedCardIds);
  const [paidSections, setPaidSections] = useState<PaidSectionState>({});
  const [paidLoading, setPaidLoading] = useState<HumanPaidSectionKey | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const dragX = useMotionValue(0);
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  const impressionsRef = useRef<Set<NatalStoryCardId>>(new Set());
  const activeCard = cards[activeIndex] || cards[0];
  const sheetCard = sheetCardId ? cards.find((card) => card.id === sheetCardId) || null : null;

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      setIsTelegram(!!tg);
      tg?.ready?.();
      tg?.expand?.();
      tg?.requestFullscreen?.();
      tg?.disableVerticalSwipes?.();
      tg?.setupSwipeBehavior?.({ allow_vertical_swipe: false });
    } catch {
      /* optional */
    }
    fireViewerEvent('natal_viewer_open', { card_id: activeCard?.id, index: activeIndex });
    void syncNatalStoryStateFromCloud().then((state) => setSavedCards(state.savedCardIds));
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
    if (!activeCard) return;
    setLastNatalStoryCard(activeCard.id);
    if (!impressionsRef.current.has(activeCard.id)) {
      impressionsRef.current.add(activeCard.id);
      fireViewerEvent('card_impression', { card_id: activeCard.id, index: activeIndex });
    }
    if (activeIndex === cards.length - 1) markNatalStoryCompleted();
  }, [activeCard, activeIndex, cards.length]);

  const closeViewer = useCallback(() => onClose(), [onClose]);

  const moveTo = useCallback((nextIndex: number, reason: 'next_tap' | 'prev_tap' | 'swipe_next') => {
    const clamped = Math.max(0, Math.min(cards.length - 1, nextIndex));
    if (clamped === activeIndex) return;
    const from = cards[activeIndex];
    const to = cards[clamped];
    hapticSelection();
    setActiveIndex(clamped);
    dragX.set(0);
    fireViewerEvent(reason, { from_card: from?.id, to_card: to?.id, index: clamped });
  }, [activeIndex, cards, dragX]);

  const loadPaid = useCallback(async (key: HumanPaidSectionKey, allowLumiSpend: boolean) => {
    if (!profile.id || paidLoading) return null;
    setSectionError(null);
    setPaidLoading(key);
    try {
      const result = await loadHumanPaidSection(String(profile.id), key, chartId, {
        accessTier: allowLumiSpend ? 'lumi' : 'premium',
        allowLumiSpend,
      });
      setPaidSections((current) => ({ ...current, [key]: result.content }));
      if (typeof result.lumiBalance === 'number') {
        onUpdateProfile?.({ ...profile, lumiBalance: result.lumiBalance });
      }
      if (allowLumiSpend) fireViewerEvent('upgrade_success', { section_key: key, method: 'lumi' });
      return result.content;
    } catch (error) {
      setSectionError(formatStoryError(error));
      return null;
    } finally {
      setPaidLoading(null);
    }
  }, [chartId, onUpdateProfile, paidLoading, profile]);

  const openDetails = useCallback((card: NatalStoryCard) => {
    hapticImpact();
    setSheetCardId(card.id);
    setNatalStoryExpandedCard(card.id);
    fireViewerEvent('details_open', { card_id: card.id, index: card.index, locked: !!getPaidKey(card) && !isPremium });
    const paidKey = getPaidKey(card);
    if (paidKey && isPremium && !paidSections[paidKey]) void loadPaid(paidKey, false);
  }, [isPremium, loadPaid, paidSections]);

  const handlePrimary = useCallback((card: NatalStoryCard) => {
    if (card.ctaPrimary.type === 'open_today') {
      hapticImpact();
      fireViewerEvent('today_cta', { card_id: card.id });
      closeViewer();
      onOpenTodaySection('pulse');
      return;
    }
    if (card.ctaPrimary.type === 'open_checkin') {
      hapticImpact();
      fireViewerEvent('checkin_cta', { card_id: card.id });
      closeViewer();
      onOpenTodaySection('checkin');
      return;
    }
    openDetails(card);
  }, [closeViewer, onOpenTodaySection, openDetails]);

  const handleBack = useCallback(() => {
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
      moveTo(activeIndex - 1, 'prev_tap');
      return;
    }
    closeViewer();
  }, [activeIndex, closeViewer, infoOpen, moveTo, sheetCardId]);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const backButton = tg?.BackButton;
    if (!backButton?.show || !backButton?.onClick) return;
    backButton.show();
    backButton.onClick(handleBack);
    return () => {
      backButton.offClick?.(handleBack);
      backButton.hide?.();
    };
  }, [handleBack]);

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

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 70;
    const direction =
      info.offset.x < -threshold || info.velocity.x < -420
        ? 1
        : info.offset.x > threshold || info.velocity.x > 420
          ? -1
          : 0;
    if (direction) moveTo(activeIndex + direction, 'swipe_next');
    animate(dragX, 0, reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28 });
  }, [activeIndex, dragX, moveTo, reduceMotion]);

  const handleSave = useCallback((card: NatalStoryCard) => {
    const next = saveNatalStoryCard(card.id);
    setSavedCards(next.savedCardIds);
    hapticSuccess();
    fireViewerEvent('save_tap', { card_id: card.id });
  }, []);

  const handleShare = useCallback(async (card: NatalStoryCard) => {
    hapticImpact();
    const payload = {
      title: `LUMIA: ${card.title}`,
      text: `${card.title}\n\n${card.shortText}`,
      url: buildShareUrl(card.id),
    };
    try {
      const image = profile.id ? await loadNatalStoryShareImage(String(profile.id), card.id, chartId, 'story').catch(() => null) : null;
      const files = image && typeof File !== 'undefined'
        ? [new File([image], `lumia-${card.id}.png`, { type: 'image/png' })]
        : [];
      if (files.length && navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
        fireViewerEvent('share_tap', { card_id: card.id, format: 'story_png' });
        await navigator.share({ ...payload, files });
      } else if (navigator.share) {
        fireViewerEvent('share_tap', { card_id: card.id, format: 'web_share' });
        await navigator.share(payload);
      } else if (navigator.clipboard) {
        fireViewerEvent('share_tap', { card_id: card.id, format: 'clipboard' });
        await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
        hapticSuccess();
      }
    } catch {
      /* share dismissed */
    }
  }, [chartId, profile.id]);

  if (!activeCard) return null;
  const paidKeyForSheet = sheetCard ? getPaidKey(sheetCard) : null;
  const paidSectionForSheet = paidKeyForSheet ? paidSections[paidKeyForSheet] : undefined;
  const isSheetLocked = !!paidKeyForSheet && !isPremium && !paidSectionForSheet;

  return (
    <div className="fixed inset-0 z-[110] overflow-hidden bg-[#171126] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_4%,rgba(255,76,183,0.24),transparent_34%),radial-gradient(circle_at_88%_14%,rgba(21,199,255,0.18),transparent_28%),linear-gradient(180deg,#171126_0%,#0f0a1c_100%)]" />
      <div
        className="relative z-10 flex h-full min-h-0 flex-col px-4 pb-[calc(0.75rem+var(--tg-content-safe-area-inset-bottom,0px))] pt-[calc(0.65rem+var(--tg-content-safe-area-inset-top,0px))]"
        style={{ height: 'var(--tg-viewport-stable-height, 100dvh)' }}
      >
        <header className={cn('grid min-h-[3.25rem] items-center gap-2', isTelegram ? 'grid-cols-[1fr_3rem]' : 'grid-cols-[3rem_1fr_3rem]')}>
          {!isTelegram ? (
            <button
              type="button"
              onClick={closeViewer}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white"
              aria-label="Закрыть"
            >
              <X size={20} strokeWidth={2.2} />
            </button>
          ) : null}
          <div className="text-center">
            <p className="mb-0 font-lumiaHome text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-white/62">
              Карта {activeIndex + 1}/{cards.length}
            </p>
            <div className="mt-2 grid grid-cols-6 gap-1">
              {cards.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => moveTo(index, index > activeIndex ? 'next_tap' : 'prev_tap')}
                  className={cn('h-1.5 rounded-full', index === activeIndex ? 'bg-[#B6FF3B]' : 'bg-white/22')}
                  aria-label={`Открыть карту ${index + 1}`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white"
            aria-label="Информация"
          >
            <MoreHorizontal size={20} strokeWidth={2.2} />
          </button>
        </header>

        <motion.div
          className="min-h-0 flex-1 touch-pan-y py-2.5"
          drag={reduceMotion ? false : 'x'}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.08}
          dragMomentum={false}
          onPointerDown={(event) => {
            if (reduceMotion || event.clientX <= 24) return;
            dragControls.start(event);
          }}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
        >
          <ViewerCard
            card={activeCard}
            saved={savedCards.includes(activeCard.id)}
            onPrimary={() => handlePrimary(activeCard)}
            onSave={() => handleSave(activeCard)}
            onShare={() => void handleShare(activeCard)}
            showPrimaryCta={!isTelegram}
          />
        </motion.div>

        {!isTelegram ? (
          <footer className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => (activeIndex > 0 ? moveTo(activeIndex - 1, 'prev_tap') : closeViewer())}
              className="min-h-[3rem] rounded-full bg-white/12 font-lumiaHome text-[0.8rem] font-extrabold text-white"
            >
              {activeIndex > 0 ? 'Назад' : 'Закрыть'}
            </button>
            <button
              type="button"
              onClick={() => (activeIndex < cards.length - 1 ? moveTo(activeIndex + 1, 'next_tap') : closeViewer())}
              className="min-h-[3rem] rounded-full bg-[#B6FF3B] font-lumiaHome text-[0.8rem] font-extrabold text-[#171126]"
            >
              {activeIndex < cards.length - 1 ? 'Дальше' : 'Готово'}
            </button>
          </footer>
        ) : null}
      </div>

      {sheetCard ? (
        <DetailsSheet
          card={sheetCard}
          isPremium={isPremium}
          paidSection={paidSectionForSheet}
          isLoading={paidLoading === paidKeyForSheet}
          isLocked={isSheetLocked}
          error={sectionError}
          lumiBalance={profile.lumiBalance ?? 0}
          onClose={() => {
            setSheetCardId(null);
            setNatalStoryExpandedCard(null);
            setSectionError(null);
          }}
          onPremium={() => {
            const key = getPaidKey(sheetCard);
            const card = cards.find((item) => getPaidKey(item) === key);
            fireViewerEvent('trial_start', { card_id: card?.id, source: 'natal_viewer' });
            setSheetCardId(null);
            setNatalStoryExpandedCard(null);
            void requestPremium('natal_viewer_unlock', { card_id: card?.id, section_key: key });
          }}
          onLumi={() => {
            const key = getPaidKey(sheetCard);
            if (!key || paidLoading) return;
            void loadPaid(key, true).then((content) => {
              if (content) {
                // sheetCardId stays set, DetailsSheet re-renders with unlocked content
              }
            });
          }}
          onWallet={() => {
            setSheetCardId(null);
            setNatalStoryExpandedCard(null);
            onOpenWallet?.();
          }}
          onFullReport={() => {
            setSheetCardId(null);
            setNatalStoryExpandedCard(null);
            closeViewer();
            onScrollToFullReport();
          }}
        />
      ) : null}

      {infoOpen ? <InfoSheet profile={profile} chartData={chartData} onClose={() => setInfoOpen(false)} /> : null}
    </div>
  );
}

export const NatalMapPresentation = memo<NatalMapPresentationProps>(
  ({
    profile,
    chartData,
    chartId,
    requestPremium,
    onOpenWallet,
    onUpdateProfile,
    onOpenTodaySection,
    onScrollToFullReport,
    onBack,
    onViewerOpenChange,
    initialCardId,
  }) => {
    const userId = profile.id ? String(profile.id) : '';
    const [profileCards, setProfileCards] = useState<ProfileCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerInitialCardId, setViewerInitialCardId] = useState<NatalStoryCardId | null>(initialCardId || null);
    const [infoOpen, setInfoOpen] = useState(false);
    const openedFromInitialRef = useRef(false);

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

    const cards = useMemo(() => adaptProfileCardsToStoryCards(profileCards), [profileCards]);

    useEffect(() => {
      if (!initialCardId || openedFromInitialRef.current || !cards.length) return;
      openedFromInitialRef.current = true;
      setViewerInitialCardId(initialCardId);
      setViewerOpen(true);
      onViewerOpenChange?.(true);
      fireViewerEvent('deeplink_open', { card_id: initialCardId });
    }, [cards.length, initialCardId, onViewerOpenChange]);

    const openViewer = useCallback((cardId?: NatalStoryCardId | null) => {
      setViewerInitialCardId(cardId || null);
      setViewerOpen(true);
      onViewerOpenChange?.(true);
      hapticImpact('medium');
    }, [onViewerOpenChange]);

    const closeViewer = useCallback(() => {
      setViewerOpen(false);
      onViewerOpenChange?.(false);
    }, [onViewerOpenChange]);

    return (
      <>
        <CoverCard
          cards={cards}
          loading={loading}
          error={error}
          onOpen={() => openViewer(null)}
          onInfo={() => setInfoOpen(true)}
          onFullReport={onScrollToFullReport}
        />
        {viewerOpen && cards.length ? (
          <NatalCardViewer
            cards={cards}
            initialCardId={viewerInitialCardId}
            profile={profile}
            chartData={chartData}
            chartId={chartId}
            onClose={closeViewer}
            onBack={onBack}
            onOpenTodaySection={onOpenTodaySection}
            onScrollToFullReport={onScrollToFullReport}
            requestPremium={requestPremium}
            onOpenWallet={onOpenWallet}
            onUpdateProfile={onUpdateProfile}
          />
        ) : null}
        {infoOpen ? <InfoSheet profile={profile} chartData={chartData} onClose={() => setInfoOpen(false)} /> : null}
      </>
    );
  }
);

NatalMapPresentation.displayName = 'NatalMapPresentation';
