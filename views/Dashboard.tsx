import React, { memo, useEffect, useMemo, useState } from 'react';
import { FileText, Lock, Sparkles, Star, MessageCircle, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
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
import { DaySheet } from '../components/lumia-ui/DaySheet';
import { HoroscopeStories } from '../components/lumia-ui/HoroscopeStories';
import { PersonalDailyStories } from '../components/lumia-ui/PersonalDailyStories';
import { getZodiacSign } from '../constants';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { DaySummary } from '../components/Dashboard/home/DaySummary';
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedTodayAssistantHome,
  getTodayAssistantHome,
} from '../services/astrologyService';

// ─── Palette ──────────────────────────────────────────────────────────────────
// page #F8F5FA · hero/banner lavender #DDD0F0 · ink #1E1230 · soft ink #50465E
// muted #9A93A3 · hairline #EAE3F1 · cards: amber #F6C64F, blue #A8C8F2,
// sage #C8E4CE, pink #F6C9DB · accent purple #7B5CF6

// ─── Props ────────────────────────────────────────────────────────────────────

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

// ─── Fallback content ─────────────────────────────────────────────────────────

const FALLBACKS = {
  background: 'Сегодня полезнее выбрать один ясный приоритет и не разгонять тревогу лишними решениями.',
  dayCard: 'Сначала закончи то, что уже начато. Один спокойный разговор и один завершённый шаг сегодня дадут больше, чем попытка успеть всё сразу.',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const RU_DAY_ABBR = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
const EN_DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

function buildCenteredDays(todayKey: string) {
  const [yr, mo, da] = todayKey.split('-').map(Number);
  // 7 days centered on today: today-3 … today … today+3.
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(yr, mo - 1, da + (i - 3));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key, date: d.getDate(), weekdayIndex: d.getDay() };
  });
}

function shortDate(todayKey: string, lang: 'ru' | 'en'): string {
  const [yr, mo, da] = todayKey.split('-').map(Number);
  const d = new Date(Date.UTC(yr, mo - 1, da, 12));
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    timeZone: 'UTC', day: 'numeric', month: 'long',
  }).format(d);
}

// ─── Date Selector — white bordered capsules, active = dark with dot ──────────

function DateSelector({
  todayKey,
  language,
  isPremium,
  onPick,
}: {
  todayKey: string;
  language: 'ru' | 'en';
  isPremium: boolean;
  onPick: (key: string) => void;
}) {
  const days = useMemo(() => buildCenteredDays(todayKey), [todayKey]);
  const abbrs = language === 'ru' ? RU_DAY_ABBR : EN_DAY_ABBR;
  return (
    <div className="flex items-center gap-1.5">
      {days.map(({ key, date, weekdayIndex }) => {
        const isToday = key === todayKey;
        const locked = !isPremium && !isToday;
        return (
          <button
            key={key}
            type="button"
            onClick={() => { lumiaSelectionHaptic(); onPick(key); }}
            className={`flex flex-1 flex-col items-center rounded-full transition-colors ${
              isToday ? 'bg-[#1E1230] py-3' : 'border border-[#EAE3F1] bg-white py-[10px]'
            }`}
          >
            {isToday && <div className="mb-[5px] h-1 w-1 rounded-full bg-white" />}
            <span className={`text-[11px] font-semibold leading-none ${isToday ? 'text-white/80' : 'text-[#9A93A3]'}`}>
              {abbrs[weekdayIndex]}
            </span>
            <span className={`mt-[7px] text-[16px] font-bold leading-none ${isToday ? 'text-white' : 'text-[#1E1230]'}`}>
              {date}
            </span>
            {/* Lock badge on non-today days for free users */}
            <div className="mt-[5px] flex h-2.5 items-center justify-center">
              {!isToday && locked ? <Lock size={9} className="text-[#C3BBD2]" /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

type PlanCardProps = {
  title: string;
  detail: React.ReactNode;
  bg: string;
  glyph: React.ReactNode;
  onClick?: () => void;
  delay?: number;
  lang: 'ru' | 'en';
};

function PlanCard({ title, detail, bg, glyph, onClick, delay = 0, lang }: PlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={`relative flex min-h-[124px] flex-col overflow-hidden rounded-[18px] p-4 shadow-[0_8px_22px_rgba(30,18,48,0.08)] ${onClick ? 'cursor-pointer' : ''}`}
      style={{ backgroundColor: bg }}
    >
      {/* Soft glyph watermark, bottom-right */}
      <div className="pointer-events-none absolute -bottom-3 -right-2 z-0 text-[#1E1230]" style={{ opacity: 0.12 }} aria-hidden="true">
        {glyph}
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <h3
          lang={lang}
          className="break-words pr-1 font-lumiaHome text-[17px] font-extrabold leading-tight text-[#1E1230]"
          style={{ hyphens: 'auto' }}
        >
          {title}
        </h3>
        <div className="mt-1.5 flex-1 pr-2 text-[13px] font-medium leading-snug text-[#1E1230]/65">
          {detail}
        </div>
        <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm">
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M2.5 7.5h10M9 4l3.5 3.5L9 11" stroke="#1E1230" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const Dashboard = memo<DashboardProps>(({
  profile,
  chartData,
  chartId,
  onOpenHoroscopeLayer,
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
  const selectedSign = String(profile.selectedZodiacSign || chartData?.sun?.sign || '').trim();

  const [signReading, setSignReading] = useState<ForecastDailyReading | null>(null);
  const [signLoading, setSignLoading] = useState(!!selectedSign);
  const [personal, setPersonal] = useState<TodayAssistantHomeResult | null>(
    () => hasChart && premium ? getCachedTodayAssistantHome(profile, chartId, undefined, chartData) : null,
  );
  const [personalLoading, setPersonalLoading] = useState(hasChart && premium && !personal);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Which calendar day is open in the bottom sheet (null = closed).
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [horoscopeOpen, setHoroscopeOpen] = useState(false);
  const [personalStoryOpen, setPersonalStoryOpen] = useState(false);

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

  // Telegram avatar (display only — never gates anything)
  useEffect(() => {
    try {
      const tgUser = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { photo_url?: unknown } } } } })
        ?.Telegram?.WebApp?.initDataUnsafe?.user;
      setAvatarUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setAvatarUrl(null);
    }
  }, []);

  const readyPersonal = personal?.status === 'ready' ? personal : null;
  const personalSummary = readyPersonal?.pulse.currentPoint.summary || FALLBACKS.dayCard;

  const openHoroscope = (layer: HoroscopeLayer = 'sign', options?: HoroscopeOpenOptions) =>
    onOpenHoroscopeLayer(layer, options);
  const openPersonalDaily = (section: PersonalDailySection = 'overview') => onOpenPersonalDaily(section);


  // Calendar day tap: today is always free; other days require Premium.
  const handlePickDay = (key: string) => {
    if (premium || key === today) { setSheetDate(key); return; }
    onRequestPremium?.('calendar');
  };

  const pdText = !hasChart
    ? (language === 'ru' ? 'Создайте натальную карту для личного разбора' : 'Create a natal chart for your personal day')
    : !premium
    ? (language === 'ru' ? 'Личный день доступен в Premium' : 'Personal day is available in Premium')
    : personalLoading
    ? (language === 'ru' ? 'Готовится…' : 'Preparing…')
    : (language === 'ru' ? 'Ваш персональный разбор дня уже готов' : 'Your personal day breakdown is ready');

  const pdAction = !hasChart ? onCreateNatalChart : () => openPersonalDaily('overview');

  const userInitial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto bg-[#F8F5FA] px-4 pb-[var(--lumia-bottom-tab-clearance)] font-lumiaHome"
      style={{ paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px), 24px) + 1.75rem)' }}
    >
      <div className="mx-auto w-full max-w-md pb-3">

        {/* ── 1. Header ── */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={language === 'ru' ? 'Профиль' : 'Profile'}
              className="flex-shrink-0"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  draggable={false}
                  className="h-[58px] w-[58px] rounded-full object-cover"
                />
              ) : (
                <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#DDD0F0] text-[22px] font-bold text-[#1E1230] font-lumiaHome">
                  {userInitial}
                </div>
              )}
            </button>
            <div className="min-w-0">
              <p className="truncate font-lumiaHome text-[21px] font-bold leading-tight text-[#1E1230]">
                {language === 'ru' ? `Привет, ${profile.name}` : `Hello, ${profile.name}`}
              </p>
              <p className="mt-1 text-[14px] font-medium leading-none text-[#9A93A3]">
                {`${language === 'ru' ? 'Сегодня' : 'Today'} ${shortDate(today, language)}`}
              </p>
            </div>
          </div>
        </header>

        {/* ── 2. Сводка дня (Moon + best time) ── */}
        <DaySummary profile={profile} chartData={chartData} chartId={chartId} language={language} />

        {/* ── 3. Date Selector ── */}
        <div className="mt-5">
          <DateSelector
            todayKey={today}
            language={language}
            isPremium={premium}
            onPick={handlePickDay}
          />
        </div>

        {/* ── Section cards 2×2 ── */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <PlanCard
            title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
            detail={hasChart && chartData ? (
              <div className="flex flex-col gap-0.5 font-semibold text-[#1E1230]/80">
                <span>☉ {getZodiacSign(language, chartData.sun.sign)}</span>
                <span>☾ {getZodiacSign(language, chartData.moon.sign)}</span>
                <span>ASC {getZodiacSign(language, chartData.rising.sign)}</span>
              </div>
            ) : (language === 'ru' ? 'Кто ты на самом деле' : 'Who you really are')}
            bg="#F6C64F"
            glyph={<Sparkles size={92} strokeWidth={1.4} />}
            onClick={onCreateNatalChart}
            delay={0.10}
            lang={language}
          />
          <PlanCard
            title={language === 'ru' ? 'Гороскоп' : 'Horoscope'}
            detail={(
              <span className="line-clamp-2">
                {signLoading
                  ? (language === 'ru' ? 'Что тебя ждёт сегодня' : 'What today holds')
                  : (signReading?.summary || (language === 'ru' ? 'Что тебя ждёт сегодня' : 'What today holds'))}
              </span>
            )}
            bg="#A8C8F2"
            glyph={selectedSign ? <ZodiacIcon sign={selectedSign} size={96} /> : <Star size={92} strokeWidth={1.4} />}
            onClick={() => { lumiaSelectionHaptic(); setHoroscopeOpen(true); }}
            delay={0.14}
            lang={language}
          />
          <PlanCard
            title={language === 'ru' ? 'Спроси Lumia' : 'Ask Lumia'}
            detail={language === 'ru' ? '«Что для меня важно сегодня?»' : '“What matters for me today?”'}
            bg="#C8E4CE"
            glyph={<MessageCircle size={88} strokeWidth={1.4} />}
            onClick={onOpenOracle}
            delay={0.18}
            lang={language}
          />
          <PlanCard
            title={language === 'ru' ? 'Совместимость' : 'Compatibility'}
            detail={language === 'ru' ? 'Вы подходите друг другу?' : 'Do you match?'}
            bg="#F6C9DB"
            glyph={<Heart size={88} strokeWidth={1.4} />}
            onClick={onOpenSynastry}
            delay={0.22}
            lang={language}
          />
        </div>

        {/* ── 6. Personal Daily Banner — lavender like the hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3"
        >
          <motion.button
            type="button"
            onClick={() => {
              if (hasChart && premium) { lumiaSelectionHaptic(); setPersonalStoryOpen(true); }
              else pdAction?.();
            }}
            whileTap={{ scale: 0.97 }}
            className="flex w-full items-center gap-4 rounded-[20px] bg-[#DDD0F0] px-5 py-[18px] text-left"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#7B5CF6]">
              <FileText size={22} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-[#1E1230]">{language === 'ru' ? 'Личный день' : 'Personal day'}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#5A4F68]">{pdText}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#7B5CF6]">
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </motion.button>
        </motion.div>

      </div>

      <DaySheet
        dateKey={sheetDate}
        todayKey={today}
        sign={selectedSign}
        language={language}
        isPremium={premium}
        onClose={() => setSheetDate(null)}
        onRequestPremium={() => onRequestPremium?.('calendar')}
      />

      <HoroscopeStories open={horoscopeOpen} profile={profile} chartData={chartData} language={language} onClose={() => setHoroscopeOpen(false)} />
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
