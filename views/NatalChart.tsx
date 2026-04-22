import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  NatalAnchorReading,
  NatalChartData,
  NatalDictionaryTerm,
  NatalLivingReading,
  NatalReadingPoint,
  UserProfile,
} from '../types';
import { getZodiacSign } from '../constants';
import {
  getCachedNatalAnchorLayer,
  getCachedPremiumNatalLivingLayer,
  getNatalAnchorLayer,
  getPremiumNatalLivingLayer,
} from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import {
  buildNatalAnchorFallback,
  buildNatalLivingFallback,
  getCurrentNatalPeriodKey,
  mapNatalAnchorToLegacyIntro,
} from '../lib/natalReadings';
import { Loading } from '../components/ui/Loading';
import { FormattedAiText } from '../components/ui/FormattedAiText';
import { ReadingScreenShell } from '../components/layout/ScreenShell';

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  dictionaryOpenSignal?: number;
}

type Language = 'ru' | 'en';

interface ReadingSection {
  id: string;
  label: string;
}

const PLANET_NAMES: Record<string, { ru: string; en: string }> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  rising: { ru: 'Асцендент', en: 'Rising' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

function normalizeCopy(value?: string | null): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isGreetingParagraph(value: string, lang: Language) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return lang === 'ru'
    ? normalized.startsWith('привет')
    : normalized.startsWith('hello') || normalized.startsWith('hi ');
}

function sanitizeShortCopy(value: string | undefined, lang: Language): string | null {
  const normalized = normalizeCopy(value);
  if (!normalized || isGreetingParagraph(normalized, lang)) return null;
  return normalized;
}

function sanitizeLongCopy(value: string | undefined, lang: Language, blocked: Array<string | null | undefined> = []) {
  const blockedSet = new Set(blocked.map((item) => normalizeCopy(item).toLowerCase()).filter(Boolean));

  return normalizeCopy(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => !isGreetingParagraph(paragraph, lang))
    .filter((paragraph) => !blockedSet.has(paragraph.toLowerCase()))
    .join('\n\n');
}

function AirSection({
  id,
  sectionRef,
  eyebrow,
  title,
  intro,
  children,
  className = '',
}: {
  id: string;
  sectionRef: (node: HTMLElement | null) => void;
  eyebrow?: string;
  title?: string;
  intro?: string | null;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      ref={sectionRef}
      id={id}
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      transition={{ duration: 0.24 }}
      className={`scroll-mt-28 border-t border-astro-border/10 pt-6 first:border-t-0 first:pt-1 ${className}`.trim()}
    >
      {eyebrow ? <p className="lumia-label tracking-[0.2em]">{eyebrow}</p> : null}
      {title ? (
        <h2 className="mt-2 font-serif text-[1.75rem] leading-tight tracking-[-0.02em] text-astro-text sm:text-[2rem]">
          {title}
        </h2>
      ) : null}
      {intro ? <p className="mt-3 max-w-reading-wide text-[15px] leading-relaxed text-astro-subtext">{intro}</p> : null}
      {children ? <div className={title || eyebrow || intro ? 'mt-5' : ''}>{children}</div> : null}
    </motion.section>
  );
}

function QuietNavigator({
  sections,
  activeSection,
  onSelect,
}: {
  sections: ReadingSection[];
  activeSection: string;
  onSelect: (id: string) => void;
}) {
  if (sections.length < 2) return null;

  return (
    <nav
      aria-label="Reading sections"
      className="fixed right-2 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2"
    >
      {sections.map((section, index) => {
        const isActive = section.id === activeSection;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-label={section.label}
            className={`w-[2px] rounded-full transition-all duration-200 ${
              isActive ? 'h-7 bg-astro-text' : 'h-3 bg-astro-text/18 hover:bg-astro-text/35'
            }`}
          >
            <span className="sr-only">{index + 1}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ParagraphText({ text }: { text: string }) {
  return <FormattedAiText text={text} variant="article" className="lumia-prose" />;
}

function PointRows({
  points,
  numbered = false,
}: {
  points: Array<string | NatalReadingPoint>;
  numbered?: boolean;
}) {
  return (
    <div className="space-y-0">
      {points.map((point, index) => {
        const title = typeof point === 'string' ? '' : point.title;
        const body = typeof point === 'string' ? point : point.body;
        return (
          <div
            key={`${title || body}-${index}`}
            className="flex gap-3 border-t border-astro-border/10 py-4 first:border-t-0 first:pt-0 last:pb-0"
          >
            <span className="mt-[2px] flex h-5 min-w-5 items-center justify-center text-[12px] font-medium text-astro-highlight/85">
              {numbered ? `${index + 1}.` : ''}
            </span>
            <div className="min-w-0">
              {title ? <p className="text-[15px] font-medium leading-relaxed text-astro-text">{title}</p> : null}
              <p className={`${title ? 'mt-1 ' : ''}text-[15px] leading-relaxed text-astro-text/88 sm:text-base`}>
                {body}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnchorRows({
  anchors,
  lang,
  signs,
}: {
  anchors: NatalReadingPoint[];
  lang: Language;
  signs: { sun: string; moon: string; rising: string };
}) {
  const signMap: Record<string, string> = {
    sun: signs.sun,
    moon: signs.moon,
    rising: signs.rising,
    солнце: signs.sun,
    луна: signs.moon,
    асцендент: signs.rising,
  };

  return (
    <div className="space-y-0">
      {anchors.map((anchor, index) => {
        const normalized = anchor.title.toLowerCase();
        const sign = signMap[normalized] || '';
        return (
          <div
            key={`${anchor.title}-${index}`}
            className="border-t border-astro-border/10 py-4 first:border-t-0 first:pt-0 last:pb-0"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[15px] font-medium text-astro-text">{anchor.title}</p>
              {sign ? (
                <p className="shrink-0 text-[13px] text-astro-subtext">
                  {lang === 'ru' ? `в ${sign}` : `in ${sign}`}
                </p>
              ) : null}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-astro-text/86">{anchor.body}</p>
          </div>
        );
      })}
    </div>
  );
}

function DictionaryTerms({ terms }: { terms: NatalDictionaryTerm[] }) {
  return (
    <div className="space-y-0">
      {terms.map((term, index) => (
        <div
          key={`${term.term}-${index}`}
          className="border-t border-astro-border/10 py-4 first:border-t-0 first:pt-0 last:pb-0"
        >
          <p className="text-[15px] font-medium text-astro-text">{term.term}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-astro-text/82">{term.meaning}</p>
        </div>
      ))}
    </div>
  );
}

function SecondaryPlanetLine({
  planets,
  lang,
}: {
  planets: Array<{ id: string; sign: string | null }>;
  lang: Language;
}) {
  const visible = planets.filter((planet) => planet.sign);
  if (!visible.length) return null;

  return (
    <p className="mt-5 text-[13px] leading-relaxed text-astro-subtext">
      {visible
        .map((planet) => `${PLANET_NAMES[planet.id]?.[lang] || planet.id} — ${planet.sign}`)
        .join(' • ')}
    </p>
  );
}

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  requestPremium,
  onUpdateProfile,
  dictionaryOpenSignal = 0,
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const periodKey = useMemo(() => getCurrentNatalPeriodKey(), []);
  const anchorFallback = useMemo(() => buildNatalAnchorFallback(lang), [lang]);
  const livingFallback = useMemo(() => buildNatalLivingFallback(lang, periodKey), [lang, periodKey]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const dictionaryRef = useRef<HTMLElement | null>(null);

  const cachedLegacyIntro: NatalAnchorReading | null = null;

  const [anchorReading, setAnchorReading] = useState<NatalAnchorReading>(cachedLegacyIntro || anchorFallback);
  const [livingReading, setLivingReading] = useState<NatalLivingReading | null>(
    profile.isPremium ? livingFallback : null
  );
  const [activeSection, setActiveSection] = useState('rhythm');
  const [baseExpanded, setBaseExpanded] = useState(!profile.isPremium);

  const hasChartData = !!(data?.sun && data?.moon);

  const registerSection = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      sectionRefs.current[id] = node;
      if (id === 'dictionary') {
        dictionaryRef.current = node;
      }
    },
    []
  );

  const scrollToSection = useCallback((id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const updateProfileAnchorCache = useCallback(
    (reading: NatalAnchorReading) => {
      if (chartId) return;

      const intro = mapNatalAnchorToLegacyIntro(reading);
      const currentIntro = profile.generatedContent?.natalIntro || '';
      if (currentIntro === intro) return;

      const nextProfile: UserProfile = {
        ...profile,
        generatedContent: {
          ...(profile.generatedContent || { timestamps: {} }),
          natalIntro: intro,
          timestamps: {
            ...(profile.generatedContent?.timestamps || {}),
            natalIntroGenerated: Date.now(),
          },
        },
      };

      onUpdateProfile?.(nextProfile);
      saveProfile(nextProfile).catch(console.error);
    },
    [chartId, onUpdateProfile, profile]
  );

  useEffect(() => {
    setAnchorReading(cachedLegacyIntro || anchorFallback);
    setLivingReading(profile.isPremium ? livingFallback : null);
    setBaseExpanded(!profile.isPremium);
  }, [anchorFallback, cachedLegacyIntro, livingFallback, profile.isPremium]);

  useEffect(() => {
    let cancelled = false;

    const loadAnchor = async () => {
      if (!data) return;

      try {
        const cached = await getCachedNatalAnchorLayer(String(profile.id), lang, chartId);
        if (cancelled) return;

        if (cached) {
          setAnchorReading(cached);
          updateProfileAnchorCache(cached);
          return;
        }

        const generated = await getNatalAnchorLayer(profile, data, chartId);
        if (cancelled) return;
        setAnchorReading(generated);
        updateProfileAnchorCache(generated);
      } catch (error) {
        console.error(error);
      }
    };

    void loadAnchor();

    return () => {
      cancelled = true;
    };
  }, [chartId, data, lang, profile, updateProfileAnchorCache]);

  useEffect(() => {
    let cancelled = false;

    const loadLiving = async () => {
      if (!data || !profile.isPremium) return;

      setLivingReading((current) => current || livingFallback);

      try {
        const cached = await getCachedPremiumNatalLivingLayer(String(profile.id), lang, chartId, periodKey);
        if (cancelled) return;

        if (cached) {
          setLivingReading(cached);
          return;
        }

        const generated = await getPremiumNatalLivingLayer(profile, data, chartId, periodKey);
        if (cancelled) return;
        setLivingReading(generated);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLivingReading((current) => current || livingFallback);
        }
      }
    };

    void loadLiving();

    return () => {
      cancelled = true;
    };
  }, [chartId, data, lang, livingFallback, periodKey, profile]);

  useEffect(() => {
    const nodes = Object.values(sectionRefs.current).filter(Boolean) as HTMLElement[];
    if (!nodes.length || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      { threshold: [0.18, 0.32, 0.48], rootMargin: '-20% 0px -55% 0px' }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [anchorReading, livingReading, baseExpanded, profile.isPremium]);

  useEffect(() => {
    if (!dictionaryOpenSignal) return;
    requestAnimationFrame(() => {
      dictionaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [dictionaryOpenSignal]);

  const localizedSun = data?.sun?.sign ? getZodiacSign(lang, data.sun.sign) : '—';
  const localizedMoon = data?.moon?.sign ? getZodiacSign(lang, data.moon.sign) : '—';
  const localizedRising = data?.rising?.sign ? getZodiacSign(lang, data.rising.sign) : '—';
  const anchorSignature =
    lang === 'ru'
      ? `Солнце в ${localizedSun} · Луна в ${localizedMoon} · Асцендент в ${localizedRising}`
      : `Sun in ${localizedSun} · Moon in ${localizedMoon} · Rising in ${localizedRising}`;

  const secondaryPlanets = useMemo(
    () => [
      { id: 'mercury', sign: data?.mercury?.sign ? getZodiacSign(lang, data.mercury.sign) : null },
      { id: 'venus', sign: data?.venus?.sign ? getZodiacSign(lang, data.venus.sign) : null },
      { id: 'mars', sign: data?.mars?.sign ? getZodiacSign(lang, data.mars.sign) : null },
    ],
    [data?.mars?.sign, data?.mercury?.sign, data?.venus?.sign, lang]
  );

  const anchorHeadline =
    sanitizeShortCopy(anchorReading.headline, lang) ||
    (lang === 'ru' ? 'Твой внутренний ритм' : 'Your inner rhythm');
  const anchorSummary = sanitizeShortCopy(anchorReading.summary, lang);
  const anchorBody = sanitizeLongCopy(anchorReading.reading || anchorFallback.reading, lang, [
    anchorReading.headline,
    anchorReading.summary,
  ]);
  const livingContent = livingReading || livingFallback;
  const dailyHeadline =
    sanitizeShortCopy(livingContent.headline, lang) ||
    (lang === 'ru' ? 'Сегодня для тебя' : 'Today for you');
  const dailySummary = sanitizeShortCopy(livingContent.summary, lang);

  const freeSections: ReadingSection[] = useMemo(
    () => [
      { id: 'rhythm', label: lang === 'ru' ? 'Ритм' : 'Rhythm' },
      { id: 'anchors', label: lang === 'ru' ? 'Акценты' : 'Anchors' },
      { id: 'others', label: lang === 'ru' ? 'Впечатление' : 'Impression' },
      { id: 'strengths', label: lang === 'ru' ? 'Сильное' : 'Strengths' },
      { id: 'watchouts', label: lang === 'ru' ? 'Замечать' : 'Notice' },
      { id: 'dictionary', label: lang === 'ru' ? 'Словарь' : 'Dictionary' },
    ],
    [lang]
  );

  const premiumSections: ReadingSection[] = useMemo(
    () => [
      { id: 'today', label: lang === 'ru' ? 'Сегодня' : 'Today' },
      { id: 'situations', label: lang === 'ru' ? 'Ситуации' : 'Situations' },
      { id: 'relationships', label: lang === 'ru' ? 'Отношения' : 'Relationships' },
      { id: 'work-money', label: lang === 'ru' ? 'Работа' : 'Work' },
      { id: 'evening', label: lang === 'ru' ? 'Вечер' : 'Evening' },
      { id: 'pattern', label: lang === 'ru' ? 'Сценарий' : 'Pattern' },
      { id: 'personality', label: lang === 'ru' ? 'Личность' : 'Personality' },
    ],
    [lang]
  );

  if (!hasChartData) {
    return <Loading />;
  }

  const baseReading = (
    <>
      <AirSection
        id="rhythm"
        sectionRef={registerSection('rhythm')}
        eyebrow={lang === 'ru' ? 'О тебе' : 'About you'}
        title={anchorHeadline}
        intro={anchorSummary}
      >
        <p className="mb-5 text-[13px] leading-relaxed text-astro-subtext">{anchorSignature}</p>
        <ParagraphText text={anchorBody} />
      </AirSection>

      <AirSection
        id="anchors"
        sectionRef={registerSection('anchors')}
        eyebrow={lang === 'ru' ? 'Три главных акцента' : 'Three main anchors'}
        title={lang === 'ru' ? 'Как звучит твоя карта' : 'How your chart speaks'}
      >
        <AnchorRows
          anchors={anchorReading.threeAnchors}
          lang={lang}
          signs={{ sun: localizedSun, moon: localizedMoon, rising: localizedRising }}
        />
        <SecondaryPlanetLine planets={secondaryPlanets} lang={lang} />
      </AirSection>

      <AirSection
        id="others"
        sectionRef={registerSection('others')}
        eyebrow={lang === 'ru' ? 'Как тебя считывают люди' : 'How people read you'}
        title={lang === 'ru' ? 'Первое впечатление не всегда всё объясняет' : 'First impression is not the whole story'}
      >
        <ParagraphText text={sanitizeLongCopy(anchorReading.perceivedByOthers, lang)} />
      </AirSection>

      <AirSection
        id="strengths"
        sectionRef={registerSection('strengths')}
        eyebrow={lang === 'ru' ? 'Что в тебе особенно заметно' : 'What stands out in you'}
      >
        <PointRows points={anchorReading.strengths} numbered />
      </AirSection>

      <AirSection
        id="watchouts"
        sectionRef={registerSection('watchouts')}
        eyebrow={lang === 'ru' ? 'Что важно замечать за собой' : 'What is worth noticing'}
      >
        <PointRows points={anchorReading.watchouts} numbered />
      </AirSection>
    </>
  );

  return (
    <ReadingScreenShell className="relative bg-white pb-10">
      <QuietNavigator
        sections={profile.isPremium ? premiumSections : freeSections}
        activeSection={activeSection}
        onSelect={scrollToSection}
      />

      {profile.isPremium ? (
        <>
          <AirSection
            id="today"
            sectionRef={registerSection('today')}
            eyebrow={lang === 'ru' ? 'Сегодня для тебя' : 'Today for you'}
            title={dailyHeadline}
            intro={dailySummary}
          >
            <ParagraphText text={sanitizeLongCopy(livingContent.today, lang)} />
          </AirSection>

          <AirSection
            id="situations"
            sectionRef={registerSection('situations')}
            eyebrow={lang === 'ru' ? 'Ситуации дня' : 'Situations today'}
          >
            <PointRows points={livingContent.daySituations} />
          </AirSection>

          <AirSection
            id="relationships"
            sectionRef={registerSection('relationships')}
            eyebrow={lang === 'ru' ? 'Отношения сегодня' : 'Relationships today'}
            title={lang === 'ru' ? 'Говорить проще, чем додумывать' : 'Speak more simply than you guess'}
          >
            <ParagraphText text={sanitizeLongCopy(livingContent.relationshipsToday, lang)} />
          </AirSection>

          <AirSection
            id="work-money"
            sectionRef={registerSection('work-money')}
            eyebrow={lang === 'ru' ? 'Работа и деньги сегодня' : 'Work and money today'}
            title={lang === 'ru' ? 'Решения лучше принимать из ясности' : 'Decide from clarity'}
          >
            <ParagraphText text={sanitizeLongCopy(livingContent.workMoneyToday, lang)} />
          </AirSection>

          <AirSection
            id="evening"
            sectionRef={registerSection('evening')}
            eyebrow={lang === 'ru' ? 'Вечером' : 'In the evening'}
          >
            <ParagraphText text={sanitizeLongCopy(livingContent.evening, lang)} />
          </AirSection>

          <AirSection
            id="pattern"
            sectionRef={registerSection('pattern')}
            eyebrow={lang === 'ru' ? 'Повторяющийся сценарий' : 'Repeating pattern'}
            title={lang === 'ru' ? 'Что стоит увидеть именно сейчас' : 'What is worth seeing now'}
          >
            <ParagraphText text={sanitizeLongCopy(livingContent.repeatingScenario, lang)} />
            <div className="mt-6 border-t border-astro-border/10 pt-5">
              <p className="lumia-label tracking-[0.18em]">
                {lang === 'ru' ? 'Вопрос дня' : 'Question of the day'}
              </p>
              <p className="mt-2 font-serif text-[1.35rem] leading-snug text-astro-text">
                {livingContent.questionOfDay}
              </p>
            </div>
          </AirSection>

          <AirSection
            id="personality"
            sectionRef={registerSection('personality')}
            eyebrow={lang === 'ru' ? 'Полная интерпретация личности' : 'Full personality reading'}
            title={lang === 'ru' ? 'Как ты живёшь, реагируешь и выбираешь' : 'How you live, react, and choose'}
          >
            <ParagraphText text={sanitizeLongCopy(livingContent.fullPersonality, lang)} />
          </AirSection>

          <section className="border-t border-astro-border/10 pt-6">
            <button
              type="button"
              onClick={() => setBaseExpanded((value) => !value)}
              className="flex w-full items-start justify-between gap-4 text-left"
            >
              <span>
                <span className="lumia-label block tracking-[0.2em]">
                  {lang === 'ru' ? 'Перечитать карту' : 'Read the chart again'}
                </span>
                <span className="mt-2 block text-[13px] leading-relaxed text-astro-subtext">{anchorSignature}</span>
              </span>
              <span className="pt-1 text-[18px] leading-none text-astro-subtext">{baseExpanded ? '−' : '+'}</span>
            </button>
            {baseExpanded ? <div className="mt-7">{baseReading}</div> : null}
          </section>
        </>
      ) : (
        <>
          {baseReading}
          <section className="border-t border-astro-border/10 pt-6">
            <button
              type="button"
              onClick={requestPremium}
              className="text-left text-[15px] font-medium leading-relaxed text-astro-highlight underline underline-offset-4 transition-opacity hover:opacity-70"
            >
              {lang === 'ru' ? 'Продолжить карту глубже' : 'Continue deeper into the chart'}
            </button>
          </section>
        </>
      )}

      <AirSection
        id="dictionary"
        sectionRef={registerSection('dictionary')}
        eyebrow={lang === 'ru' ? 'Словарь' : 'Dictionary'}
        title={lang === 'ru' ? 'Простые слова для карты' : 'Simple words for the chart'}
        intro={
          lang === 'ru'
            ? 'Коротко о терминах, которые встречаются в карте. Без учебника и лишней сложности.'
            : 'A short plain-language guide to terms used in the chart.'
        }
      >
        <DictionaryTerms terms={anchorReading.dictionaryTerms} />
      </AirSection>
    </ReadingScreenShell>
  );
};
