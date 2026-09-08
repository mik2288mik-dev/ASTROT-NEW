import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { LayeredSurface } from './LayeredSurface';
import type { LayeredSurfaceController } from '../../lib/neboDesign/layeredSurface';
import { ZODIAC_ART_READY, zodiacHeroArtwork } from './zodiacArtwork';
import styles from './NeboZodiac.module.css';
import { NeboZodiacFuture } from './NeboZodiacFuture';
import { NeboZodiacExplore } from './NeboZodiacExplore';

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
  onOpenProfile?: () => void;
  uiPreview?: { readings: Record<Period, SignHoroscopeReadingV2>; phase?: 'ready' | 'loading' | 'error'; initialPeriod?: Period };
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
  return `${start} — ${end}`;
}

function signArt(sign: ZodiacKey): ArtName {
  return sign.toLowerCase() as ArtName;
}

export function NeboHoroscopeReader({ profile, chartData, onOpenCharts, onOpenProfile, onRequestPremium, uiPreview }: Props) {
  const preview = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1' ? uiPreview : undefined;
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
  const period: Period = preview?.initialPeriod || 'today';
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
  const local = useMemo(() => preview ? preview.phase && preview.phase !== 'ready' ? null : { ...preview.readings[period], sign: sign.toLowerCase(), periodKey: key } : readLocalSignHoroscope(period, sign, key, language), [period, sign, key, language, preview]);
  const stored = readings[readingKey];
  const reading = stored === undefined ? local : stored;
  const failed = preview?.phase === 'error' || stored === null && !local;
  const loading = !premiumLocked && !failed && !reading;

  useEffect(() => {
    if (premiumLocked || local || preview) return;
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
  }, [key, language, local, period, premiumLocked, readingKey, retryRevision, sign, preview]);

  const chooseSign = (next: ZodiacKey) => {
    lumiaSelectionHaptic();
    setSign(next);
  };
  const retry = () => {
    setReadings(current => { const next = { ...current }; delete next[readingKey]; return next; });
    setRetryRevision(value => value + 1);
  };
  const label = getZodiacSign(language, sign);
  const surface = useRef<LayeredSurfaceController | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => { strip.current?.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }); }, [sign]);

  const statusContent = premiumLocked ? <><h3>{ru ? 'Больше с NEBO+' : 'More with NEBO+'}</h3><p>{ru ? 'Прогнозы на неделю и месяц доступны с подпиской.' : 'Weekly and monthly forecasts are available with a subscription.'}</p><button className={styles.action} type="button" onClick={() => onRequestPremium?.(period === 'month' ? 'month' : 'week')}>{ru ? 'Открыть NEBO+' : 'Open NEBO+'}</button></>
    : failed ? <div role="alert"><h3>{ru ? 'Прогноз не загрузился' : 'Forecast unavailable'}</h3><button className={styles.action} type="button" onClick={retry}>{ru ? 'Повторить' : 'Try again'}</button></div>
    : loading ? <div className={styles.loading} aria-busy="true" aria-label={ru ? 'Загружаем прогноз' : 'Loading forecast'}><span/><span/><span/></div> : null;
  const back = <div className={styles.back}>
    <div className={styles.intro}><h1 className="sr-only">{ru ? 'Гороскоп по знакам зодиака' : 'Zodiac sign horoscope'}</h1>
    <p className={styles.subtitle}>{ru ? 'Выбери знак и прочитай прогноз' : 'Choose a sign and read your forecast'}</p>
    </div>
    <section className={styles.hero} aria-label={`${label} · ${PERIOD_LABELS[period][language]}`}>
      {ZODIAC_ART_READY.has(sign.toLowerCase()) ? <img key={sign} className={styles.heroImage} src={zodiacHeroArtwork(sign)} alt=""/> : <div className={styles.fallbackArt}><Art name={signArt(sign)} alt=""/></div>}
      <div className={styles.heroContent}>
        <div className={styles.heroIdentity}>
        <h2 className={styles.signTitle}>{label}</h2>
        <span className={styles.signRange}>{zodiacRange(sign, language)}</span>
        <time className={styles.readingDate}>{periodDate(period, reading?.periodKey || key, language)}</time>
        </div>
        <div className={styles.heroReading}>
        {statusContent || (reading ? <><h3 className={styles.readingHeadline}>{reading.headline}</h3><p className={styles.readingText}>{reading.text}</p></> : null)}
        </div>
      </div>
    </section>
    <div className={styles.signPicker}>
      <button className={styles.arrow} type="button" aria-label={ru ? 'Предыдущий знак' : 'Previous sign'} onClick={() => chooseSign(ZODIAC_KEYS[(ZODIAC_KEYS.indexOf(sign) + 11) % 12])}><Glyph name="back" size={18}/></button>
      <div className={styles.signStrip} ref={strip} role="group" aria-label={ru ? 'Знаки зодиака' : 'Zodiac signs'}>
        {ZODIAC_KEYS.map(item => <button className={styles.signChip} type="button" key={item} aria-pressed={item === sign} onClick={() => chooseSign(item)}><img className={styles.pickerArt} src={`/zodiac/sign_symbol_${item.toLowerCase()}.png`} width={42} height={42} alt=""/><small>{getZodiacSign(language, item)}</small></button>)}
      </div>
      <button className={styles.arrow} type="button" aria-label={ru ? 'Следующий знак' : 'Next sign'} onClick={() => chooseSign(ZODIAC_KEYS[(ZODIAC_KEYS.indexOf(sign) + 1) % 12])}><Glyph name="next" size={18}/></button>
    </div>
    <button className={styles.futureEntry} type="button" onClick={() => surface.current?.setPosition('expanded')}><span><strong>{ru ? 'А что дальше?' : 'What comes next?'}</strong><small>{ru ? 'Неделя, месяц и будущие даты' : 'Weeks, months and future dates'}</small></span><Glyph name="next" size={19}/></button>
    <NeboZodiacExplore sign={sign} language={language}/>
  </div>;
  return <div className={`nebo-screen ${styles.root}`}>
    <Header title={ru ? 'Зодиак' : 'Zodiac'} name={profile.name || ''} onPeople={onOpenCharts} onProfile={onOpenProfile || onOpenCharts}/>
    <LayeredSurface initial={{ position: 'collapsed', scrollTop: 0 }} collapsedPeek={48} controlRef={surface} back={back}>
      <h2 className={styles.sheetTitle}>{ru ? 'Будущее' : 'Future'} · {label}</h2>
      <p className={styles.sheetSubtitle}>{ru ? 'Прогнозы для твоего знака' : 'Forecasts for your sign'}</p>
      <NeboZodiacFuture profile={profile} sign={sign} preview={Boolean(preview)} onPremium={() => onRequestPremium?.('week')}/>
    </LayeredSurface>
  </div>;
}
