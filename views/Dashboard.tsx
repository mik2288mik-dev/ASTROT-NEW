import React, { memo, useEffect, useMemo, useState } from 'react';
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
import { loadHumanDailyPackage } from '../services/natalReadingService';
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
  const [dailyPackage, setDailyPackage] = useState<DailyCanvas | null>(null);
  const [dailyPackageState, setDailyPackageState] = useState<DashboardSystemState>('loading');
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [moonInfoOpen, setMoonInfoOpen] = useState(false);

  /* Загрузка единого дневного пакета для карточки-героя и hooks */
  useEffect(() => {
    if (!hasChart || !chartData || !profile.id) {
      setDailyPackage(null);
      setDailyPackageState('no_chart');
      return;
    }
    let alive = true;
    setDailyPackageState('loading');
    void loadHumanDailyPackage(String(profile.id), chartId ?? undefined, today, {
      accessTier: 'premium',
      maxInProgressRetries: 3,
      profile,
      chartData,
    })
      .then((result) => {
        if (!alive) return;
        setDailyPackage(result);
        setDailyPackageState('ready');
      })
      .catch(() => {
        if (!alive) return;
        setDailyPackage(null);
        setDailyPackageState('generation_error');
      });
    return () => { alive = false; };
  }, [chartData, chartId, hasChart, profile, today]);

  const systemState = dailyPackage ? 'ready' : dailyPackageState;
  const systemCopy = getDashboardSystemText(systemState, language, today);

  /* Вспомогательные данные */
  const displayName = profile.name?.trim() || (language === 'ru' ? 'друг' : 'friend');
  const periodTabs = language === 'ru'
    ? ['Сегодня', 'Эта неделя', 'Этот месяц', 'Этот год']
    : ['Today', 'This week', 'This month', 'This year'];

  /* Астро-контекст дня: день недели + фаза луны (фаза считается клиентски, точно) */
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
  const moonTone = language === 'ru'
    ? 'Сегодня лучше держать день внятным: меньше шума, больше одного честного шага.'
    : 'Today works best with a clear pace: less noise, one honest next step.';
  const mercuryTitle = language === 'ru'
    ? 'Меркурий сегодня'
    : 'Mercury today';
  const mercuryTone = language === 'ru'
    ? 'Перед важным сообщением перечитай его один раз. Сегодня точность звучит теплее, чем скорость.'
    : 'Before an important message, read it once more. Precision lands better than speed today.';
  const moonExplain = language === 'ru'
    ? 'Фаза луны — сколько её освещено сейчас, от новолуния к полнолунию и обратно. Растущая — время начинать и набирать, убывающая — завершать и отпускать. Это общий ритм месяца, а не предсказание.'
    : 'A moon phase is how much of the Moon is lit now, from new to full and back. Waxing is for starting and building, waning for finishing and letting go. It is a monthly rhythm, not a prediction.';

  const dayHeroTitle = dailyPackage?.hero_title?.trim() || systemCopy;
  const dayHeroText = dailyPackage?.hero_hook?.trim() || systemCopy;
  const dayHeroAria = language === 'ru' ? 'Открыть личный разбор дня' : 'Open your personal day reading';
  const natalText = hasChart
    ? (language === 'ru'
      ? 'Твой персональный разбор — по факту, а не общими словами. Загляни.'
      : 'Your personal reading — specific, not generic. Take a look.')
    : (language === 'ru'
      ? 'Собери карту — дальше будет про твоё небо, не про знак вообще.'
      : 'Build your chart so the app reads your sky, not just your sign.');
  const matrixText = language === 'ru'
    ? 'Короткий портрет по числам рождения: что в тебе заметно сразу и какая внутренняя тема часто возвращается.'
    : 'A compact portrait from your birth numbers: what shows first in you and what inner theme tends to return.';
  const compatibilityText = language === 'ru'
    ? 'Посмотри, где вам легко быть рядом, а где лучше говорить бережнее, чтобы понимать друг друга без догадок.'
    : 'See where being close feels easy, and where softer, clearer words help you understand each other without guessing.';
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
        ['family', 'Home and family'],
        ['friendship', 'Friends'],
        ['energy', 'Energy'],
        ['communication', 'Talks'],
      ]).map(([section, title]) => {
        const key = section as Exclude<PersonalDailySection, 'overview'>;
        return {
          section: key,
          title,
          hook: dailyPackage?.[key]?.hook?.trim() || systemCopy,
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
      <section className="home-top" aria-label="Твой Гороскоп">
        <div className="home-logo-bar">
          <span className="home-logo-wordmark">Твой Гороскоп</span>
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
          <span className="home-day-hero-date">{dayHeroDateLabel}</span>
          <StickerSlot surface="hero" />
        </span>
        <span className="home-day-hero-copy">
          <span className="home-day-hero-title">{dayHeroTitle}</span>
          <span className="home-day-hero-text">{dayHeroText}</span>
        </span>
      </button>

      <section className="home-spheres" aria-label={language === 'ru' ? 'Сферы дня' : 'Day spheres'}>
        <div className="home-spheres-track">
          {sphereCards.map((card) => (
            <button
              key={card.section}
              type="button"
              className={`home-sphere-card home-sphere-card--${card.section}`}
              onClick={() => openSphere(card.section)}
            >
              <span className="home-sphere-title">{card.title}</span>
              <span className="home-sphere-hook">{card.hook}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-today home-soft-card home-soft-card--moon" aria-label={language === 'ru' ? 'Луна сегодня' : 'Moon today'}>
        <div className="home-soft-card-glow" aria-hidden />
        <div className="home-today-copy">
          <span className="home-soft-card-kicker">{weekdayLabel}</span>
          <div className="home-sky-grid">
            <div className="home-sky-item">
              <span className="home-sky-symbol" aria-hidden>{moonSymbol}</span>
              <div>
                <h2 className="home-soft-card-title">{moon.label}</h2>
                <p className="home-soft-card-text">{moonTone}</p>
              </div>
            </div>
            <div className="home-sky-item">
              <span className="home-sky-symbol" aria-hidden>☿</span>
              <div>
                <h2 className="home-soft-card-title">{mercuryTitle}</h2>
                <p className="home-soft-card-text">{mercuryTone}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="home-soft-card-link"
            onClick={() => { lumiaSelectionHaptic(); setMoonInfoOpen((v) => !v); }}
            aria-expanded={moonInfoOpen}
          >
            {language === 'ru' ? 'Что значит эта фаза' : 'What this phase means'}
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
