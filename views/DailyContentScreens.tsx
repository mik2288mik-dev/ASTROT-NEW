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
  UserProfile,
} from '../types';
import { ensureFullDaypartForecast } from '../services/astrologyService';
import { loadHumanDailySection } from '../services/natalReadingService';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import type { HumanDailySectionKey } from '../lib/natalHumanShared';
import { cn } from '../lib/cn';

type DailyScreenTone = 'love' | 'money' | 'work' | 'goals' | 'personal';

type DailyScreenProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onBack: () => void | Promise<void>;
  requestPremium: () => void | Promise<void>;
};

type DailySectionScreenProps = DailyScreenProps & {
  sectionKey: HumanDailySectionKey;
  title: string;
  subtitle: string;
  tone: DailyScreenTone;
  icon: LucideIcon;
};

const toneStyles: Record<DailyScreenTone, { accent: string; soft: string; line: string }> = {
  love: {
    accent: '#f3a7bd',
    soft: 'bg-[#fff8fa]',
    line: 'from-[#f7bdd0]/40 via-[#f8d6df]/25 to-transparent',
  },
  money: {
    accent: '#d5bd7d',
    soft: 'bg-[#fffdf5]',
    line: 'from-[#dbc27a]/42 via-[#eadfb6]/26 to-transparent',
  },
  work: {
    accent: '#cbb879',
    soft: 'bg-[#fffdf5]',
    line: 'from-[#d7c684]/44 via-[#ebe2bc]/28 to-transparent',
  },
  goals: {
    accent: '#aab98e',
    soft: 'bg-[#fbfff8]',
    line: 'from-[#afc596]/40 via-[#dbe7cc]/26 to-transparent',
  },
  personal: {
    accent: '#93b7e8',
    soft: 'bg-[#f8fbff]',
    line: 'from-[#9fc4ef]/40 via-[#d7e7fb]/26 to-transparent',
  },
};

function splitParagraphs(value?: string | null): string[] {
  return String(value || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeErrorMessage(error: unknown, language: 'ru' | 'en'): string {
  const err = error as { code?: string; status?: number; message?: string };
  if (err?.status === 409 || err?.code === 'PRIMARY_CHART_MISSING') {
    return language === 'en'
      ? 'A saved natal chart is required for this section.'
      : 'Для этого раздела нужна сохраненная натальная карта.';
  }
  if (err?.status === 403 || err?.code === 'PREMIUM_REQUIRED') {
    return language === 'en'
      ? 'This section is available in Premium.'
      : 'Этот раздел доступен в Premium.';
  }
  return language === 'en'
    ? 'LUMIA could not read the saved text for this section.'
    : 'LUMIA не получила сохраненный текст этого раздела.';
}

function hapticOpen() {
  try {
    (window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
  } catch {
    /* Telegram haptics are optional */
  }
}

function ScreenFrame({
  profile,
  onBack,
  title,
  subtitle,
  tone,
  icon: Icon,
  children,
}: DailyScreenProps & {
  title: string;
  subtitle: string;
  tone: DailyScreenTone;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const style = toneStyles[tone];

  return (
    <div className={cn('min-h-full bg-white px-4 pb-8 pt-[calc(max(env(safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px))+0.8rem)] font-sans', style.soft)}>
      <div className="mx-auto flex min-h-[calc(100dvh-1.6rem)] w-full max-w-[25rem] flex-col gap-4">
        <button
          type="button"
          onClick={() => {
            hapticOpen();
            void onBack();
          }}
          className="inline-flex min-h-[40px] w-fit items-center gap-2 rounded-full bg-white/78 px-3 text-[13px] font-semibold text-[#202024] shadow-[0_8px_22px_rgba(0,0,0,0.06)] backdrop-blur-md"
          aria-label={language === 'en' ? 'Back' : 'Назад'}
        >
          <ArrowLeft size={16} />
          {language === 'en' ? 'Back' : 'Назад'}
        </button>

        <section className="relative flex flex-1 flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white/74 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.08)] backdrop-blur-md">
          <div className="pointer-events-none absolute -right-8 top-20 opacity-[0.09]">
            <Icon size={188} strokeWidth={0.8} />
          </div>
          <div className="pointer-events-none relative h-8 w-[min(19rem,80vw)] overflow-hidden [mask-image:radial-gradient(190px_46px_at_35%_0%,white_0%,white_38%,transparent_82%)]">
            <div
              className={cn('absolute left-0 top-2 h-px w-[82%] bg-gradient-to-r blur-[1px]', style.line)}
              style={{ boxShadow: `0 0 18px ${style.accent}` }}
            />
            <span className="absolute left-[29%] top-0 h-2 w-2 rounded-full bg-current opacity-50" style={{ color: style.accent }} />
            <span className="absolute left-[53%] top-2 h-1.5 w-1.5 rounded-full bg-current opacity-38" style={{ color: style.accent }} />
          </div>
          <div className="relative">
            <h1 className="max-w-[min(82vw,22rem)] text-[clamp(2.35rem,10vw,3.35rem)] font-semibold leading-[0.98] text-[#202024]">
              {title}
            </h1>
            <p className="mt-3 max-w-[min(82vw,21rem)] text-[14px] leading-relaxed text-[#68646e]">{subtitle}</p>
          </div>
          <div className="relative mt-6 flex-1">{children}</div>
        </section>
      </div>
    </div>
  );
}

function PremiumNotice({ profile, requestPremium }: Pick<DailyScreenProps, 'profile' | 'requestPremium'>) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  return (
    <div className="mt-4 max-w-[min(82vw,22rem)] rounded-[18px] border border-black/10 bg-white/76 px-4 py-4 text-[#34333a]">
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
              ? 'The personal daily section opens after Premium is active.'
              : 'Персональный ежедневный раздел открывается после активного Premium.'}
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

function LoadingText() {
  return (
    <div className="mt-3 max-w-[min(82vw,22rem)] space-y-3" aria-busy="true">
      <div className="h-4 w-5/6 animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/10" />
      <div className="h-3 w-2/3 animate-pulse rounded-full bg-black/10" />
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <div className="mt-3 max-w-[min(82vw,22rem)] rounded-[18px] border border-[#d9b9b0] bg-white/76 px-4 py-3 text-[14px] leading-relaxed text-[#7d5960]">
      {message}
    </div>
  );
}

function DailySectionContent({ section }: { section: InterpretationSection }) {
  const paragraphs = splitParagraphs(section.content);
  return (
    <div className="max-h-[calc(100dvh-17rem)] overflow-y-auto pb-2 pr-1">
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
            <div key={bullet} className="rounded-[16px] border border-black/10 bg-white/70 px-4 py-3 text-[14px] leading-relaxed text-[#3b3840]">
              {bullet}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DailySectionScreen({
  profile,
  chartData,
  chartId,
  onBack,
  requestPremium,
  sectionKey,
  title,
  subtitle,
  tone,
  icon,
}: DailySectionScreenProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const dateKey = useMemo(() => getMoscowTodayKey(), []);
  const [section, setSection] = useState<InterpretationSection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setSection(null);

    if (!profile.isPremium) {
      return () => {
        alive = false;
      };
    }

    if (!profile.id || !chartData) {
      setError(language === 'en' ? 'A saved natal chart is required for this section.' : 'Для этого раздела нужна сохраненная натальная карта.');
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    loadHumanDailySection(String(profile.id), sectionKey, chartId ?? undefined, dateKey, {
      accessTier: 'premium',
      maxInProgressRetries: 45,
      profile,
      chartData,
    })
      .then((result) => {
        if (!alive) return;
        if (result.content?.content?.trim()) {
          setSection(result.content);
        } else {
          setError(language === 'en' ? 'Saved text is empty.' : 'Сохраненный текст пустой.');
        }
      })
      .catch((err) => {
        if (!alive) return;
        setError(safeErrorMessage(err, language));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [chartData, chartId, dateKey, language, profile, sectionKey]);

  return (
    <ScreenFrame profile={profile} chartData={chartData} chartId={chartId} onBack={onBack} requestPremium={requestPremium} title={title} subtitle={`${subtitle} · ${formatLumiaDate(dateKey, language)}`} tone={tone} icon={icon}>
      {!profile.isPremium ? (
        <PremiumNotice profile={profile} requestPremium={requestPremium} />
      ) : loading && !section ? (
        <LoadingText />
      ) : error && !section ? (
        <ErrorText message={error} />
      ) : section ? (
        <DailySectionContent section={section} />
      ) : null}
    </ScreenFrame>
  );
}

function PersonalForecastContent({ reading }: { reading: ForecastDaypartReading }) {
  const items = [
    { label: 'Фокус дня', value: reading.focus },
    { label: 'Отношения', value: reading.relationships },
    { label: 'Деньги', value: reading.money },
    { label: 'Что делать', value: reading.guidance },
  ].filter((item) => item.value?.trim());

  return (
    <div className="max-h-[calc(100dvh-17rem)] overflow-y-auto pb-2 pr-1">
      <p className="max-w-[min(82vw,22rem)] text-[17px] leading-[1.58] text-[#34333a]">
        {reading.summary || reading.headline}
      </p>
      <div className="mt-5 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-[16px] border border-black/10 bg-white/70 px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b8690]">{item.label}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-[#3b3840]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const DailyLoveScreen = memo<DailyScreenProps>((props) => (
  <DailySectionScreen
    {...props}
    sectionKey="daily_love"
    title="Любовь сегодня"
    subtitle="Эмоции, близость и разговоры"
    tone="love"
    icon={Heart}
  />
));

export const DailyMoneyScreen = memo<DailyScreenProps>((props) => (
  <DailySectionScreen
    {...props}
    sectionKey="daily_money"
    title="Деньги сегодня"
    subtitle="Покупки, решения и финансовая собранность"
    tone="money"
    icon={WalletCards}
  />
));

export const DailyWorkScreen = memo<DailyScreenProps>((props) => (
  <DailySectionScreen
    {...props}
    sectionKey="daily_work_business"
    title="Работа и бизнес сегодня"
    subtitle="Фокус, договоренности и рабочий ритм"
    tone="work"
    icon={BriefcaseBusiness}
  />
));

export const DailyGoalsScreen = memo<DailyScreenProps>((props) => (
  <DailySectionScreen
    {...props}
    sectionKey="daily_goals"
    title="Дела и цели сегодня"
    subtitle="Главный шаг, задачи и приоритет"
    tone="goals"
    icon={Target}
  />
));

export const PersonalForecastScreen = memo<DailyScreenProps>(({ profile, chartData, chartId, onBack, requestPremium }) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const dateKey = useMemo(() => getMoscowTodayKey(), []);
  const [reading, setReading] = useState<ForecastDaypartReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setReading(null);

    if (!profile.isPremium) {
      return () => {
        alive = false;
      };
    }

    if (!profile.id || !chartData) {
      setError(language === 'en' ? 'A saved natal chart is required for this section.' : 'Для этого раздела нужна сохраненная натальная карта.');
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    ensureFullDaypartForecast(profile, chartData, 'day', {
      accessTier: 'premium',
      date: dateKey,
      chartId: chartId ?? null,
      maxInProgressRetries: 45,
    })
      .then((result) => {
        if (alive) setReading(result.reading);
      })
      .catch((err) => {
        if (alive) setError(safeErrorMessage(err, language));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [chartData, chartId, dateKey, language, profile]);

  return (
    <ScreenFrame
      profile={profile}
      chartData={chartData}
      chartId={chartId}
      onBack={onBack}
      requestPremium={requestPremium}
      title="Личный прогноз"
      subtitle={`Персональный прогноз дня · ${formatLumiaDate(dateKey, language)}`}
      tone="personal"
      icon={Sparkles}
    >
      {!profile.isPremium ? (
        <PremiumNotice profile={profile} requestPremium={requestPremium} />
      ) : loading && !reading ? (
        <LoadingText />
      ) : error && !reading ? (
        <ErrorText message={error} />
      ) : reading ? (
        <PersonalForecastContent reading={reading} />
      ) : null}
    </ScreenFrame>
  );
});

DailyLoveScreen.displayName = 'DailyLoveScreen';
DailyMoneyScreen.displayName = 'DailyMoneyScreen';
DailyWorkScreen.displayName = 'DailyWorkScreen';
DailyGoalsScreen.displayName = 'DailyGoalsScreen';
PersonalForecastScreen.displayName = 'PersonalForecastScreen';
