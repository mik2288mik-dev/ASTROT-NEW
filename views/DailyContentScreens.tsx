import React, { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { canAccessFeature, hasActivePremium } from '../lib/accessMatrix';
import type {
  InterpretationSection,
  NatalChartData,
  PersonalDailySection,
  UserProfile,
} from '../types';
import { loadHumanDailySection } from '../services/natalReadingService';
import { formatDisplayDate, getMoscowTodayKey } from '../lib/date-utils';
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

const DAILY_TAB_BASE: Array<Omit<DailyTabConfig, 'label' | 'title' | 'subtitle'> & {
  ru: Pick<DailyTabConfig, 'label' | 'title' | 'subtitle'>;
  en: Pick<DailyTabConfig, 'label' | 'title' | 'subtitle'>;
}> = [
  { id: 'overview', accent: '#1478FF', sectionKey: 'daily_overview', ru: { label: 'Обзор', title: 'Личный разбор дня', subtitle: 'Главный фокус дня' }, en: { label: 'Overview', title: 'Personal Day', subtitle: 'The main focus of the day' } },
  { id: 'love', accent: '#2563EB', sectionKey: 'daily_love', ru: { label: 'Любовь', title: 'Любовь', subtitle: 'Близость, эмоции и разговоры' }, en: { label: 'Love', title: 'Love', subtitle: 'Closeness, feelings, and talks' } },
  { id: 'money', accent: '#0F172A', sectionKey: 'daily_money', ru: { label: 'Деньги', title: 'Деньги', subtitle: 'Решения, покупки и устойчивость' }, en: { label: 'Money', title: 'Money', subtitle: 'Choices, spending, and steadiness' } },
  { id: 'work', accent: '#38BDF8', sectionKey: 'daily_work_business', ru: { label: 'Работа', title: 'Работа', subtitle: 'Фокус, задачи и рабочий ритм' }, en: { label: 'Work', title: 'Work', subtitle: 'Focus, tasks, and work rhythm' } },
  { id: 'goals', accent: '#475569', sectionKey: 'daily_goals', ru: { label: 'Цели', title: 'Цели', subtitle: 'Один ясный следующий шаг' }, en: { label: 'Goals', title: 'Goals', subtitle: 'One clear next step' } },
  { id: 'family', accent: '#64748B', sectionKey: 'daily_family', ru: { label: 'Дом и семья', title: 'Дом и семья', subtitle: 'Опора, близкие и атмосфера дома' }, en: { label: 'Home & Family', title: 'Home & Family', subtitle: 'Support, close people, and home mood' } },
  { id: 'friendship', accent: '#0284C7', sectionKey: 'daily_friendship', ru: { label: 'Друзья', title: 'Друзья', subtitle: 'Контакты, поддержка и разговоры' }, en: { label: 'Friends', title: 'Friends', subtitle: 'Contacts, support, and conversations' } },
  { id: 'energy', accent: '#0F766E', sectionKey: 'daily_energy', ru: { label: 'Силы', title: 'Силы', subtitle: 'Темп дня, паузы и ресурс' }, en: { label: 'Energy', title: 'Energy', subtitle: 'Pace, pauses, and capacity' } },
  { id: 'communication', accent: '#7C3AED', sectionKey: 'daily_communication', ru: { label: 'Разговоры', title: 'Разговоры', subtitle: 'Слова, паузы и договорённости' }, en: { label: 'Conversations', title: 'Conversations', subtitle: 'Words, pauses, and agreements' } },
];

function getDailyTabs(language: 'ru' | 'en'): DailyTabConfig[] {
  return DAILY_TAB_BASE.map((tab) => ({
    id: tab.id,
    accent: tab.accent,
    sectionKey: tab.sectionKey,
    ...(language === 'en' ? tab.en : tab.ru),
  }));
}

function splitParagraphs(value?: string | null): string[] {
  return String(value || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveTab(tabs: DailyTabConfig[], section?: PersonalDailySection | null): DailyTabConfig {
  return tabs.find((tab) => tab.id === section) || tabs[0];
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

const SCORE_COLORS: Array<[number, string]> = [
  [80, '#1478FF'],
  [66, '#2563EB'],
  [50, '#475569'],
  [36, '#64748B'],
  [0, '#0F172A'],
];
function scoreTone(score: number): string {
  for (const [threshold, color] of SCORE_COLORS) {
    if (score >= threshold) return color;
  }
  return '#6366F1';
}

// Две колонки «Сегодня в плюс» / «Аккуратнее» — из do[]/dont[] полотна.
function DoDontColumns({ dayDo, dayDont, ru }: { dayDo?: string[]; dayDont?: string[]; ru: boolean }) {
  const doItems = (dayDo || []).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const dontItems = (dayDont || []).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (!doItems.length && !dontItems.length) return null;
  return (
    <motion.div className="pd-dd" variants={PD_ITEM}>
      <div className="pd-dd-col pd-dd-col--do">
        <div className="pd-dd-head">{ru ? 'Сегодня в плюс' : 'Today helps'}</div>
        <ul className="pd-dd-list">
          {doItems.map((item) => <li key={item} className="pd-dd-item">{item}</li>)}
        </ul>
      </div>
      <div className="pd-dd-col pd-dd-col--dont">
        <div className="pd-dd-head">{ru ? 'Аккуратнее' : 'Go gently'}</div>
        <ul className="pd-dd-list">
          {dontItems.map((item) => <li key={item} className="pd-dd-item">{item}</li>)}
        </ul>
      </div>
    </motion.div>
  );
}

// Оценка дня — единственное место показа во всём приложении (низ разбора, premium).
function DayScorePanel({ score, explain, ru }: { score: number; explain?: string; ru: boolean }) {
  const tone = scoreTone(score);
  return (
    <div className="pd-score" style={{ ['--pd-score-tone' as string]: tone } as React.CSSProperties}>
      <div className="pd-score-row">
        <span className="pd-score-k">{ru ? 'Оценка дня' : 'Day score'}</span>
        <span className="pd-score-val" style={{ color: tone }}>{score}<i>/100</i></span>
      </div>
      {explain?.trim() ? <p className="pd-score-explain">{explain.trim()}</p> : null}
    </div>
  );
}

const PD_STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const PD_ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

function SectionContent({
  section,
  accent,
  ru,
  isOverview = false,
  premium = false,
}: {
  section: InterpretationSection;
  accent: string;
  ru: boolean;
  isOverview?: boolean;
  premium?: boolean;
}) {
  const paragraphs = splitParagraphs(section.content);
  // Оценка дня показывается ТОЛЬКО в самом низу обзора дня и только премиуму.
  const showScore = isOverview && premium && typeof section.dayScore === 'number';
  return (
    <div className="pd-body">
      <motion.div className="natal-sec-body" style={{ marginTop: 0 }} variants={PD_STAGGER} initial="hidden" animate="show">
        {paragraphs.map((paragraph, index) => (
          <motion.p key={index} className="natal-sec-p" style={{ marginTop: index ? 12 : 0 }} variants={PD_ITEM}>{paragraph}</motion.p>
        ))}
      </motion.div>
      {isOverview ? (
        <motion.div variants={PD_STAGGER} initial="hidden" animate="show">
          <DoDontColumns dayDo={section.dayDo} dayDont={section.dayDont} ru={ru} />
        </motion.div>
      ) : section.bullets?.length ? (
        <motion.ul className="pd-points" style={{ ['--pd-accent' as string]: accent } as React.CSSProperties} variants={PD_STAGGER} initial="hidden" animate="show">
          {section.bullets.slice(0, 4).map((bullet) => (
            <motion.li key={bullet} className="pd-point" variants={PD_ITEM}>{bullet}</motion.li>
          ))}
        </motion.ul>
      ) : null}
      {showScore ? <DayScorePanel score={section.dayScore as number} explain={section.dayScoreExplain} ru={ru} /> : null}
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
  void onBack; // навигацию назад берёт системная кнопка Telegram
  const language = profile.language === 'en' ? 'en' : 'ru';
  const dailyTabs = useMemo(() => getDailyTabs(language), [language]);
  const dateKey = useMemo(() => getMoscowTodayKey(), []);
  const access = useMemo(
    () => canAccessFeature('personal_daily', profile, { chartData, primaryChartId: chartId ?? null }),
    [chartData, chartId, profile]
  );
  const premium = hasActivePremium(profile);
  const [activeSection, setActiveSection] = useState<PersonalDailySection>(initialSection);
  const [sections, setSections] = useState<Partial<Record<HumanDailySectionKey, InterpretationSection>>>({});
  const [loadingKey, setLoadingKey] = useState<PersonalDailySection | null>(null);
  const [errorKey, setErrorKey] = useState<PersonalDailySection | null>(null);
  const [premiumLockedKey, setPremiumLockedKey] = useState<PersonalDailySection | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => { setActiveSection(initialSection); }, [initialSection]);

  const activeTab = resolveTab(dailyTabs, activeSection);
  const activeDailySection = activeTab.sectionKey ? sections[activeTab.sectionKey] : null;
  const hasContent = !!activeDailySection?.content?.trim();
  const isLoading = loadingKey === activeTab.id;
  const hasError = errorKey === activeTab.id && !hasContent;

  // Свайп между темами — как в гороскопе (табы остаются индикатором).
  const [dir, setDir] = useState(0);
  const activeIndex = dailyTabs.findIndex((t) => t.id === activeSection);
  const goToSection = (nextIndex: number, direction: number) => {
    const idx = (nextIndex + dailyTabs.length) % dailyTabs.length;
    lumiaSelectionHaptic();
    setDir(direction);
    setActiveSection(dailyTabs[idx].id);
  };
  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const power = info.offset.x + info.velocity.x * 0.2;
    if (power < -70) goToSection(activeIndex + 1, 1);
    else if (power > 70) goToSection(activeIndex - 1, -1);
  };

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    if (!access.allowed || !profile.id || !chartData) return () => { alive = false; controller.abort(); };

    const tab = resolveTab(dailyTabs, activeSection);
    if (!tab.sectionKey) return () => { alive = false; controller.abort(); };
    if (sections[tab.sectionKey]?.content?.trim()) return () => { alive = false; controller.abort(); };

    setLoadingKey(tab.id);
    setErrorKey(null);
    setPremiumLockedKey((current) => (current === tab.id ? null : current));

    loadHumanDailySection(String(profile.id), tab.sectionKey, chartId ?? undefined, dateKey, {
      accessTier: 'premium',
      profile,
      chartData,
      signal: controller.signal,
    })
      .then((result) => {
        if (!alive) return;
        if (result.content?.content?.trim()) {
          setSections((current) => ({ ...current, [tab.sectionKey!]: result.content }));
          return;
        }
        setErrorKey(tab.id);
      })
      .catch((error) => {
        if (!alive) return;
        const err = error as { status?: number; code?: string };
        if (err.status === 403 || err.code === 'PREMIUM_REQUIRED') {
          setPremiumLockedKey(tab.id);
          return;
        }
        setErrorKey(tab.id);
      })
      .finally(() => { if (alive) setLoadingKey((current) => (current === tab.id ? null : current)); });

    return () => { alive = false; controller.abort(); };
  }, [access.allowed, activeSection, chartData, chartId, dailyTabs, dateKey, profile, reloadNonce, sections]);

  const retryActiveSection = () => {
    const tab = resolveTab(dailyTabs, activeSection);
    lumiaSelectionHaptic();
    setErrorKey(null);
    setPremiumLockedKey(null);
    if (tab.sectionKey) {
      setSections((current) => {
        const next = { ...current };
        delete next[tab.sectionKey!];
        return next;
      });
    }
    setReloadNonce((value) => value + 1);
  };

  const tabItems = useMemo(() => dailyTabs.map((t) => ({ id: t.id, label: t.label })), [dailyTabs]);

  return (
    <div className="fresh-page">
      {/* Без своей «Назад» — навигацию назад берёт системная кнопка Telegram. */}
      <FreshInnerHeader title={language === 'en' ? 'Personal Day' : 'Личный разбор дня'} />

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
            <div className={`pd-areahero pd-areahero--${activeTab.id}`} style={{ ['--pd-accent' as string]: activeTab.accent } as React.CSSProperties}>
              <div className="pd-areahero-title">{activeTab.title}</div>
              <div className="pd-areahero-sub">{activeTab.subtitle} · {formatDisplayDate(dateKey, language)}</div>
            </div>
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
                body={language === 'en' ? 'Your personal day by chart opens with Premium.' : 'Личный разбор дня по твоей карте открывается в Premium.'}
                cta={language === 'en' ? 'Open Premium' : 'Открыть Premium'}
                onCta={() => { lumiaSelectionHaptic(); void requestPremium(); }}
              />
            ) : premiumLockedKey === activeTab.id ? (
              <Notice
                icon="lock"
                title={language === 'en' ? 'Full day is in Premium' : 'Полный день — в Premium'}
                body={language === 'en' ? 'Free opens the overview and one extra topic for today. Premium opens all nine sections.' : 'В бесплатном доступе открыт обзор и одна дополнительная тема дня. Premium открывает все девять разделов.'}
                cta={language === 'en' ? 'Open Premium' : 'Открыть Premium'}
                onCta={() => { lumiaSelectionHaptic(); void requestPremium(); }}
              />
            ) : !chartData || !profile.id ? (
              <Notice icon="chart" title={language === 'en' ? 'Check birth data' : 'Проверь данные рождения'} body={language === 'en' ? 'Open this section again after your birth data is saved.' : 'Открой раздел ещё раз, когда данные рождения сохранятся.'} />
            ) : isLoading && !hasContent ? (
              <Skeleton />
            ) : hasError ? (
              <Notice
                icon="chart"
                title={language === 'en' ? 'The reading did not come together' : 'Разбор не собрался'}
                body={language === 'en' ? 'Nothing mystical here: the tech just stumbled. Let’s try again.' : 'Ничего мистического — просто техника споткнулась. Попробуем ещё раз.'}
                cta={language === 'en' ? 'Try again' : 'Попробовать ещё раз'}
                onCta={retryActiveSection}
              />
            ) : activeDailySection ? (
              <SectionContent
                section={activeDailySection}
                accent={activeTab.accent}
                ru={language === 'ru'}
                isOverview={activeTab.id === 'overview'}
                premium={premium}
              />
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
