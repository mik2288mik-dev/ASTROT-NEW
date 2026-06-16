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
import { NatalChartIcon, HeartIcon, ChatIcon } from '../components/icons/UiIcons';
import { DaySheet } from '../components/lumia-ui/DaySheet';
import { HoroscopeStories } from '../components/lumia-ui/HoroscopeStories';
import { PersonalDailyStories } from '../components/lumia-ui/PersonalDailyStories';
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedTodayAssistantHome,
  getTodayAssistantHome,
} from '../services/astrologyService';
import {
  FreshHeader,
  FreshHeroCard,
  FreshQuickBar,
  FreshSectionHeader,
  FreshItemList,
  FreshListItem,
} from '../components/fresh-ui';

/* ── Вспомогательные функции ── */
function formatDate(todayKey: string, lang: 'ru' | 'en'): string {
  const [yr, mo, da] = todayKey.split('-').map(Number);
  const d = new Date(Date.UTC(yr, mo - 1, da, 12));
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    timeZone: 'UTC', day: 'numeric', month: 'long',
  }).format(d);
}

// Маппинг знаков на астро-символы
const SIGN_SYMBOLS: Record<string, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋',
  leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏',
  sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};

// Маппинг планет на символы
const PLANET_SYMBOLS: Record<string, string> = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀',
  mars: '♂', jupiter: '♃', saturn: '♄',
};

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

// Цвета бейджей по планете
const PLANET_BADGE: Record<string, { bg: string; color: string }> = {
  sun:     { bg: '#FFFBEB', color: '#F59E0B' },
  moon:    { bg: '#F5F3FF', color: '#7C3AED' },
  mercury: { bg: '#EFF6FF', color: '#3B82F6' },
  venus:   { bg: '#FDF2F8', color: '#EC4899' },
  mars:    { bg: '#FEF2F2', color: '#EF4444' },
  jupiter: { bg: '#F0FDF4', color: '#10B981' },
  saturn:  { bg: '#F8FAFC', color: '#64748B' },
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
  onOpenPersonalDaily,
  onCreateNatalChart,
  onOpenOracle,
  onOpenSynastry,
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
  const [horoscopeOpen, setHoroscopeOpen] = useState(false);
  const [personalStoryOpen, setPersonalStoryOpen] = useState(false);

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

  /* Текст hero-карточки */
  const heroTitle = signReading?.summary
    ? signReading.summary.slice(0, 80)
    : language === 'ru' ? 'Заглядываем в звёзды…' : 'Reading the stars…';

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
      onClick: () => { lumiaSelectionHaptic(); setHoroscopeOpen(true); },
    },
    {
      id: 'synastry',
      icon: <HeartIcon />,
      label: language === 'ru' ? 'Союз' : 'Union',
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

      {/* ── Hero-карточка: гороскоп дня ── */}
      <FreshHeroCard
        color="coral"
        chipText={signNameRu}
        chipPosition="top-right"
        title={heroTitle}
        softText={language === 'ru' ? 'Пик 13:00' : 'Peak 13:00'}
        icon={<ZodiacIcon sign={selectedSign} size={88} strokeWidth={1.1} />}
        onClick={() => { lumiaSelectionHaptic(); setHoroscopeOpen(true); }}
        style={{ cursor: 'pointer' }}
      />

      {/* ── Быстрые кнопки ── */}
      <FreshQuickBar items={quickItems} />

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
            const badge = PLANET_BADGE[key] || { bg: '#F3F4F6', color: '#6B7280' };
            const houseTxt = houseLabel(planet.house, language);
            const signRu = SIGN_NAMES_RU[signKey] || planet.sign;
            const planetRu = PLANET_NAMES_RU[key] || planet.planet;
            return (
              <FreshListItem
                key={key}
                sign={PLANET_SYMBOLS[key]}
                title={language === 'ru' ? `${planetRu} в ${signRu}` : `${planet.planet} in ${planet.sign}`}
                subtitle={houseTxt ? `${houseTxt}${planet.description ? ' · ' + planet.description.slice(0, 40) : ''}` : planet.description?.slice(0, 50)}
                badgeText={SIGN_SYMBOLS[signKey] || ''}
                badgeBg={badge.bg}
                badgeColor={badge.color}
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
              {language === 'ru' ? 'Синастрия' : 'Synastry'}
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
      <HoroscopeStories
        open={horoscopeOpen}
        profile={profile}
        chartData={chartData}
        language={language}
        onClose={() => setHoroscopeOpen(false)}
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
