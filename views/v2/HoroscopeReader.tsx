import React, { memo, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { getMoscowTodayKey, getMoscowIsoWeekKey, getMoscowMonthKey, formatDisplayDate, formatWeekRangePretty, formatMonthPretty } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { canAccessFeature, hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedWeeklySignHoroscope,
  ensureWeeklySignHoroscope,
  getCachedMonthlySignHoroscope,
  ensureMonthlySignHoroscope,
} from '../../services/astrologyService';
import { shareToTelegram } from '../../lib/botLink';
import { FreshTabs, InfoNote, ZodiacSignGrid } from '../../components/fresh-ui';
import { ZodiacIllustration } from '../../components/icons/ZodiacArt';
import { ChevronRightIcon } from '../../components/icons/UiIcons';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { ZODIAC_KEYS, type ZodiacKey } from '../../lib/zodiacKeys';
import { getZodiacEditorialSticker } from '../../lib/personalForecastVisuals';
import { EditorialSticker } from '../../components/EditorialSticker';
import {
  EditorialBulletText,
  EditorialEvidence,
  EditorialProse,
  EditorialSectionHeading,
  EditorialSummary,
} from '../../components/EditorialReading';

type Period = 'today' | 'week' | 'month';

export type HoroscopeReaderProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalForecast?: () => void;
  onRequestPremium?: () => void;
};

/* Цвет карточки по стихии знака в единой серо-синей палитре */
const ELEMENT_COLOR: Record<string, string> = {
  aries: '#F3F4F6', leo: '#EEF2F7', sagittarius: '#E8EEF7',
  taurus: '#F3F4F6', virgo: '#EEF2F7', capricorn: '#E8EEF7',
  gemini: '#EFF6FF', libra: '#EAF2FF', aquarius: '#E5EFFB',
  cancer: '#F4F7FB', scorpio: '#EDF2F8', pisces: '#E8EEF7',
};

/* Понедельник недели для ключа даты — отдельный ключ вовлечённости для периода «неделя» */
function mondayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = (dt.getUTCDay() + 6) % 7; // 0 = понедельник
  dt.setUTCDate(dt.getUTCDate() - wd);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export const HoroscopeReader = memo<HoroscopeReaderProps>(({
  profile,
  chartData,
  chartId,
  onOpenChart,
  onOpenPersonalForecast,
  onRequestPremium,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const reduce = useReducedMotion();

  // Свой знак считаем от ДАТЫ РОЖДЕНИЯ — как и везде в приложении (онбординг, дом),
  // чтобы гороскоп не открывался на чужом знаке из устаревшего selectedZodiacSign/карты.
  const ownSign = useMemo(() => {
    const fromBirth = profile.birthDate ? (sunSignFromDate(profile.birthDate) || '') : '';
    return (
      fromBirth ||
      (chartData?.sun?.sign ? String(chartData.sun.sign) : '') ||
      String(profile.selectedZodiacSign || ZODIAC_KEYS[0])
    ).toLowerCase();
  }, [profile.birthDate, chartData, profile.selectedZodiacSign]);

  // Гороскоп всегда открывается на своём знаке.
  const initialIndex = useMemo(() => {
    const idx = ZODIAC_KEYS.findIndex((s) => s.toLowerCase() === ownSign);
    return idx >= 0 ? idx : 0;
  }, [ownSign]);

  const [signIndex, setSignIndex] = useState(initialIndex);
  const [hasReaderSelection, setHasReaderSelection] = useState(false);
  const [period, setPeriod] = useState<Period>('today');
  const [readings, setReadings] = useState<Record<string, ForecastDailyReading | null>>({});
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    setSignIndex(initialIndex);
    setHasReaderSelection(false);
  }, [initialIndex]);

  const sign = ZODIAC_KEYS[signIndex] as ZodiacKey;
  const keyOf = (s: string, p: Period) => `${s.toLowerCase()}|${p}`;
  const currentKey = keyOf(sign, period);
  const reading = readings[currentKey];

  const premium = hasActivePremium(profile);
  const periodLocked = period !== 'today'
    && !canAccessFeature('weekly_sign_horoscope', profile, null).allowed;
  const loading = hasReaderSelection && !periodLocked && reading === undefined;

  /* Тап по знаку загружает только выбранный разбор, без префетча остальных 11. */
  useEffect(() => {
    if (!hasReaderSelection || periodLocked) return;
    let alive = true;
    const loadFor = async (s: string, p: Period) => {
      const kk = keyOf(s, p);
      let already = false;
      setReadings((prev) => { already = kk in prev; return prev; });
      if (already) return;
      try {
        const r = p === 'week'
          ? (await getCachedWeeklySignHoroscope(s, getMoscowIsoWeekKey(), language)) || await ensureWeeklySignHoroscope(s, getMoscowIsoWeekKey(), language)
          : p === 'month'
            ? (await getCachedMonthlySignHoroscope(s, getMoscowMonthKey(), language)) || await ensureMonthlySignHoroscope(s, getMoscowMonthKey(), language)
            : (await getCachedDailySignHoroscope(s, today, language)) || await ensureDailySignHoroscope(s, today, language);
        if (alive) setReadings((prev) => ({ ...prev, [kk]: r }));
      } catch {
        if (alive) setReadings((prev) => ({ ...prev, [kk]: null }));
      }
    };
    void loadFor(sign, period);
    return () => { alive = false; };
  }, [sign, period, language, today, hasReaderSelection, periodLocked, loadRevision]);

  const chooseSign = (picked: string) => {
    const idx = ZODIAC_KEYS.findIndex((s) => s.toLowerCase() === picked.toLowerCase());
    if (idx < 0) return;
    lumiaSelectionHaptic();
    setSignIndex(idx);
    setHasReaderSelection(true);
  };

  const retryCurrent = () => {
    lumiaSelectionHaptic();
    setReadings((prev) => {
      const next = { ...prev };
      delete next[currentKey];
      return next;
    });
    setLoadRevision((value) => value + 1);
  };

  const signLabel = getZodiacSign(language, sign);

  const periodTabs = useMemo(() => ([
    { id: 'today', label: language === 'ru' ? 'Сегодня' : 'Today' },
    { id: 'week', label: language === 'ru' ? 'Неделя' : 'Week' },
    { id: 'month', label: language === 'ru' ? 'Месяц' : 'Month' },
  ]), [language]);

  /* Дата/период для шапки */
  const dateLine = useMemo(() => {
    if (period === 'week') return formatWeekRangePretty(getMoscowIsoWeekKey(), language);
    if (period === 'month') return formatMonthPretty(getMoscowMonthKey(), language);
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    const wd = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { timeZone: 'UTC', weekday: 'long' }).format(dt);
    return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${formatDisplayDate(today, language)}`;
  }, [period, today, language]);

  /* Тег для цветной карточки: дата (сегодня) / диапазон недели / месяц */
  const periodTag = useMemo(() => {
    if (period === 'week') return formatWeekRangePretty(getMoscowIsoWeekKey(), language);
    if (period === 'month') return formatMonthPretty(getMoscowMonthKey(), language);
    return formatDisplayDate(today, language);
  }, [period, today, language]);

  /* Личный гороскоп — доступ по карте + Premium */
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const personalSubtitle = !hasChart
    ? (language === 'ru' ? 'Сначала создай натальную карту: личный прогноз использует дату, время и место рождения.' : 'Create a natal chart first: the personal forecast uses birth date, time, and place.')
    : !premium
      ? (language === 'ru' ? 'Личный прогноз по натальной карте доступен в Premium.' : 'The personal forecast based on your natal chart is available with Premium.')
      : (language === 'ru' ? 'Личный прогноз рассчитан по твоей натальной карте и выбранному периоду.' : 'The personal forecast uses your natal chart and selected period.');
  const personalCta = !hasChart
    ? (language === 'ru' ? 'Создать карту' : 'Create chart')
    : !premium
      ? (language === 'ru' ? 'Открыть Premium' : 'Open Premium')
      : (language === 'ru' ? 'Открыть' : 'Open');
  const zodiacSticker = useMemo(() => getZodiacEditorialSticker(sign), [sign]);

  const openPersonal = () => {
    lumiaSelectionHaptic();
    if (hasChart && premium) onOpenPersonalForecast?.();
    else if (!hasChart) onOpenChart?.();
    else onRequestPremium?.();
  };

  /* Поделиться — короткая зазывалка (главное + приглашение), а не весь текст */
  const shareReading = () => {
    const hook = reading?.headline || (language === 'ru' ? 'Главное на выбранный период' : 'The main point for this period');
    const text = language === 'ru'
      ? `Гороскоп · ${signLabel}\n«${hook}»\n\nУзнай свой в «Твой Гороскоп» — по дате рождения, бесплатно.`
      : `Horoscope · ${signLabel}\n“${hook}”\n\nGet yours in Your Horoscope — by birth date, free.`;
    shareToTelegram(text);
  };

  return (
    <div className="fresh-page horo-reader-page">
      <AppTopBar title={language === 'ru' ? 'Гороскоп' : 'Horoscope'} subtitle={dateLine} />

      <div className="horo-reader-controls">
        <ZodiacSignGrid
          signs={ZODIAC_KEYS}
          active={sign}
          ownSign={ownSign}
          language={language}
          onPick={chooseSign}
        />

        {hasReaderSelection ? (
          <FreshTabs
            className="horo-period-tabs"
            tabs={periodTabs}
            activeTab={period}
            onTabChange={(id) => {
              lumiaSelectionHaptic();
              setPeriod(id as Period);
            }}
          />
        ) : null}
      </div>

      <div className="horo-uni-wrap">
        <AnimatePresence initial={false} mode="wait">
          {hasReaderSelection ? (
            <motion.div
              key={currentKey}
              className="horo-uni horo-reader-article"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: reduce ? 0.08 : 0.18, ease: 'easeOut' }}
            >
              <div
                className="horo-uni-hero"
                style={{ backgroundColor: ELEMENT_COLOR[sign.toLowerCase()] || 'var(--fresh-sky)', backgroundImage: 'none' }}
              >
                {zodiacSticker ? (
                  <EditorialSticker
                    asset={zodiacSticker}
                    className="horo-zodiac-sticker"
                    priority
                  />
                ) : (
                  <ZodiacIllustration sign={sign} className="horo-hero-illus" />
                )}
                <div className="horo-hero-glyph" aria-hidden>
                  <div className="horo-hero-date">{periodTag}</div>
                </div>
                <div className="horo-hero-stack">
                  <div className="fresh-sticky horo-reader-headline">
                    {!periodLocked
                      ? (reading?.headline || (
                          reading === null
                            ? (language === 'ru' ? 'Не удалось загрузить' : 'Could not load')
                            : (language === 'ru' ? 'Готовим разбор…' : 'Preparing…')
                        ))
                      : signLabel}
                  </div>
                </div>
              </div>
              <div className="horo-uni-body horo-reader-reading">
                {periodLocked ? (
                  <div className="horo-lock">
                    <div className="horo-lock-title">
                      {period === 'week'
                        ? (language === 'ru' ? 'Гороскоп на неделю — в Premium' : 'Weekly horoscope — Premium')
                        : (language === 'ru' ? 'Гороскоп на месяц — в Premium' : 'Monthly horoscope — Premium')}
                    </div>
                    <p className="horo-lock-text">
                      {language === 'ru'
                        ? 'Сегодня доступны все 12 знаков бесплатно. Неделя и месяц открываются в Premium.'
                        : 'All 12 signs are free today. Week and month open in Premium.'}
                    </p>
                    {onRequestPremium ? (
                      <button
                        type="button"
                        className="fresh-btn-primary"
                        style={{ marginTop: 12, width: '100%' }}
                        onClick={() => {
                          lumiaSelectionHaptic();
                          onRequestPremium();
                        }}
                      >
                        {language === 'ru' ? 'Открыть Premium' : 'Open Premium'}
                      </button>
                    ) : null}
                  </div>
                ) : reading === null ? (
                  <div className="horo-lock">
                    <div className="horo-lock-title">
                      {language === 'ru' ? 'Разбор не загрузился' : 'The reading did not load'}
                    </div>
                    <p className="horo-lock-text">
                      {language === 'ru'
                        ? 'Попробуй ещё раз — повторно загрузится только выбранный знак и период.'
                        : 'Try again — only the selected sign and period will be requested.'}
                    </p>
                    <button
                      type="button"
                      className="fresh-btn-primary"
                      style={{ marginTop: 12, width: '100%' }}
                      onClick={retryCurrent}
                    >
                      {language === 'ru' ? 'Повторить' : 'Try again'}
                    </button>
                  </div>
                ) : (
                  <>
                    {loading ? (
                      <p className="horo-uni-summary">
                        {language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…'}
                      </p>
                    ) : reading ? (
                      <div className="editorial-reading-flow horo-editorial-flow">
                        <EditorialSummary label={language === 'ru' ? 'Главный вывод' : 'Main takeaway'} className="horo-editorial-intro">
                          <p>{reading.summary}</p>
                        </EditorialSummary>

                        {reading.reading ? (
                          <section className="editorial-reading-section">
                            <EditorialSectionHeading
                              title={language === 'ru' ? 'Что происходит' : 'What is happening'}
                            />
                            <EditorialProse text={reading.reading} />
                          </section>
                        ) : null}

                        {reading.chance || reading.risk ? (
                          <section className="editorial-reading-section">
                            <EditorialSectionHeading
                              title={language === 'ru' ? 'Где шанс, где риск' : 'Opportunity and risk'}
                            />
                            <ul className="editorial-reading-list editorial-reading-list--leads">
                              {reading.chance ? (
                                <li>
                                  <strong>{language === 'ru' ? 'Шанс.' : 'Opportunity.'}</strong>
                                  <span>{reading.chance}</span>
                                </li>
                              ) : null}
                              {reading.risk ? (
                                <li>
                                  <strong>{language === 'ru' ? 'Риск.' : 'Risk.'}</strong>
                                  <span>{reading.risk}</span>
                                </li>
                              ) : null}
                            </ul>
                          </section>
                        ) : null}

                        {reading.advice?.length ? (
                          <section className="editorial-reading-section horo-uni-advice">
                            <EditorialSectionHeading
                              title={language === 'ru' ? 'Что делать' : 'What to do'}
                            />
                            <ul className="editorial-reading-list">
                              {reading.advice.slice(0, 3).map((item) => (
                                <li key={item}><EditorialBulletText text={item} /></li>
                              ))}
                            </ul>
                          </section>
                        ) : null}

                        {reading.context ? (
                          <EditorialEvidence label={language === 'ru' ? 'Основа разбора' : 'Basis of the reading'}>
                            <p>{reading.context}</p>
                          </EditorialEvidence>
                        ) : null}

                        {reading.focus ? (
                          <EditorialSummary label={language === 'ru' ? 'Итог' : 'Bottom line'} className="horo-editorial-final">
                            <p>{reading.focus}</p>
                          </EditorialSummary>
                        ) : null}
                      </div>
                    ) : null}
                    {!loading && reading ? (
                      <HoroscopeActivityBar
                        userId={profile.id ? String(profile.id) : undefined}
                        sign={sign}
                        date={period === 'week' ? mondayKey(today) : period === 'month' ? `${getMoscowMonthKey()}-01` : today}
                        period={period}
                        language={language}
                        onShare={shareReading}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {hasReaderSelection ? (
        <>
          <div className="horo-reader-info">
            <InfoNote title={language === 'ru' ? 'На чём основан гороскоп?' : 'What is this based on?'}>
              {language === 'ru'
                ? 'Это общий гороскоп по знаку Солнца — один ориентир на период для всех с этим знаком. Гороскоп по твоей дате, времени и месту рождения — в разделе «Личный гороскоп».'
                : 'This is a general horoscope for your Sun sign — one shared cue for everyone with that sign. A horoscope based on your exact birth data is in “Personal Horoscope”.'}
            </InfoNote>
          </div>

          <button type="button" className="horo-premium horo-reader-personal" onClick={openPersonal}>
            <div className="horo-premium-text">
              <div className="horo-premium-kicker">{language === 'ru' ? 'Личный гороскоп' : 'Personal Horoscope'}</div>
              <div className="horo-premium-title">{personalSubtitle}</div>
            </div>
            <span className="horo-premium-cta">{personalCta}<ChevronRightIcon size={15} /></span>
          </button>
        </>
      ) : null}
    </div>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
