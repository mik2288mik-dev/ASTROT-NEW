import React, { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { canAccessFeature } from '../lib/accessMatrix';
import type {
  ForecastDaypartReading,
  InterpretationSection,
  NatalChartData,
  PersonalDailySection,
  TodayAssistantHomeResult,
  UserProfile,
} from '../types';
import { ensureFullDaypartForecast, getCachedTodayAssistantHome, getTodayAssistantHome } from '../services/astrologyService';
import { loadHumanDailySection } from '../services/natalReadingService';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import type { HumanDailySectionKey } from '../lib/natalHumanShared';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { FreshTabs } from '../components/fresh-ui';
import { FreshInnerHeader } from '../components/fresh-ui/FreshHeaders';

type PersonalDailyScreenProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  initialSection?: PersonalDailySection;
  onBack: () => void | Promise<void>;
  requestPremium: () => void | Promise<void>;
  onCreateNatalChart?: () => void | Promise<void>;
};

type DailyTabConfig = {
  id: PersonalDailySection;
  label: string;
  title: string;
  subtitle: string;
  accent: string;
  sectionKey?: HumanDailySectionKey;
};

const DAILY_TABS: DailyTabConfig[] = [
  { id: 'overview', label: 'День', title: 'Личный прогноз', subtitle: 'Главный фокус дня', accent: '#6366F1' },
  { id: 'love', label: 'Любовь', title: 'Любовь сегодня', subtitle: 'Близость, эмоции и разговоры', accent: '#A98CEC', sectionKey: 'daily_love' },
  { id: 'money', label: 'Деньги', title: 'Деньги сегодня', subtitle: 'Решения, покупки и устойчивость', accent: '#34C39A', sectionKey: 'daily_money' },
  { id: 'work', label: 'Работа', title: 'Работа сегодня', subtitle: 'Фокус, задачи и рабочий ритм', accent: '#5BB6EC', sectionKey: 'daily_work_business' },
  { id: 'goals', label: 'Цели', title: 'Дела и цели', subtitle: 'Один ясный следующий шаг', accent: '#FF9B6A', sectionKey: 'daily_goals' },
];

function splitParagraphs(value?: string | null): string[] {
  return String(value || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveTab(section?: PersonalDailySection | null): DailyTabConfig {
  return DAILY_TABS.find((tab) => tab.id === section) || DAILY_TABS[0];
}

function Skeleton() {
  return (
    <div className="pd-skel" aria-busy="true">
      <div className="pd-skel-line" style={{ width: '85%' }} />
      <div className="pd-skel-line" style={{ width: '100%' }} />
      <div className="pd-skel-line" style={{ width: '78%' }} />
      <div className="pd-skel-line" style={{ width: '64%' }} />
    </div>
  );
}

function Notice({ icon, title, body, cta, onCta }: { icon: 'lock' | 'chart'; title: string; body: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="pd-notice">
      <span className="pd-notice-ico" aria-hidden>
        {icon === 'lock' ? (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" fill="currentColor" /></svg>
        )}
      </span>
      <div className="pd-notice-title">{title}</div>
      <p className="pd-notice-body">{body}</p>
      {cta && onCta ? (
        <button type="button" className="fresh-btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={onCta}>{cta}</button>
      ) : null}
    </div>
  );
}

function ForecastContent({ reading, accent }: { reading: ForecastDaypartReading; accent: string }) {
  const items = [
    { label: 'Главное сегодня', value: reading.focus },
    { label: 'Люди и отношения', value: reading.relationships },
    { label: 'Действие дня', value: reading.guidance },
    { label: 'Что учесть', value: reading.risk },
    { label: 'Почему так по карте', value: reading.chartReason },
  ].filter((item) => item.value?.trim());

  return (
    <div className="pd-body">
      <div className="pd-hero" style={{ background: `${accent}1a`, borderColor: `${accent}33` }}>
        <p className="pd-hero-text">{reading.summary || reading.headline}</p>
      </div>
      <div className="compat-read" style={{ padding: 0, marginTop: 18 }}>
        {items.map((item) => (
          <div key={item.label} className="compat-read-block">
            <div className="compat-read-title" style={{ color: accent }}>{item.label}</div>
            <p className="compat-read-text">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionContent({ section }: { section: InterpretationSection }) {
  const paragraphs = splitParagraphs(section.content);
  return (
    <div className="pd-body">
      <div className="natal-sec-body" style={{ marginTop: 0 }}>
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="natal-sec-p" style={{ marginTop: index ? 12 : 0 }}>{paragraph}</p>
        ))}
      </div>
      {section.bullets?.length ? (
        <ul className="natal-sec-bullets" style={{ marginTop: 16 }}>
          {section.bullets.slice(0, 4).map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function DayLine({ points, nowHour, accent, ru }: { points: Array<{ hour: number; score: number }>; nowHour: number; accent: string; ru: boolean }) {
  const W = 320;
  const H = 84;
  const pad = 7;
  const sorted = [...points].filter((p) => Number.isFinite(p.hour) && Number.isFinite(p.score)).sort((a, b) => a.hour - b.hour);
  if (sorted.length < 2) return null;
  const x = (h: number) => pad + (Math.max(0, Math.min(24, h)) / 24) * (W - 2 * pad);
  const y = (s: number) => pad + (1 - Math.max(0, Math.min(100, s)) / 100) * (H - 2 * pad);
  const line = sorted.map((p, i) => `${i ? 'L' : 'M'} ${x(p.hour).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(sorted[sorted.length - 1].hour).toFixed(1)} ${H - pad} L ${x(sorted[0].hour).toFixed(1)} ${H - pad} Z`;
  const nearestNow = sorted.reduce((best, p) => (Math.abs(p.hour - nowHour) < Math.abs(best.hour - nowHour) ? p : best), sorted[0]);
  const nx = x(nowHour);
  const level = nearestNow.score >= 66
    ? (ru ? 'насыщенно' : 'high')
    : nearestNow.score >= 40
      ? (ru ? 'ровно' : 'steady')
      : (ru ? 'спокойно' : 'calm');

  return (
    <div className="dl">
      <div className="dl-head">
        {ru ? 'Линия дня' : 'Day line'}
        <span className="dl-now" style={{ color: accent }}>{ru ? 'сейчас' : 'now'}: {level}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="dl-svg" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="dl-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.28" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dl-grad)" />
        <path d={line} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1={nx} y1={pad} x2={nx} y2={H - pad} stroke="var(--fresh-text)" strokeWidth="1" opacity="0.45" />
        <circle cx={nx} cy={y(nearestNow.score)} r="4" fill={accent} stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="dl-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
      <div className="dl-cap">{ru ? 'Чем выше линия — тем больше энергии и удачных окон в этот час. Вертикаль — сейчас.' : 'The higher the line, the more energy and good windows that hour. The vertical marks now.'}</div>
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
  onCreateNatalChart,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const dateKey = useMemo(() => getMoscowTodayKey(), []);
  const access = useMemo(
    () => canAccessFeature('personal_daily', profile, { chartData, primaryChartId: chartId ?? null }),
    [chartData, chartId, profile]
  );
  const [activeSection, setActiveSection] = useState<PersonalDailySection>(initialSection);
  const [forecast, setForecast] = useState<ForecastDaypartReading | null>(null);
  const [sections, setSections] = useState<Partial<Record<HumanDailySectionKey, InterpretationSection>>>({});
  const [loadingKey, setLoadingKey] = useState<PersonalDailySection | null>(null);
  const [errorKey, setErrorKey] = useState<PersonalDailySection | null>(null);

  useEffect(() => { setActiveSection(initialSection); }, [initialSection]);

  const activeTab = resolveTab(activeSection);
  const activeDailySection = activeTab.sectionKey ? sections[activeTab.sectionKey] : null;
  const hasContent = activeTab.id === 'overview' ? !!forecast : !!activeDailySection?.content?.trim();
  const isLoading = loadingKey === activeTab.id;
  const hasError = errorKey === activeTab.id && !hasContent;

  // Свайп между темами — как в гороскопе (табы остаются индикатором).
  const [dir, setDir] = useState(0);
  const activeIndex = DAILY_TABS.findIndex((t) => t.id === activeSection);
  const goToSection = (nextIndex: number, direction: number) => {
    const idx = (nextIndex + DAILY_TABS.length) % DAILY_TABS.length;
    lumiaSelectionHaptic();
    setDir(direction);
    setActiveSection(DAILY_TABS[idx].id);
  };
  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const power = info.offset.x + info.velocity.x * 0.2;
    if (power < -70) goToSection(activeIndex + 1, 1);
    else if (power > 70) goToSection(activeIndex - 1, -1);
  };

  useEffect(() => {
    let alive = true;
    if (!access.allowed || !profile.id || !chartData) return () => { alive = false; };

    const tab = resolveTab(activeSection);
    if (tab.id === 'overview' && forecast) return () => { alive = false; };
    if (tab.sectionKey && sections[tab.sectionKey]?.content?.trim()) return () => { alive = false; };

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
        }).then((result) => { if (alive) setForecast(result.reading); });

    load
      .catch(() => { if (alive) setErrorKey(tab.id); })
      .finally(() => { if (alive) setLoadingKey((current) => (current === tab.id ? null : current)); });

    return () => { alive = false; };
  }, [access.allowed, activeSection, chartData, chartId, dateKey, forecast, profile, sections]);

  // Пульс дня (для «Линии дня») — берём из кэша today-assistant (тёплый с главной).
  const [home, setHome] = useState<TodayAssistantHomeResult | null>(
    () => (access.allowed && chartData ? getCachedTodayAssistantHome(profile, chartId, undefined, chartData) : null),
  );
  useEffect(() => {
    if (!access.allowed || !chartData || !profile.id) return;
    const cached = getCachedTodayAssistantHome(profile, chartId, undefined, chartData);
    if (cached) { setHome(cached); return; }
    let alive = true;
    void getTodayAssistantHome(profile, chartData, chartId).then((r) => { if (alive) setHome(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, [access.allowed, chartData, chartId, profile]);

  const pulsePoints = home && home.status === 'ready'
    ? home.pulse.points.map((p) => ({ hour: p.hour, score: p.score }))
    : null;
  const nowHour = home && home.status === 'ready' ? home.pulse.currentPoint.hour : new Date().getHours();

  const tabItems = useMemo(() => DAILY_TABS.map((t) => ({ id: t.id, label: t.label })), []);

  return (
    <div className="fresh-page">
      <FreshInnerHeader
        title={language === 'en' ? 'Personal horoscope' : 'Личный гороскоп'}
        onBack={() => { lumiaSelectionHaptic(); void onBack(); }}
      />

      <div className="pd-head">
        <div className="pd-head-title">{activeTab.title}</div>
        <div className="pd-head-sub">{activeTab.subtitle} · {formatLumiaDate(dateKey, language)}</div>
      </div>

      <FreshTabs tabs={tabItems} activeTab={activeSection} onTabChange={(id) => { lumiaSelectionHaptic(); setActiveSection(id as PersonalDailySection); }} />

      <div style={{ padding: '6px 20px 0' }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={activeTab.id}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d > 0 ? 44 : d < 0 ? -44 : 0 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d > 0 ? -44 : d < 0 ? 44 : 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={onDragEnd}
            style={{ touchAction: 'pan-y' }}
          >
            {access.status === 'needs_chart' ? (
              <Notice
                icon="chart"
                title={language === 'en' ? 'Create your natal chart' : 'Создать натальную карту'}
                body={language === 'en' ? 'Personal readings need birth data first.' : 'Для персонального прогноза сначала нужна твоя карта рождения.'}
                cta={onCreateNatalChart ? (language === 'en' ? 'Create chart' : 'Создать карту') : undefined}
                onCta={onCreateNatalChart ? () => { lumiaSelectionHaptic(); void onCreateNatalChart(); } : undefined}
              />
            ) : access.status === 'needs_premium' ? (
              <Notice
                icon="lock"
                title={language === 'en' ? 'Available in Premium' : 'Доступно в Premium'}
                body={language === 'en' ? 'Your personal daily horoscope by chart opens with Premium.' : 'Личный гороскоп по твоей карте — каждый день, открывается в Premium.'}
                cta={language === 'en' ? 'Open Premium' : 'Открыть Premium'}
                onCta={() => { lumiaSelectionHaptic(); void requestPremium(); }}
              />
            ) : !chartData || !profile.id ? (
              <Notice icon="chart" title={language === 'en' ? 'Check birth data' : 'Проверь данные рождения'} body={language === 'en' ? 'Open this section again after your birth data is saved.' : 'Открой раздел ещё раз, когда данные рождения сохранятся.'} />
            ) : isLoading && !hasContent ? (
              <Skeleton />
            ) : hasError ? (
              <Notice icon="chart" title={language === 'en' ? 'Could not prepare' : 'Не удалось подготовить'} body={language === 'en' ? 'Try opening this section again.' : 'Открой раздел ещё раз.'} />
            ) : activeTab.id === 'overview' && forecast ? (
              <>
                {pulsePoints ? <DayLine points={pulsePoints} nowHour={nowHour} accent={activeTab.accent} ru={language === 'ru'} /> : null}
                <ForecastContent reading={forecast} accent={activeTab.accent} />
              </>
            ) : activeDailySection ? (
              <SectionContent section={activeDailySection} />
            ) : (
              <Skeleton />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }} />
    </div>
  );
});

PersonalDailyScreen.displayName = 'PersonalDailyScreen';
