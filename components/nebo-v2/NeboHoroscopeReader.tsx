import React, { useEffect, useMemo, useState } from 'react';
import type { NatalChartData, SignHoroscopeReadingV2, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import {
  formatDisplayDate,
  formatMonthPretty,
  formatWeekRangePretty,
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
} from '../../lib/date-utils';
import { APPROXIMATE_SUN_SIGN_DATES } from '../../lib/zodiac-utils';
import { normalizeZodiacKey, ZODIAC_KEYS, type ZodiacKey } from '../../lib/zodiacKeys';
import { canAccessFeature } from '../../lib/accessMatrix';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  ensureDailySignHoroscope,
  ensureMonthlySignHoroscope,
  ensureWeeklySignHoroscope,
  readLocalSignHoroscope,
} from '../../services/astrologyService';
import { Art, Glyph, Header, type ArtName } from './Primitives';

type Period = 'today' | 'week' | 'month';

type Props = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalForecast?: () => void;
  onOpenCharts?: () => void;
  onRequestPremium?: (period: Exclude<Period, 'today'>) => void;
};

const PERIOD_LABELS: Record<Period, { ru: string; en: string }> = {
  today: { ru: 'Сегодня', en: 'Today' },
  week: { ru: 'Неделя', en: 'Week' },
  month: { ru: 'Месяц', en: 'Month' },
};

function periodDate(period: Period, key: string, language: 'ru' | 'en') {
  if (period === 'week') return formatWeekRangePretty(key, language);
  if (period === 'month') return formatMonthPretty(key, language);
  return formatDisplayDate(key, language);
}

function zodiacRange(sign: ZodiacKey, language: 'ru' | 'en') {
  const range = APPROXIMATE_SUN_SIGN_DATES[sign];
  const fmt = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { day:'numeric', month:'long', timeZone:'UTC' });
  const boundary = (month: number, day: number) => fmt.format(new Date(Date.UTC(2024, month - 1, day)));
  const start = boundary(range.startMonth, range.startDay);
  const end = boundary(range.endMonth, range.endDay);
  return language === 'ru' ? `${start} — ${end}` : `${start} — ${end}`;
}

function signArt(sign: ZodiacKey): ArtName {
  return sign.toLowerCase() as ArtName;
}

export function NeboHoroscopeReader({ profile, chartData, onOpenCharts, onRequestPremium }: Props) {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const [today, setToday] = useState(() => getMoscowTodayKey());
  const detectedSign = useMemo(() => {
    return normalizeZodiacKey(String(chartData?.sun?.sign || ''))
      || normalizeZodiacKey(profile.birthDate ? sunSignFromDate(profile.birthDate) || '' : '')
      || normalizeZodiacKey(String(profile.selectedZodiacSign || ''))
      || ZODIAC_KEYS[0];
  }, [chartData?.sun?.sign, profile.birthDate, profile.selectedZodiacSign]);
  const [sign, setSign] = useState<ZodiacKey>(detectedSign as ZodiacKey);
  const [period, setPeriod] = useState<Period>('today');
  const [readings, setReadings] = useState<Record<string, SignHoroscopeReadingV2 | null | undefined>>({});
  const [retryRevision, setRetryRevision] = useState(0);

  useEffect(() => setSign(detectedSign as ZodiacKey), [detectedSign]);
  useEffect(() => {
    const refresh = () => setToday(getMoscowTodayKey());
    const timer = window.setInterval(refresh, 60_000);
    const visibility = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  const weekKey = useMemo(() => getMoscowIsoWeekKey(), [today]);
  const monthKey = useMemo(() => getMoscowMonthKey(), [today]);
  const key = period === 'week' ? weekKey : period === 'month' ? monthKey : today;
  const readingKey = `${sign}|${period}|${key}|${language}`;
  const premiumLocked = period !== 'today' && !canAccessFeature('weekly_sign_horoscope', profile, chartData).allowed;
  const local = useMemo(() => readLocalSignHoroscope(period, sign, key, language), [period, sign, key, language]);
  const stored = readings[readingKey];
  const reading = stored === undefined ? local : stored;
  const failed = stored === null && !local;
  const loading = !premiumLocked && !failed && !reading;

  useEffect(() => {
    if (premiumLocked || local) return;
    let active = true;
    const load = async () => {
      try {
        const value = period === 'week'
          ? await ensureWeeklySignHoroscope(sign, key, language)
          : period === 'month'
            ? await ensureMonthlySignHoroscope(sign, key, language)
            : await ensureDailySignHoroscope(sign, key, language);
        if (active) setReadings(current => ({ ...current, [readingKey]: value }));
      } catch {
        if (active) setReadings(current => ({ ...current, [readingKey]: null }));
      }
    };
    void load();
    return () => { active = false; };
  }, [key, language, local, period, premiumLocked, readingKey, retryRevision, sign]);

  const chooseSign = (next: ZodiacKey) => {
    lumiaSelectionHaptic();
    setSign(next);
  };
  const choosePeriod = (next: Period) => {
    lumiaSelectionHaptic();
    setPeriod(next);
  };
  const retry = () => {
    setReadings(current => { const next = { ...current }; delete next[readingKey]; return next; });
    setRetryRevision(value => value + 1);
  };
  const label = getZodiacSign(language, sign);

  return <div className="nebo-screen nebo-zodiac-screen">
    <Header name={profile.name || ''} onProfile={onOpenCharts}/>
    <div className="nebo-reader-scroll nebo-zodiac-scroll">
      <h1>{ru ? 'Гороскоп по знакам' : 'Sign horoscope'}</h1>
      <p className="nebo-zodiac-subtitle">{ru ? 'Выбери знак и период — прогноз откроется здесь.' : 'Choose a sign and period to read its forecast.'}</p>

      <section className="nebo-zodiac-hero">
        <div><strong>{label}</strong><span>{zodiacRange(sign, language)}</span>{reading ? <p>{reading.headline}</p> : null}</div>
        <Art name={signArt(sign)} alt={label}/>
      </section>

      <div className="nebo-zodiac-strip" role="list" aria-label={ru ? 'Знаки зодиака' : 'Zodiac signs'}>
        {ZODIAC_KEYS.map(item => {
          const itemLabel = getZodiacSign(language, item as ZodiacKey);
          return <button type="button" role="listitem" key={item} aria-pressed={item === sign} onClick={() => chooseSign(item as ZodiacKey)}>
            <Art name={signArt(item as ZodiacKey)} alt=""/><small>{itemLabel}</small>
          </button>;
        })}
      </div>

      <div className="nebo-periods nebo-zodiac-periods" role="tablist" aria-label={ru ? 'Период' : 'Period'}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(item => <button type="button" role="tab" aria-selected={period === item} aria-pressed={period === item} key={item} onClick={() => choosePeriod(item)}>{PERIOD_LABELS[item][language]}</button>)}
      </div>

      {premiumLocked ? <section className="nebo-zodiac-reading nebo-tone-peach">
        <Art name="premium"/><div><h2>{ru ? `Прогноз на ${period === 'week' ? 'неделю' : 'месяц'}` : `${PERIOD_LABELS[period].en} forecast`}</h2><p>{ru ? 'Открой Premium, чтобы читать этот период.' : 'Open Premium to read this period.'}</p><button type="button" className="nebo-primary" onClick={() => onRequestPremium?.(period as Exclude<Period,'today'>)}>{ru ? 'Открыть Premium' : 'Open Premium'}</button></div>
      </section> : failed ? <section className="nebo-zodiac-reading" role="alert"><h2>{ru ? 'Прогноз не загрузился' : 'Forecast unavailable'}</h2><button type="button" className="nebo-primary" onClick={retry}>{ru ? 'Повторить' : 'Try again'}</button></section> : loading ? <section className="nebo-zodiac-reading" aria-busy="true"><div className="nebo-zodiac-skeleton"/><div className="nebo-zodiac-skeleton nebo-zodiac-skeleton--wide"/></section> : reading ? <section className="nebo-zodiac-reading">
        <div className="nebo-zodiac-reading-head"><Art name="today"/><span><strong>{period === 'today' ? (ru ? `Сегодня для ${label}` : `Today for ${label}`) : reading.headline}</strong><small>{periodDate(period, reading.periodKey || key, language)}</small></span></div>
        <h2>{reading.headline}</h2><p>{reading.text}</p>
      </section> : null}

      <div className="nebo-zodiac-hints"><div className="nebo-tone-lime"><strong>{ru ? 'Смотреть проще' : 'Keep it simple'}</strong><small>{ru ? 'Прогноз — ориентир, а не команда.' : 'A forecast is context, not an order.'}</small></div><div className="nebo-tone-pink"><strong>{ru ? 'Без лишней мистики' : 'No extra mysticism'}</strong><small>{ru ? 'Читай как обычный прогноз на период.' : 'Read it as a simple period forecast.'}</small></div></div>
    </div>
  </div>;
}
