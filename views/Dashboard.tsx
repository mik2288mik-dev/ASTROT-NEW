import React, { memo, useCallback, useMemo, useState } from 'react';
import type {
  HoroscopeLayer,
  HoroscopeOpenOptions,
  NatalChartData,
  DailyPackageStatus,
  PersonalDailySection,
  UserProfile,
} from '../types';
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import { getMoscowTodayKey } from '../lib/date-utils';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { DaySheet } from '../components/lumia-ui/DaySheet';
import { HomeFaq } from '../components/Dashboard/HomeFaq';
import { DailyQuestionStoryModal } from '../components/Dashboard/DailyQuestionStoryModal';
import { MATRIX_TITLE } from '../lib/matrixArcana';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { StickerScreen, StickerSlot } from '../components/stickers/StickerScreen';
import type { SurfaceRequest } from '../lib/stickers/select';
import { getDashboardSystemText, type DashboardSystemState } from '../lib/dailyPresentationPatterns';
import type { DailyCanvas } from '../lib/natalHumanShared';
import { useDailyQuestionStories } from '../lib/dailyQuestions';
import {
  cardBackgroundStyle,
  getHeroCardBackground,
  getPersonalCardBackground,
  getUniversalCardBackground,
  type CardBackgroundAsset,
} from '../lib/cardBackgrounds';

const LOADING_STICKER_REQUESTS: SurfaceRequest[] = [
  { surface: 'hero', kind: 'maskot', moods: ['thinking', 'calm'], themes: ['study', 'read', 'tech'] },
];

type SphereCard = {
  section: PersonalDailySection;
  title: string;
  hook: string;
  background: CardBackgroundAsset | null;
};

type DashboardProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  dailyPackage: DailyCanvas | null;
  dailyPackageStatus: DailyPackageStatus;
  onRetryDailyPackage: () => void;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer, options?: HoroscopeOpenOptions) => void;
  onOpenPersonalDaily: (section?: PersonalDailySection) => void;
  onCreateNatalChart?: () => void;
  onOpenSynastry?: () => void;
  onOpenMatrix?: () => void;
  onRequestPremium?: (source?: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  initialTodaySection?: string | null;
};

export const Dashboard = memo<DashboardProps>(({ 
  profile,
  chartData,
  chartId,
  dailyPackage,
  dailyPackageStatus,
  onRetryDailyPackage,
  onOpenPersonalDaily,
  onCreateNatalChart,
  onOpenSynastry,
  onOpenMatrix,
  onRequestPremium,
  scrollRef,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const backgroundUserId = String(profile.id || 'guest');
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);
  const ownSunSign = String(chartData?.sun?.sign || sunSignFromDate(profile.birthDate) || '').trim().toLowerCase();
  const selectedSign = ownSunSign || String(profile.selectedZodiacSign || '').trim().toLowerCase();

  const heroBackground = useMemo(
    () => getHeroCardBackground(backgroundUserId, today),
    [backgroundUserId, today],
  );
  const natalBackground = useMemo(
    () => getUniversalCardBackground('natal', backgroundUserId, today),
    [backgroundUserId, today],
  );
  const compatibilityBackground = useMemo(
    () => getUniversalCardBackground('compatibility', backgroundUserId, today),
    [backgroundUserId, today],
  );
  const matrixBackground = useMemo(
    () => getUniversalCardBackground('matrix', backgroundUserId, today),
    [backgroundUserId, today],
  );

  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);

  const systemState: DashboardSystemState = dailyPackage
    ? 'ready'
    : !hasChart
      ? 'no_chart'
      : dailyPackageStatus === 'error'
        ? 'generation_error'
        : 'loading';
  const systemCopy = getDashboardSystemText(systemState, language, today);
  const isDailyReady = !!dailyPackage;
  const isDailyLoading = hasChart && !isDailyReady && dailyPackageStatus === 'loading';
  const isDailyError = hasChart && !isDailyReady && !isDailyLoading;
  const stickerRequests = isDailyLoading ? LOADING_STICKER_REQUESTS : [];

  const displayName = profile.name?.trim() || (language === 'ru' ? 'друг' : 'friend');
  const periodTabs = language === 'ru'
    ? ['Сегодня', 'Эта неделя', 'Этот месяц', 'Этот год']
    : ['Today', 'This week', 'This month', 'This year'];

  const weekdayLabel = useMemo(() => {
    const [yr, mo, da] = today.split('-').map(Number);
    const d = new Date(Date.UTC(yr, mo - 1, da, 12));
    const w = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      timeZone: 'UTC', weekday: 'long',
    }).format(d);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }, [today, language]);

  const dayHeroDateLabel = useMemo(() => {
    const [yr, mo, da] = today.split('-').map(Number);
    const d = new Date(Date.UTC(yr, mo - 1, da, 12));
    const date = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
    }).format(d);
    const dayName = language === 'ru' ? weekdayLabel.toLowerCase() : weekdayLabel;
    return `${date} · ${dayName}`;
  }, [language, today, weekdayLabel]);

  const dayHeroTitle = dailyPackage?.hero_title?.trim()
    || (isDailyLoading
      ? (language === 'ru' ? 'Считаем твой личный гороскоп' : 'Calculating your personal horoscope')
      : isDailyError
        ? (language === 'ru' ? 'Личный гороскоп пока не готов' : 'Your personal horoscope is not ready yet')
        : (language === 'ru' ? 'Личный гороскоп' : 'Personal Horoscope'));
  const dayHeroText = dailyPackage?.hero_hook?.trim() || systemCopy;
  const dayHeroAria = isDailyLoading
    ? (language === 'ru' ? 'Личный гороскоп рассчитывается' : 'Personal horoscope is being calculated')
    : isDailyError
      ? (language === 'ru' ? 'Повторить расчёт личного гороскопа' : 'Retry personal horoscope calculation')
      : language === 'ru' ? 'Личный гороскоп на сегодня' : 'Personal horoscope for today';
  const dayHeroCta: string | null = isDailyLoading
    ? (language === 'ru' ? 'Идёт расчёт' : 'Calculating')
    : isDailyError
      ? (language === 'ru' ? 'Попробовать ещё раз' : 'Try again')
      : !hasChart
        ? (language === 'ru' ? 'Нужны данные рождения' : 'Birth data needed')
        : null;
  const dayHeroPersonalLine = hasChart
    ? (language === 'ru'
      ? 'Здесь твой личный гороскоп — по дате рождения и положению планет сегодня.'
      : 'Your personal horoscope, based on your birth data and today’s planetary positions.')
    : null;

  const sphereCards: SphereCard[] = useMemo(() => {
    const labels: Array<[Exclude<PersonalDailySection, 'overview'>, string]> = language === 'ru'
      ? [
          ['love', 'Любовь'],
          ['money', 'Деньги'],
          ['work', 'Работа'],
          ['goals', 'Цели'],
          ['family', 'Дом и семья'],
          ['friendship', 'Друзья'],
          ['energy', 'Силы'],
          ['communication', 'Разговоры'],
        ]
      : [
          ['love', 'Love'],
          ['money', 'Money'],
          ['work', 'Work'],
          ['goals', 'Goals'],
          ['family', 'Home & Family'],
          ['friendship', 'Friends'],
          ['energy', 'Energy'],
          ['communication', 'Conversations'],
        ];

    return labels.map(([section, title]) => ({
      section,
      title,
      hook: dailyPackage?.[section]?.hook?.trim()
        || getDashboardSystemText(systemState, language, `${today}-${section}`),
      background: getPersonalCardBackground(section, backgroundUserId, today),
    }));
  }, [backgroundUserId, dailyPackage, language, systemState, today]);

  const dailyQuestionStories = useDailyQuestionStories(
    dailyPackage,
    backgroundUserId,
    today,
    language,
    premium,
  );
  const activeQuestion = activeQuestionIndex == null ? null : dailyQuestionStories[activeQuestionIndex] || null;

  const openDayHero = () => {
    if (isDailyLoading) return;
    lumiaSelectionHaptic();
    if (!hasChart) { onCreateNatalChart?.(); return; }
    if (isDailyError) { onRetryDailyPackage(); return; }
    if (isDailyReady) { onOpenPersonalDaily('overview'); }
  };

  const openSphere = (section: PersonalDailySection) => {
    lumiaSelectionHaptic();
    if (!hasChart) { onCreateNatalChart?.(); return; }
    if (isDailyReady) { onOpenPersonalDaily(section); }
  };

  const openDailyQuestion = (index: number) => {
    lumiaSelectionHaptic();
    if (!premium) {
      onRequestPremium?.('daily_questions');
      return;
    }
    setActiveQuestionIndex(index);
  };

  const closeDailyQuestion = useCallback(() => {
    setActiveQuestionIndex(null);
  }, []);

  const moveQuestion = useCallback((direction: number) => {
    if (!dailyQuestionStories.length) return;
    setActiveQuestionIndex((current) => {
      const index = current ?? 0;
      return (index + direction + dailyQuestionStories.length) % dailyQuestionStories.length;
    });
  }, [dailyQuestionStories.length]);

  return (
    <StickerScreen requests={stickerRequests} maxMaskots={isDailyLoading ? 1 : 0}>
      <div
        className="fresh-page home-screen lumia-main-scroll lumia-bottom-tab-scroll"
        ref={scrollRef as React.RefObject<HTMLDivElement>}
      >
        <section className="home-top" aria-label={language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}>
          <div className="home-logo-bar">
            <span className="home-logo-wordmark">{language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}</span>
          </div>
          <div className="home-top-content">
            <p className="home-top-greeting">
              {language === 'ru' ? `Привет, ${displayName}` : `Hi, ${displayName}`}
            </p>
            <div className="home-period-tabs" role="tablist" aria-label={language === 'ru' ? 'Период' : 'Period'}>
              {periodTabs.map((label, index) => {
                const active = index === 0;
                return (
                  <button
                    key={label}
                    type="button"
                    className={`home-period-tab${active ? ' is-active' : ''}`}
                    role="tab"
                    aria-selected={active}
                    aria-disabled={!active}
                    onClick={active ? () => { lumiaSelectionHaptic(); } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <button
          type="button"
          className={`home-day-hero home-day-hero--${systemState}${isDailyLoading ? ' has-stickers' : ''}${heroBackground ? ' has-card-background' : ''}`}
          style={cardBackgroundStyle(heroBackground)}
          onClick={openDayHero}
          aria-label={dayHeroAria}
          aria-busy={isDailyLoading}
          disabled={isDailyLoading}
        >
          <span className="home-day-hero-glow" aria-hidden />
          {isDailyLoading ? (
            <span className="home-day-hero-scene" aria-hidden>
              <StickerSlot surface="hero" />
            </span>
          ) : null}
          <span className="home-day-hero-copy">
            <span className="home-day-hero-date">{dayHeroDateLabel}</span>
            {dayHeroPersonalLine ? <span className="home-day-hero-basis">{dayHeroPersonalLine}</span> : null}
            <span className="home-day-hero-title">{dayHeroTitle}</span>
            <span className="home-day-hero-text">{dayHeroText}</span>
            {dayHeroCta ? (
              <span className="home-day-hero-cta">
                {dayHeroCta}
                {isDailyLoading ? <span className="home-day-loading-dots" aria-hidden><i /><i /><i /></span> : null}
              </span>
            ) : null}
          </span>
        </button>

        <section className="home-spheres" aria-label={language === 'ru' ? 'Темы личного гороскопа' : 'Personal horoscope topics'}>
          <div className="home-spheres-track">
            {sphereCards.map((card) => (
              <button
                key={card.section}
                type="button"
                className={`home-sphere-card home-sphere-card--${card.section}${card.background ? ' has-card-background' : ''}`}
                style={cardBackgroundStyle(card.background)}
                onClick={() => openSphere(card.section)}
                disabled={!isDailyReady && hasChart}
                aria-disabled={!isDailyReady && hasChart}
              >
                <span className="home-sphere-title">{card.title}</span>
                <span className="home-sphere-hook">{card.hook}</span>
              </button>
            ))}
          </div>
        </section>

        {dailyQuestionStories.length ? (
          <section className="home-daily-questions" aria-label={language === 'ru' ? 'Спроси про сегодня' : 'Ask about today'}>
            <h2 className="home-section-heading">{language === 'ru' ? 'Спроси про сегодня' : 'Ask about today'}</h2>
            <div className="home-daily-question-list">
              {dailyQuestionStories.map((story, index) => (
                <button
                  key={story.id}
                  type="button"
                  className={`home-daily-question-card${story.background ? ' has-card-background' : ''}${premium ? '' : ' is-locked'}`}
                  style={cardBackgroundStyle(story.background)}
                  onClick={() => openDailyQuestion(index)}
                >
                  <span className="home-daily-question-copy">
                    <span className="home-daily-question-title">{story.question}</span>
                    <span className="home-daily-question-hook">{story.teaser}</span>
                  </span>
                  {!premium ? (
                    <span className="home-daily-question-lock" aria-label={language === 'ru' ? 'Доступно в Premium' : 'Available in Premium'}>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                        <rect x="3.5" y="8" width="11" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M6 8V6.25a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="home-product-grid" aria-label={language === 'ru' ? 'Другие разделы' : 'Other sections'}>
          <button
            type="button"
            className={`home-product-card home-product-card--natal home-product-card--wide${natalBackground ? ' has-card-background' : ''}`}
            style={cardBackgroundStyle(natalBackground)}
            onClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
          >
            <span className="home-product-card-copy">
              <span className="home-product-card-kicker">{language === 'ru' ? 'Натальная карта' : 'Natal chart'}</span>
              <span className="home-product-card-title">{language === 'ru' ? 'Вот почему ты именно такой' : 'This is why you are the way you are'}</span>
              <span className="home-product-card-text">
                {language === 'ru'
                  ? 'Характер, сильные стороны и знакомые сценарии — по твоей карте рождения.'
                  : 'Character, strengths, and familiar patterns from your birth chart.'}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={`home-product-card home-product-card--compat home-product-card--wide${compatibilityBackground ? ' has-card-background' : ''}`}
            style={cardBackgroundStyle(compatibilityBackground)}
            onClick={() => { lumiaSelectionHaptic(); onOpenSynastry?.(); }}
          >
            <span className="home-product-card-copy">
              <span className="home-product-card-kicker">{language === 'ru' ? 'Совместимость' : 'Compatibility'}</span>
              <span className="home-product-card-title">{language === 'ru' ? 'Что между вами на самом деле' : 'What is really between you'}</span>
              <span className="home-product-card-text">
                {language === 'ru'
                  ? 'Где вас тянет друг к другу, а где вы начинаете говорить на разных языках.'
                  : 'Where you are drawn together and where you start speaking different languages.'}
              </span>
            </span>
          </button>

          {onOpenMatrix ? (
            <button
              type="button"
              className={`home-product-card home-product-card--matrix home-product-card--wide${matrixBackground ? ' has-card-background' : ''}`}
              style={cardBackgroundStyle(matrixBackground)}
              onClick={() => { lumiaSelectionHaptic(); onOpenMatrix(); }}
            >
              <span className="home-product-card-copy">
                <span className="home-product-card-kicker">{language === 'ru' ? MATRIX_TITLE.ru : MATRIX_TITLE.en}</span>
                <span className="home-product-card-title">{language === 'ru' ? 'Твоя дата — не просто цифры' : 'Your date is more than numbers'}</span>
                <span className="home-product-card-text">
                  {language === 'ru'
                    ? 'Что даётся тебе легко, а где ты снова попадаешь в знакомый сюжет.'
                    : 'What comes naturally and where you keep returning to a familiar pattern.'}
                </span>
              </span>
            </button>
          ) : null}
        </section>

        <HomeFaq language={language} />

        <DaySheet
          dateKey={sheetDate}
          todayKey={today}
          sign={selectedSign}
          language={language}
          isPremium={premium}
          onClose={() => setSheetDate(null)}
          onRequestPremium={() => onRequestPremium?.('calendar')}
        />
      </div>

      <DailyQuestionStoryModal
        activeStory={activeQuestion}
        stories={dailyQuestionStories}
        activeIndex={activeQuestionIndex}
        language={language}
        scrollRef={scrollRef}
        onClose={closeDailyQuestion}
        onMove={moveQuestion}
      />
    </StickerScreen>
  );
});

Dashboard.displayName = 'Dashboard';
