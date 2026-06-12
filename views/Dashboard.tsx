import React, { memo, useEffect, useMemo, useState } from 'react';
import { Search, FileText } from 'lucide-react';
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
  onOpenSettings?: () => void;
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

function buildWeekDays(todayKey: string) {
  const [yr, mo, da] = todayKey.split('-').map(Number);
  const dow = new Date(yr, mo - 1, da).getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(yr, mo - 1, da - dow + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key: k, date: d.getDate(), dayIndex: i };
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

function DateSelector({ todayKey, language }: { todayKey: string; language: 'ru' | 'en' }) {
  const days = useMemo(() => buildWeekDays(todayKey), [todayKey]);
  const abbrs = language === 'ru' ? RU_DAY_ABBR : EN_DAY_ABBR;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {days.map(({ key, date, dayIndex }) => {
        const active = key === todayKey;
        return (
          <div
            key={key}
            className={`flex min-w-[42px] flex-1 flex-col items-center rounded-full ${
              active ? 'bg-[#1E1230] py-3' : 'border border-[#EAE3F1] bg-white py-[10px]'
            }`}
          >
            {active && <div className="mb-[5px] h-1 w-1 rounded-full bg-white" />}
            <span className={`text-[11px] font-semibold leading-none ${active ? 'text-white/80' : 'text-[#9A93A3]'}`}>
              {abbrs[dayIndex]}
            </span>
            <span className={`mt-[7px] text-[16px] font-bold leading-none ${active ? 'text-white' : 'text-[#1E1230]'}`}>
              {date}
            </span>
          </div>
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
function HeroAvatars() {
  const palette = ['#F2A0BC', '#7CC8F0', '#F5C74A'];
  return (
    <div className="flex items-center" aria-hidden="true">
      {palette.map((c, i) => (
        <div
          key={c}
          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#DDD0F0] ${i ? '-ml-2' : ''}`}
          style={{ backgroundColor: c }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white" fillOpacity="0.85" aria-hidden="true">
            <circle cx="7" cy="4.6" r="2.6"/>
            <path d="M1.8 12.6c.5-3 2.4-4.5 5.2-4.5s4.7 1.5 5.2 4.5Z"/>
          </svg>
        </div>
      ))}
      <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#DDD0F0] bg-[#B7A2DE] text-[11px] font-bold leading-none text-white">
        +4
      </div>
    </div>
  );
}

// Cream stacked bowls — Natal card (amber bg)
function NatalDecor() {
  return (
    <svg width="78" height="112" viewBox="0 0 78 112" fill="none" aria-hidden="true">
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
    <svg width="56" height="118" viewBox="0 0 56 118" fill="none" aria-hidden="true">
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
    <svg width="66" height="112" viewBox="0 0 66 112" fill="none" aria-hidden="true">
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
    <svg width="76" height="104" viewBox="0 0 76 104" fill="none" aria-hidden="true">
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
  tag: string;
  title: string;
  description: string;
  bg: string;
  decoration?: React.ReactNode;
  onClick?: () => void;
  delay?: number;
  lang: 'ru' | 'en';
};

function PlanCard({ tag, title, description, bg, decoration, onClick, delay = 0, lang }: PlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-[24px] ${onClick ? 'cursor-pointer' : ''}`}
      style={{ backgroundColor: bg, minHeight: '208px' }}
    >
      {/* Decoration hugs the bottom-right corner, under the text flow */}
      <div className="absolute bottom-2 right-2" aria-hidden="true">
        {decoration}
      </div>

      <div className="relative flex h-full min-h-[208px] flex-col p-[18px]">
        <span className="inline-flex self-start rounded-full bg-white/60 px-3 py-[6px] text-[11px] font-semibold leading-none text-[#1E1230]">
          {tag}
        </span>
        <h3
          lang={lang}
          className="mt-3 break-words text-[20px] font-bold leading-tight text-[#1E1230]"
          style={{ hyphens: 'auto' }}
        >
          {title}
        </h3>
        <p className="mt-[6px] line-clamp-2 text-[12px] leading-snug text-[#50465E]">
          {description}
        </p>
        {/* Arrow circle — bottom-left */}
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
  onOpenSettings,
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

  const readyPersonal = personal?.status === 'ready' ? personal : null;
  const personalSummary = readyPersonal?.pulse.currentPoint.summary || FALLBACKS.dayCard;

  const openHoroscope = (layer: HoroscopeLayer = 'sign', options?: HoroscopeOpenOptions) =>
    onOpenHoroscopeLayer(layer, options);
  const openPersonalDaily = (section: PersonalDailySection = 'overview') => onOpenPersonalDaily(section);

  const heroSubtitle = signLoading
    ? (language === 'ru' ? 'Готовим ваш прогноз на сегодня…' : 'Preparing your forecast…')
    : (signReading?.summary || FALLBACKS.background);

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
      className="h-full overflow-y-auto bg-[#F8F5FA] px-4 pb-[var(--lumia-bottom-tab-clearance)] font-sans"
      style={{ paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + 0.75rem)' }}
    >
      <div className="mx-auto max-w-[25rem] pb-3">

        {/* ── 1. Header ── */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#DDD0F0] text-[18px] font-bold text-[#1E1230]">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[20px] font-bold leading-tight text-[#1E1230]">
                {language === 'ru' ? `Привет, ${profile.name}` : `Hello, ${profile.name}`}
              </p>
              <p className="mt-1 text-[13px] leading-none text-[#9A93A3]">
                {`${language === 'ru' ? 'Сегодня' : 'Today'} ${shortDate(today, language)}`}
              </p>
            </div>
          </div>
          {/* Search button — white circle with hairline border */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={language === 'ru' ? 'Настройки' : 'Settings'}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[#EAE3F1] bg-white"
          >
            <Search size={18} strokeWidth={2.25} className="text-[#1E1230]" />
          </button>
        </header>

        {/* ── 2. Hero Card — lavender, donut wreath right, avatars bottom-left ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 flex overflow-hidden rounded-[24px] bg-[#DDD0F0]"
          style={{ minHeight: '220px' }}
        >
          <div className="flex flex-1 flex-col justify-center p-5">
            <h2 className="text-[28px] font-bold leading-[1.12] text-[#1E1230]">
              {language === 'ru' ? <>Сегодня<br/>для вас</> : <>Today<br/>for you</>}
            </h2>
            <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-[#50465E]">
              {heroSubtitle}
            </p>
            <div className="mt-4">
              <HeroAvatars />
            </div>
          </div>
          <div className="flex w-[45%] flex-shrink-0 items-center justify-center" aria-hidden="true">
            <HeroDonuts />
          </div>
        </motion.div>

        {/* ── 3. Date Selector ── */}
        <div className="mt-4">
          <DateSelector todayKey={today} language={language} />
        </div>

        {/* ── 4. "Ваш план" ── */}
        <h2 className="mt-6 text-[24px] font-bold text-[#1E1230]">
          {language === 'ru' ? 'Ваш план' : 'Your plan'}
        </h2>

        {/* ── 5. Plan Cards 2×2 ── */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <PlanCard
            tag={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
            title={language === 'ru' ? 'Ваша карта' : 'Your chart'}
            description={language === 'ru' ? 'Разбор личности и потенциала' : 'Personality & potential'}
            bg="#F6C64F"
            decoration={<NatalDecor />}
            onClick={onCreateNatalChart}
            delay={0.10}
            lang={language}
          />
          <PlanCard
            tag={language === 'ru' ? 'Гороскоп' : 'Horoscope'}
            title={language === 'ru' ? 'Прогноз дня' : 'Daily forecast'}
            description={language === 'ru' ? 'Что важно знать сегодня' : 'What matters today'}
            bg="#A8C8F2"
            decoration={<HoroscopeDecor />}
            onClick={() => openHoroscope('sign', { mode: 'single', source: 'home_card_today' })}
            delay={0.14}
            lang={language}
          />
          <PlanCard
            tag="Ask Lumia"
            title={language === 'ru' ? 'Спросите AI' : 'Ask AI'}
            description={language === 'ru' ? 'Получите ответ на любой вопрос' : 'Get answers to any question'}
            bg="#C8E4CE"
            decoration={<OracleDecor />}
            onClick={() => openPersonalDaily('overview')}
            delay={0.18}
            lang={language}
          />
          <PlanCard
            tag={language === 'ru' ? 'Совместимость' : 'Compatibility'}
            title={language === 'ru' ? 'Совместимость' : 'Compatibility'}
            description={language === 'ru' ? 'Понимание ваших отношений' : 'Understand your relationship'}
            bg="#F6C9DB"
            decoration={<SynastryDecor />}
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
            onClick={pdAction}
            whileTap={{ scale: 0.97 }}
            className="flex w-full items-center gap-4 rounded-[24px] bg-[#DDD0F0] px-5 py-[18px] text-left"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#7B5CF6]">
              <FileText size={22} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-[#1E1230]">Personal Daily</p>
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
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
