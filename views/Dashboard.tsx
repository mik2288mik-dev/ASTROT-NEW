import React, { memo, useEffect, useMemo, useState } from 'react';
import { Lock, Sparkles, MessageCircle } from 'lucide-react';
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
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedTodayAssistantHome,
  getTodayAssistantHome,
} from '../services/astrologyService';
import {
  MonoPage,
  MonoHeader,
  MonoBentoTile,
  MonoTag,
  MonoIllustPersonal,
  MonoIllustCouple,
  MonoIllustHoroscope,
  MonoIllustChart,
} from '../components/mono-ui';

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

const RU_DAY_ABBR = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
const EN_DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

function buildCenteredDays(todayKey: string) {
  const [yr, mo, da] = todayKey.split('-').map(Number);
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
            className={`relative flex flex-1 flex-col items-center rounded-full border py-[12px] transition-colors ${
              isToday ? 'border-mono-ink bg-mono-black text-white' : 'border-mono-line bg-mono-white text-mono-ink'
            }`}
          >
            <span className={`text-[12px] font-medium leading-none ${isToday ? 'text-white/70' : 'text-mono-muted'}`}>
              {abbrs[weekdayIndex]}
            </span>
            <span className="mt-2 text-[18px] font-bold leading-none">{date}</span>
            <div className="mt-1.5 flex h-2.5 items-center justify-center">
              {!isToday && locked ? <Lock size={10} className="text-mono-muted/50" /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const Dashboard = memo<DashboardProps>(({
  profile,
  chartData,
  chartId,
  onOpenHoroscopeLayer: _onOpenHoroscopeLayer,
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

  useEffect(() => {
    try {
      const tgUser = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { photo_url?: unknown } } } } })
        ?.Telegram?.WebApp?.initDataUnsafe?.user;
      setAvatarUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setAvatarUrl(null);
    }
  }, []);


  const openPersonalDaily = (section: PersonalDailySection = 'overview') => onOpenPersonalDaily(section);

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
    <MonoPage scrollRef={scrollRef} className="px-4">
      <div className="mx-auto w-full max-w-md pb-3">
        <MonoHeader
          greeting={language === 'ru' ? `Привет, ${profile.name}!` : `Hi, ${profile.name}!`}
          subtitle={`${language === 'ru' ? 'Сегодня' : 'Today'} ${shortDate(today, language)}`}
          avatarSrc={avatarUrl}
          avatarInitial={userInitial}
          onAvatarClick={onOpenSettings}
        />

        {/* Hero — personal day */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (hasChart && premium) { lumiaSelectionHaptic(); setPersonalStoryOpen(true); }
            else pdAction?.();
          }}
          className="relative mt-5 flex min-h-[160px] w-full flex-col justify-center overflow-hidden rounded-mono-card bg-mono-plate px-5 py-5 text-left"
        >
          <MonoIllustPersonal className="absolute right-3 top-3 opacity-80" size={96} />
          <MonoTag className="relative z-10 w-fit">{language === 'ru' ? 'сегодня' : 'today'}</MonoTag>
          <h2 className="relative z-10 mt-2 max-w-[58%] text-[28px] font-bold leading-[1.05] tracking-[-0.02em] text-mono-ink">
            {language === 'ru' ? 'Личный день' : 'Personal day'}
          </h2>
          <p className="relative z-10 mt-2 max-w-[62%] line-clamp-2 text-[14px] font-medium leading-snug text-mono-muted">
            {pdText}
          </p>
          <span className="relative z-10 mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-mono-black text-white">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </motion.button>

        <div className="mt-5">
          <DateSelector todayKey={today} language={language} isPremium={premium} onPick={handlePickDay} />
        </div>

        <div className="mb-3 mt-8">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-mono-ink">
            {language === 'ru' ? 'Твой план' : 'Your plan'}
          </h2>
        </div>

        {/* Bento grid — compatibility hero first */}
        <div className="grid grid-cols-2 gap-3">
          <MonoBentoTile
            className="col-span-2 min-h-[132px]"
            variant="black"
            tag={language === 'ru' ? 'союз' : 'union'}
            title={language === 'ru' ? 'Совместимость' : 'Compatibility'}
            detail={language === 'ru' ? 'Узнай про парня, девушку или пару' : 'Learn about him, her, or your pair'}
            illustration={<MonoIllustCouple size={88} />}
            onClick={() => { lumiaSelectionHaptic(); onOpenSynastry?.(); }}
            delay={0.08}
          />
          <MonoBentoTile
            title={language === 'ru' ? 'Гороскоп' : 'Horoscope'}
            tag={language === 'ru' ? 'сегодня' : 'today'}
            detail={
              signLoading
                ? (language === 'ru' ? 'Что тебя ждёт сегодня' : 'What today holds')
                : (signReading?.summary || (language === 'ru' ? 'Что тебя ждёт сегодня' : 'What today holds'))
            }
            variant="gray"
            illustration={<MonoIllustHoroscope size={72} />}
            onClick={() => { lumiaSelectionHaptic(); setHoroscopeOpen(true); }}
            delay={0.12}
          />
          <MonoBentoTile
            title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
            tag={language === 'ru' ? 'карта' : 'chart'}
            detail={
              hasChart && chartData ? (
                <div className="flex flex-col gap-1 text-[13px] font-semibold">
                  <span>☉ {getZodiacSign(language, chartData.sun.sign)}</span>
                  <span>☾ {getZodiacSign(language, chartData.moon.sign)}</span>
                </div>
              ) : (language === 'ru' ? 'Кто ты на самом деле' : 'Who you really are')
            }
            variant="white"
            illustration={<MonoIllustChart size={72} />}
            onClick={onCreateNatalChart}
            delay={0.14}
            footer={
              hasChart ? (
                <div className="flex items-center gap-2">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mono-plate text-sm font-bold">
                      {userInitial}
                    </div>
                  )}
                  <span className="truncate text-[13px] font-semibold">{profile.name}</span>
                </div>
              ) : undefined
            }
          />
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => { lumiaSelectionHaptic(); onOpenOracle?.(); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-mono-card border border-mono-line bg-mono-white py-3.5 text-[14px] font-semibold active:scale-[0.98]"
          >
            <MessageCircle size={18} strokeWidth={2} />
            {language === 'ru' ? 'Спроси Lumia' : 'Ask Lumia'}
          </button>
          <button
            type="button"
            onClick={() => { lumiaSelectionHaptic(); openPersonalDaily('overview'); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-mono-card border border-mono-line bg-mono-white py-3.5 text-[14px] font-semibold active:scale-[0.98]"
          >
            <Sparkles size={18} strokeWidth={2} />
            {language === 'ru' ? 'Личный день' : 'Personal day'}
          </button>
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
    </MonoPage>
  );
});

Dashboard.displayName = 'Dashboard';
