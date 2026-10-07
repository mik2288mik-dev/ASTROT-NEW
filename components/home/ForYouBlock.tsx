import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AssetSlot } from '../lumia-ui/AssetSlot';
import { buildForYouOffers, daysBetweenKeys, type ForYouAction, type ForYouOffer, type ForYouRuleId } from '../../lib/forYou';
import { readInterestSignals } from '../../lib/interestSignals';
import { findUpcomingSky, type UpcomingSky } from '../../lib/upcomingSky';
import { loadFeatureState, peekFeatureState, saveFeatureState } from '../../services/featureStateService';
import { loadExploreCharts, peekExploreCharts } from '../PersonalForecastFeed/exploreCharts';
import { WishesSheet, type WishItem, type WishRecord } from './WishesSheet';
import { MonthReviewSheet, type MonthReviewRecord } from './MonthReviewSheet';
import { findSelfTest } from '../../lib/selfTests/engine';
import { isMoodWeekFinished, type MoodWeek } from '../../lib/moodWeek';

export const FOR_YOU_IMAGES: Record<ForYouRuleId, string> = {
  premium_ending: '/assets/for-you/premium.webp',
  birthday: '/assets/for-you/birthday.webp',
  person_birthday: '/assets/for-you/gift.webp',
  new_moon: '/assets/for-you/new-moon.webp',
  mercury: '/assets/for-you/mercury.webp',
  month_review: '/assets/for-you/month-review.webp',
  pair: '/assets/for-you/pair.webp',
  compatibility: '/assets/for-you/compatibility.webp',
  love_week: '/assets/for-you/love-week.webp',
  birth_time: '/assets/for-you/birth-time.webp',
  test_unfinished: '/assets/for-you/test.webp',
  mood_report: '/assets/for-you/mood-report.webp',
  streak_gift: '/assets/for-you/gift.webp',
  anniversary_gift: '/assets/for-you/gift.webp',
  streak_progress: '/assets/for-you/streak.webp',
};

const MONTHS_GEN_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let skyEngine: Promise<typeof import('astronomy-engine')> | null = null;

type ForYouBlockProps = {
  userId: string;
  language: 'ru' | 'en';
  todayKey: string;
  weekKey: string;
  timezone: string;
  birthDate: string;
  birthTimeKnown: boolean;
  premium: boolean;
  premiumEndsAt: string | null;
  premiumAutoRenew: boolean | null;
  gift?: { streak: number; daysToGift: number; claimable: 'streak' | 'anniversary' | null; hasWeekGift: boolean } | null;
  /** Actions that leave the block: navigation, store, week reading. */
  onAction: (action: Exclude<ForYouAction, { type: 'wishes' } | { type: 'month_review' }>) => void;
  /** Extra cards that close the row, such as today's invitation into a section. */
  extra?: React.ReactNode;
};

function asWishRecord(value: unknown): WishRecord | null {
  const record = value as WishRecord | null;
  return record && Array.isArray(record.items) ? record : null;
}

/** «Для тебя»: one to three personal suggestions with «Скрыть». */
export function ForYouBlock({
  userId,
  language,
  todayKey,
  weekKey,
  timezone,
  birthDate,
  birthTimeKnown,
  premium,
  premiumEndsAt,
  premiumAutoRenew,
  gift,
  onAction,
  extra,
}: ForYouBlockProps) {
  const ru = language === 'ru';
  const [dismissed, setDismissed] = useState<Record<string, string>>(
    () => (peekFeatureState(userId, 'for_you').dismissed as Record<string, string>) || {},
  );
  const [wishes, setWishes] = useState<Record<string, unknown>>(() => peekFeatureState(userId, 'wishes'));
  const [reviews, setReviews] = useState<Record<string, unknown>>(() => peekFeatureState(userId, 'month_review'));
  const [tests, setTests] = useState<Record<string, unknown>>(() => peekFeatureState(userId, 'tests'));
  const [moodWeeks, setMoodWeeks] = useState<Record<string, unknown>>(() => peekFeatureState(userId, 'mood_week'));
  const [people, setPeople] = useState<Array<{ id: string; name: string; birthDate: string | null }>>([]);
  const [sky, setSky] = useState<UpcomingSky>({ newMoonKey: null, mercuryRetroKey: null });
  const [sheet, setSheet] = useState<{ type: 'wishes'; newMoonKey: string } | { type: 'month_review'; monthKey: string } | null>(null);

  useEffect(() => {
    let active = true;
    void loadFeatureState(userId, 'for_you').then((items) => {
      if (active) setDismissed((items.dismissed as Record<string, string>) || {});
    });
    void loadFeatureState(userId, 'wishes').then((items) => { if (active) setWishes(items); });
    void loadFeatureState(userId, 'month_review').then((items) => { if (active) setReviews(items); });
    void loadFeatureState(userId, 'tests').then((items) => { if (active) setTests(items); });
    void loadFeatureState(userId, 'mood_week').then((items) => { if (active) setMoodWeeks(items); });
    const toPeople = (charts: ReturnType<typeof peekExploreCharts>) => (charts ?? [])
      .filter((chart) => !chart.is_primary && !chart.archived_at && chart.name)
      .map((chart) => ({ id: String(chart.id), name: chart.name.trim().split(/\s+/u)[0], birthDate: chart.birth_date ?? null }));
    setPeople(toPeople(peekExploreCharts(userId)));
    void loadExploreCharts(userId).then((charts) => { if (active) setPeople(toPeople(charts)); });
    skyEngine ??= import('astronomy-engine');
    void skyEngine
      .then((engine) => { if (active) setSky(findUpcomingSky(engine, new Date(), timezone)); })
      .catch(() => { skyEngine = null; });
    return () => { active = false; };
  }, [timezone, todayKey, userId]);

  const unfinishedTest = useMemo(() => {
    const entries = Object.entries(tests)
      .filter(([key]) => key.startsWith('progress:'))
      .map(([key, value]) => ({ test: findSelfTest(key.slice('progress:'.length)), progress: value as { answers?: unknown[]; updatedAt?: string } | null }))
      .filter((entry) => entry.test && Array.isArray(entry.progress?.answers) && entry.progress!.answers!.length > 0)
      .sort((a, b) => String(b.progress?.updatedAt).localeCompare(String(a.progress?.updatedAt)));
    const latest = entries[0];
    return latest?.test ? {
      id: latest.test.id,
      title: latest.test.title[language],
      answered: latest.progress!.answers!.length,
      total: latest.test.questions.length,
      updatedAt: String(latest.progress?.updatedAt || new Date().toISOString()),
    } : null;
  }, [language, tests]);

  const moodReportReady = useMemo(() => {
    const latest = Object.values(moodWeeks)
      .map((value) => value as MoodWeek | null)
      .filter((week): week is MoodWeek => Boolean(week && typeof week.startDayKey === 'string'))
      .sort((a, b) => b.startDayKey.localeCompare(a.startDayKey))[0];
    return latest && isMoodWeekFinished(latest, todayKey) && !latest.reportSeenAt ? latest.startDayKey : null;
  }, [moodWeeks, todayKey]);

  const offers = useMemo(() => buildForYouOffers({
    language,
    todayKey,
    weekKey,
    birthDate,
    birthTimeKnown,
    premium,
    premiumEndsAt,
    premiumAutoRenew,
    signals: readInterestSignals(userId),
    savedPeople: people,
    newMoonKey: sky.newMoonKey,
    mercuryRetroKey: sky.mercuryRetroKey,
    wishKeys: new Set(Object.keys(wishes)),
    reviewedMonths: new Set(Object.keys(reviews)),
    dismissed: new Set(Object.keys(dismissed)),
    unfinishedTest,
    moodReportReady,
    gift,
  }), [gift, birthDate, birthTimeKnown, dismissed, language, moodReportReady, people, premium, premiumAutoRenew, premiumEndsAt, reviews, sky, todayKey, unfinishedTest, userId, weekKey, wishes]);

  const hide = useCallback((offer: ForYouOffer) => {
    const next = Object.fromEntries(
      [...Object.entries(dismissed), [offer.occurrence, new Date().toISOString()] as const]
        .sort((a, b) => b[1].localeCompare(a[1]))
        .slice(0, 100),
    );
    setDismissed(next);
    void saveFeatureState(userId, 'for_you', 'dismissed', next);
  }, [dismissed, userId]);

  const run = (offer: ForYouOffer) => {
    const { action } = offer;
    if (action.type === 'wishes' || action.type === 'month_review') {
      setSheet(action);
      return;
    }
    onAction(action);
  };

  /** Plans of the month under review: new moons from ten days before its start to its end. */
  const monthWishGroups = useMemo(() => {
    if (sheet?.type !== 'month_review') return [];
    const monthStart = `${sheet.monthKey}-01`;
    return Object.entries(wishes)
      .map(([key, value]) => ({ key, record: asWishRecord(value) }))
      .filter(({ key, record }) => record && key.slice(0, 7) <= sheet.monthKey && daysBetweenKeys(key, monthStart) <= 10)
      .map(({ key, record }) => ({ key, items: record!.items }));
  }, [sheet, wishes]);

  if (!offers.length && !sheet && !extra) return null;

  const wishSheetKey = sheet?.type === 'wishes' ? sheet.newMoonKey : null;
  const reviewMonth = sheet?.type === 'month_review' ? Number(sheet.monthKey.slice(5, 7)) - 1 : 0;

  return (
    <section className="for-you" aria-labelledby="for-you-title">
      {offers.length || extra ? <h2 id="for-you-title" className="for-you-title">{ru ? 'Для тебя' : 'For you'}</h2> : null}
      <div className="for-you-list">
        {offers.map((offer) => (
          <article key={offer.occurrence} className={`for-you-card is-${offer.id}`}>
            <AssetSlot src={FOR_YOU_IMAGES[offer.id]} fit="contain" className="for-you-card-art" />
            <div className="for-you-card-copy">
              <h3>{offer.title}</h3>
              <p>{offer.body}</p>
              <div className="for-you-card-actions">
                <button type="button" className="for-you-card-cta" onClick={() => run(offer)}>
                  {offer.cta}
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <button type="button" className="for-you-card-hide" onClick={() => hide(offer)}>
                  {ru ? 'Скрыть' : 'Hide'}
                </button>
              </div>
            </div>
          </article>
        ))}
        {extra}
      </div>

      <WishesSheet
        open={sheet?.type === 'wishes'}
        language={language}
        dateLabel={wishSheetKey
          ? (ru ? `${Number(wishSheetKey.slice(8, 10))} ${MONTHS_GEN_RU[Number(wishSheetKey.slice(5, 7)) - 1]}` : `${MONTHS_EN[Number(wishSheetKey.slice(5, 7)) - 1]} ${Number(wishSheetKey.slice(8, 10))}`)
          : ''}
        initial={wishSheetKey ? asWishRecord(wishes[wishSheetKey])?.items ?? [] : []}
        onSave={(items: WishItem[]) => {
          if (!wishSheetKey) return;
          const record: WishRecord = { items, savedAt: new Date().toISOString() };
          setWishes((current) => ({ ...current, [wishSheetKey]: record }));
          void saveFeatureState(userId, 'wishes', wishSheetKey, record);
        }}
        onClose={() => setSheet(null)}
      />
      <MonthReviewSheet
        open={sheet?.type === 'month_review'}
        language={language}
        monthLabel={ru ? MONTHS_RU[reviewMonth] : MONTHS_EN[reviewMonth]}
        wishGroups={monthWishGroups}
        onSave={(groups, note) => {
          if (sheet?.type !== 'month_review') return;
          const monthKey = sheet.monthKey;
          for (const group of groups) {
            const previous = asWishRecord(wishes[group.key]);
            if (!previous) continue;
            const record: WishRecord = { ...previous, items: group.items };
            setWishes((current) => ({ ...current, [group.key]: record }));
            void saveFeatureState(userId, 'wishes', group.key, record);
          }
          const all = groups.flatMap((group) => group.items);
          const review: MonthReviewRecord = {
            note,
            came: all.filter((item) => item.done).length,
            planned: all.length,
            savedAt: new Date().toISOString(),
          };
          setReviews((current) => ({ ...current, [monthKey]: review }));
          void saveFeatureState(userId, 'month_review', monthKey, review);
        }}
        onClose={() => setSheet(null)}
      />
    </section>
  );
}
