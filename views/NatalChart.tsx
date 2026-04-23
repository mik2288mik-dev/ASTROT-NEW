import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  NatalAnchorReading,
  NatalChartData,
  NatalDictionaryTerm,
  NatalFullReading,
  NatalHumanSection,
  UserProfile,
} from '../types';
import { getZodiacSign } from '../constants';
import {
  getCachedNatalAnchorLayer,
  getCachedPremiumNatalFullLayer,
  getNatalAnchorLayer,
  getPremiumNatalFullLayer,
} from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import {
  buildNatalAnchorFallback,
  buildNatalFullFallback,
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

function ParagraphText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <FormattedAiText
      text={normalizeCopy(text)}
      variant="article"
      className={`lumia-prose ${className}`.trim()}
    />
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

function AirSection({
  id,
  sectionRef,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id: string;
  sectionRef: (node: HTMLElement | null) => void;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      ref={sectionRef}
      id={id}
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      transition={{ duration: 0.22 }}
      className="scroll-mt-28 border-t border-astro-border/10 pt-7 first:border-t-0 first:pt-0"
    >
      {eyebrow ? <p className="lumia-label tracking-[0.2em]">{eyebrow}</p> : null}
      <h2 className="mt-2 font-serif text-[1.75rem] leading-tight tracking-[-0.02em] text-astro-text sm:text-[1.95rem]">
        {title}
      </h2>
      {subtitle ? <p className="mt-2 text-[13px] leading-relaxed text-astro-subtext">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function ExampleLines({ examples }: { examples: string[] }) {
  if (!examples.length) return null;

  return (
    <div className="mt-5 space-y-2">
      {examples.map((example, index) => (
        <p key={`${example}-${index}`} className="flex gap-2 text-[14px] leading-relaxed text-astro-subtext">
          <span className="mt-[2px] text-astro-text/30">—</span>
          <span>{example}</span>
        </p>
      ))}
    </div>
  );
}

function SectionBody({ section }: { section: NatalHumanSection }) {
  return (
    <>
      <ParagraphText text={section.body} />
      <ExampleLines examples={section.examples} />
    </>
  );
}

function DictionaryPanel({
  terms,
  sectionRef,
  lang,
}: {
  terms: NatalDictionaryTerm[];
  sectionRef: (node: HTMLElement | null) => void;
  lang: Language;
}) {
  return (
    <motion.section
      ref={sectionRef}
      id="dictionary"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      transition={{ duration: 0.22 }}
      className="scroll-mt-28 border-t border-astro-border/10 pt-7"
    >
      <p className="lumia-label tracking-[0.2em]">{lang === 'ru' ? 'Словарь' : 'Dictionary'}</p>
      <div className="mt-5 space-y-0">
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
    </motion.section>
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
  const anchorFallback = useMemo(() => buildNatalAnchorFallback(lang, data), [data, lang]);
  const fullFallback = useMemo(() => buildNatalFullFallback(lang, data), [data, lang]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const dictionaryRef = useRef<HTMLElement | null>(null);

  const [anchorReading, setAnchorReading] = useState<NatalAnchorReading>(anchorFallback);
  const [fullReading, setFullReading] = useState<NatalFullReading | null>(profile.isPremium ? fullFallback : null);
  const [activeSection, setActiveSection] = useState('character');
  const [dictionaryVisible, setDictionaryVisible] = useState(false);

  const hasChartData = !!(data?.sun && data?.moon && data?.rising);

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
    setActiveSection('character');
  }, [anchorFallback, fullFallback, profile.isPremium]);

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

    const loadFull = async () => {
      if (!data || !profile.isPremium) return;

      try {
        const cached = await getCachedPremiumNatalFullLayer(String(profile.id), lang, chartId);
        if (cancelled) return;

        if (cached) {
          setFullReading(cached);
          return;
        }

        const generated = await getPremiumNatalFullLayer(profile, data, chartId);
        if (cancelled) return;
        setFullReading(generated);
      } catch (error) {
        console.error(error);
      }
    };

    void loadFull();
    return () => {
      cancelled = true;
    };
  }, [chartId, data, lang, profile]);

  useEffect(() => {
    const ids = profile.isPremium
      ? (fullReading?.sections || fullFallback.sections).map((section) => section.id)
      : anchorReading.sections.map((section) => section.id);
    if (!ids.length) return;

    const nodes = ids
      .map((id) => sectionRefs.current[id])
      .filter(Boolean) as HTMLElement[];

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
  }, [anchorReading.sections, fullFallback.sections, fullReading?.sections, profile.isPremium]);

  useEffect(() => {
    if (!dictionaryOpenSignal) return;
    setDictionaryVisible((value) => !value);
  }, [dictionaryOpenSignal]);

  useEffect(() => {
    if (!dictionaryVisible) return;
    requestAnimationFrame(() => {
      dictionaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [dictionaryVisible]);

  const localizedSun = data?.sun?.sign ? getZodiacSign(lang, data.sun.sign) : '—';
  const localizedMoon = data?.moon?.sign ? getZodiacSign(lang, data.moon.sign) : '—';
  const localizedRising = data?.rising?.sign ? getZodiacSign(lang, data.rising.sign) : '—';
  const signature =
    lang === 'ru'
      ? `Солнце в ${localizedSun} · Луна в ${localizedMoon} · Асцендент в ${localizedRising}`
      : `Sun in ${localizedSun} · Moon in ${localizedMoon} · Rising in ${localizedRising}`;

  const displayReading = profile.isPremium ? (fullReading || fullFallback) : anchorReading;
  const sections = displayReading.sections;
  const navigatorSections: ReadingSection[] = useMemo(
    () => sections.map((section) => ({ id: section.id, label: section.title })),
    [sections]
  );

  if (!hasChartData) {
    return <Loading />;
  }

  return (
    <ReadingScreenShell className="relative bg-white pb-10">
      <QuietNavigator sections={navigatorSections} activeSection={activeSection} onSelect={scrollToSection} />

      <section className="pb-2">
        <p className="lumia-label tracking-[0.2em]">{lang === 'ru' ? 'Натальная карта' : 'Natal chart'}</p>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight tracking-[-0.025em] text-astro-text sm:text-[2.2rem]">
          {displayReading.headline}
        </h1>
        <p className="mt-3 max-w-reading-wide text-[15px] leading-relaxed text-astro-subtext">{displayReading.lead}</p>
        <p className="mt-4 text-[13px] leading-relaxed text-astro-subtext">{signature}</p>
      </section>

      {dictionaryVisible ? (
        <DictionaryPanel terms={anchorReading.dictionaryTerms} sectionRef={registerSection('dictionary')} lang={lang} />
      ) : null}

      <div className="space-y-0">
        {sections.map((section, index) => (
          <AirSection
            key={section.id}
            id={section.id}
            sectionRef={registerSection(section.id)}
            eyebrow={index === 0 ? (lang === 'ru' ? 'О тебе' : 'About you') : undefined}
            title={section.title}
            subtitle={section.subtitle}
          >
            <SectionBody section={section} />
          </AirSection>
        ))}
      </div>

      {profile.isPremium ? (
        <motion.section
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          transition={{ duration: 0.22 }}
          className="border-t border-astro-border/10 pt-7"
        >
          <p className="lumia-label tracking-[0.2em]">{lang === 'ru' ? 'Итог' : 'Summary'}</p>
          <div className="mt-4">
            <ParagraphText text={fullReading?.synthesis || fullFallback.synthesis} />
          </div>
        </motion.section>
      ) : (
        <section className="border-t border-astro-border/10 pt-6">
          <button
            type="button"
            onClick={requestPremium}
            className="text-left text-[15px] font-medium leading-relaxed text-astro-highlight underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            {lang === 'ru' ? 'Открыть полную карту' : 'Open full chart'}
          </button>
        </section>
      )}
    </ReadingScreenShell>
  );
};
