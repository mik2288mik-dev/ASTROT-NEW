import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Heart,
  Lock,
  Sparkles,
  Target,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type {
  ForecastDaypartReading,
  InterpretationSection,
  NatalChartData,
  PersonalDailySection,
  UserProfile,
} from '../types';
import { ensureFullDaypartForecast } from '../services/astrologyService';
import { loadHumanDailySection } from '../services/natalReadingService';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import type { HumanDailySectionKey } from '../lib/natalHumanShared';
import { cn } from '../lib/cn';

type PersonalDailyScreenProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  initialSection?: PersonalDailySection;
  onBack: () => void | Promise<void>;
  requestPremium: () => void | Promise<void>;
};

type DailyTabConfig = {
  id: PersonalDailySection;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  sectionKey?: HumanDailySectionKey;
};

const DAILY_TABS: DailyTabConfig[] = [
  {
    id: 'overview',
    title: 'Личный прогноз',
    subtitle: 'Главный фокус дня',
    icon: Sparkles,
  },
  {
    id: 'love',
    title: 'Любовь сегодня',
    subtitle: 'Близость, эмоции и разговоры',
    icon: Heart,
    sectionKey: 'daily_love',
  },
  {
    id: 'money',
    title: 'Деньги сегодня',
    subtitle: 'Решения, покупки и устойчивость',
    icon: WalletCards,
    sectionKey: 'daily_money',
  },
  {
    id: 'work',
    title: 'Работа сегодня',
    subtitle: 'Фокус, задачи и рабочий ритм',
    icon: BriefcaseBusiness,
    sectionKey: 'daily_work_business',
  },
  {
    id: 'goals',
    title: 'Дела и цели',
    subtitle: 'Один ясный следующий шаг',
    icon: Target,
    sectionKey: 'daily_goals',
  },
];

function hapticOpen() {
  try {
    (window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
  } catch {
    /* Telegram haptics are optional */
  }
}

function splitParagraphs(value?: string | null): string[] {
  return String(value || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveTab(section?: PersonalDailySection | null): DailyTabConfig {
  return DAILY_TABS.find((tab) => tab.id === section) || DAILY_TABS[0];
}

function LoadingText() {
  return (
    <div className="mt-6 max-w-[min(82vw,22rem)] space-y-3" aria-busy="true">
      <div className="h-4 w-5/6 animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-2/3 animate-pulse rounded-full bg-black/10" />
    </div>
  );
}

function PremiumNotice({ profile, requestPremium }: Pick<PersonalDailyScreenProps, 'profile' | 'requestPremium'>) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  return (
    <div className="mt-6 max-w-[min(82vw,22rem)] rounded-[18px] border border-black/10 bg-white px-4 py-4 text-[#34333a]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#202024] text-white">
          <Lock size={16} />
        </span>
        <div>
          <p className="text-[16px] font-semibold leading-snug">
            {language === 'en' ? 'Available in Premium' : 'Доступно в Premium'}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-[#68646e]">
            {language === 'en'
              ? 'Personal daily readings open after Premium is active.'
              : 'Персональный день открывается после активного Premium.'}
          </p>
          <button
            type="button"
            onClick={() => {
              hapticOpen();
              void requestPremium();
            }}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-[#202024] px-5 text-[14px] font-semibold text-white"
          >
            {language === 'en' ? 'Open Premium' : 'Открыть Premium'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorText({ language }: { language: 'ru' | 'en' }) {
  return (
    <div className="mt-6 max-w-[min(82vw,22rem)] rounded-[18px] border border-black/10 bg-white px-4 py-3 text-[14px] leading-relaxed text-[#5f5b64]">
      {language === 'en'
        ? 'Check your saved birth data and try opening this section again.'
        : 'Проверь сохранённые данные рождения и открой раздел ещё раз.'}
    </div>
  );
}

function ForecastContent({ reading }: { reading: ForecastDaypartReading }) {
  const items = [
    { label: 'Фокус дня', value: reading.focus },
    { label: 'Отношения', value: reading.relationships },
    { label: 'Деньги', value: reading.money },
    { label: 'Что делать', value: reading.guidance },
  ].filter((item) => item.value?.trim());

  return (
    <div className="mt-6 max-h-[calc(100dvh-19rem)] overflow-y-auto pb-2 pr-1">
      <p className="max-w-[min(82vw,22rem)] text-[17px] leading-[1.62] text-[#34333a]">
        {reading.summary || reading.headline}
      </p>
      <div className="mt-5 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-[16px] border border-black/10 bg-white px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b8690]">{item.label}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-[#3b3840]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionContent({ section }: { section: InterpretationSection }) {
  const paragraphs = splitParagraphs(section.content);
  return (
    <div className="mt-6 max-h-[calc(100dvh-19rem)] overflow-y-auto pb-2 pr-1">
      <div className="space-y-3">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="max-w-[min(82vw,22rem)] text-[16px] leading-[1.66] text-[#3b3840]">
            {paragraph}
          </p>
        ))}
      </div>
      {section.bullets?.length ? (
        <div className="mt-5 space-y-2">
          {section.bullets.slice(0, 4).map((bullet) => (
            <div key={bullet} className="rounded-[16px] border border-black/10 bg-white px-4 py-3 text-[14px] leading-relaxed text-[#3b3840]">
              {bullet}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const PersonalDailyScreen = memo<PersonalDailyScreenProps>(({
  profile,
  chartData,
  chartId,
  initialSection = 'overview',
  onBack,
  requestPremium,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const dateKey = useMemo(() => getMoscowTodayKey(), []);
  const [activeSection, setActiveSection] = useState<PersonalDailySection>(initialSection);
  const [forecast, setForecast] = useState<ForecastDaypartReading | null>(null);
  const [sections, setSections] = useState<Partial<Record<HumanDailySectionKey, InterpretationSection>>>({});
  const [loadingKey, setLoadingKey] = useState<PersonalDailySection | null>(null);
  const [errorKey, setErrorKey] = useState<PersonalDailySection | null>(null);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const activeTab = resolveTab(activeSection);
  const Icon = activeTab.icon;
  const activeDailySection = activeTab.sectionKey ? sections[activeTab.sectionKey] : null;
  const hasContent = activeTab.id === 'overview' ? !!forecast : !!activeDailySection?.content?.trim();
  const isLoading = loadingKey === activeTab.id;
  const hasError = errorKey === activeTab.id && !hasContent;

  useEffect(() => {
    let alive = true;
    if (!profile.isPremium || !profile.id || !chartData) return () => {
      alive = false;
    };

    const tab = resolveTab(activeSection);
    if (tab.id === 'overview' && forecast) return () => {
      alive = false;
    };
    if (tab.sectionKey && sections[tab.sectionKey]?.content?.trim()) return () => {
      alive = false;
    };

    setLoadingKey(tab.id);
    setErrorKey(null);

    const load = tab.sectionKey
      ? loadHumanDailySection(String(profile.id), tab.sectionKey, chartId ?? undefined, dateKey, {
          accessTier: 'premium',
          maxInProgressRetries: 3,
          profile,
          chartData,
        }).then((result) => {
          if (!alive) return;
          if (result.content?.content?.trim()) {
            setSections((current) => ({ ...current, [tab.sectionKey!]: result.content }));
            return;
          }
          setErrorKey(tab.id);
        })
      : ensureFullDaypartForecast(profile, chartData, 'day', {
          accessTier: 'premium',
          date: dateKey,
          chartId: chartId ?? null,
          maxInProgressRetries: 3,
        }).then((result) => {
          if (alive) setForecast(result.reading);
        });

    load
      .catch(() => {
        if (alive) setErrorKey(tab.id);
      })
      .finally(() => {
        if (alive) setLoadingKey((current) => (current === tab.id ? null : current));
      });

    return () => {
      alive = false;
    };
  }, [activeSection, chartData, chartId, dateKey, forecast, profile, sections]);

  return (
    <div className="min-h-full bg-white px-4 pb-8 pt-[calc(max(env(safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px))+0.8rem)] font-sans">
      <div className="mx-auto flex min-h-[calc(100dvh-1.6rem)] w-full max-w-[25rem] flex-col gap-4">
        <button
          type="button"
          onClick={() => {
            hapticOpen();
            void onBack();
          }}
          className="inline-flex min-h-[40px] w-fit items-center gap-2 rounded-full bg-white px-3 text-[13px] font-semibold text-[#202024] shadow-[0_8px_22px_rgba(0,0,0,0.06)]"
          aria-label={language === 'en' ? 'Back' : 'Назад'}
        >
          <ArrowLeft size={16} />
          {language === 'en' ? 'Back' : 'Назад'}
        </button>

        <section className="relative flex flex-1 flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white p-5 shadow-[0_18px_44px_rgba(0,0,0,0.08)]">
          <div className="pointer-events-none absolute -right-8 top-20 opacity-[0.08]">
            <Icon size={188} strokeWidth={0.8} />
          </div>
          <div className="pointer-events-none relative h-8 w-[min(19rem,80vw)] overflow-hidden [mask-image:radial-gradient(190px_46px_at_35%_0%,white_0%,white_38%,transparent_82%)]">
            <div className="absolute left-0 top-2 h-px w-[82%] bg-gradient-to-r from-black/10 via-black/5 to-transparent blur-[1px]" />
            <span className="absolute left-[29%] top-0 h-2 w-2 rounded-full bg-[#d8d8dc]" />
            <span className="absolute left-[53%] top-2 h-1.5 w-1.5 rounded-full bg-[#d8d8dc]" />
          </div>

          <div className="relative">
            <h1 className="max-w-[min(82vw,22rem)] text-[clamp(2.35rem,10vw,3.35rem)] font-semibold leading-[0.98] text-[#202024]">
              {activeTab.title}
            </h1>
            <p className="mt-3 max-w-[min(82vw,21rem)] text-[14px] leading-relaxed text-[#68646e]">
              {activeTab.subtitle} · {formatLumiaDate(dateKey, language)}
            </p>
          </div>

          <div className="relative mt-5 flex gap-2 overflow-x-auto pb-1">
            {DAILY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  hapticOpen();
                  setActiveSection(tab.id);
                }}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-2 text-[13px] font-semibold',
                  tab.id === activeTab.id
                    ? 'border-[#202024] bg-[#202024] text-white'
                    : 'border-black/10 bg-white text-[#4b4850]'
                )}
              >
                {tab.title}
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            {!profile.isPremium ? (
              <PremiumNotice profile={profile} requestPremium={requestPremium} />
            ) : !chartData || !profile.id ? (
              <ErrorText language={language} />
            ) : isLoading && !hasContent ? (
              <LoadingText />
            ) : hasError ? (
              <ErrorText language={language} />
            ) : activeTab.id === 'overview' && forecast ? (
              <ForecastContent reading={forecast} />
            ) : activeDailySection ? (
              <SectionContent section={activeDailySection} />
            ) : (
              <LoadingText />
            )}
          </div>
        </section>
      </div>
    </div>
  );
});

PersonalDailyScreen.displayName = 'PersonalDailyScreen';
