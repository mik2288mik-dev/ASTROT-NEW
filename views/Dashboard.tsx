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

// ─── Date Selector ────────────────────────────────────────────────────────────

function DateSelector({ todayKey, language }: { todayKey: string; language: 'ru' | 'en' }) {
  const days = useMemo(() => buildWeekDays(todayKey), [todayKey]);
  const abbrs = language === 'ru' ? RU_DAY_ABBR : EN_DAY_ABBR;
  return (
    <div className="flex items-stretch">
      {days.map(({ key, date, dayIndex }) => {
        const active = key === todayKey;
        return (
          <div key={key} className="flex flex-1 flex-col items-center">
            <div
              className={`flex flex-col items-center gap-[3px] rounded-full px-2 py-[9px] w-full ${active ? 'bg-[#111111]' : ''}`}
            >
              <div className={`h-[5px] w-[5px] rounded-full ${active ? 'bg-white' : 'bg-transparent'}`} />
              <span className={`text-[10px] font-semibold leading-none ${active ? 'text-white' : 'text-[#8A8A8A]'}`}>
                {abbrs[dayIndex]}
              </span>
              <span className={`mt-[3px] text-[16px] font-bold leading-none ${active ? 'text-white' : 'text-[#111111]'}`}>
                {date}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Decorative SVGs ──────────────────────────────────────────────────────────

// 6 stacked rings — fills the right column of the hero card
function HeroRings() {
  const h = '#CBC6F5'; // card bg — punches out ring holes
  return (
    <svg width="128" height="165" viewBox="0 0 128 165" fill="none" aria-hidden="true">
      {/* Blue — top */}
      <ellipse cx="64" cy="22"  rx="54" ry="16" fill="#7CC8F0"/>
      <ellipse cx="64" cy="16"  rx="31" ry="9"  fill={h}/>
      {/* Cream */}
      <ellipse cx="64" cy="46"  rx="54" ry="16" fill="#EDE8DC"/>
      <ellipse cx="64" cy="40"  rx="31" ry="9"  fill={h}/>
      {/* Rose */}
      <ellipse cx="64" cy="70"  rx="54" ry="16" fill="#F5A0B8"/>
      <ellipse cx="64" cy="64"  rx="31" ry="9"  fill={h}/>
      {/* Orange */}
      <ellipse cx="64" cy="94"  rx="54" ry="16" fill="#F5A060"/>
      <ellipse cx="64" cy="88"  rx="31" ry="9"  fill={h}/>
      {/* Coral */}
      <ellipse cx="64" cy="118" rx="54" ry="16" fill="#F07058"/>
      <ellipse cx="64" cy="112" rx="31" ry="9"  fill={h}/>
      {/* Teal — bottom */}
      <ellipse cx="64" cy="142" rx="54" ry="16" fill="#3B9E84"/>
      <ellipse cx="64" cy="136" rx="31" ry="9"  fill={h}/>
    </svg>
  );
}

// Cream stacked bowls — Natal card (yellow bg #F8D448)
function NatalDecor() {
  return (
    <svg width="82" height="118" viewBox="0 0 82 118" fill="none" aria-hidden="true">
      {/* Bottom wide bowl */}
      <ellipse cx="44" cy="107" rx="38" ry="10" fill="#D4C4A0"/>
      <path d="M6 90 Q6 66 44 66 Q82 66 82 90 Q82 107 44 107 Q6 107 6 90 Z" fill="#F0E4C8"/>
      <ellipse cx="44" cy="67" rx="26" ry="9" fill="#E2D4B0"/>
      {/* Top round bowl */}
      <ellipse cx="38" cy="54" rx="22" ry="7" fill="#D4C4A0"/>
      <path d="M16 34 Q16 12 38 12 Q60 12 60 34 Q60 53 38 53 Q16 53 16 34 Z" fill="#FAF4E8"/>
      <ellipse cx="38" cy="13" rx="16" ry="5" fill="#EEE2CE"/>
    </svg>
  );
}

// Ribbed cylinder — Horoscope card (blue bg #A8D4F8)
function HoroscopeDecor() {
  return (
    <svg width="58" height="115" viewBox="0 0 58 115" fill="none" aria-hidden="true">
      <ellipse cx="29" cy="15" rx="25" ry="9" fill="#E4F2FF"/>
      <rect x="4" y="15" width="50" height="88" rx="2" fill="#CCE4FA"/>
      {[24, 34, 44, 54, 64, 74, 84, 94].map((y) => (
        <rect key={y} x="4" y={y} width="50" height="8" rx="1" fill="#B4D0EE"/>
      ))}
      <ellipse cx="29" cy="103" rx="25" ry="8" fill="#A4C4E4"/>
    </svg>
  );
}

// Thick arch shapes — Oracle card (mint bg #A8E6CE)
function OracleDecor() {
  return (
    <svg width="70" height="115" viewBox="0 0 70 115" fill="none" aria-hidden="true">
      <path
        d="M8 108 L8 50 Q8 14 34 14 Q60 14 60 48 L60 66 Q60 84 46 84 Q32 84 32 66 L32 50 Q32 38 42 36"
        fill="none" stroke="#52C0A0" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M48 108 L48 64 Q48 48 62 46"
        fill="none" stroke="#3EAA8A" strokeWidth="16" strokeLinecap="round"
      />
    </svg>
  );
}

// Twisted loop ring — Synastry card (pink bg #F8B4C8)
function SynastryDecor() {
  return (
    <svg width="78" height="104" viewBox="0 0 78 104" fill="none" aria-hidden="true">
      {/* Main ring loop */}
      <path
        d="M14 62 Q2 42 18 24 Q34 6 58 24 Q76 42 58 62 Q38 82 18 62 Z"
        fill="none" stroke="#F078A8" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Highlight on upper arc — suggests 3D depth */}
      <path
        d="M18 62 Q6 42 18 26 Q34 10 56 24"
        fill="none" stroke="#F8A8C8" strokeWidth="12" strokeLinecap="round"
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
};

function PlanCard({ tag, title, description, bg, decoration, onClick, delay = 0 }: PlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={`flex overflow-hidden rounded-[20px] ${onClick ? 'cursor-pointer' : ''}`}
      style={{ backgroundColor: bg, minHeight: '200px' }}
    >
      {/* Left column: tag → title → description → arrow */}
      <div className="flex flex-1 flex-col justify-between py-5 pl-5 pr-3">
        <div>
          <span className="inline-flex self-start rounded-full bg-white/60 px-3 py-[5px] text-[11px] font-semibold text-[#111111] leading-none">
            {tag}
          </span>
          <h3 className="mt-[10px] text-[20px] font-bold leading-tight text-[#111111] break-words">{title}</h3>
          <p className="mt-1.5 text-[13px] leading-snug text-[#3D3D3D]">{description}</p>
        </div>
        {/* Arrow circle */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M2.5 7.5h10M9 4l3.5 3.5L9 11" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Right column: illustration anchored to bottom */}
      <div className="flex w-[42%] flex-shrink-0 items-end justify-center pb-3 pr-2" aria-hidden="true">
        {decoration}
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
      className="h-full overflow-y-auto bg-white px-4 pb-[var(--lumia-bottom-tab-clearance)] font-sans"
      style={{ paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + 0.75rem)' }}
    >
      <div className="mx-auto max-w-[25rem] pb-3">

        {/* ── 1. Header ── */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div className="flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-full bg-[#CBC6F5] text-[18px] font-bold text-[#111111]">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-bold leading-tight text-[#111111]">
                {language === 'ru' ? `Привет, ${profile.name}` : `Hello, ${profile.name}`}
              </p>
              <p className="mt-[3px] text-[13px] leading-none text-[#8A8A8A]">
                {`${language === 'ru' ? 'Сегодня' : 'Today'} ${shortDate(today, language)}`}
              </p>
            </div>
          </div>
          {/* Settings button */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={language === 'ru' ? 'Настройки' : 'Settings'}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-black/[0.07] bg-[#F7F7F7]"
          >
            <Search size={18} strokeWidth={2.5} className="text-[#111111]" />
          </button>
        </header>

        {/* ── 2. Hero Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 flex overflow-hidden rounded-[20px] bg-[#CBC6F5]"
          style={{ minHeight: '250px' }}
        >
          {/* Text — left column */}
          <div className="flex flex-1 flex-col justify-center p-5">
            <h2 className="text-[28px] font-bold leading-[1.1] text-[#111111]">
              {language === 'ru' ? 'Сегодня для вас' : 'Today for you'}
            </h2>
            <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-[#3D3D3D]">
              {heroSubtitle}
            </p>
          </div>
          {/* Rings — right column, 45% */}
          <div
            className="flex flex-shrink-0 items-center justify-center"
            style={{ width: '45%' }}
            aria-hidden="true"
          >
            <HeroRings />
          </div>
        </motion.div>

        {/* ── 3. Date Selector ── */}
        <div className="mt-5">
          <DateSelector todayKey={today} language={language} />
        </div>

        {/* ── 4. "Ваш план" ── */}
        <h2 className="mt-5 text-[22px] font-bold text-[#111111]">
          {language === 'ru' ? 'Ваш план' : 'Your plan'}
        </h2>

        {/* ── 5. Plan Cards 2×2 ── */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <PlanCard
            tag={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
            title={language === 'ru' ? 'Ваша карта' : 'Your chart'}
            description={language === 'ru' ? 'Разбор личности и потенциала' : 'Personality & potential'}
            bg="#F8D448"
            decoration={<NatalDecor />}
            onClick={onCreateNatalChart}
            delay={0.10}
          />
          <PlanCard
            tag={language === 'ru' ? 'Гороскоп' : 'Horoscope'}
            title={language === 'ru' ? 'Прогноз дня' : 'Daily forecast'}
            description={language === 'ru' ? 'Что важно знать сегодня' : 'What matters today'}
            bg="#A8D4F8"
            decoration={<HoroscopeDecor />}
            onClick={() => openHoroscope('sign', { mode: 'single', source: 'home_card_today' })}
            delay={0.14}
          />
          <PlanCard
            tag="Ask Lumia"
            title={language === 'ru' ? 'Спросите AI' : 'Ask AI'}
            description={language === 'ru' ? 'Получите ответ на любой вопрос' : 'Get answers to any question'}
            bg="#A8E6CE"
            decoration={<OracleDecor />}
            onClick={() => openPersonalDaily('overview')}
            delay={0.18}
          />
          <PlanCard
            tag={language === 'ru' ? 'Совместимость' : 'Compatibility'}
            title={language === 'ru' ? 'Совместимость' : 'Compatibility'}
            description={language === 'ru' ? 'Понимание ваших отношений' : 'Understand your relationship'}
            bg="#F8B4C8"
            decoration={<SynastryDecor />}
            delay={0.22}
          />
        </div>

        {/* ── 6. Personal Daily Banner ── */}
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
            className="flex w-full items-center gap-4 rounded-[20px] border border-black/[0.07] bg-white px-5 py-4 text-left"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#7B5CF6]">
              <FileText size={22} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#111111]">Personal Daily</p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[#8A8A8A]">{pdText}</p>
            </div>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#7B5CF6]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
