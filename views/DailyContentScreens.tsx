import React, { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { canAccessFeature, hasActivePremium } from '../lib/accessMatrix';
import type {
  InterpretationSection,
  NatalChartData,
  PersonalDailySection,
  UserProfile,
} from '../types';
import { formatDisplayDate, getMoscowTodayKey } from '../lib/date-utils';
import {
  DAILY_SECTION_TO_CANVAS_KEY,
  type DailyCanvas,
  type DailyCanvasTopicKey,
  type HumanDailySectionKey,
} from '../lib/natalHumanShared';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { FreshTabs } from '../components/fresh-ui';
import { FreshInnerHeader } from '../components/fresh-ui/FreshHeaders';
import { cardBackgroundStyle, getPersonalCardBackground } from '../lib/cardBackgrounds';

type PersonalDailyScreenProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  dailyPackage: DailyCanvas | null;
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
  { id: 'overview', accent: '#1478FF', sectionKey: 'daily_overview', ru: { label: 'Обзор', title: 'Личный гороскоп', subtitle: 'Главное на сегодня' }, en: { label: 'Overview', title: 'Personal Horoscope', subtitle: 'Today at a glance' } },
  { id: 'love', accent: '#2563EB', sectionKey: 'daily_love', ru: { label: 'Любовь', title: 'Любовь', subtitle: 'Отношения и личные реакции' }, en: { label: 'Love', title: 'Love', subtitle: 'Relationships and personal reactions' } },
  { id: 'money', accent: '#0F172A', sectionKey: 'daily_money', ru: { label: 'Деньги', title: 'Деньги', subtitle: 'Покупки, решения и цена выбора' }, en: { label: 'Money', title: 'Money', subtitle: 'Spending, choices, and value' } },
  { id: 'work', accent: '#38BDF8', sectionKey: 'daily_work_business', ru: { label: 'Работа', title: 'Работа', subtitle: 'Задачи, люди и рабочие решения' }, en: { label: 'Work', title: 'Work', subtitle: 'Tasks, people, and work decisions' } },
  { id: 'goals', accent: '#475569', sectionKey: 'daily_goals', ru: { label: 'Цели', title: 'Цели', subtitle: 'Что сегодня действительно стоит решить' }, en: { label: 'Goals', title: 'Goals', subtitle: 'What is actually worth deciding today' } },
  { id: 'family', accent: '#64748B', sectionKey: 'daily_family', ru: { label: 'Дом и семья', title: 'Дом и семья', subtitle: 'Близкие, дом и личное пространство' }, en: { label: 'Home & Family', title: 'Home & Family', subtitle: 'Close people, home, and personal space' } },
  { id: 'friendship', accent: '#0284C7', sectionKey: 'daily_friendship', ru: { label: 'Друзья', title: 'Друзья', subtitle: 'Компания, контакты и чужие реакции' }, en: { label: 'Friends', title: 'Friends', subtitle: 'Company, contacts, and other people’s reactions' } },
  { id: 'energy', accent: '#0F766E', sectionKey: 'daily_energy', ru: { label: 'Силы', title: 'Силы', subtitle: 'На что сегодня реально хватает ресурса' }, en: { label: 'Energy', title: 'Energy', subtitle: 'What you actually have capacity for today' } },
  { id: 'communication', accent: '#7C3AED', sectionKey: 'daily_communication', ru: { label: 'Разговоры', title: 'Разговоры', subtitle: 'Тон, паузы и важные договорённости' }, en: { label: 'Conversations', title: 'Conversations', subtitle: 'Tone, pauses, and important agreements' } },
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
  const explicitParagraphs = String(value || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (explicitParagraphs.length !== 1 || explicitParagraphs[0].length < 360) {
    return explicitParagraphs;
  }

  const sentences = explicitParagraphs[0]
    .match(/[^.!?…]+(?:[.!?…]+[»”"']?|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];

  if (sentences.length < 4) return explicitParagraphs;

  const paragraphCount = explicitParagraphs[0].length >= 760 && sentences.length >= 6 ? 3 : 2;
  const balancedParagraphs: string[] = [];
  let sentenceIndex = 0;

  for (let paragraphIndex = 0; paragraphIndex < paragraphCount; paragraphIndex += 1) {
    const paragraphsLeft = paragraphCount - paragraphIndex;
    const sentencesLeft = sentences.length - sentenceIndex;
    const take = Math.ceil(sentencesLeft / paragraphsLeft);
    balancedParagraphs.push(sentences.slice(sentenceIndex, sentenceIndex + take).join(' '));
    sentenceIndex += take;
  }

  return balancedParagraphs;
}

function resolveTab(tabs: DailyTabConfig[], section?: PersonalDailySection | null): DailyTabConfig {
  return tabs.find((tab) => tab.id === section) || tabs[0];
}

function sectionFromDailyCanvas(
  canvas: DailyCanvas | null,
  tab: DailyTabConfig,
  premium: boolean,
): InterpretationSection | null {
  if (!canvas || !tab.sectionKey) return null;
  const canvasKey = DAILY_SECTION_TO_CANVAS_KEY[tab.sectionKey];
  if (!canvasKey) return null;

  if (canvasKey === 'overview') {
    const content = canvas.overview?.trim();
    if (!content) return null;
    return {
      key: tab.sectionKey,
      title: canvas.hero_title?.trim() || tab.title,
      subtitle: tab.subtitle,
      access: 'free',
      isLocked: false,
      teaser: canvas.hero_hook?.trim() || '',
      content,
      bullets: [],
      ctaLabel: '',
      dayScore: canvas.meta?.day_score ?? null,
      dayScoreExplain: canvas.meta?.day_score_explain || '',
    };
  }

  const topicKey = canvasKey as DailyCanvasTopicKey;
  const topic = canvas[topicKey];
  const content = topic?.body?.trim() || '';
  const isFreeExtra = canvas.meta?.free_section_key === topicKey;
  if (!content && !premium && !isFreeExtra) return null;
  if (!content) return null;
  return {
    key: tab.sectionKey,
    title: tab.title,
    subtitle: tab.subtitle,
    access: isFreeExtra ? 'free' : 'premium',
    isLocked: false,
    teaser: topic?.hook?.trim() || '',
    content,
    bullets: [],
    ctaLabel: '',
  };
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
        <div className="pd-dd-head">{ru ? 'Аккуратнее' : 'Watch this'}</div>
        <ul className="pd-dd-list">
          {dontItems.map((item) => <li key={item} className="pd-dd-item">{item}</li>)}
        </ul>
      </div>
    </motion.div>
  );
}

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
  const showScore = isOverview && premium && typeof section.dayScore === 'number';
  return (
    <div className="pd-body">
      <motion.div className="natal-sec-body pd-reading-card" variants={PD_STAGGER} initial="hidden" animate="show">
        {paragraphs.map((paragraph, index) => (
          <motion.p key={index} className="natal-sec-p pd-reading-paragraph" variants={PD_ITEM}>{paragraph}</motion.p>
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
  dailyPackage,
  initialSection = 'overview',
  onBack,
  requestPremium,
  onCreateNatalChart,
}) => {
  void onBack;
  const language = profile.language === 'en' ? 'en' : 'ru';
  const dailyTabs = useMemo(() => getDailyTabs(language), [language]);
  const dateKey = useMemo(() => getMoscowTodayKey(), []);
  const access = useMemo(
    () => canAccessFeature('personal_daily', profile, { chartData, primaryChartId: chartId ?? null }),
    [chartData, chartId, profile]
  );
  const premium = hasActivePremium(profile);
  const [activeSection, setActiveSection] = useState<PersonalDailySection>(initialSection);

  useEffect(() => { setActiveSection(initialSection); }, [initialSection]);

  const activeTab = resolveTab(dailyTabs, activeSection);
  const activeBackground = useMemo(
    () => getPersonalCardBackground(activeSection, String(profile.id || 'guest'), dateKey),
    [activeSection, dateKey, profile.id],
  );
  const activeHeroStyle = {
    ['--pd-accent' as string]: activeTab.accent,
    ...cardBackgroundStyle(activeBackground),
  } as React.CSSProperties;
  const activeDailySection = useMemo(
    () => sectionFromDailyCanvas(dailyPackage, activeTab, premium),
    [activeTab, dailyPackage, premium]
  );
  const hasContent = !!activeDailySection?.content?.trim();
  const activeCanvasKey = activeTab.sectionKey ? DAILY_SECTION_TO_CANVAS_KEY[activeTab.sectionKey] : null;
  const premiumLocked = !!dailyPackage
    && !premium
    && !!activeCanvasKey
    && activeCanvasKey !== 'overview'
    && dailyPackage.meta?.free_section_key !== activeCanvasKey
    && !hasContent;
  const hasError = access.allowed && !!chartData && !!profile.id && !premiumLocked && !hasContent;

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

  const tabItems = useMemo(() => dailyTabs.map((t) => ({ id: t.id, label: t.label })), [dailyTabs]);

  return (
    <div className="fresh-page">
      <FreshInnerHeader title={language === 'en' ? 'Personal Horoscope' : 'Личный гороскоп'} />

      <FreshTabs tabs={tabItems} activeTab={activeSection} className="personal-daily-tabs" onTabChange={(id) => { lumiaSelectionHaptic(); setActiveSection(id as PersonalDailySection); }} />

      <div className="personal-daily-content">
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
            <div
              className={`pd-areahero pd-areahero--${activeTab.id}${activeBackground ? ' has-card-background' : ''}`}
              style={activeHeroStyle}
            >
              <div className="pd-areahero-title">{activeTab.title}</div>
              <div className="pd-areahero-sub">{activeTab.subtitle} · {formatDisplayDate(dateKey, language)}</div>
            </div>
            {access.status === 'needs_chart' ? (
              <Notice
                icon="chart"
                title={language === 'en' ? 'Create your natal chart' : 'Создать натальную карту'}
                body={language === 'en' ? 'A personal horoscope needs birth data first.' : 'Для личного гороскопа сначала нужна твоя карта рождения.'}
                cta={onCreateNatalChart ? (language === 'en' ? 'Create chart' : 'Создать карту') : undefined}
                onCta={onCreateNatalChart ? () => { lumiaSelectionHaptic(); void onCreateNatalChart(); } : undefined}
              />
            ) : access.status === 'needs_premium' ? (
              <Notice
                icon="lock"
                title={language === 'en' ? 'Available in Premium' : 'Доступно в Premium'}
                body={language === 'en' ? 'Your personal horoscope by chart opens with Premium.' : 'Личный гороскоп по твоей карте открывается в Premium.'}
                cta={language === 'en' ? 'Open Premium' : 'Открыть Premium'}
                onCta={() => { lumiaSelectionHaptic(); void requestPremium(); }}
              />
            ) : premiumLocked ? (
              <Notice
                icon="lock"
                title={language === 'en' ? 'Full personal horoscope is in Premium' : 'Полный личный гороскоп — в Premium'}
                body={language === 'en' ? 'Free opens the overview and one extra topic for today. Premium opens all nine sections.' : 'В бесплатном доступе открыт обзор и одна дополнительная тема дня. Premium открывает все девять разделов.'}
                cta={language === 'en' ? 'Open Premium' : 'Открыть Premium'}
                onCta={() => { lumiaSelectionHaptic(); void requestPremium(); }}
              />
            ) : !chartData || !profile.id ? (
              <Notice icon="chart" title={language === 'en' ? 'Check birth data' : 'Проверь данные рождения'} body={language === 'en' ? 'Open this section again after your birth data is saved.' : 'Открой раздел ещё раз, когда данные рождения сохранятся.'} />
            ) : hasError ? (
              <Notice
                icon="chart"
                title={language === 'en' ? 'The reading is still being prepared' : 'Разбор ещё готовится'}
                body={language === 'en' ? 'Return to the main loading flow and try again.' : 'Вернись к общей загрузке и попробуй ещё раз.'}
              />
            ) : activeDailySection ? (
              <SectionContent
                section={activeDailySection}
                accent={activeTab.accent}
                ru={language === 'ru'}
                isOverview={activeTab.id === 'overview'}
                premium={premium}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }} />
    </div>
  );
});

PersonalDailyScreen.displayName = 'PersonalDailyScreen';
