import React, { memo, useEffect, useMemo, useState } from 'react';
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
import { getDayGreeting } from '../lib/greeting';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { PlanetIcon } from '../components/icons/PlanetIcon';
import { NatalChartIcon, HeartIcon, ChatIcon } from '../components/icons/UiIcons';
import { getMoonPhase } from '../lib/horoscope/moonPhase';
import { MoonPhaseIcon } from '../components/Horoscope/MoonPhaseIcon';
import { DaySheet } from '../components/lumia-ui/DaySheet';
import { PersonalDailyStories } from '../components/lumia-ui/PersonalDailyStories';
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedTodayAssistantHome,
  getTodayAssistantHome,
  getSkyToday,
  type SkyToday,
} from '../services/astrologyService';
import {
  FreshHeader,
  FreshHeroCard,
  FreshQuickBar,
  FreshSectionHeader,
  FreshItemList,
  FreshListItem,
} from '../components/fresh-ui';
import { ActionWindows } from './v2/ActionWindows';
import { MATRIX_HOME_LABEL, MATRIX_HOME_SUB } from '../lib/matrixArcana';

/* ── Вспомогательные функции ── */
function formatDate(todayKey: string, lang: 'ru' | 'en'): string {
  const [yr, mo, da] = todayKey.split('-').map(Number);
  const d = new Date(Date.UTC(yr, mo - 1, da, 12));
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    timeZone: 'UTC', day: 'numeric', month: 'long',
  }).format(d);
}

// Маппинг знаков на русские названия
const SIGN_NAMES_RU: Record<string, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы',
  cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец',
  capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};

// Маппинг планет на русские названия
const PLANET_NAMES_RU: Record<string, string> = {
  sun: 'Солнце', moon: 'Луна', mercury: 'Меркурий',
  venus: 'Венера', mars: 'Марс', jupiter: 'Юпитер', saturn: 'Сатурн',
};

// Номер дома → подпись
function houseLabel(house: string | number | undefined, lang: 'ru' | 'en'): string {
  if (!house) return '';
  const n = typeof house === 'string' ? parseInt(house, 10) : house;
  if (Number.isNaN(n)) return '';
  return lang === 'ru' ? `${n}-й дом` : `${n}th house`;
}

/* ── Типы пропсов ── */
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
  onOpenSettings?: () => void;
  onRequestPremium?: (source?: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  initialTodaySection?: string | null;
};

/* ── Dashboard ── */
export const Dashboard = memo<DashboardProps>(({
  profile,
  chartData,
  chartId,
  onOpenHoroscopeLayer,
  onOpenPersonalDaily,
  onCreateNatalChart,
  onOpenOracle,
  onOpenSynastry,
  onOpenMatrix,
  onOpenSettings,
  onRequestPremium,
  scrollRef,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);
  const selectedSign = String(profile.selectedZodiacSign || chartData?.sun?.sign || '').trim().toLowerCase();

  const [signReading, setSignReading] = useState<ForecastDailyReading | null>(null);
  const [, setSignLoading] = useState(!!selectedSign);
  const [personal, setPersonal] = useState<TodayAssistantHomeResult | null>(
    () => hasChart && premium ? getCachedTodayAssistantHome(profile, chartId, undefined, chartData) : null,
  );
  const [, setPersonalLoading] = useState(hasChart && premium && !personal);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [personalStoryOpen, setPersonalStoryOpen] = useState(false);
  const [sky, setSky] = useState<SkyToday | null>(null);

  /* Небо сегодня: ретроградные планеты (серверный расчёт, с кэшем) */
  useEffect(() => {
    let alive = true;
    void getSkyToday(today).then((result) => { if (alive) setSky(result); }).catch(() => undefined);
    return () => { alive = false; };
  }, [today]);

  /* Загрузка гороскопа знака */
  useEffect(() => {
    if (!selectedSign) { setSignLoading(false); return; }
    let alive = true;
    setSignLoading(true);
    void getCachedDailySignHoroscope(selectedSign, today, language)
      .then((cached) => cached || ensureDailySignHoroscope(selectedSign, today, language))
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

  /* Аватар из Telegram */
  useEffect(() => {
    try {
      const tgUser = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { photo_url?: unknown } } } } })
        ?.Telegram?.WebApp?.initDataUnsafe?.user;
      setAvatarUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setAvatarUrl(null);
    }
  }, []);

  /* Вспомогательные данные */
  const signNameRu = SIGN_NAMES_RU[selectedSign] || selectedSign;
  const dateLabel = formatDate(today, language);

  /* Астро-контекст дня: день недели + фаза луны (фаза считается клиентски, точно) */
  const moon = useMemo(() => getMoonPhase(), []);
  const weekdayLabel = useMemo(() => {
    const [yr, mo, da] = today.split('-').map(Number);
    const d = new Date(Date.UTC(yr, mo - 1, da, 12));
    const w = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      timeZone: 'UTC', weekday: 'long',
    }).format(d);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }, [today, language]);

  /* Ретроградные планеты сегодня (с сервера) */
  const retro = sky?.retrograde ?? [];
  const retroLabel = retro.length === 0
    ? null
    : language === 'ru'
      ? (retro.length === 1 ? `${retro[0].nameRu} ретроградный` : `Ретроградны: ${retro.map((r) => r.nameRu).join(', ')}`)
      : (retro.length === 1 ? `${retro[0].nameEn} retrograde` : `Retrograde: ${retro.map((r) => r.nameEn).join(', ')}`);

  /* Текст hero-карточки — полный заголовок (без обрезки слов; CSS усечёт с …) */
  const heroTitle = signReading?.headline
    || signReading?.summary
    || (language === 'ru' ? 'Заглядываем в звёзды…' : 'Reading the stars…');

  /* Быстрые кнопки */
  const quickItems = [
    {
      id: 'chart',
      icon: <NatalChartIcon />,
      label: language === 'ru' ? 'Карта' : 'Chart',
      onClick: () => { lumiaSelectionHaptic(); onCreateNatalChart?.(); },
    },
    {
      id: 'horoscope',
      icon: <ZodiacIcon sign={selectedSign} size={23} />,
      label: language === 'ru' ? 'Гороскоп' : 'Horoscope',
      onClick: () => { lumiaSelectionHaptic(); onOpenHoroscopeLayer('sign', { source: 'home_quick' }); },
    },
    {
      id: 'synastry',
      icon: <HeartIcon />,
      label: language === 'ru' ? 'Совместимость' : 'Compatibility',
      onClick: () => { lumiaSelectionHaptic(); onOpenSynastry?.(); },
    },
    {
      id: 'oracle',
      icon: <ChatIcon />,
      label: language === 'ru' ? 'Чат' : 'Chat',
      onClick: () => { lumiaSelectionHaptic(); onOpenOracle?.(); },
    },
  ];

  /* Планеты для списка */
  const planetItems = chartData ? [
    { key: 'sun',     planet: chartData.sun,      show: true },
    { key: 'moon',    planet: chartData.moon,     show: true },
    { key: 'mercury', planet: chartData.mercury,  show: !!chartData.mercury },
    { key: 'venus',   planet: chartData.venus,    show: !!chartData.venus },
    { key: 'mars',    planet: chartData.mars,     show: !!chartData.mars },
  ].filter((p) => p.show).slice(0, 4) : [];

  /* Персональный день: подпись */
  const personalSubtitle = !hasChart
    ? (language === 'ru' ? 'Создайте натальную карту' : 'Create a natal chart')
    : !premium
    ? (language === 'ru' ? 'Доступно в Premium' : 'Available in Premium')
    : (personal && personal.status === 'ready' ? personal.pulse.currentPoint.summary : undefined)
      || (language === 'ru' ? 'Ваш разбор дня готов' : 'Your day breakdown is ready');

  return (
    <div
      className="fresh-page lumia-main-scroll lumia-bottom-tab-scroll"
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      {/* ── Хедер: аватар + приветствие + дата на одном уровне ── */}
      <FreshHeader
        name={profile.name || ''}
        greeting={getDayGreeting(language)}
        avatarUrl={avatarUrl || undefined}
        onAvatarClick={onOpenSettings ? () => { lumiaSelectionHaptic(); onOpenSettings(); } : undefined}
        rightSlot={
          <>
            <div className="fresh-header-date-kicker">{language === 'ru' ? 'Сегодня' : 'Today'}</div>
            <div className="fresh-header-date-value">{dateLabel}</div>
          </>
        }
      />

      {/* ── Астро-контекст дня: день недели + фаза луны ── */}
      <div className="fresh-sky-strip">
        <div className="fresh-sky-strip-ico" aria-hidden>
          <MoonPhaseIcon slot={moon.slot} size={26} fill="#111827" outline="#111827" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="fresh-sky-strip-title">{weekdayLabel} · {moon.label}</div>
          {retroLabel ? (
            <div className="fresh-sky-strip-retro">
              {retro.map((r) => (
                <PlanetIcon key={r.key} planet={r.key} size={14} strokeWidth={1.6} />
              ))}
              <span>{retroLabel}</span>
            </div>
          ) : (
            <div className="fresh-sky-strip-sub">{moon.meaning}</div>
          )}
        </div>
      </div>

      {/* ── Hero-карточка: гороскоп дня ── */}
      <FreshHeroCard
        color="coral"
        chipText={signNameRu}
        chipPosition="top-right"
        stickyText={heroTitle}
        stickyRotation={-2}
        softText={language === 'ru' ? 'Пик 13:00' : 'Peak 13:00'}
        icon={<ZodiacIcon sign={selectedSign} size={80} strokeWidth={1.1} />}
        onClick={() => { lumiaSelectionHaptic(); onOpenHoroscopeLayer('sign', { source: 'home_hero' }); }}
        style={{ cursor: 'pointer' }}
      />

      {/* ── Быстрые кнопки ── */}
      <FreshQuickBar items={quickItems} />

      {/* ── Окна дня: лучшее время для действий по карте (перенесено из Гороскопа) ── */}
      <ActionWindows
        profile={profile}
        chartData={chartData}
        chartId={chartId}
        onOpenChart={onCreateNatalChart}
        onRequestPremium={() => onRequestPremium?.('action_windows')}
      />

      {/* ── Натальная карта ── */}
      <FreshSectionHeader
        title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        linkText={language === 'ru' ? 'Все →' : 'All →'}
        onLinkClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
      />

      {hasChart && chartData ? (
        <FreshItemList>
          {planetItems.map(({ key, planet }) => {
            if (!planet) return null;
            const signKey = planet.sign?.toLowerCase() ?? '';
            const houseTxt = houseLabel(planet.house, language);
            const signRu = SIGN_NAMES_RU[signKey] || planet.sign;
            const planetRu = PLANET_NAMES_RU[key] || planet.planet;
            return (
              <FreshListItem
                key={key}
                sign={<PlanetIcon planet={key} size={20} strokeWidth={1.5} />}
                title={language === 'ru' ? `${planetRu} в ${signRu}` : `${planet.planet} in ${planet.sign}`}
                subtitle={houseTxt ? `${houseTxt}${planet.description ? ' · ' + planet.description.slice(0, 40) : ''}` : planet.description?.slice(0, 50)}
                badge={<ZodiacIcon sign={signKey} size={20} strokeWidth={1.5} />}
                onClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
              />
            );
          })}
        </FreshItemList>
      ) : (
        <div style={{ padding: '0 20px' }}>
          <button
            type="button"
            onClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
            style={{
              display: 'block',
              width: '100%',
              background: 'var(--fresh-surface)',
              border: 'none',
              borderRadius: 'var(--fresh-radius-card)',
              padding: '16px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fresh-text)', marginBottom: 4 }}>
              {language === 'ru' ? 'Построить натальную карту' : 'Build natal chart'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fresh-muted)' }}>
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
            onClick={() => {
              lumiaSelectionHaptic();
              if (hasChart && premium) { setPersonalStoryOpen(true); }
              else if (!hasChart) { onCreateNatalChart?.(); }
              else { onRequestPremium?.('personal_day'); }
            }}
            style={{
              display: 'block',
              width: '100%',
              background: 'var(--fresh-surface)',
              border: 'none',
              borderRadius: 'var(--fresh-radius-card)',
              padding: '16px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fresh-text)', marginBottom: 4 }}>
              {language === 'ru' ? 'Разбор вашего дня по карте' : 'Your day breakdown by chart'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fresh-muted)' }}>
              {personalSubtitle}
            </div>
            {(!hasChart || !premium) && (
              <div style={{
                display: 'inline-block',
                marginTop: 10,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--fresh-link)',
              }}>
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
              onClick={() => { lumiaSelectionHaptic(); onOpenMatrix(); }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #6D5BDF, #A855F7)',
                border: 'none',
                borderRadius: 'var(--fresh-radius-card)',
                padding: '16px 18px',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#fff',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 3 }}>
                {language === 'en' ? MATRIX_HOME_LABEL.en : MATRIX_HOME_LABEL.ru}
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>
                {language === 'en' ? MATRIX_HOME_SUB.en : MATRIX_HOME_SUB.ru}
              </div>
            </button>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 20px' }}>
          <button
            type="button"
            onClick={() => { lumiaSelectionHaptic(); onOpenSynastry?.(); }}
            style={{
              background: 'var(--fresh-surface)',
              border: 'none',
              borderRadius: 'var(--fresh-radius-item)',
              padding: 14,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ color: 'var(--fresh-text)', marginBottom: 8 }}><HeartIcon size={24} /></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fresh-text)', marginBottom: 2 }}>
              {language === 'ru' ? 'Совместимость' : 'Compatibility'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fresh-muted)' }}>
              {language === 'ru' ? 'По знакам и по карте' : 'By signs & chart'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fresh-link)', marginTop: 8 }}>
              {language === 'ru' ? 'Открыть →' : 'Open →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => { lumiaSelectionHaptic(); onOpenOracle?.(); }}
            style={{
              background: 'var(--fresh-surface)',
              border: 'none',
              borderRadius: 'var(--fresh-radius-item)',
              padding: 14,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ color: 'var(--fresh-text)', marginBottom: 8 }}><ChatIcon size={24} /></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fresh-text)', marginBottom: 2 }}>
              {language === 'ru' ? 'Спросить Lumia' : 'Ask Lumia'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fresh-muted)' }}>
              {language === 'ru' ? 'Личный вопрос' : 'Personal question'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fresh-link)', marginTop: 8 }}>
              {language === 'ru' ? 'Открыть →' : 'Open →'}
            </div>
          </button>
        </div>
      </div>

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
      <PersonalDailyStories
        open={personalStoryOpen}
        profile={profile}
        chartData={chartData}
        chartId={chartId}
        language={language}
        onClose={() => setPersonalStoryOpen(false)}
      />
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
