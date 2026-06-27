import React, { memo, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { FreshInnerHeader } from '../../components/fresh-ui/FreshHeaders';
import { getMoscowTodayKey, getMoscowIsoWeekKey, getMoscowMonthKey, formatLumiaDate, formatWeekRangePretty, formatMonthPretty } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedWeeklySignHoroscope,
  ensureWeeklySignHoroscope,
  getCachedMonthlySignHoroscope,
  ensureMonthlySignHoroscope,
} from '../../services/astrologyService';
import { saveProfile } from '../../services/storageService';
import { shareToTelegram } from '../../lib/botLink';
import { FreshTabs, FreshSignCarousel, InfoNote } from '../../components/fresh-ui';
import { ZodiacIcon } from '../../components/icons/ZodiacIcon';
import { ChevronRightIcon } from '../../components/icons/UiIcons';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { ZODIAC_KEYS, type ZodiacKey } from '../../lib/horoscope/signDaily';

const LOCAL_SIGN_KEY = 'lumia:selected-zodiac-sign';

/* Дневная квота «других» знаков: бесплатно 1, в Premium 3 (свой знак всегда доступен).
   Знаки открываются по тапу — без авто-префетча, чтобы не жечь API. */
const HORO_EXTRA_KEY = 'lumia:horo-extra-signs';
const FREE_EXTRA_QUOTA = 1;
// Премиум — все знаки без лимита (11 чужих + свой = 12); квота 12 фактически не упирается.
const PREMIUM_EXTRA_QUOTA = 12;

function readExtraSigns(today: string): string[] {
  try {
    const raw = window.localStorage.getItem(HORO_EXTRA_KEY);
    if (!raw) return [];
    const obj = JSON.parse(raw);
    return obj && obj.date === today && Array.isArray(obj.signs) ? obj.signs.map((s: unknown) => String(s)) : [];
  } catch { return []; }
}

function writeExtraSigns(today: string, signs: string[]) {
  try { window.localStorage.setItem(HORO_EXTRA_KEY, JSON.stringify({ date: today, signs })); } catch { /* optional */ }
}

/* Свой знак тоже открывается ТОЛЬКО по кнопке — без авто-генерации при входе на экран
   (экономим API/деньги). Запоминаем на текущий день, чтобы при возврате не жать снова. */
const HORO_OWN_OPENED_KEY = 'lumia:horo-own-opened';

function readOwnOpened(today: string, sign: string): boolean {
  try {
    const raw = window.localStorage.getItem(HORO_OWN_OPENED_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    return !!obj && obj.date === today && String(obj.sign) === sign;
  } catch { return false; }
}

function writeOwnOpened(today: string, sign: string) {
  try { window.localStorage.setItem(HORO_OWN_OPENED_KEY, JSON.stringify({ date: today, sign })); } catch { /* optional */ }
}

type Period = 'today' | 'week' | 'month';

export type HoroscopeReaderProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalDaily?: () => void;
  onRequestPremium?: () => void;
};

/* Цвет карточки по стихии знака (без космоса — просто палитра) */
const ELEMENT_COLOR: Record<string, string> = {
  aries: 'var(--fresh-coral)', leo: 'var(--fresh-coral)', sagittarius: 'var(--fresh-coral)',
  taurus: 'var(--fresh-mint)', virgo: 'var(--fresh-mint)', capricorn: 'var(--fresh-mint)',
  gemini: 'var(--fresh-sky)', libra: 'var(--fresh-sky)', aquarius: 'var(--fresh-sky)',
  cancer: 'var(--fresh-lavender)', scorpio: 'var(--fresh-lavender)', pisces: 'var(--fresh-lavender)',
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

const cardVariants = {
  enter: (d: number) => ({ x: d > 0 ? 300 : d < 0 ? -300 : 0, opacity: 0, rotate: d > 0 ? 5 : d < 0 ? -5 : 0 }),
  center: { x: 0, opacity: 1, rotate: 0 },
  exit: (d: number) => ({ x: d > 0 ? -300 : d < 0 ? 300 : 0, opacity: 0, rotate: d > 0 ? -5 : d < 0 ? 5 : 0 }),
};

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
  const [dir, setDir] = useState(0);
  const [period, setPeriod] = useState<Period>('today');
  const [readings, setReadings] = useState<Record<string, ForecastDailyReading | null>>({});

  useEffect(() => { setSignIndex(initialIndex); }, [initialIndex]);

  const sign = ZODIAC_KEYS[signIndex] as ZodiacKey;
  const keyOf = (s: string, p: Period) => `${s.toLowerCase()}|${p}`;
  const currentKey = keyOf(sign, period);
  const reading = readings[currentKey];

  /* ── Доступ к знакам: свой знак всегда; «другие» — по дневной квоте, открываются КНОПКОЙ ── */
  const premium = hasActivePremium(profile);
  const extraQuota = premium ? PREMIUM_EXTRA_QUOTA : FREE_EXTRA_QUOTA;
  const [openedSigns, setOpenedSigns] = useState<string[]>(() => readExtraSigns(today));
  // Свой знак открыт сегодня? (по кнопке, без авто-генерации при входе)
  const [ownOpened, setOwnOpened] = useState<boolean>(() => readOwnOpened(today, ownSign));
  useEffect(() => { setOwnOpened(readOwnOpened(today, ownSign)); }, [today, ownSign]);

  const current = sign.toLowerCase();
  const isOwnSign = current === ownSign;
  const isOpened = (isOwnSign && ownOpened) || openedSigns.includes(current);
  const canOpenExtra = openedSigns.length < extraQuota;
  // Свой знак можно открыть всегда (бесплатно); чужой — пока есть дневная квота.
  const canOpen = isOwnSign || canOpenExtra;
  const signState: 'open' | 'can-open' | 'locked' = isOpened ? 'open' : canOpen ? 'can-open' : 'locked';

  // Free: только «Сегодня». Неделя и месяц — премиум.
  const periodLocked = !premium && period !== 'today';

  /* Открыть гороскоп по кнопке — никакого авто-фетча/авто-генерации (экономим API/деньги).
     Свой знак — бесплатно; чужой — тратит дневную квоту. */
  const openCurrent = () => {
    if (isOpened) return;
    if (isOwnSign) {
      lumiaSelectionHaptic();
      setOwnOpened(true);
      writeOwnOpened(today, ownSign);
      return;
    }
    if (!canOpenExtra) return;
    lumiaSelectionHaptic();
    const next = [...openedSigns, current];
    setOpenedSigns(next);
    writeExtraSigns(today, next);
  };

  const loading = isOpened && reading === undefined;

  /* Загружаем только открытый знак и только текущий (без префетча соседей). */
  useEffect(() => {
    if (!isOpened || periodLocked) return;
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
  }, [sign, period, language, today, isOpened, periodLocked]);

  const goToIndex = (next: number, direction: number) => {
    lumiaSelectionHaptic();
    setDir(direction);
    const idx = (next + 12) % 12;
    setSignIndex(idx);
    const normalized = ZODIAC_KEYS[idx];
    // Сохраняем выбранный знак как «основной» только для премиума или для своего знака,
    // чтобы бесплатный просмотр чужого знака не подменял знак на главной.
    if (premium || normalized.toLowerCase() === ownSign) {
      try { window.localStorage.setItem(LOCAL_SIGN_KEY, normalized); } catch { /* optional */ }
      const updated = { ...profile, selectedZodiacSign: normalized };
      onUpdateProfile?.(updated);
      if (updated.id) void saveProfile(updated).catch(() => undefined);
    }
  };

  const paginate = (delta: number) => goToIndex(signIndex + delta, delta);

  const chooseSign = (picked: string) => {
    const idx = ZODIAC_KEYS.findIndex((s) => s.toLowerCase() === picked.toLowerCase());
    if (idx < 0 || idx === signIndex) return;
    goToIndex(idx, idx > signIndex ? 1 : -1);
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const power = info.offset.x + info.velocity.x * 0.2;
    if (power < -70) paginate(1);
    else if (power > 70) paginate(-1);
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
    return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${formatLumiaDate(today, language)}`;
  }, [period, today, language]);

  /* Тег для цветной карточки: дата (сегодня) / диапазон недели / месяц */
  const periodTag = useMemo(() => {
    if (period === 'week') return formatWeekRangePretty(getMoscowIsoWeekKey(), language);
    if (period === 'month') return formatMonthPretty(getMoscowMonthKey(), language);
    return formatLumiaDate(today, language);
  }, [period, today, language]);

  /* Личный день — доступ по карте + Premium */
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
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

  /* Поделиться — короткая зазывалка (главное + приглашение), а не весь текст */
  const shareReading = () => {
    const hook = reading?.headline || (language === 'ru' ? 'Узнай, что тебя ждёт' : 'See what is ahead');
    const text = language === 'ru'
      ? `Гороскоп · ${signLabel}\n«${hook}»\n\nУзнай свой в Lumia — по дате рождения, бесплатно.`
      : `Horoscope · ${signLabel}\n“${hook}”\n\nGet yours in Lumia — by birth date, free.`;
    shareToTelegram(text);
  };

  return (
    <div className="fresh-page">
      {/* Единый верх (как на всех экранах). Знак НЕ дублируем — он в селекторе и на карточке. */}
      <FreshInnerHeader title={language === 'ru' ? 'Гороскоп' : 'Horoscope'} subtitle={dateLine} />

      {/* Личный день — премиум, наверху */}
      <button type="button" className="horo-premium" onClick={openPersonal}>
        <div className="horo-premium-text">
          <div className="horo-premium-kicker">{language === 'ru' ? 'Личный день' : 'Personal day'}</div>
          <div className="horo-premium-title">{personalSubtitle}</div>
        </div>
        <span className="horo-premium-cta">{personalCta}<ChevronRightIcon size={15} /></span>
      </button>

      {/* Лента знаков — селектор: тап по любому знаку (активный по центру) */}
      <FreshSignCarousel signs={ZODIAC_KEYS} active={sign} language={language} onPick={chooseSign} />

      {/* Период */}
      <FreshTabs
        tabs={periodTabs}
        activeTab={period}
        onTabChange={(id) => { lumiaSelectionHaptic(); setDir(0); setPeriod(id as Period); }}
      />

      <div style={{ padding: '0 20px' }}>
        <InfoNote title={language === 'ru' ? 'На чём основан гороскоп?' : 'What is this based on?'}>
          {language === 'ru'
            ? 'Это общий гороскоп по знаку Солнца — один ориентир на период для всех с этим знаком. Личный разбор по твоей дате, времени и месту рождения — в разделе «Личный день».'
            : 'This is a general horoscope for your Sun sign — one shared cue for everyone with that sign. A personal reading from your exact birth data is in "Personal day".'}
        </InfoNote>
      </div>

      {/* Единая свайп-карточка: весь гороскоп + советы вместе (свайп ← → меняет знак) */}
      <div className="horo-uni-wrap">
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={currentKey}
            className="horo-uni"
            custom={dir}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 34 }}
            drag={reduce ? false : 'x'}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={onDragEnd}
          >
            <div className="horo-uni-hero" style={{ background: ELEMENT_COLOR[sign.toLowerCase()] || 'var(--fresh-sky)' }}>
              <div className="horo-hero-glyph" aria-hidden>
                <ZodiacIcon sign={sign} size={64} strokeWidth={1.1} />
                {signState === 'open' ? <div className="horo-hero-date">{periodTag}</div> : null}
              </div>
              <div className="horo-hero-stack">
                <div className="fresh-sticky" style={{ transform: 'rotate(-2deg)' }}>
                  {signState === 'open' && !periodLocked ? (reading?.headline || (language === 'ru' ? 'Готовим разбор…' : 'Preparing…')) : signLabel}
                </div>
              </div>
            </div>
            <div className="horo-uni-body">
              {periodLocked ? (
                <div className="horo-lock">
                  <div className="horo-lock-title">
                    {period === 'week'
                      ? (language === 'ru' ? 'Гороскоп на неделю — в Premium' : 'Weekly horoscope — Premium')
                      : (language === 'ru' ? 'Гороскоп на месяц — в Premium' : 'Monthly horoscope — Premium')}
                  </div>
                  <p className="horo-lock-text">
                    {language === 'ru' ? 'Бесплатно — гороскоп на сегодня. Неделя и месяц открываются в Premium.' : 'Free — today’s horoscope. Week and month open in Premium.'}
                  </p>
                  {onRequestPremium ? (
                    <button type="button" className="fresh-btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => { lumiaSelectionHaptic(); onRequestPremium(); }}>
                      {language === 'ru' ? 'Открыть Premium' : 'Open Premium'}
                    </button>
                  ) : null}
                </div>
              ) : signState === 'open' ? (
                <>
                  <p className="horo-uni-summary">
                    {loading ? (language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…') : reading?.summary}
                  </p>
                  {!loading && reading?.advice?.length ? (
                    <div className="horo-uni-advice">
                      <div className="horo-uni-advice-title">{language === 'ru' ? 'Советы' : 'Advice'}</div>
                      <ul>{reading.advice.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
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
              ) : signState === 'can-open' ? (
                <div className="horo-lock">
                  <div className="horo-lock-title">
                    {isOwnSign
                      ? (language === 'ru' ? 'Твой гороскоп' : 'Your horoscope')
                      : (language === 'ru' ? 'Гороскоп на сегодня' : 'Today’s horoscope')}
                  </div>
                  <p className="horo-lock-text">
                    {isOwnSign
                      ? (language === 'ru' ? 'Откроется по кнопке — это твой знак.' : 'Tap to open — this is your sign.')
                      : premium
                        ? (language === 'ru' ? 'Откроется по кнопке — в Premium доступны все знаки.' : 'Tap to open — Premium opens every sign.')
                        : (language === 'ru' ? 'Откроется по кнопке. Бесплатно — 1 другой знак в день.' : 'Tap to open. Free — 1 other sign a day.')}
                  </p>
                  <button type="button" className="fresh-btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={openCurrent}>
                    {language === 'ru' ? 'Открыть гороскоп' : 'Open horoscope'}
                  </button>
                </div>
              ) : (
                <div className="horo-lock">
                  <div className="horo-lock-title">
                    {premium ? (language === 'ru' ? 'Лимит знаков на сегодня' : "Today's sign limit") : (language === 'ru' ? 'Другие знаки — в Premium' : 'Other signs — Premium')}
                  </div>
                  <p className="horo-lock-text">
                    {premium
                      ? (language === 'ru' ? 'В Premium доступны все знаки без лимита.' : 'Premium opens every sign, no limit.')
                      : (language === 'ru' ? 'Бесплатно — свой знак и ещё 1 в день. Все знаки — в Premium.' : 'Free — your sign plus 1 a day. All signs in Premium.')}
                  </p>
                  {!premium && onRequestPremium ? (
                    <button type="button" className="fresh-btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => { lumiaSelectionHaptic(); onRequestPremium(); }}>
                      {language === 'ru' ? 'Открыть Premium' : 'Open Premium'}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="horo-hint">{language === 'ru' ? 'Свайп ← → меняет знак' : 'Swipe ← → to change sign'}</div>
    </div>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
