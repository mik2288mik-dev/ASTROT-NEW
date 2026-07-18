import React, { memo, useMemo, useState } from 'react';
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
import { MATRIX_TITLE } from '../lib/matrixArcana';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { StickerScreen, StickerSlot } from '../components/stickers/StickerScreen';
import type { SurfaceRequest } from '../lib/stickers/select';
import { getDashboardSystemText, type DashboardSystemState } from '../lib/dailyPresentationPatterns';
import type { DailyCanvas } from '../lib/natalHumanShared';
import {
  cardBackgroundStyle,
  getHeroCardBackground,
  getPersonalCardBackground,
  getUniversalCardBackground,
  type CardBackgroundAsset,
} from '../lib/cardBackgrounds';

// ── Динамическая система стикеров (см. docs/STICKER_SYSTEM.md) ──
// Маскот остаётся только в состоянии расчёта. После загрузки характер карточкам
// дают оригинальные editorial-фоны из card-background-manifest.json.
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

/* ── Dashboard ── */
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
  // Главная всегда показывает СВОЙ знак (по карте/дате рождения), а не последний
  // просмотренный в гороскопе — иначе у Рыб на главной мог оказаться Козерог.
  const ownSunSign = String(chartData?.sun?.sign || sunSignFromDate(profile.birthDate) || '').trim().toLowerCase();
  const selectedSign = ownSunSign || String(profile.selectedZodiacSign || '').trim().toLowerCase();

  // Картинки выбираются детерминированно: пользователь + дата + ключ карточки.
  // Поэтому фон не прыгает при повторном рендере и остаётся тем же весь день.
  const heroBackground = useMemo(
    () => getHeroCardBackground(backgroundUserId, today),
    [backgroundUserId, today],
  );
  const natalBackground = useMemo(() => getUniversalCardBackground('natal'), []);
  const matrixBackground = useMemo(() => getUniversalCardBackground('matrix'), []);
  const compatibilityBackground = useMemo(() => getUniversalCardBackground('compatibility'), []);

  // Карточка-герой и hooks восьми сфер читают один сохранённый дневной пакет.
  // Если пакета ещё нет, Dashboard показывает системное состояние, а не прогнозную заглушку.
  const [sheetDate, setSheetDate] = useState<string | null>(null);

  /* Единый дневной пакет приходит из App startup. */
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

  /* Вспомогательные данные */
  const displayName = profile.name?.trim() || (language === 'ru' ? 'друг' : 'friend');
  const periodTabs = language === 'ru'
    ? ['Сегодня', 'Эта неделя', 'Этот месяц', 'Этот год']
    : ['Today', 'This week', 'This month', 'This year'];

  /* Дата личного hero. */
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
      ? (language === 'ru' ? 'Готовим твой личный гороскоп' : 'Preparing your personal horoscope')
      : isDailyError
        ? (language === 'ru' ? 'Личный гороскоп пока не готов' : 'Your personal horoscope is not ready yet')
        : (language === 'ru' ? 'Личный гороскоп' : 'Personal Horoscope'));
  const dayHeroText = dailyPackage?.hero_hook?.trim() || systemCopy;
  const dayHeroAria = isDailyLoading
    ? (language === 'ru' ? 'Личный гороскоп рассчитывается' : 'Personal horoscope is being calculated')
    : isDailyError
      ? (language === 'ru' ? 'Повторить расчёт личного гороскопа' : 'Retry personal horoscope calculation')
      : language === 'ru' ? 'Открыть личный гороскоп' : 'Open your personal horoscope';
  const dayHeroCta: string | null = isDailyLoading
    ? (language === 'ru' ? 'Гороскоп рассчитывается' : 'Calculating your horoscope')
    : isDailyError
      ? (language === 'ru' ? 'Попробовать ещё раз' : 'Try again')
      : !hasChart
        ? (language === 'ru' ? 'Создать натальную карту' : 'Create natal chart')
        : null;
  const natalText = hasChart
    ? (language === 'ru'
      ? 'Характер, привычки и сильные стороны — по твоим данным рождения.'
      : 'Character, habits, and strengths based on your birth data.')
    : (language === 'ru'
      ? 'Дата, время и место рождения — и вместо общих слов будет разбор про тебя.'
      : 'Add your birth date, time, and place to get a reading about you, not a generic one.');
  const matrixText = language === 'ru'
    ? 'Что у тебя получается естественно, а где ты сам добавляешь себе лишний квест.'
    : 'What comes naturally and where you tend to make life harder than it needs to be.';
  const compatibilityText = language === 'ru'
    ? 'Где вы быстро находите общий язык, а где спор начинается раньше вопроса.'
    : 'Where you click quickly and where an argument starts before the question does.';

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
            <span className="home-day-hero-title">{dayHeroTitle}</span>
            <span className="home-day-hero-text">{dayHeroText}</span>
            {dayHeroCta ? (
              <span className="home-day-hero-cta">
                {dayHeroCta}
                {isDailyLoading ? (
                  <span className="home-day-loading-dots" aria-hidden>
                    <i /><i /><i />
                  </span>
                ) : null}
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
      </>

      <div className="home-feed">
        <button
          type="button"
          className={`home-soft-card home-feed-card home-feed-card--natal${natalBackground ? ' has-card-background' : ''}`}
          style={cardBackgroundStyle(natalBackground)}
          onClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
        >
          <span className="home-soft-card-glow" aria-hidden />
          <span className="home-soft-card-content">
            <span className="home-soft-card-title">{language === 'ru' ? 'Натальная карта' : 'Natal chart'}</span>
            <span className="home-soft-card-text">{natalText}</span>
          </span>
        </button>

        {onOpenMatrix ? (
          <button
            type="button"
            className={`home-soft-card home-feed-card home-feed-card--matrix${matrixBackground ? ' has-card-background' : ''}`}
            style={cardBackgroundStyle(matrixBackground)}
            onClick={() => { lumiaSelectionHaptic(); onOpenMatrix(); }}
          >
            <span className="home-soft-card-glow" aria-hidden />
            <span className="home-soft-card-content">
              <span className="home-soft-card-title">{language === 'ru' ? MATRIX_TITLE.ru : MATRIX_TITLE.en}</span>
              <span className="home-soft-card-text">{matrixText}</span>
            </span>
          </button>
        ) : null}

        <button
          type="button"
          className={`home-soft-card home-feed-card home-feed-card--compat${compatibilityBackground ? ' has-card-background' : ''}`}
          style={cardBackgroundStyle(compatibilityBackground)}
          onClick={() => { lumiaSelectionHaptic(); onOpenSynastry?.(); }}
        >
          <span className="home-soft-card-glow" aria-hidden />
          <span className="home-soft-card-content">
            <span className="home-soft-card-title">{language === 'ru' ? 'Совместимость' : 'Compatibility'}</span>
            <span className="home-soft-card-text">{compatibilityText}</span>
          </span>
        </button>
      </div>

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
    </StickerScreen>
  );
});

Dashboard.displayName = 'Dashboard';
