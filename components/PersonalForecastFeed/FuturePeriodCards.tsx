import React from 'react';
import { ChevronRight, LoaderCircle, LockKeyhole, RefreshCw } from 'lucide-react';
import { AssetSlot } from '../lumia-ui/AssetSlot';

export type FuturePeriodCardData = {
  /** Readable state of the NEBO+ reading; free cards are always `locked`. */
  phase: 'locked' | 'loading' | 'ready' | 'error';
  /** First sentences of the ready reading (NEBO+). */
  opening: string;
  /** Opening lines from the person's own calendar (free, and while NEBO+ waits). */
  teaser: readonly string[];
};

type FuturePeriodCardsProps = {
  language: 'ru' | 'en';
  /** «6 — 12 октября». */
  weekLabel: string;
  /** Month name in the nominative, lowercase: «октябрь». */
  monthName: string;
  year: number;
  week: FuturePeriodCardData;
  month: FuturePeriodCardData;
  canPromotePremium: boolean;
  onRead: (period: 'week' | 'month') => void;
  onRetry: (period: 'week' | 'month') => void;
};

export const FUTURE_CARD_IMAGES = {
  week: '/assets/future/week-card.webp',
  month: '/assets/future/month-card.webp',
} as const;

function PeriodCard({
  period,
  kicker,
  title,
  data,
  language,
  canPromotePremium,
  onRead,
  onRetry,
}: {
  period: 'week' | 'month';
  kicker: string;
  title: string;
  data: FuturePeriodCardData;
  language: 'ru' | 'en';
  canPromotePremium: boolean;
  onRead: () => void;
  onRetry: () => void;
}) {
  const ru = language === 'ru';
  const locked = data.phase === 'locked';
  const lines = data.phase === 'ready' && data.opening ? [data.opening] : data.teaser;
  const canRead = data.phase === 'ready' || (locked && canPromotePremium);

  return (
    <article className={`future-period-card is-${period}${locked ? ' is-locked' : ''}`} aria-labelledby={`future-period-${period}-title`}>
      <AssetSlot src={FUTURE_CARD_IMAGES[period]} className="future-period-card-art" />
      <p className="future-period-card-kicker">{kicker}</p>
      <h3 id={`future-period-${period}-title`} className="future-period-card-title">{title}</h3>
      {lines.length ? (
        <div className="future-period-card-lines">
          {lines.map((line) => <p key={line}>{line}</p>)}
        </div>
      ) : null}
      {locked ? (
        <p className="future-period-card-lock">
          <LockKeyhole size={14} aria-hidden="true" />
          {ru
            ? (period === 'week' ? 'Полный разбор недели — в NEBO+' : 'Полный разбор месяца — в NEBO+')
            : (period === 'week' ? 'The full week reading is in NEBO+' : 'The full month reading is in NEBO+')}
        </p>
      ) : null}
      {data.phase === 'loading' ? (
        <p className="future-period-card-status" role="status">
          <LoaderCircle className="forecast-feed-loading-spinner" size={16} strokeWidth={1.8} aria-hidden="true" />
          {ru ? 'Готовим разбор — обычно до минуты' : 'Preparing the reading — usually under a minute'}
        </p>
      ) : null}
      {data.phase === 'error' ? (
        <button type="button" className="future-period-card-retry" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden="true" />
          {ru ? 'Не загрузилось. Попробовать ещё раз' : 'Did not load. Try again'}
        </button>
      ) : null}
      {canRead ? (
        <button type="button" className="future-period-card-read" onClick={onRead}>
          {ru ? 'Читать' : 'Read'}
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}

/**
 * The two NEBO+ readings open «Будущее»: the week and the current month. Free
 * cards show real opening lines from the person's calendar and a lock — never
 * a blurred text.
 */
export function FuturePeriodCards({
  language,
  weekLabel,
  monthName,
  year,
  week,
  month,
  canPromotePremium,
  onRead,
  onRetry,
}: FuturePeriodCardsProps) {
  const ru = language === 'ru';
  return (
    <section className="future-period-cards" aria-label={ru ? 'Разборы недели и месяца' : 'Week and month readings'}>
      <PeriodCard
        period="week"
        kicker={weekLabel}
        title={ru ? 'Твоя неделя' : 'Your week'}
        data={week}
        language={language}
        canPromotePremium={canPromotePremium}
        onRead={() => onRead('week')}
        onRetry={() => onRetry('week')}
      />
      <PeriodCard
        period="month"
        kicker={`${monthName} ${year}`}
        title={ru ? `Твой ${monthName}` : `Your ${monthName}`}
        data={month}
        language={language}
        canPromotePremium={canPromotePremium}
        onRead={() => onRead('month')}
        onRetry={() => onRetry('month')}
      />
    </section>
  );
}
