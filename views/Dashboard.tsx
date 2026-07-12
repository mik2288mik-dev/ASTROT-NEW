import React, { memo, useMemo, useState } from 'react';
import type {
  HoroscopeLayer,
  HoroscopeOpenOptions,
  NatalChartData,
  PersonalDailySection,
  UserProfile,
} from '../types';
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import { getMoscowTodayKey } from '../lib/date-utils';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { getMoonPhase } from '../lib/horoscope/moonPhase';
import { DaySheet } from '../components/lumia-ui/DaySheet';
import { HomeFaq } from '../components/Dashboard/HomeFaq';
import { MATRIX_TITLE } from '../lib/matrixArcana';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { StickerScreen, StickerSlot } from '../components/stickers/StickerScreen';
import type { SurfaceRequest } from '../lib/stickers/select';
import { getDashboardSystemText, type DashboardSystemState } from '../lib/dailyPresentationPatterns';
import type { DailyCanvas } from '../lib/natalHumanShared';

// ── Динамическая система стикеров (см. docs/STICKER_SYSTEM.md) ──
// Стикеры/позиции выбираются случайно из каталога на КАЖДЫЙ заход; это единственное место,
// где настраиваются вайб (moods) и ТЕМАТИКА (themes) каждого блока. Правила: не больше одного
// маскота на карточку, общий лимит на экран = 3, тематический фильтр (rule 5). Раскладка
// меняется 2 раза в сутки (см. StickerScreen), а не на каждый заход.
// NB (для параллельного дизайн-агента): не возвращать статические <img> стикеров в карточки —
// их рисует <StickerSlot/>; слой изолирован в styles/stickers.css.
const STICKER_REQUESTS: SurfaceRequest[] = [
  // ОДИН маскот на всю страницу — только на герое, целиком видимый в правой пустой полосе.
  // Карточки-переходы (натал/матрица/совместимость) и луна — БЕЗ стикеров (нет композиции).
  { surface: 'hero', kind: 'maskot', moods: ['calm', 'happy', 'chill'], themes: ['drink', 'read', 'cozy', 'study'] },
];

type SphereCard = {
  section: PersonalDailySection;
  title: string;
  hook: string;
};

const MOON_SYMBOL: Record<string, string> = {
  new: '●',
  'waxing-crescent': '☽',
  'first-quarter': '◐',
  'waxing-gibbous': '◑',
  full: '○',
  'waning-gibbous': '◒',
  'last-quarter': '◑',
  'waning-crescent': '☾',
};

type DashboardProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  dailyPackage: DailyCanvas | null;
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
  onOpenPersonalDaily,
  onCreateNatalChart,
  onOpenSynastry,
  onOpenMatrix,
  onRequestPremium,
  scrollRef,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);
  // Главная всегда показывает СВОЙ знак (по карте/дате рождения), а не последний
  // просмотренный в гороскопе — иначе у Рыб на главной мог оказаться Козерог.
  const ownSunSign = String(chartData?.sun?.sign || sunSignFromDate(profile.birthDate) || '').trim().toLowerCase();
  const selectedSign = ownSunSign || String(profile.selectedZodiacSign || '').trim().toLowerCase();

  // Карточка-герой и hooks восьми сфер читают один сохранённый дневной пакет.
  // Если пакета ещё нет, Dashboard показывает системное состояние, а не прогнозную заглушку.
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [moonInfoOpen, setMoonInfoOpen] = useState(false);

  /* Единый дневной пакет приходит из App startup. */
  const systemState: DashboardSystemState = dailyPackage ? 'ready' : hasChart ? 'generation_error' : 'no_chart';
  const systemCopy = getDashboardSystemText(systemState, language, today);
  const isDailyReady = !!dailyPackage;

  /* Вспомогательные данные */
  const displayName = profile.name?.trim() || (language === 'ru' ? 'друг' : 'friend');
  const periodTabs = language === 'ru'
    ? ['Сегодня', 'Эта неделя', 'Этот месяц', 'Этот год']
    : ['Today', 'This week', 'This month', 'This year'];

  /* Астро-контекст дня: день недели + фактическая фаза Луны */
  const moon = useMemo(() => getMoonPhase(new Date(), language), [language]);
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

  const moonSymbol = MOON_SYMBOL[moon.slot] || '○';
  const moonFact = language === 'ru'
    ? `Освещено около ${moon.illumination}% диска. Это факт о фазе, не личный прогноз.`
    : `About ${moon.illumination}% of the disc is illuminated. That is a phase fact, not a personal prediction.`;
  const moonExplain = language === 'ru'
    ? 'Фаза показывает, какая часть Луны освещена с Земли. Она меняется в течение лунного месяца и сама по себе не говорит, что с тобой обязательно произойдёт.'
    : 'The phase shows how much of the Moon is illuminated from Earth. It changes through the lunar month and does not predict what must happen to you.';

  const dayHeroTitle = dailyPackage?.hero_title?.trim() || systemCopy;
  const dayHeroText = dailyPackage?.hero_hook?.trim() || systemCopy;
  const dayHeroAria = language === 'ru' ? 'Открыть личный разбор дня' : 'Open your personal day reading';
  const dayHeroCta = language === 'ru' ? 'Открыть полный личный разбор' : 'Open full personal reading';
  const natalText = hasChart
    ? (language === 'ru'
      ? 'Карта уже собрана. Посмотри, что в ней про характер, привычки и сильные стороны.'
      : 'Your chart is ready. See what it says about your character, habits, and strengths.')
    : (language === 'ru'
      ? 'Дата, время и место рождения — и вместо общих слов будет разбор про тебя.'
      : 'Add your birth date, time, and place to get a reading about you, not a generic one.');
  const matrixText = language === 'ru'
    ? 'Числа рождения покажут, что у тебя получается без разгона, а где ты сам себе добавляешь квестов.'
    : 'Your birth numbers show what comes naturally and where you tend to make life harder than it needs to be.';
  const compatibilityText = language === 'ru'
    ? 'Где вы быстро находите общий язык, а где спор начинается раньше, чем кто-то понял вопрос.'
    : 'See where you click quickly and where an argument starts before either person has understood the question.';
  const sphereCards: SphereCard[] = (language === 'ru'
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
      ]).map(([section, title]) => {
        const key = section as Exclude<PersonalDailySection, 'overview'>;
        return {
          section: key,
          title,
          hook: dailyPackage?.[key]?.hook?.trim()
            || getDashboardSystemText(systemState, language, `${today}-${key}`),
        };
      });
  const openDayHero = () => {
    lumiaSelectionHaptic();
    if (hasChart) { onOpenPersonalDaily('overview'); }
    else if (!hasChart) { onCreateNatalChart?.(); }
    else { onRequestPremium?.('personal_daily'); }
  };
  const openSphere = (section: PersonalDailySection) => {
    lumiaSelectionHaptic();
    if (hasChart) { onOpenPersonalDaily(section); }
    else if (!hasChart) { onCreateNatalChart?.(); }
    else { onRequestPremium?.('personal_daily_section'); }
  };

  return (
    <StickerScreen requests={STICKER_REQUESTS} maxMaskots={1}>
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
        className="home-day-hero has-stickers"
        onClick={openDayHero}
        aria-label={dayHeroAria}
      >
        <span className="home-day-hero-glow" aria-hidden />
        <span className="home-day-hero-scene" aria-hidden>
          <StickerSlot surface="hero" />
        </span>
        <span className="home-day-hero-copy">
          <span className="home-day-hero-date">{dayHeroDateLabel}</span>
          <span className="home-day-hero-title">{dayHeroTitle}</span>
          <span className="home-day-hero-text">{dayHeroText}</span>
          <span className="home-day-hero-cta">{dayHeroCta}</span>
        </span>
      </button>

      <section className="home-spheres" aria-label={language === 'ru' ? 'Темы личного разбора' : 'Personal reading topics'}>
        <div className="home-spheres-track">
          {sphereCards.map((card) => (
            <button
              key={card.section}
              type="button"
              className={`home-sphere-card home-sphere-card--${card.section}`}
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

      <section className="home-today home-soft-card home-soft-card--moon" aria-label={language === 'ru' ? 'Фаза Луны' : 'Moon phase'}>
        <div className="home-soft-card-glow" aria-hidden />
        <div className="home-today-copy">
          <span className="home-soft-card-kicker">{weekdayLabel}</span>
          <div className="home-sky-grid">
            <div className="home-sky-item">
              <span className="home-sky-symbol" aria-hidden>{moonSymbol}</span>
              <div>
                <h2 className="home-soft-card-title">{moon.label}</h2>
                <p className="home-soft-card-text">{moonFact}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="home-soft-card-link"
            onClick={() => { lumiaSelectionHaptic(); setMoonInfoOpen((v) => !v); }}
            aria-expanded={moonInfoOpen}
          >
            {language === 'ru' ? 'Как считается фаза' : 'How the phase is calculated'}
          </button>
        </div>

        {moonInfoOpen && (
          <div className="home-today-panel">
            <p className="home-today-explain">{moonExplain}</p>
          </div>
        )}
      </section>

      <div className="home-feed">
        <button
          type="button"
          className="home-soft-card home-feed-card home-feed-card--natal"
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
            className="home-soft-card home-feed-card home-feed-card--matrix"
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
          className="home-soft-card home-feed-card home-feed-card--compat"
          onClick={() => { lumiaSelectionHaptic(); onOpenSynastry?.(); }}
        >
          <span className="home-soft-card-glow" aria-hidden />
          <span className="home-soft-card-content">
            <span className="home-soft-card-title">{language === 'ru' ? 'Совместимость' : 'Compatibility'}</span>
            <span className="home-soft-card-text">{compatibilityText}</span>
          </span>
        </button>
      </div>

      {/* ── FAQ в самом низу: на чём основаны расчёты, что это не медицина ── */}
      <HomeFaq language={language} />

      {/* ── Скрытые компоненты логики ── */}
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
