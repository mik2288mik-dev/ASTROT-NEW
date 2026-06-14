import React, { memo, useEffect, useMemo, useState } from 'react';
import { Lock, Sparkles, Star, MessageCircle, Heart } from 'lucide-react';
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
              isToday ? 'bg-[#1E1230] py-[14px]' : 'border-[1.5px] border-[#ECE6F2] bg-white py-[13px]'
            }`}
          >
            {isToday && <div className="mb-[6px] h-1.5 w-1.5 rounded-full bg-white" />}
            <span className={`text-[13px] font-medium leading-none ${isToday ? 'text-white/75' : 'text-[#9A93A3]'}`}>
              {abbrs[weekdayIndex]}
            </span>
            <span className={`mt-[9px] text-[19px] font-bold leading-none ${isToday ? 'text-white' : 'text-[#1E1230]'}`}>
              {date}
            </span>
            {/* Lock badge on non-today days for free users */}
            <div className="mt-[6px] flex h-2.5 items-center justify-center">
              {!isToday && locked ? <Lock size={10} className="text-[#C3BBD2]" /> : null}
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
  badge?: string;
  footer?: React.ReactNode;
  onClick?: () => void;
  delay?: number;
  lang: 'ru' | 'en';
  className?: string;
};

function PlanCard({ title, detail, bg, glyph, badge, footer, onClick, delay = 0, lang, className = '' }: PlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={`relative flex min-h-[168px] flex-col overflow-hidden rounded-[24px] p-[18px] shadow-[0_12px_26px_rgba(30,18,48,0.08)] ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ backgroundColor: bg }}
    >
      {/* Decorative glyph illustration, bottom-right (reference: 3D object) */}
      <div className="pointer-events-none absolute bottom-10 right-3 z-0 text-[#1E1230]" style={{ opacity: 0.16 }} aria-hidden="true">
        {glyph}
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Badge pill, top-left (reference: Medium / Light) */}
        {badge ? (
          <span className="mb-3.5 inline-flex w-fit items-center rounded-full bg-white/70 px-3.5 py-1.5 text-[13px] font-semibold leading-none text-[#1E1230]">
            {badge}
          </span>
        ) : null}
        <h3
          lang={lang}
          className="break-words pr-1 font-lumiaHome text-[22px] font-extrabold leading-[1.05] tracking-[-0.3px] text-[#1E1230]"
          style={{ hyphens: 'auto' }}
        >
          {title}
        </h3>
        <div className="mt-3 flex-1 pr-2 text-[15px] font-medium leading-relaxed text-[#1E1230]/78">
          {detail}
        </div>
        {/* Footer block (reference: "Trainer" row) */}
        {footer ? <div className="mt-auto pt-3.5">{footer}</div> : null}
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
      style={{ paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px), 84px) + 12px)' }}
    >
      <div className="mx-auto w-full max-w-md pb-3">

        {/* ── 1. Header ── */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={language === 'ru' ? 'Профиль' : 'Profile'}
              className="flex flex-shrink-0 items-center"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  draggable={false}
                  className="block h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#DDD0F0] text-[24px] font-bold text-[#1E1230] font-lumiaHome">
                  {userInitial}
                </div>
              )}
            </button>
            <div className="flex min-w-0 flex-col justify-center">
              <p className="truncate font-lumiaHome text-[22px] font-extrabold leading-tight text-[#1E1230]">
                {language === 'ru' ? `Привет, ${profile.name}` : `Hello, ${profile.name}`}
              </p>
              <p className="mt-1 text-[15px] font-medium leading-tight text-[#9A93A3]">
                {`${language === 'ru' ? 'Сегодня' : 'Today'} ${shortDate(today, language)}`}
              </p>
            </div>
          </div>
        </header>

        {/* ── 2. Hero — big lavender "Daily challenge" card (Personal day) ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5"
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (hasChart && premium) { lumiaSelectionHaptic(); setPersonalStoryOpen(true); }
              else pdAction?.();
            }}
            className="relative flex min-h-[172px] w-full overflow-hidden rounded-[26px] px-[22px] py-[22px] text-left shadow-[0_12px_26px_rgba(123,92,246,0.18)]"
            style={{ backgroundColor: '#C9BCEF' }}
          >
            {/* Left: title + subtitle + CTA */}
            <div className="relative z-10 flex max-w-[58%] flex-col">
              <h2 className="whitespace-pre-line font-lumiaHome text-[32px] font-extrabold leading-[1.02] tracking-[-0.5px] text-[#1E1230]">
                {language === 'ru' ? 'Личный\nдень' : 'Personal\nday'}
              </h2>
              <p className="mt-2.5 line-clamp-2 text-[14px] font-semibold leading-snug text-[#1E1230]/70">
                {pdText}
              </p>
              <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_10px_rgba(30,18,48,0.12)]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" stroke="#7B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
            {/* Right: decorative colorful cluster (reference: 3D rings) */}
            <div className="pointer-events-none absolute bottom-0 right-1 top-0 z-0 w-[190px]" aria-hidden="true">
              <span className="absolute rounded-full shadow-[0_8px_16px_rgba(30,18,48,0.22)]" style={{ right: 84, top: 18, width: 52, height: 52, background: '#5BA9F4' }} />
              <span className="absolute rounded-full shadow-[0_8px_16px_rgba(30,18,48,0.22)]" style={{ right: 30, top: 10, width: 58, height: 58, background: '#EFEDEA' }} />
              <span className="absolute rounded-full shadow-[0_8px_16px_rgba(30,18,48,0.22)]" style={{ right: 6, top: 44, width: 50, height: 50, background: '#E8843A' }} />
              <span className="absolute rounded-full shadow-[0_8px_16px_rgba(30,18,48,0.22)]" style={{ right: 96, top: 66, width: 56, height: 56, background: '#E78BB6' }} />
              <span className="absolute rounded-full shadow-[0_8px_16px_rgba(30,18,48,0.22)]" style={{ right: 40, top: 76, width: 52, height: 52, background: '#2E2552' }} />
              <span className="absolute rounded-full shadow-[0_8px_16px_rgba(30,18,48,0.22)]" style={{ right: 2, top: 98, width: 48, height: 48, background: '#2F7D5B' }} />
            </div>
          </motion.button>
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

        {/* ── 4. Section heading "Your plan" ── */}
        <h2 className="mb-3.5 mt-6 font-lumiaHome text-[27px] font-extrabold leading-tight tracking-[-0.3px] text-[#1E1230]">
          {language === 'ru' ? 'Ваш план' : 'Your plan'}
        </h2>

        {/* ── 5. Section cards — tall left + stacked right (reference masonry) ── */}
        <div className="flex items-stretch gap-3">
          {/* Left: tall card with profile footer (reference: Judo Group + trainer) */}
          <PlanCard
            title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
            badge={language === 'ru' ? 'Карта' : 'Chart'}
            detail={hasChart && chartData ? (
              <div className="flex flex-col gap-1.5 font-semibold text-[#1E1230]/82">
                <span>☉&nbsp; {getZodiacSign(language, chartData.sun.sign)}</span>
                <span>☾&nbsp; {getZodiacSign(language, chartData.moon.sign)}</span>
                <span>ASC&nbsp; {getZodiacSign(language, chartData.rising.sign)}</span>
              </div>
            ) : (language === 'ru' ? 'Кто ты на самом деле' : 'Who you really are')}
            footer={(
              <div className="flex items-center gap-2.5">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" draggable={false} className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/60 text-[15px] font-bold text-[#1E1230]/80">
                    {userInitial}
                  </div>
                )}
                <div className="min-w-0 leading-tight">
                  <div className="text-[12px] font-medium text-[#1E1230]/55">{language === 'ru' ? 'Профиль' : 'Profile'}</div>
                  <div className="truncate text-[15px] font-bold text-[#1E1230]">{profile.name}</div>
                </div>
              </div>
            )}
            bg="#F8B94E"
            glyph={<Sparkles size={92} strokeWidth={1.4} />}
            onClick={onCreateNatalChart}
            delay={0.10}
            lang={language}
            className="flex-1"
          />
          {/* Right: stacked column — horoscope card + pink quick-actions */}
          <div className="flex flex-1 flex-col gap-3">
            <PlanCard
              title={language === 'ru' ? 'Гороскоп' : 'Horoscope'}
              badge={language === 'ru' ? 'Сегодня' : 'Today'}
              detail={(
                <span className="line-clamp-3">
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
            {/* Pink quick-actions card (reference: 3 round buttons) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-around rounded-[24px] bg-[#F6C9DB] px-3.5 py-4 shadow-[0_12px_26px_rgba(30,18,48,0.08)]"
            >
              <button
                type="button"
                aria-label={language === 'ru' ? 'Спроси Lumia' : 'Ask Lumia'}
                onClick={() => { lumiaSelectionHaptic(); onOpenOracle?.(); }}
                className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#CE86C9] active:scale-95"
              >
                <MessageCircle size={23} className="text-white" strokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label={language === 'ru' ? 'Совместимость' : 'Compatibility'}
                onClick={() => { lumiaSelectionHaptic(); onOpenSynastry?.(); }}
                className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#CE86C9] active:scale-95"
              >
                <Heart size={23} className="text-white" strokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label={language === 'ru' ? 'Личный день' : 'Personal day'}
                onClick={() => { lumiaSelectionHaptic(); openPersonalDaily('overview'); }}
                className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#CE86C9] active:scale-95"
              >
                <Sparkles size={23} className="text-white" strokeWidth={2} />
              </button>
            </motion.div>
          </div>
        </div>

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
