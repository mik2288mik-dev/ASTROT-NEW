import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import type {
  ForecastDailyReading,
  HoroscopeLayer,
  HoroscopeOpenOptions,
  NatalChartData,
  DailyPackageStatus,
  PersonalDailySection,
  UserProfile,
} from '../types';
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import {
  formatIsoWeekPeriodLabel,
  formatMonthPeriodLabel,
  formatYearPeriodLabel,
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
  getMoscowYearKey,
} from '../lib/date-utils';
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
import {
  ensureMonthlySignHoroscope,
  ensureWeeklySignHoroscope,
  ensureYearlySignHoroscope,
  getCachedMonthlySignHoroscope,
  getCachedWeeklySignHoroscope,
  getCachedYearlySignHoroscope,
} from '../services/astrologyService';

const LOADING_STICKER_REQUESTS: SurfaceRequest[] = [
  { surface: 'hero', kind: 'maskot', moods: ['thinking', 'calm'], themes: ['study', 'read', 'tech'] },
];

type SphereCard = {
  section: PersonalDailySection;
  title: string;
  hook: string;
  background: CardBackgroundAsset | null;
};

type HomePeriod = 'today' | 'week' | 'month' | 'year';
type LoadableHomePeriod = Exclude<HomePeriod, 'today'>;
type PeriodLoadState = 'idle' | 'loading' | 'ready' | 'error';

type PeriodSphereCard = {
  id: string;
  visualSection: Exclude<PersonalDailySection, 'overview'>;
  title: string;
  hook: string;
  background: CardBackgroundAsset | null;
};

const PERIOD_TABS: ReadonlyArray<{ id: HomePeriod; ru: string; en: string }> = [
  { id: 'today', ru: 'Сегодня', en: 'Today' },
  { id: 'week', ru: 'Эта неделя', en: 'This week' },
  { id: 'month', ru: 'Этот месяц', en: 'This month' },
  { id: 'year', ru: 'Этот год', en: 'This year' },
] as const;

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
  const weekPeriodKey = useMemo(() => getMoscowIsoWeekKey(), []);
  const monthPeriodKey = useMemo(() => getMoscowMonthKey(), []);
  const yearPeriodKey = useMemo(() => getMoscowYearKey(), []);
  const [activePeriod, setActivePeriod] = useState<HomePeriod>('today');
  const [periodStates, setPeriodStates] = useState<Record<LoadableHomePeriod, PeriodLoadState>>({
    week: 'idle',
    month: 'idle',
    year: 'idle',
  });
  const [periodReadings, setPeriodReadings] = useState<Partial<Record<LoadableHomePeriod, ForecastDailyReading>>>({});
  const periodRequestsRef = useRef<Partial<Record<LoadableHomePeriod, boolean>>>({});

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

  const loadPeriod = async (period: LoadableHomePeriod) => {
    if (!selectedSign || periodReadings[period] || periodRequestsRef.current[period]) return;
    periodRequestsRef.current[period] = true;
    setPeriodStates((current) => ({ ...current, [period]: 'loading' }));
    try {
      const periodKey = period === 'week'
        ? weekPeriodKey
        : period === 'month'
          ? monthPeriodKey
          : yearPeriodKey;
      const cached = period === 'week'
        ? await getCachedWeeklySignHoroscope(selectedSign, periodKey, language)
        : period === 'month'
          ? await getCachedMonthlySignHoroscope(selectedSign, periodKey, language)
          : await getCachedYearlySignHoroscope(selectedSign, periodKey, language);
      const reading = cached || (period === 'week'
        ? await ensureWeeklySignHoroscope(selectedSign, periodKey, language)
        : period === 'month'
          ? await ensureMonthlySignHoroscope(selectedSign, periodKey, language)
          : await ensureYearlySignHoroscope(selectedSign, periodKey, language));
      setPeriodReadings((current) => ({ ...current, [period]: reading }));
      setPeriodStates((current) => ({ ...current, [period]: 'ready' }));
    } catch {
      setPeriodStates((current) => ({ ...current, [period]: 'error' }));
    } finally {
      periodRequestsRef.current[period] = false;
    }
  };

  const selectPeriod = (period: HomePeriod) => {
    lumiaSelectionHaptic();
    setActivePeriod(period);
    if (period !== 'today') void loadPeriod(period);
  };

  const loadablePeriod = activePeriod === 'today' ? null : activePeriod;
  const periodState = loadablePeriod ? periodStates[loadablePeriod] : 'idle';
  const periodReading = loadablePeriod ? periodReadings[loadablePeriod] : undefined;
  const periodKey = loadablePeriod === 'week'
    ? weekPeriodKey
    : loadablePeriod === 'month'
      ? monthPeriodKey
      : loadablePeriod === 'year'
        ? yearPeriodKey
        : '';
  const periodLabel = loadablePeriod === 'week'
    ? formatIsoWeekPeriodLabel(weekPeriodKey, language)
    : loadablePeriod === 'month'
      ? formatMonthPeriodLabel(monthPeriodKey, language)
      : loadablePeriod === 'year'
        ? formatYearPeriodLabel(yearPeriodKey, language)
        : '';
  const periodIsLoading = !!selectedSign && !!loadablePeriod && (periodState === 'idle' || periodState === 'loading');
  const periodVisualState: DashboardSystemState = !selectedSign
    ? 'no_chart'
    : periodState === 'error'
      ? 'generation_error'
      : periodState === 'ready'
        ? 'ready'
        : 'loading';
  const periodHeroTitle = !selectedSign
    ? (language === 'ru' ? 'Нужны данные рождения' : 'Birth data needed')
    : periodState === 'error'
      ? (loadablePeriod === 'week'
        ? (language === 'ru' ? 'Неделя не загрузилась' : 'The week did not load')
        : loadablePeriod === 'month'
          ? (language === 'ru' ? 'Месяц не загрузился' : 'The month did not load')
          : (language === 'ru' ? 'Год не загрузился' : 'The year did not load'))
      : periodReading?.headline
        || (loadablePeriod === 'week'
          ? (language === 'ru' ? 'Смотрим эту неделю' : 'Looking at this week')
          : loadablePeriod === 'month'
            ? (language === 'ru' ? 'Смотрим этот месяц' : 'Looking at this month')
            : (language === 'ru' ? 'Смотрим этот год' : 'Looking at this year'));
  const periodHeroText = !selectedSign
    ? (language === 'ru' ? 'Добавь место и время рождения, чтобы определить твой знак.' : 'Add your birth place and time so we can identify your sign.')
    : periodState === 'error'
      ? (loadablePeriod === 'week'
        ? (language === 'ru' ? 'Неделя не загрузилась. Попробуем ещё раз.' : 'The week did not load. Let’s try again.')
        : loadablePeriod === 'month'
          ? (language === 'ru' ? 'Месяц не загрузился. Попробуем ещё раз.' : 'The month did not load. Let’s try again.')
          : (language === 'ru' ? 'Год не загрузился. Попробуем ещё раз.' : 'The year did not load. Let’s try again.'))
      : periodReading?.reading
        || (loadablePeriod === 'week'
          ? (language === 'ru' ? 'Смотрим, что важно на этой неделе.' : 'Looking at what matters this week.')
          : loadablePeriod === 'month'
            ? (language === 'ru' ? 'Смотрим месяц — без воды и страшилок.' : 'Looking at the month — no filler or scare tactics.')
            : (language === 'ru' ? 'Смотрим год — коротко и без обещаний.' : 'Looking at the year — short and without promises.'));
  const periodHeroCta = !selectedSign
    ? (language === 'ru' ? 'Заполнить данные' : 'Add birth data')
    : loadablePeriod && periodState === 'error'
      ? (language === 'ru' ? 'Попробовать ещё раз' : 'Try again')
      : periodIsLoading
        ? (language === 'ru' ? 'Загружаем' : 'Loading')
        : null;
  const periodSphereCards: PeriodSphereCard[] = useMemo(() => {
    if (!periodReading || !loadablePeriod) return [];
    const candidates: Array<Omit<PeriodSphereCard, 'background'>> = [
      {
        id: 'focus',
        visualSection: 'goals',
        title: language === 'ru' ? 'Что сейчас главное' : 'What matters now',
        hook: periodReading.focus,
      },
      {
        id: 'chance',
        visualSection: 'energy',
        title: language === 'ru' ? 'На что можно опереться' : 'What can support you',
        hook: periodReading.chance,
      },
      {
        id: 'risk',
        visualSection: 'communication',
        title: language === 'ru' ? 'Где не усложнять' : 'Where not to complicate things',
        hook: periodReading.risk,
      },
      {
        id: 'advice',
        visualSection: 'work',
        title: language === 'ru' ? 'Полезные ориентиры' : 'Useful guidance',
        hook: [...new Set((periodReading.advice || []).map((item) => item.trim()).filter(Boolean))].join(' · '),
      },
      {
        id: 'context',
        visualSection: 'family',
        title: language === 'ru' ? 'Основа разбора' : 'Reading context',
        hook: periodReading.context,
      },
    ];
    return candidates
      .filter((card) => card.hook?.trim())
      .map((card) => ({
        ...card,
        background: getPersonalCardBackground(card.visualSection, backgroundUserId, periodKey),
      }));
  }, [backgroundUserId, language, loadablePeriod, periodKey, periodReading]);

  const openPeriodHero = () => {
    lumiaSelectionHaptic();
    if (!selectedSign) {
      onCreateNatalChart?.();
      return;
    }
    if (loadablePeriod && periodState === 'error') void loadPeriod(loadablePeriod);
  };

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
              {PERIOD_TABS.map((tab) => {
                const active = tab.id === activePeriod;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`home-period-tab${active ? ' is-active' : ''}`}
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectPeriod(tab.id)}
                  >
                    {tab[language]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {activePeriod === 'today' ? (
          <>
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
          </>
        ) : (
          <>
            <button
              type="button"
              className={`home-day-hero home-day-hero--${periodVisualState}${periodIsLoading ? ' has-stickers' : ''}${heroBackground ? ' has-card-background' : ''}`}
              style={cardBackgroundStyle(heroBackground)}
              onClick={openPeriodHero}
              aria-label={periodHeroTitle}
              aria-busy={periodIsLoading}
              disabled={periodIsLoading}
            >
              <span className="home-day-hero-glow" aria-hidden />
              {periodIsLoading ? (
                <span className="home-day-hero-scene" aria-hidden>
                  <StickerSlot surface="hero" />
                </span>
              ) : null}
              <span className="home-day-hero-copy">
                <span className="home-day-hero-date">{periodLabel}</span>
                {periodReading?.summary ? <span className="home-day-hero-basis">{periodReading.summary}</span> : null}
                <span className="home-day-hero-title">{periodHeroTitle}</span>
                <span className="home-day-hero-text">{periodHeroText}</span>
                {periodHeroCta ? (
                  <span className="home-day-hero-cta">
                    {periodHeroCta}
                    {periodIsLoading ? <span className="home-day-loading-dots" aria-hidden><i /><i /><i /></span> : null}
                  </span>
                ) : null}
              </span>
            </button>

            {periodSphereCards.length ? (
              <section className="home-spheres" aria-label={language === 'ru' ? 'Разбор периода' : 'Period reading'}>
                <div className="home-spheres-track">
                  {periodSphereCards.map((card) => (
                    <div
                      key={card.id}
                      className={`home-sphere-card home-sphere-card--${card.visualSection}${card.background ? ' has-card-background' : ''}`}
                      style={cardBackgroundStyle(card.background)}
                    >
                      <span className="home-sphere-title">{card.title}</span>
                      <span className="home-sphere-hook">{card.hook}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

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
