import React, { memo, useEffect, useMemo, useState } from 'react';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { getMoscowTodayKey, getMoscowIsoWeekKey, formatLumiaDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedWeeklySignHoroscope,
  ensureWeeklySignHoroscope,
} from '../../services/astrologyService';
import { saveProfile } from '../../services/storageService';
import { MonoArticleSection, MonoShareBar, MonoTag } from '../../components/mono-ui';
import { FreshHeroCard, FreshTabs, FreshSignCarousel } from '../../components/fresh-ui';
import { ZodiacIcon } from '../../components/icons/ZodiacIcon';
import { ChevronRightIcon } from '../../components/icons/UiIcons';
import { ZODIAC_KEYS, type ZodiacKey } from '../../lib/horoscope/signDaily';

const LOCAL_SIGN_KEY = 'lumia:selected-zodiac-sign';

type Period = 'today' | 'tomorrow' | 'week';

export type HoroscopeReaderProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalDaily?: () => void;
  onRequestPremium?: () => void;
};

/* +N дней к ключу даты YYYY-MM-DD (в UTC, чтобы не плыло) */
function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export const HoroscopeReader = memo<HoroscopeReaderProps>(({
  profile,
  chartData,
  chartId,
  onUpdateProfile,
  onOpenChart,
  onOpenPersonalDaily,
  onRequestPremium,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);

  const initialSign = useMemo(() => {
    const fromProfile = String(profile.selectedZodiacSign || chartData?.sun?.sign || '').trim();
    return ZODIAC_KEYS.find((s) => s.toLowerCase() === fromProfile.toLowerCase()) || ZODIAC_KEYS[0];
  }, [profile.selectedZodiacSign, chartData]);

  const [sign, setSign] = useState<ZodiacKey>(initialSign);
  const [period, setPeriod] = useState<Period>('today');
  const [reading, setReading] = useState<ForecastDailyReading | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setSign(initialSign); }, [initialSign]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setReading(null);
    const load = async (): Promise<ForecastDailyReading> => {
      if (period === 'week') {
        const wk = getMoscowIsoWeekKey();
        return (await getCachedWeeklySignHoroscope(sign, wk, language)) || ensureWeeklySignHoroscope(sign, wk, language);
      }
      const dateKey = period === 'tomorrow' ? addDaysKey(today, 1) : today;
      return (await getCachedDailySignHoroscope(sign, dateKey, language)) || ensureDailySignHoroscope(sign, dateKey, language);
    };
    void load()
      .then((result) => { if (alive) setReading(result); })
      .catch(() => { if (alive) setReading(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [language, sign, period, today]);

  const chooseSign = (picked: string) => {
    const normalized = ZODIAC_KEYS.find((s) => s.toLowerCase() === picked.toLowerCase());
    if (!normalized) return;
    lumiaSelectionHaptic();
    setSign(normalized);
    try { window.localStorage.setItem(LOCAL_SIGN_KEY, normalized); } catch { /* optional */ }
    const updated = { ...profile, selectedZodiacSign: normalized };
    onUpdateProfile?.(updated);
    if (updated.id) void saveProfile(updated).catch(() => undefined);
  };

  const signLabel = getZodiacSign(language, sign);

  const periodTabs = useMemo(() => ([
    { id: 'today', label: language === 'ru' ? 'Сегодня' : 'Today' },
    { id: 'tomorrow', label: language === 'ru' ? 'Завтра' : 'Tomorrow' },
    { id: 'week', label: language === 'ru' ? 'Неделя' : 'Week' },
  ]), [language]);

  const periodLabel = period === 'today'
    ? (language === 'ru' ? 'Сегодня' : 'Today')
    : period === 'tomorrow'
      ? (language === 'ru' ? 'Завтра' : 'Tomorrow')
      : (language === 'ru' ? 'Неделя' : 'This week');

  const periodDateLabel = period === 'week'
    ? (language === 'ru' ? 'На этой неделе' : 'This week')
    : formatLumiaDate(period === 'tomorrow' ? addDaysKey(today, 1) : today, language);

  /* Личный день — доступ по карте + Premium */
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);
  const personalSubtitle = !hasChart
    ? (language === 'ru' ? 'Создайте натальную карту' : 'Create a natal chart')
    : !premium
      ? (language === 'ru' ? 'Доступно в Premium' : 'Available in Premium')
      : (language === 'ru' ? 'Разбор вашего дня по карте' : 'Your day, read from your chart');
  const personalCta = !hasChart
    ? (language === 'ru' ? 'Создать карту' : 'Create chart')
    : !premium
      ? (language === 'ru' ? 'Открыть Premium' : 'Open Premium')
      : (language === 'ru' ? 'Открыть' : 'Open');

  const openPersonal = () => {
    lumiaSelectionHaptic();
    if (hasChart && premium) onOpenPersonalDaily?.();
    else if (!hasChart) onOpenChart?.();
    else onRequestPremium?.();
  };

  return (
    <div className="fresh-page">
      {/* Заголовок */}
      <div className="fresh-page-title-block">
        <div className="fresh-page-kicker">
          {language === 'ru' ? 'Гороскоп' : 'Horoscope'} · {periodLabel}
        </div>
        <div className="fresh-page-title">{signLabel}</div>
      </div>

      {/* Горизонтальная лента знаков */}
      <FreshSignCarousel signs={ZODIAC_KEYS} active={sign} language={language} onPick={chooseSign} />

      {/* Период */}
      <FreshTabs tabs={periodTabs} activeTab={period} onTabChange={(id) => { lumiaSelectionHaptic(); setPeriod(id as Period); }} />

      {/* Карточка-герой */}
      <FreshHeroCard
        color="sky"
        chipText={periodLabel}
        stickyText={reading?.headline || undefined}
        softText={periodDateLabel}
        icon={<ZodiacIcon sign={sign} size={80} strokeWidth={1.1} />}
      />

      {/* Текст разбора */}
      <article style={{ padding: '6px 20px 8px' }}>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--fresh-text)', margin: 0 }}>
          {loading ? (language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…') : reading?.summary}
        </p>

        {!loading && reading ? (
          <div className="space-y-4" style={{ marginTop: 24 }}>
            {reading.reading ? (
              <MonoArticleSection title={language === 'ru' ? 'Подробнее' : 'More'}>{reading.reading}</MonoArticleSection>
            ) : null}
            {reading.focus ? (
              <MonoArticleSection title={language === 'ru' ? 'Фокус' : 'Focus'}>{reading.focus}</MonoArticleSection>
            ) : null}
            {reading.chance ? (
              <MonoArticleSection title={language === 'ru' ? 'Шанс' : 'Opportunity'}>{reading.chance}</MonoArticleSection>
            ) : null}
            {reading.risk ? (
              <MonoArticleSection title={language === 'ru' ? 'Осторожно' : 'Watch out'}>{reading.risk}</MonoArticleSection>
            ) : null}
            {reading.advice?.length ? (
              <MonoArticleSection title={language === 'ru' ? 'Советы' : 'Advice'}>
                <ul className="space-y-2">
                  {reading.advice.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </MonoArticleSection>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <MonoTag>{signLabel}</MonoTag>
          <MonoTag>{periodLabel}</MonoTag>
        </div>
      </article>

      {/* Личный день — переехал сюда из натальной карты */}
      <div style={{ padding: '6px 20px 28px' }}>
        <button
          type="button"
          onClick={openPersonal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            background: 'var(--fresh-surface)',
            border: 'none',
            borderRadius: 'var(--fresh-radius-card)',
            padding: 16,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fresh-text)', marginBottom: 4 }}>
              {language === 'ru' ? 'Личный день' : 'Personal day'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fresh-muted)' }}>{personalSubtitle}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fresh-link)', marginTop: 8 }}>{personalCta} →</div>
          </div>
          <div style={{ color: 'var(--fresh-muted)', flexShrink: 0 }}><ChevronRightIcon size={20} /></div>
        </button>
      </div>

      <MonoShareBar
        label={language === 'ru' ? 'Поделиться' : 'Share'}
        withTabClearance
        onShare={() => {
          try {
            const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
              .Telegram?.WebApp;
            tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent('https://t.me/lumia_astrology_bot')}`);
          } catch {
            /* optional */
          }
        }}
      />
    </div>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
