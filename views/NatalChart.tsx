import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  AstroEvidenceItem,
  NatalAnchorReading,
  NatalChartData,
  NatalDictionaryTerm,
  NatalFullReading,
  NatalLivingReading,
  NatalReadingPoint,
  UserProfile,
} from '../types';
import { getZodiacSign } from '../constants';
import {
  getCachedNatalAnchorLayer,
  getCachedPremiumNatalFullLayer,
  getCachedPremiumNatalLivingLayer,
  getNatalAnchorLayer,
  getPremiumNatalFullLayer,
  getPremiumNatalLivingLayer,
} from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import {
  buildNatalAnchorFallback,
  buildNatalFullFallback,
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

function ParagraphText({ text }: { text: string }) {
  return <FormattedAiText text={normalizeCopy(text)} variant="article" className="lumia-prose" />;
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
      transition={{ duration: 0.22 }}
      className={`scroll-mt-28 border-t border-astro-border/10 pt-7 first:border-t-0 first:pt-1 ${className}`.trim()}
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

function PointRows({
  points,
  numbered = false,
}: {
  points: NatalReadingPoint[];
  numbered?: boolean;
}) {
  return (
    <div className="space-y-0">
      {points.map((point, index) => (
        <div
          key={`${point.title || point.body}-${index}`}
          className="flex gap-3 border-t border-astro-border/10 py-4 first:border-t-0 first:pt-0 last:pb-0"
        >
          <span className="mt-[2px] flex h-5 min-w-5 items-center justify-center text-[12px] font-medium text-astro-highlight/85">
            {numbered ? `${index + 1}.` : ''}
          </span>
          <div className="min-w-0">
            {point.title ? <p className="text-[15px] font-medium leading-relaxed text-astro-text">{point.title}</p> : null}
            <p className={`${point.title ? 'mt-1 ' : ''}text-[15px] leading-relaxed text-astro-text/88 sm:text-base`}>
              {point.body}
            </p>
          </div>
        </div>
      ))}
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
  return (
    <div className="space-y-0">
      {anchors.map((anchor, index) => {
        const normalized = anchor.title.toLowerCase();
        const sign = normalized.includes('sun') || normalized.includes('солн') ? signs.sun
          : normalized.includes('moon') || normalized.includes('лун') ? signs.moon
            : signs.rising;
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

function EvidenceLines({
  evidence,
  lang,
}: {
  evidence: AstroEvidenceItem[];
  lang: Language;
}) {
  const visible = evidence.slice(0, 3);
  if (!visible.length) return null;

  return (
    <div className="mb-5 space-y-2 border-l border-astro-highlight/25 pl-4">
      {visible.map((item) => (
        <p key={item.id} className="text-[13px] leading-relaxed text-astro-subtext">
          <span className="text-astro-text/80">{item.label}</span>
          {item.orb != null ? ` · ${item.orb.toFixed(1)}°` : ''}
          {item.humanMeaning ? ` — ${item.humanMeaning}` : ''}
        </p>
      ))}
      <p className="text-[11px] uppercase tracking-[0.18em] text-astro-subtext/70">
        {lang === 'ru' ? 'по фактам карты' : 'from chart facts'}
      </p>
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
        .join(' · ')}
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
  const anchorFallback = useMemo(() => buildNatalAnchorFallback(lang, data), [data, lang]);
  const fullFallback = useMemo(() => buildNatalFullFallback(lang, data), [data, lang]);
  const livingFallback = useMemo(() => buildNatalLivingFallback(lang, periodKey, data), [data, lang, periodKey]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const dictionaryRef = useRef<HTMLElement | null>(null);

  const [anchorReading, setAnchorReading] = useState<NatalAnchorReading>(anchorFallback);
  const [fullReading, setFullReading] = useState<NatalFullReading | null>(profile.isPremium ? fullFallback : null);
  const [livingReading, setLivingReading] = useState<NatalLivingReading | null>(profile.isPremium ? livingFallback : null);
  const [activeSection, setActiveSection] = useState(profile.isPremium ? 'today' : 'portrait');
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
    setAnchorReading(anchorFallback);
    setFullReading(profile.isPremium ? fullFallback : null);
    setLivingReading(profile.isPremium ? livingFallback : null);
    setBaseExpanded(!profile.isPremium);
    setActiveSection(profile.isPremium ? 'today' : 'portrait');
  }, [anchorFallback, fullFallback, livingFallback, profile.isPremium]);

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

    const loadPremiumReadings = async () => {
      if (!data || !profile.isPremium) return;

      try {
        const [cachedLiving, cachedFull] = await Promise.all([
          getCachedPremiumNatalLivingLayer(String(profile.id), lang, chartId, periodKey),
          getCachedPremiumNatalFullLayer(String(profile.id), lang, chartId),
        ]);
        if (cancelled) return;

        if (cachedLiving) setLivingReading(cachedLiving);
        if (cachedFull) setFullReading(cachedFull);

        const tasks: Promise<void>[] = [];
        if (!cachedLiving) {
          tasks.push(
            getPremiumNatalLivingLayer(profile, data, chartId, periodKey)
              .then((reading) => { if (!cancelled) setLivingReading(reading); })
              .catch(console.error)
          );
        }
        if (!cachedFull) {
          tasks.push(
            getPremiumNatalFullLayer(profile, data, chartId)
              .then((reading) => { if (!cancelled) setFullReading(reading); })
              .catch(console.error)
          );
        }
        await Promise.allSettled(tasks);
      } catch (error) {
        console.error(error);
      }
    };

    void loadPremiumReadings();

    return () => {
      cancelled = true;
    };
  }, [chartId, data, lang, periodKey, profile]);

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
  }, [anchorReading, fullReading, livingReading, baseExpanded, profile.isPremium]);

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

  const freeSections: ReadingSection[] = useMemo(
    () => [
      { id: 'portrait', label: lang === 'ru' ? 'Портрет' : 'Portrait' },
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
      { id: 'work-money', label: lang === 'ru' ? 'Дела' : 'Work' },
      { id: 'evening', label: lang === 'ru' ? 'Вечер' : 'Evening' },
      { id: 'full-map', label: lang === 'ru' ? 'Карта' : 'Chart' },
      { id: 'dictionary', label: lang === 'ru' ? 'Словарь' : 'Dictionary' },
    ],
    [lang]
  );

  if (!hasChartData) {
    return <Loading />;
  }

  const baseReading = (
    <>
      <AirSection
        id="portrait"
        sectionRef={registerSection('portrait')}
        eyebrow={lang === 'ru' ? 'О тебе' : 'About you'}
        title={anchorReading.headline}
        intro={anchorReading.summary}
      >
        <p className="mb-5 text-[13px] leading-relaxed text-astro-subtext">{anchorSignature}</p>
        <ParagraphText text={anchorReading.portrait || anchorReading.reading || anchorFallback.portrait} />
      </AirSection>

      <AirSection
        id="anchors"
        sectionRef={registerSection('anchors')}
        eyebrow={lang === 'ru' ? 'Три главных акцента' : 'Three main anchors'}
        title={lang === 'ru' ? 'Характер, эмоции и первое впечатление' : 'Character, emotions, and first impression'}
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
        eyebrow={lang === 'ru' ? 'Как тебя видят' : 'How people read you'}
        title={lang === 'ru' ? 'Первое впечатление не всегда всё объясняет' : 'First impression is not the whole story'}
      >
        <ParagraphText text={anchorReading.perceivedByOthers} />
      </AirSection>

      <AirSection
        id="strengths"
        sectionRef={registerSection('strengths')}
        eyebrow={lang === 'ru' ? 'Что у тебя получается естественно' : 'What comes naturally'}
      >
        <PointRows points={anchorReading.strengths} numbered />
      </AirSection>

      <AirSection
        id="watchouts"
        sectionRef={registerSection('watchouts')}
        eyebrow={lang === 'ru' ? 'Где ты чаще теряешь себя' : 'Where you may lose yourself'}
      >
        <PointRows points={anchorReading.watchouts} numbered />
      </AirSection>
    </>
  );

  const daily = livingReading || livingFallback;
  const full = fullReading || fullFallback;

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
            eyebrow={lang === 'ru' ? 'Сегодня по карте' : 'Today through your chart'}
            title={daily.headline}
            intro={daily.summary}
          >
            <EvidenceLines evidence={daily.astroEvidence || []} lang={lang} />
            <ParagraphText text={daily.whyToday} />
          </AirSection>

          <AirSection
            id="situations"
            sectionRef={registerSection('situations')}
            eyebrow={lang === 'ru' ? 'Ситуации дня' : 'Situations today'}
          >
            <PointRows points={daily.situations || daily.daySituations || []} />
          </AirSection>

          <AirSection
            id="relationships"
            sectionRef={registerSection('relationships')}
            eyebrow={lang === 'ru' ? 'Отношения' : 'Relationships'}
          >
            <ParagraphText text={daily.relationships} />
          </AirSection>

          <AirSection
            id="work-money"
            sectionRef={registerSection('work-money')}
            eyebrow={lang === 'ru' ? 'Работа и деньги' : 'Work and money'}
          >
            <ParagraphText text={daily.workMoney} />
          </AirSection>

          <AirSection
            id="evening"
            sectionRef={registerSection('evening')}
            eyebrow={lang === 'ru' ? 'Вечером' : 'In the evening'}
          >
            <ParagraphText text={daily.evening} />
            <div className="mt-6 border-t border-astro-border/10 pt-5">
              <p className="lumia-label tracking-[0.18em]">
                {lang === 'ru' ? 'Вопрос дня' : 'Question of the day'}
              </p>
              <p className="mt-2 font-serif text-[1.35rem] leading-snug text-astro-text">
                {daily.questionOfDay}
              </p>
            </div>
          </AirSection>

          <AirSection
            id="full-map"
            sectionRef={registerSection('full-map')}
            eyebrow={lang === 'ru' ? 'Полная карта' : 'Full chart'}
            title={full.headline}
            intro={full.summary}
          >
            <EvidenceLines evidence={full.astroEvidence || []} lang={lang} />
            <div className="space-y-8">
              <div>
                <p className="lumia-label tracking-[0.18em]">{lang === 'ru' ? 'Главная конфигурация' : 'Main configuration'}</p>
                <div className="mt-3"><ParagraphText text={full.mainConfiguration} /></div>
              </div>
              <div>
                <p className="lumia-label tracking-[0.18em]">{lang === 'ru' ? 'Как ты реагируешь' : 'How you react'}</p>
                <div className="mt-3"><ParagraphText text={full.reactions} /></div>
              </div>
              <div>
                <p className="lumia-label tracking-[0.18em]">{lang === 'ru' ? 'Как ты выбираешь' : 'How you choose'}</p>
                <div className="mt-3"><ParagraphText text={full.choices} /></div>
              </div>
              <div>
                <p className="lumia-label tracking-[0.18em]">{lang === 'ru' ? 'Как строишь близость' : 'How you build closeness'}</p>
                <div className="mt-3"><ParagraphText text={full.closeness} /></div>
              </div>
              <div>
                <p className="lumia-label tracking-[0.18em]">{lang === 'ru' ? 'Где твоя сила' : 'Where your strength is'}</p>
                <div className="mt-3"><ParagraphText text={full.strengths} /></div>
              </div>
              <div>
                <p className="lumia-label tracking-[0.18em]">{lang === 'ru' ? 'Где повторяется напряжение' : 'Where tension repeats'}</p>
                <div className="mt-3"><ParagraphText text={full.tensionPattern} /></div>
              </div>
              <div>
                <p className="lumia-label tracking-[0.18em]">{lang === 'ru' ? 'Как с этим обращаться' : 'How to work with it'}</p>
                <div className="mt-3"><ParagraphText text={full.integration} /></div>
              </div>
            </div>
          </AirSection>

          <section className="border-t border-astro-border/10 pt-6">
            <button
              type="button"
              onClick={() => setBaseExpanded((value) => !value)}
              className="flex w-full items-start justify-between gap-4 text-left"
            >
              <span>
                <span className="lumia-label block tracking-[0.2em]">
                  {lang === 'ru' ? 'Перечитать начало' : 'Read the beginning again'}
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
              {lang === 'ru' ? 'Открыть ежедневную карту' : 'Open the daily chart'}
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
