import React, { memo, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type {
  HoroscopeLayer,
  HoroscopeOpenOptions,
  NatalChartData,
  PersonalDailySection,
  TodayAssistantHomeResult,
  UserProfile,
} from '../types';
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import { getMoscowTodayKey } from '../lib/date-utils';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { getMoonPhase } from '../lib/horoscope/moonPhase';
import { DaySheet } from '../components/lumia-ui/DaySheet';
import {
  getCachedTodayAssistantHome,
  getTodayAssistantHome,
} from '../services/astrologyService';
import { scoreColor, scoreLabel, nowHourIn, DayCurve } from './v2/ActionWindows';
import { HomeFaq } from '../components/Dashboard/HomeFaq';
import { MATRIX_TITLE } from '../lib/matrixArcana';
import { sunSignFromDate } from '../lib/synastry/compatScore';

const DAY_HERO_MASCOT = '/stickers/capy_hoodie_peek_happy.webp';

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
  onOpenOracle?: () => void;
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

  const [personal, setPersonal] = useState<TodayAssistantHomeResult | null>(
    () => hasChart && premium ? getCachedTodayAssistantHome(profile, chartId, undefined, chartData) : null,
  );
  const [, setPersonalLoading] = useState(hasChart && premium && !personal);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [moonInfoOpen, setMoonInfoOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);

  /* Загрузка персонального дня */
  useEffect(() => {
    if (!hasChart || !premium || !chartData) { setPersonalLoading(false); return; }
    const cached = getCachedTodayAssistantHome(profile, chartId, undefined, chartData);
    if (cached) { setPersonal(cached); setPersonalLoading(false); return; }
    let alive = true;
    setPersonalLoading(true);
    void getTodayAssistantHome(profile, chartData, chartId)
      .then((result) => { if (alive) setPersonal(result); })
      .catch(() => { if (alive) setPersonal(null); })
      .finally(() => { if (alive) setPersonalLoading(false); });
    return () => { alive = false; };
  }, [chartData, chartId, hasChart, premium, profile]);

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

  const reduce = useReducedMotion();
  const moonSymbol = MOON_SYMBOL[moon.slot] || '○';
  const moonTone = language === 'ru'
    ? 'Сегодня полезно держать день проще: заметить главное, убрать лишнее и не гнать себя там, где нужна ясность.'
    : 'Today asks for a simpler pace: notice what matters, clear the extra, and do not rush where clarity is needed.';
  const moonExplain = language === 'ru'
    ? 'Фаза луны — сколько её освещено сейчас, от новолуния к полнолунию и обратно. Растущая — время начинать и набирать, убывающая — завершать и отпускать. Это общий ритм месяца, а не предсказание.'
    : 'A moon phase is how much of the Moon is lit now, from new to full and back. Waxing is for starting and building, waning for finishing and letting go. It is a monthly rhythm, not a prediction.';

  /* Оценка дня по карте — для бейджа «на дневнике» (данные те же, что у персонального дня). */
  const dayPulse = personal && personal.status === 'ready' ? personal.pulse : null;
  const dayPoints = useMemo(
    () => (dayPulse ? dayPulse.points.map((p) => ({ hour: p.hour, score: p.score })) : []),
    [dayPulse],
  );
  const dayScore = useMemo(
    () => (dayPoints.length ? Math.round(dayPoints.reduce((s, p) => s + p.score, 0) / dayPoints.length) : null),
    [dayPoints],
  );
  const dayTimezone = dayPulse?.timezone || 'Europe/Moscow';
  const [nowH, setNowH] = useState(() => nowHourIn('Europe/Moscow'));
  useEffect(() => {
    setNowH(nowHourIn(dayTimezone));
    const id = window.setInterval(() => setNowH(nowHourIn(dayTimezone)), 60000);
    return () => window.clearInterval(id);
  }, [dayTimezone]);

  const dayHeroTitle = (personal && personal.status === 'ready' ? personal.pulse.currentPoint.summary : undefined)
    || (language === 'ru'
      ? 'День располагает к важным разговорам и спокойным решениям'
      : 'A day for honest conversations and steadier choices');
  const dayHeroText = !hasChart
    ? (language === 'ru'
      ? 'Сначала соберём личную основу: так день станет про тебя, а не про общий фон.'
      : 'First, build your personal base so the day can feel about you, not a generic mood.')
    : !premium
    ? (language === 'ru'
      ? 'Внутри будет больше деталей: где легче двигаться, а где лучше оставить себе паузу.'
      : 'There is more detail inside: where movement comes easier and where space may help.')
    : (language === 'ru'
      ? 'Внутри больше деталей: сильные стороны дня, аккуратные места и подсказки по времени.'
      : 'Inside: the day’s stronger points, softer spots, and timing cues.');
  const dayHeroAria = language === 'ru' ? 'Открыть личный разбор дня' : 'Open your personal day reading';
  const natalText = hasChart
    ? (language === 'ru'
      ? 'Загляни в личный портрет: что в тебе сильное, что включается первым и почему некоторые вещи даются легче.'
      : 'Step into your personal portrait: what is strong in you, what turns on first, and why some things come easier.')
    : (language === 'ru'
      ? 'Собери личный портрет по рождению, чтобы дальше читать себя точнее и без общих фраз.'
      : 'Build your birth portrait so the rest of the app can read you more precisely, without generic lines.');
  const matrixText = language === 'ru'
    ? 'Короткий портрет по числам рождения: что в тебе заметно сразу и какая внутренняя тема часто возвращается.'
    : 'A compact portrait from your birth numbers: what shows first in you and what inner theme tends to return.';
  const compatibilityText = language === 'ru'
    ? 'Посмотри, где вам легко быть рядом, а где лучше говорить бережнее, чтобы понимать друг друга без догадок.'
    : 'See where being close feels easy, and where softer, clearer words help you understand each other without guessing.';
  const openDayHero = () => {
    lumiaSelectionHaptic();
    if (hasChart && premium) { onOpenPersonalDaily('overview'); }
    else if (!hasChart) { onCreateNatalChart?.(); }
    else { onRequestPremium?.('personal_day'); }
  };

  /* Оценка дня — компактный блок внутри системной карточки Луны. */
  const dayBadge = !hasChart ? (
    <button
      type="button"
      className="home-day-badge home-day-badge--cta"
      onClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
    >
      <span className="home-day-badge-k">{language === 'ru' ? 'Оценка дня' : 'Day score'}</span>
      <span className="home-day-badge-cta">{language === 'ru' ? 'Создать карту' : 'Create chart'}</span>
    </button>
  ) : !premium ? (
    <button
      type="button"
      className="home-day-badge home-day-badge--cta"
      onClick={() => { lumiaSelectionHaptic(); onRequestPremium?.('action_windows'); }}
    >
      <span className="home-day-badge-k">{language === 'ru' ? 'Оценка дня' : 'Day score'}</span>
      <span className="home-day-badge-cta">Premium</span>
    </button>
  ) : dayScore == null ? (
    <div className="home-day-badge home-day-badge--load">{language === 'ru' ? 'Считаю…' : 'Scoring…'}</div>
  ) : (
    <button
      type="button"
      className="home-day-badge"
      onClick={() => { lumiaSelectionHaptic(); setDayOpen((v) => !v); }}
      aria-expanded={dayOpen}
    >
      <span className="home-day-badge-k">{language === 'ru' ? 'Оценка дня' : 'Day score'}</span>
      <span className="home-day-badge-score" style={{ color: scoreColor(dayScore) }}>
        {dayScore}<i>/100</i>
      </span>
      <span className="home-day-badge-label">{scoreLabel(dayScore, language === 'ru')}</span>
    </button>
  );

  return (
    <div
      className="fresh-page home-screen lumia-main-scroll lumia-bottom-tab-scroll"
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      <section className="home-top" aria-label="LUMIA">
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
        className="home-day-hero"
        onClick={openDayHero}
        aria-label={dayHeroAria}
      >
        <span className="home-day-hero-date">{dayHeroDateLabel}</span>
        <span className="home-day-hero-glow" aria-hidden />
        <img className="home-day-hero-mascot" src={DAY_HERO_MASCOT} alt="" aria-hidden />
        <span className="home-day-hero-copy">
          <span className="home-day-hero-title">{dayHeroTitle}</span>
          <span className="home-day-hero-text">{dayHeroText}</span>
        </span>
      </button>

      <section className="home-today home-soft-card home-soft-card--moon" aria-label={language === 'ru' ? 'Луна и оценка дня' : 'Moon and day score'}>
        <div className="home-soft-card-glow" aria-hidden />
        <div className="home-today-copy">
          <span className="home-moon-symbol" aria-hidden>{moonSymbol}</span>
          <span className="home-soft-card-kicker">{weekdayLabel}</span>
          <h2 className="home-soft-card-title">{moon.label}</h2>
          <p className="home-soft-card-text">{moonTone}</p>
          <button
            type="button"
            className="home-soft-card-link"
            onClick={() => { lumiaSelectionHaptic(); setMoonInfoOpen((v) => !v); }}
            aria-expanded={moonInfoOpen}
          >
            {language === 'ru' ? 'Что значит эта фаза' : 'What this phase means'}
          </button>
        </div>
        <div className="home-today-score">
          {dayBadge}
        </div>

        {(moonInfoOpen || (dayOpen && dayScore != null && dayPoints.length > 0)) && (
          <div className="home-today-panel">
            {moonInfoOpen ? <p className="home-today-explain">{moonExplain}</p> : null}
            {dayOpen && dayScore != null && dayPoints.length > 0 ? (
              <div className="home-day-detail">
                <DayCurve points={dayPoints} nowH={nowH} color={scoreColor(dayScore)} reduce={reduce} />
              </div>
            ) : null}
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
  );
});

Dashboard.displayName = 'Dashboard';
