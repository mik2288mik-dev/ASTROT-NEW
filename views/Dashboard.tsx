import React, { memo, useEffect, useMemo, useState } from 'react';
import { FileText, Lock } from 'lucide-react';
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
import { StoriesViewer, buildReadingSlides } from '../components/lumia-ui/StoriesViewer';
import { PersonalDailyStories } from '../components/lumia-ui/PersonalDailyStories';
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

// ─── Decorative SVGs ──────────────────────────────────────────────────────────

// Wreath of flat donuts (stroke rings) — right half of hero card
function HeroDonuts() {
  return (
    <svg viewBox="0 0 170 200" fill="none" aria-hidden="true" className="h-auto w-[86%] max-w-[156px]">
      <ellipse cx="122" cy="40"  rx="22" ry="15" stroke="#F2ECDF" strokeWidth="13" transform="rotate(18 122 40)"/>
      <ellipse cx="143" cy="82"  rx="19" ry="13" stroke="#EC6852" strokeWidth="12" transform="rotate(50 143 82)"/>
      <ellipse cx="70"  cy="42"  rx="27" ry="18" stroke="#7CC8F0" strokeWidth="15" transform="rotate(-10 70 42)"/>
      <ellipse cx="125" cy="122" rx="22" ry="15" stroke="#F5A060" strokeWidth="13" transform="rotate(12 125 122)"/>
      <ellipse cx="38"  cy="95"  rx="25" ry="18" stroke="#F2A0BC" strokeWidth="15" transform="rotate(-16 38 95)"/>
      <ellipse cx="88"  cy="158" rx="27" ry="18" stroke="#2F7E66" strokeWidth="15" transform="rotate(4 88 158)"/>
      <ellipse cx="140" cy="165" rx="16" ry="11" stroke="#FAF8F2" strokeWidth="10" transform="rotate(26 140 165)"/>
    </svg>
  );
}

// Overlapping avatar circles + "+N" badge — bottom-left of hero

// Cream stacked bowls — Natal card (amber bg)
function NatalDecor() {
  return (
    <svg width="56" height="80" viewBox="0 0 78 112" fill="none" aria-hidden="true">
      <ellipse cx="42" cy="102" rx="34" ry="9" fill="#E3B53B"/>
      <path d="M8 86 Q8 62 42 62 Q76 62 76 86 Q76 101 42 101 Q8 101 8 86 Z" fill="#F1EBDB"/>
      <ellipse cx="42" cy="63" rx="24" ry="8" fill="#E0D4B6"/>
      <ellipse cx="36" cy="50" rx="20" ry="6" fill="#DECFAC"/>
      <path d="M16 32 Q16 12 36 12 Q56 12 56 32 Q56 50 36 50 Q16 50 16 32 Z" fill="#FAF5E9"/>
      <ellipse cx="36" cy="13" rx="15" ry="5" fill="#EADFC6"/>
    </svg>
  );
}

// Periwinkle ribbed cylinder — Horoscope card (blue bg)
function HoroscopeDecor() {
  return (
    <svg width="40" height="84" viewBox="0 0 56 118" fill="none" aria-hidden="true">
      <ellipse cx="28" cy="14" rx="24" ry="9" fill="#D6E0FA"/>
      <rect x="4" y="14" width="48" height="92" rx="2" fill="#B4C4F2"/>
      {[24, 34, 44, 54, 64, 74, 84, 94].map((y) => (
        <rect key={y} x="4" y={y} width="48" height="7" rx="1" fill="#98ACE6"/>
      ))}
      <ellipse cx="28" cy="106" rx="24" ry="8" fill="#8CA0DC"/>
    </svg>
  );
}

// Sage arch shapes — Ask Lumia card (sage bg)
function OracleDecor() {
  return (
    <svg width="50" height="85" viewBox="0 0 66 112" fill="none" aria-hidden="true">
      <path
        d="M8 106 L8 48 Q8 14 32 14 Q56 14 56 46 L56 64 Q56 80 43 80 Q30 80 30 64 L30 48 Q30 38 39 36"
        fill="none" stroke="#87BC96" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M46 106 L46 62 Q46 46 60 44"
        fill="none" stroke="#74AE85" strokeWidth="14" strokeLinecap="round"
      />
    </svg>
  );
}

// Pink twisted torus — Compatibility card (pink bg)
function SynastryDecor() {
  return (
    <svg width="58" height="79" viewBox="0 0 76 104" fill="none" aria-hidden="true">
      <path
        d="M14 62 Q2 44 17 26 Q32 9 56 25 Q74 41 57 61 Q39 80 18 62 Z"
        fill="none" stroke="#EC8FB6" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M18 60 Q7 43 18 28 Q33 13 54 26"
        fill="none" stroke="#F5B3CE" strokeWidth="11" strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

type PlanCardProps = {
  title: string;
  description: string;
  bg: string;
  decoration?: React.ReactNode;
  onClick?: () => void;
  delay?: number;
  lang: 'ru' | 'en';
};

function PlanCard({ title, description, bg, decoration, onClick, delay = 0, lang }: PlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={`relative flex min-h-[172px] flex-col overflow-hidden rounded-[18px] p-[18px] ${onClick ? 'cursor-pointer' : ''}`}
      style={{ backgroundColor: bg }}
    >
      {/* Flat decoration — anchored to bottom-right corner, behind text */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-0" aria-hidden="true">
        {decoration}
      </div>

      {/* Content flows above the decoration; text widths kept clear of it */}
      <div className="relative z-10 flex flex-1 flex-col">
        <h3
          lang={lang}
          className="break-words pr-1 font-lumiaHomeDisplay text-[20px] font-bold leading-[1.12] text-[#1E1230]"
          style={{ hyphens: 'auto' }}
        >
          {title}
        </h3>
        <p className="mt-2 line-clamp-2 pr-[40%] text-[13px] leading-snug text-[#50465E]">
          {description}
        </p>
        {/* Arrow — bottom-left, clears the bottom-right decoration */}
        <div className="mt-auto flex h-10 w-10 items-center justify-center rounded-full bg-white">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M2.5 7.5h10M9 4l3.5 3.5L9 11" stroke="#1E1230" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
  const [storyOpen, setStoryOpen] = useState(false);
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

  const heroSubtitle = signLoading
    ? (language === 'ru' ? 'Готовим ваш прогноз…' : 'Preparing your forecast…')
    : (signReading?.summary || FALLBACKS.background);

  const storySlides = useMemo(
    () => buildReadingSlides(signReading, language === 'ru' ? 'Гороскоп на сегодня' : 'Today’s horoscope', language),
    [signReading, language],
  );

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
      style={{ paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px), 24px) + 2.75rem)' }}
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
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#DDD0F0] text-[21px] font-bold text-[#1E1230] font-lumiaHomeDisplay">
                  {userInitial}
                </div>
              )}
            </button>
            <div className="min-w-0">
              <p className="truncate font-lumiaHome text-[20px] font-extrabold leading-tight text-[#1E1230]">
                {language === 'ru' ? `Привет, ${profile.name}` : `Hello, ${profile.name}`}
              </p>
              <p className="mt-1 text-[13px] leading-none text-[#9A93A3]">
                {`${language === 'ru' ? 'Сегодня' : 'Today'} ${shortDate(today, language)}`}
              </p>
            </div>
          </div>
        </header>

        {/* ── 2. Hero Card — today's forecast, tap to read as stories ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => {
            if (storySlides.length) { lumiaSelectionHaptic(); setStoryOpen(true); }
            else openHoroscope('sign', { mode: 'single', source: 'home_hero' });
          }}
          whileTap={{ scale: 0.985 }}
          className="mt-5 flex cursor-pointer overflow-hidden rounded-[20px] bg-[#DDD0F0]"
          style={{ minHeight: '206px' }}
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center p-5">
            <h2 className="text-[26px] font-bold leading-[1.12] text-[#1E1230] font-lumiaHomeDisplay">
              {language === 'ru' ? <>Сегодня<br/>для вас</> : <>Today<br/>for you</>}
            </h2>
            <p className="mt-2.5 line-clamp-3 break-words text-[14px] leading-relaxed text-[#50465E]">
              {heroSubtitle}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-[#1E1230] px-4 py-2 text-[13px] font-semibold text-white">
              {language === 'ru' ? 'Читать' : 'Read'}
              <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M2.5 7.5h10M9 4l3.5 3.5L9 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          </div>
          <div className="flex w-[40%] flex-shrink-0 items-center justify-center" aria-hidden="true">
            <HeroDonuts />
          </div>
        </motion.div>

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
            description={language === 'ru' ? 'Кто ты на самом деле' : 'Who you really are'}
            bg="#F6C64F"
            decoration={<NatalDecor />}
            onClick={onCreateNatalChart}
            delay={0.10}
            lang={language}
          />
          <PlanCard
            title={language === 'ru' ? 'Гороскоп' : 'Horoscope'}
            description={language === 'ru' ? 'Что тебя ждёт сегодня' : 'What today holds'}
            bg="#A8C8F2"
            decoration={<HoroscopeDecor />}
            onClick={() => openHoroscope('sign', { mode: 'single', source: 'home_card' })}
            delay={0.14}
            lang={language}
          />
          <PlanCard
            title={language === 'ru' ? 'Спроси Lumia' : 'Ask Lumia'}
            description={language === 'ru' ? 'Ответ на любой вопрос' : 'Answers to anything'}
            bg="#C8E4CE"
            decoration={<OracleDecor />}
            onClick={onOpenOracle}
            delay={0.18}
            lang={language}
          />
          <PlanCard
            title={language === 'ru' ? 'Совместимость' : 'Compatibility'}
            description={language === 'ru' ? 'Вы подходите друг другу?' : 'Do you match?'}
            bg="#F6C9DB"
            decoration={<SynastryDecor />}
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

      <StoriesViewer open={storyOpen} slides={storySlides} onClose={() => setStoryOpen(false)} accent="#7559CF" />
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
