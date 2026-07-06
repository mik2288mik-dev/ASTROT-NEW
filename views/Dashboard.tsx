import React, { memo, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type {
  ForecastDailyReading,
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
import { PlanetIcon } from '../components/icons/PlanetIcon';
import { HeartIcon, ChatIcon } from '../components/icons/UiIcons';
import { getMoonPhase, type MoonPhaseSlot } from '../lib/horoscope/moonPhase';
import { DaySheet } from '../components/lumia-ui/DaySheet';
import {
  getCachedDailySignHoroscope,
  getCachedTodayAssistantHome,
  getTodayAssistantHome,
  getSkyToday,
  type SkyToday,
} from '../services/astrologyService';
import {
  FreshSectionHeader,
} from '../components/fresh-ui';
import { scoreColor, scoreLabel, nowHourIn, DayCurve } from './v2/ActionWindows';
import { HomeFaq } from '../components/Dashboard/HomeFaq';
import { MATRIX_HOME_LABEL, MATRIX_HOME_SUB } from '../lib/matrixArcana';
import { sunSignFromDate } from '../lib/synastry/compatScore';

// Маппинг знаков на русские названия
const SIGN_NAMES_RU: Record<string, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы',
  cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец',
  capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};

/* Арт moon-board-cover рисует 5 фаз: новолуние · растущий серп · первая четверть ·
   растущая · полнолуние. Восьмислотовую фазу сводим к нужной рамке (убывающие
   подсвечивают рамку с той же освещённостью). */
const MOON_SLOT_FRAME: Record<MoonPhaseSlot, number> = {
  'new': 0,
  'waxing-crescent': 1,
  'first-quarter': 2,
  'waxing-gibbous': 3,
  'full': 4,
  'waning-gibbous': 3,
  'last-quarter': 2,
  'waning-crescent': 1,
};
/* Центры 5 рамок по X в координатах карточки (сцена 7/5, арт обрезан по бокам симметрично);
   промерено по пикселям фактической cover-обрезки: рамки идут ровно с шагом ~17.8%. */
const MOON_FRAME_X = [8, 25, 43, 61, 79];
const DAY_HERO_MASCOT = '/stickers/capy_hoodie_peek_happy.webp';

/* ── Типы пропсов ── */
const HOME_CARD_IMAGES = {
  moonFocus: '/home/cards/moon-board-cover.webp',
  natalMap: '/home/cards/natal-drive-cover.webp',
  personalDay: '/home/cards/energy-cover.webp',
  matrix: '/home/cards/matrix-destiny-text.webp',
  compatibility: '/home/cards/compatibility-cover.webp',
  questions: '/home/cards/questions-cover.webp',
} as const;

const homeVisualStyle = (image: string): React.CSSProperties => ({
  '--home-card-image': `url("${image}")`,
} as React.CSSProperties);

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
  onOpenOracle,
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

  const [signReading, setSignReading] = useState<ForecastDailyReading | null>(null);
  const [, setSignLoading] = useState(!!selectedSign);
  const [personal, setPersonal] = useState<TodayAssistantHomeResult | null>(
    () => hasChart && premium ? getCachedTodayAssistantHome(profile, chartId, undefined, chartData) : null,
  );
  const [, setPersonalLoading] = useState(hasChart && premium && !personal);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [sky, setSky] = useState<SkyToday | null>(null);
  const [moonInfoOpen, setMoonInfoOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);

  /* Небо сегодня: ретроградные планеты (серверный расчёт, с кэшем) */
  useEffect(() => {
    let alive = true;
    void getSkyToday(today).then((result) => { if (alive) setSky(result); }).catch(() => undefined);
    return () => { alive = false; };
  }, [today]);

  /* Только чтение кэша гороскопа знака: генерация запускается явной кнопкой открытия. */
  useEffect(() => {
    if (!selectedSign) { setSignLoading(false); return; }
    let alive = true;
    setSignLoading(true);
    void getCachedDailySignHoroscope(selectedSign, today, language)
      .then((reading) => { if (alive) setSignReading(reading); })
      .catch(() => { if (alive) setSignReading(null); })
      .finally(() => { if (alive) setSignLoading(false); });
    return () => { alive = false; };
  }, [language, selectedSign, today]);

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

  /* Ретроградные планеты сегодня (с сервера) */
  const retro = sky?.retrograde ?? [];
  const retroLabel = retro.length === 0
    ? null
    : language === 'ru'
      ? (retro.length === 1 ? `${retro[0].nameRu} ретроградный` : `Ретроградны: ${retro.map((r) => r.nameRu).join(', ')}`)
      : (retro.length === 1 ? `${retro[0].nameEn} retrograde` : `Retrograde: ${retro.map((r) => r.nameEn).join(', ')}`);

  /* Подсветка текущей фазы: какую из 5 нарисованных рамок на арте обвести. */
  const reduce = useReducedMotion();
  const frameX = MOON_FRAME_X[MOON_SLOT_FRAME[moon.slot] ?? 3];
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

  /* Планеты для списка */
  /* Персональный день: подпись */
  const personalSubtitle = !hasChart
    ? (language === 'ru' ? 'Создайте натальную карту' : 'Create a natal chart')
    : !premium
    ? (language === 'ru' ? 'Доступно в Premium' : 'Available in Premium')
    : (personal && personal.status === 'ready' ? personal.pulse.currentPoint.summary : undefined)
      || (language === 'ru' ? 'Ваш разбор дня готов' : 'Your day breakdown is ready');
  const dayHeroTitle = (personal && personal.status === 'ready' ? personal.pulse.currentPoint.summary : undefined)
    || (language === 'ru'
      ? 'День располагает к важным разговорам и спокойным решениям'
      : 'A day for honest conversations and steadier choices');
  const dayHeroText = !hasChart
    ? (language === 'ru'
      ? 'Создай карту, чтобы увидеть личный ритм дня и подсказки по времени.'
      : 'Create a chart to see your personal day rhythm and timing cues.')
    : !premium
    ? (language === 'ru'
      ? 'Полный разбор откроет, где сегодня прибавить, а где оставить себе паузу.'
      : 'The full reading shows where to move and where to give yourself space.')
    : (language === 'ru'
      ? 'Открой полный разбор: ритм дня, сильные стороны и моменты, где лучше бережнее.'
      : 'Open the full reading: day rhythm, strengths, and moments to handle with care.');
  const dayHeroCta = language === 'ru' ? 'Полный разбор дня ⌄' : 'Full day reading ⌄';
  const openDayHero = () => {
    lumiaSelectionHaptic();
    if (hasChart && premium) { onOpenPersonalDaily('overview'); }
    else if (!hasChart) { onCreateNatalChart?.(); }
    else { onRequestPremium?.('personal_day'); }
  };

  /* Оценка дня — бейдж поверх дневника на арте (со всеми состояниями доступа). */
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
      className="fresh-page lumia-main-scroll lumia-bottom-tab-scroll"
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
        aria-label={dayHeroCta}
      >
        <span className="home-day-hero-date">{dayHeroDateLabel}</span>
        <span className="home-day-hero-glow" aria-hidden />
        <img className="home-day-hero-mascot" src={DAY_HERO_MASCOT} alt="" aria-hidden />
        <span className="home-day-hero-copy">
          <span className="home-day-hero-title">{dayHeroTitle}</span>
          <span className="home-day-hero-text">{dayHeroText}</span>
        </span>
        <span className="home-day-hero-cta">{dayHeroCta}</span>
      </button>

      {/* ── Сегодня: фазы луны + доска (текст фазы) + оценка дня на дневнике ── */}
      <div className="home-today">
        <div className="home-today-stage" style={homeVisualStyle(HOME_CARD_IMAGES.moonFocus)}>
          {/* Подсветка текущей фазы среди 5 нарисованных рамок */}
          <span className="home-moon-mark" style={{ left: `${frameX}%` }} aria-hidden />

          {/* Доска: текст фазы */}
          <div className="home-today-board">
            <div className="home-today-board-kicker">{weekdayLabel} · {moon.shortLabel}</div>
            <p className="home-today-board-text">{moon.meaning}</p>
            <button
              type="button"
              className="home-today-board-info"
              onClick={() => { lumiaSelectionHaptic(); setMoonInfoOpen((v) => !v); }}
              aria-expanded={moonInfoOpen}
            >
              {language === 'ru' ? 'Что такое фаза луны?' : 'What is a moon phase?'}
            </button>
          </div>

          {/* Оценка дня — на дневнике */}
          {dayBadge}

          {/* Ретроградные планеты (если есть) */}
          {retroLabel ? (
            <div className="home-today-retro-chip">
              {retro.map((r) => (
                <PlanetIcon key={r.key} planet={r.key} size={12} strokeWidth={1.6} />
              ))}
              <span>{retroLabel}</span>
            </div>
          ) : null}
        </div>

        {/* Раскрытия уезжают под сцену, чтобы не ломать раскладку арта */}
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
      </div>

      {/* ── Натальная карта ── */}
      <FreshSectionHeader
        title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        linkText={language === 'ru' ? 'Все →' : 'All →'}
        onLinkClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
      />

      {hasChart && chartData ? (
        <div style={{ padding: '0 20px' }}>
          <button
            type="button"
            className="home-natal home-visual-card home-visual-card--profile home-visual-card--natal-drive"
            style={homeVisualStyle(HOME_CARD_IMAGES.natalMap)}
            onClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
          >
            <div className="home-visual-title home-visual-title--large">
              {language === 'ru' ? 'Прочитай свою натальную карту' : 'Read your natal chart'}
            </div>
            <div className="home-visual-sub" style={{ marginBottom: 10 }}>
              {language === 'ru' ? 'Узнай всё о себе и открой много нового' : 'Learn all about yourself and discover more'}
            </div>
            <div className="home-natal-three">
              {[
                { k: 'sun', sign: chartData.sun?.sign },
                { k: 'moon', sign: chartData.moon?.sign },
                { k: 'asc', sign: chartData.rising?.sign },
                { k: 'mercury', sign: chartData.mercury?.sign },
                { k: 'venus', sign: chartData.venus?.sign },
                { k: 'mars', sign: chartData.mars?.sign },
              ].filter((it) => it.sign).map((it) => {
                const signKey = String(it.sign || '').toLowerCase();
                const signName = language === 'ru' ? (SIGN_NAMES_RU[signKey] || it.sign) : it.sign;
                return (
                  <span className="home-natal-item" key={it.k}>
                    <PlanetIcon planet={it.k} size={15} strokeWidth={1.5} />
                    <span>{signName}</span>
                  </span>
                );
              })}
            </div>
            <span className="home-natal-cta">{language === 'ru' ? 'Открыть карту' : 'Open chart'} →</span>
          </button>
        </div>
      ) : (
        <div style={{ padding: '0 20px' }}>
          <button
            type="button"
            className="home-natal home-natal-empty home-visual-card home-visual-card--profile home-visual-card--natal-drive"
            style={homeVisualStyle(HOME_CARD_IMAGES.natalMap)}
            onClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
          >
            <div className="home-visual-title">
              {language === 'ru' ? 'Построить натальную карту' : 'Build natal chart'}
            </div>
            <div className="home-visual-sub">
              {language === 'ru' ? 'Узнайте положение планет в момент рождения' : 'Learn planet positions at birth'}
            </div>
          </button>
        </div>
      )}

      {/* ── Личный день ── */}
      <div style={{ marginTop: 20 }}>
        <FreshSectionHeader
          title={language === 'ru' ? 'Личный день' : 'Personal day'}
          linkText={hasChart && premium ? (language === 'ru' ? 'Открыть →' : 'Open →') : undefined}
          onLinkClick={() => { lumiaSelectionHaptic(); onOpenPersonalDaily('overview'); }}
        />
        <div style={{ padding: '0 20px' }}>
          <button
            type="button"
            className="home-personal-card home-visual-card home-visual-card--energy"
            style={homeVisualStyle(HOME_CARD_IMAGES.personalDay)}
            onClick={() => {
              lumiaSelectionHaptic();
              if (hasChart && premium) { onOpenPersonalDaily('overview'); }
              else if (!hasChart) { onCreateNatalChart?.(); }
              else { onRequestPremium?.('personal_day'); }
            }}
          >
            <div className="home-visual-title">
              {language === 'ru' ? 'Разбор вашего дня по карте' : 'Your day breakdown by chart'}
            </div>
            <div className="home-visual-sub">
              {personalSubtitle}
            </div>
            {(!hasChart || !premium) && (
              <div className="home-visual-cta">
                {!hasChart
                  ? (language === 'ru' ? 'Создать карту →' : 'Create chart →')
                  : (language === 'ru' ? 'Открыть Premium →' : 'Open Premium →')
                }
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ── Быстрый доступ: совместимость и матрица ── */}
      <div style={{ marginTop: 20, paddingBottom: 8 }}>
        <FreshSectionHeader title={language === 'ru' ? 'Разделы' : 'Sections'} />
        {onOpenMatrix ? (
          <div style={{ padding: '0 20px 8px' }}>
            <button
              type="button"
              className="home-matrix-card home-visual-card home-visual-card--planning home-visual-card--matrix"
              style={homeVisualStyle(HOME_CARD_IMAGES.matrix)}
              onClick={() => { lumiaSelectionHaptic(); onOpenMatrix(); }}
            >
              {/* RU-картинка уже содержит красиво набранный заголовок «Прочитай свою Матрицу судьбы»,
                  поэтому свой заголовок рисуем только для EN (там нет локализованной версии картинки). */}
              {language === 'en' && (
                <div className="home-visual-title home-visual-title--large">
                  {MATRIX_HOME_LABEL.en}
                </div>
              )}
              <div className="home-visual-sub">
                {language === 'en' ? MATRIX_HOME_SUB.en : MATRIX_HOME_SUB.ru}
              </div>
            </button>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 20px' }}>
          <button
            type="button"
            className="home-section-card home-section-card--compat home-visual-card home-visual-card--people"
            style={homeVisualStyle(HOME_CARD_IMAGES.compatibility)}
            onClick={() => { lumiaSelectionHaptic(); onOpenSynastry?.(); }}
          >
            <div className="home-section-card-icon"><HeartIcon size={24} /></div>
            <div className="home-visual-title home-visual-title--small">
              {language === 'ru' ? 'Совместимость' : 'Compatibility'}
            </div>
            <div className="home-visual-sub home-visual-sub--small">
              {language === 'ru' ? 'По знакам и по карте' : 'By signs & chart'}
            </div>
            <div className="home-visual-cta">
              {language === 'ru' ? 'Открыть →' : 'Open →'}
            </div>
          </button>

          <button
            type="button"
            className="home-section-card home-section-card--ask home-visual-card home-visual-card--chat"
            style={homeVisualStyle(HOME_CARD_IMAGES.questions)}
            onClick={() => { lumiaSelectionHaptic(); onOpenOracle?.(); }}
          >
            <div className="home-section-card-icon"><ChatIcon size={24} /></div>
            <div className="home-visual-title home-visual-title--small">
              {language === 'ru' ? 'Спросить астролога' : 'Ask the astrologer'}
            </div>
            <div className="home-visual-sub home-visual-sub--small">
              {language === 'ru' ? 'Личный вопрос' : 'Personal question'}
            </div>
            <div className="home-visual-cta">
              {language === 'ru' ? 'Открыть →' : 'Open →'}
            </div>
          </button>
        </div>
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
