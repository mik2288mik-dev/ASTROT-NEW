import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { NatalAnchorReading, NatalChartData, NatalLivingReading, UserProfile } from '../types';
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
  coerceNatalAnchorReading,
  getCurrentNatalPeriodKey,
  mapNatalAnchorToLegacyIntro,
} from '../lib/natalReadings';
import { Loading } from '../components/ui/Loading';
import { FormattedAiText } from '../components/ui/FormattedAiText';
import { READING_GLASS_SECTION_CLASS } from '../components/layout/ReadingLayout';
import { ReadingScreenShell } from '../components/layout/ScreenShell';

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
}

const PLANET_NAMES: Record<string, { ru: string; en: string }> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  rising: { ru: 'Асцендент', en: 'Rising' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
};

const PLANET_MEANINGS: Record<string, { ru: string; en: string }> = {
  sun: { ru: 'твоя основа', en: 'your core' },
  moon: { ru: 'эмоции и ритм', en: 'emotions and rhythm' },
  rising: { ru: 'то, как ты входишь в мир', en: 'how you meet the world' },
};

const LIVING_LABELS: Record<
  'activeTheme' | 'strength' | 'vulnerability' | 'relationships' | 'money' | 'guidance',
  { ru: string; en: string }
> = {
  activeTheme: { ru: 'Главная тема', en: 'Main theme' },
  strength: { ru: 'Что тебя усиливает', en: 'What strengthens you' },
  vulnerability: { ru: 'Где нужна бережность', en: 'Where to be gentle' },
  relationships: { ru: 'Отношения', en: 'Relationships' },
  money: { ru: 'Деньги и работа', en: 'Money and work' },
  guidance: { ru: 'Как пройти этот период', en: 'How to move through this period' },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

function SectionTitle({
  label,
  title,
  intro,
}: {
  label: string;
  title: string;
  intro?: string | null;
}) {
  return (
    <>
      <p className="lumia-label tracking-[0.2em]">{label}</p>
      <h2 className="mt-2 font-serif text-[1.9rem] leading-tight text-astro-text sm:text-[2.15rem]">
        {title}
      </h2>
      {intro ? (
        <p className="lumia-reading-intro lumia-muted mt-3 max-w-reading-wide">
          {intro}
        </p>
      ) : null}
    </>
  );
}

function NumberedList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className={READING_GLASS_SECTION_CLASS}>
      <p className="lumia-label tracking-[0.2em]">{title}</p>
      <ol className="mt-4 space-y-4">
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className="flex gap-3 border-b border-astro-border/10 pb-4 text-[15px] leading-relaxed text-astro-text last:border-b-0 last:pb-0 sm:text-base"
          >
            <span className="shrink-0 pt-[1px] text-[12px] font-semibold text-astro-highlight/80">
              {index + 1}.
            </span>
            <span className="min-w-0 [text-wrap:pretty]">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-astro-border/10 pb-4 last:border-b-0 last:pb-0">
      <p className="lumia-label text-[10px] tracking-[0.16em]">{label}</p>
      <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-astro-text sm:text-base">
        {value}
      </p>
    </div>
  );
}

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  requestPremium,
  onUpdateProfile,
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const periodKey = useMemo(() => getCurrentNatalPeriodKey(), []);
  const anchorFallback = useMemo(() => buildNatalAnchorFallback(lang), [lang]);
  const livingFallback = useMemo(() => buildNatalLivingFallback(lang, periodKey), [lang, periodKey]);

  const cachedLegacyIntro =
    !chartId && profile.generatedContent?.natalIntro
      ? coerceNatalAnchorReading(profile.generatedContent.natalIntro, lang)
      : null;

  const [anchorReading, setAnchorReading] = useState<NatalAnchorReading>(cachedLegacyIntro || anchorFallback);
  const [livingReading, setLivingReading] = useState<NatalLivingReading | null>(
    profile.isPremium ? livingFallback : null
  );

  const hasChartData = !!(data?.sun && data?.moon);

  const updateProfileAnchorCache = (reading: NatalAnchorReading) => {
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
  };

  useEffect(() => {
    setAnchorReading(cachedLegacyIntro || anchorFallback);
    setLivingReading(profile.isPremium ? livingFallback : null);
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
          if (!chartId) updateProfileAnchorCache(cached);
          return;
        }

        const generated = await getNatalAnchorLayer(profile, data, chartId);
        if (cancelled) return;
        setAnchorReading(generated);
        if (!chartId) updateProfileAnchorCache(generated);
      } catch (error) {
        console.error(error);
      }
    };

    void loadAnchor();

    return () => {
      cancelled = true;
    };
  }, [
    chartId,
    data,
    lang,
    profile,
  ]);

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

  const localizedSun = data?.sun?.sign ? getZodiacSign(lang, data.sun.sign) : '—';
  const localizedMoon = data?.moon?.sign ? getZodiacSign(lang, data.moon.sign) : '—';
  const localizedRising = data?.rising?.sign ? getZodiacSign(lang, data.rising.sign) : '—';

  const anchorIntro =
    lang === 'ru'
      ? `Солнце в ${localizedSun}, Луна в ${localizedMoon}, Асцендент в ${localizedRising}.`
      : `Sun in ${localizedSun}, Moon in ${localizedMoon}, Rising in ${localizedRising}.`;

  const mainPlanets = useMemo(
    () => [
      { id: 'sun', sign: localizedSun },
      { id: 'moon', sign: localizedMoon },
      { id: 'rising', sign: localizedRising },
    ],
    [localizedMoon, localizedRising, localizedSun]
  );

  const secondaryPlanets = useMemo(
    () =>
      [
        { id: 'mercury', sign: data?.mercury?.sign ? getZodiacSign(lang, data.mercury.sign) : null },
        { id: 'venus', sign: data?.venus?.sign ? getZodiacSign(lang, data.venus.sign) : null },
        { id: 'mars', sign: data?.mars?.sign ? getZodiacSign(lang, data.mars.sign) : null },
      ].filter((planet) => planet.sign),
    [data?.mars?.sign, data?.mercury?.sign, data?.venus?.sign, lang]
  );

  const livingContent = livingReading || livingFallback;

  if (!hasChartData) {
    return <Loading />;
  }

  return (
    <ReadingScreenShell className="pb-8">
      <motion.section
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        transition={{ duration: 0.24 }}
        className="border-t-0 pt-4"
      >
        <SectionTitle
          label={lang === 'ru' ? 'О тебе' : 'About you'}
          title={lang === 'ru' ? 'Твой внутренний ритм' : 'Your inner rhythm'}
          intro={anchorReading.summary || anchorIntro}
        />

        <p className="mt-5 text-sm leading-relaxed text-astro-subtext sm:text-[15px]">
          {anchorIntro}
        </p>

        <div className="mt-6 max-w-reading-wide">
          <FormattedAiText
            text={anchorReading.reading || anchorFallback.reading}
            variant="article"
            className="lumia-prose"
          />
        </div>
      </motion.section>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        transition={{ duration: 0.24, delay: 0.03 }}
      >
        <NumberedList
          title={lang === 'ru' ? 'Что в тебе особенно заметно' : 'What stands out most in you'}
          items={anchorReading.strengths}
        />
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        transition={{ duration: 0.24, delay: 0.05 }}
      >
        <NumberedList
          title={lang === 'ru' ? 'Что важно замечать за собой' : 'What is worth noticing in yourself'}
          items={anchorReading.patterns}
        />
      </motion.div>

      <motion.section
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        transition={{ duration: 0.24, delay: 0.07 }}
        className={READING_GLASS_SECTION_CLASS}
      >
        <p className="lumia-label tracking-[0.2em]">
          {lang === 'ru' ? 'Твои ключевые акценты' : 'Your key anchors'}
        </p>

        <div className="mt-4 space-y-4">
          {mainPlanets.map((planet) => (
            <div
              key={planet.id}
              className="border-b border-astro-border/10 pb-4 last:border-b-0 last:pb-0"
            >
              <p className="lumia-label text-[10px] tracking-[0.16em]">
                {PLANET_NAMES[planet.id]?.[lang]}
              </p>
              <p className="mt-1 text-lg font-medium text-astro-text">{planet.sign}</p>
              <p className="mt-1 text-sm leading-relaxed text-astro-subtext">
                {PLANET_MEANINGS[planet.id]?.[lang]}
              </p>
            </div>
          ))}
        </div>

        {secondaryPlanets.length > 0 ? (
          <p className="mt-5 text-sm leading-relaxed text-astro-subtext">
            {secondaryPlanets
              .map((planet) => `${PLANET_NAMES[planet.id]?.[lang]} — ${planet.sign}`)
              .join(' • ')}
          </p>
        ) : null}
      </motion.section>

      <motion.section
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        transition={{ duration: 0.24, delay: 0.09 }}
        className={READING_GLASS_SECTION_CLASS}
      >
        <SectionTitle
          label={lang === 'ru' ? 'Что меняется сейчас' : 'What is shifting now'}
          title={livingContent.headline}
          intro={livingContent.summary}
        />

        {profile.isPremium ? (
          <div className="mt-6 space-y-4">
            <DetailLine label={LIVING_LABELS.activeTheme[lang]} value={livingContent.activeTheme} />
            <DetailLine label={LIVING_LABELS.strength[lang]} value={livingContent.strength} />
            <DetailLine label={LIVING_LABELS.vulnerability[lang]} value={livingContent.vulnerability} />
            <DetailLine label={LIVING_LABELS.relationships[lang]} value={livingContent.relationships} />
            <DetailLine label={LIVING_LABELS.money[lang]} value={livingContent.money} />
            <DetailLine label={LIVING_LABELS.guidance[lang]} value={livingContent.guidance} />
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="max-w-prose text-sm leading-relaxed text-astro-text/82">
              {lang === 'ru'
                ? 'Живой слой показывает, что в тебе активируется именно сейчас: где твоя сила, где нужна бережность и как лучше пройти текущий период.'
                : 'The living layer shows what is activating in you right now: where your strength is, where you need gentleness, and how to move through the current period.'}
            </p>
            <button
              type="button"
              onClick={requestPremium}
              className="inline-flex items-center px-0 py-1 text-sm font-medium text-astro-highlight underline underline-offset-4 transition-opacity hover:opacity-70"
            >
              {lang === 'ru' ? 'Открыть живой слой' : 'Open the living layer'}
            </button>
          </div>
        )}
      </motion.section>
    </ReadingScreenShell>
  );
};
