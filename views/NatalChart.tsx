/** Natal screen: anchor (free, persistent) + living (premium). IA: docs/NATAL_SCREEN_IA.md */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { NatalAnchorReading, NatalChartData, NatalLivingReading, UserProfile } from '../types';
import { getText, getZodiacSign } from '../constants';
import {
  getCachedNatalAnchorLayer,
  getCachedPremiumNatalLivingLayer,
  getNatalAnchorLayer,
  getPremiumNatalLivingLayer,
} from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import { getTelegramInitDataHeaders } from '../services/sessionService';
import { coerceNatalAnchorReading, mapNatalAnchorToLegacyIntro } from '../lib/natalReadings';
import { Loading } from '../components/ui/Loading';
import { FormattedAiText } from '../components/ui/FormattedAiText';
import { READING_GLASS_SECTION_CLASS } from '../components/layout/ReadingLayout';
import { ReadingScreenShell } from '../components/layout/ScreenShell';

const NATAL_INTRO_REFRESH_COST = 250;

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onBalanceUpdate?: (balance: number) => void;
}

const PLANET_SYMBOLS: Record<string, string> = {
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  rising: '↑',
  ascendant: '↑',
};

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
  mercury: { ru: 'мышление', en: 'mind' },
  venus: { ru: 'близость', en: 'closeness' },
  mars: { ru: 'драйв', en: 'drive' },
};

type DetailLineProps = {
  label: string;
  value: string;
};

const DetailLine: React.FC<DetailLineProps> = ({ label, value }) => (
  <div className="border-b border-astro-border/15 pb-3 last:border-b-0 last:pb-0">
    <p className="lumia-label text-[10px] tracking-[0.16em]">{label}</p>
    <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-astro-text sm:text-base">
      {value}
    </p>
  </div>
);

const ListBlock: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div className="space-y-3">
    <p className="lumia-label tracking-[0.18em]">{title}</p>
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li
          key={`${title}-${index}`}
          className="flex gap-3 border-b border-astro-border/12 px-0 py-3 text-[15px] leading-relaxed text-astro-text last:border-b-0 sm:text-base"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-astro-highlight/14 text-xs font-semibold text-astro-highlight ring-1 ring-astro-highlight/18 sm:h-8 sm:w-8 sm:text-sm">
            {index + 1}
          </span>
          <span className="min-w-0 pt-0.5 [text-wrap:pretty]">{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  requestPremium,
  onUpdateProfile,
  onBalanceUpdate,
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const cachedLegacyIntro = !chartId && profile.generatedContent?.natalIntro
    ? coerceNatalAnchorReading(profile.generatedContent.natalIntro, lang)
    : null;

  const [anchorReading, setAnchorReading] = useState<NatalAnchorReading | null>(cachedLegacyIntro);
  const [livingReading, setLivingReading] = useState<NatalLivingReading | null>(null);
  const [anchorLoading, setAnchorLoading] = useState(!cachedLegacyIntro);
  const [livingLoading, setLivingLoading] = useState(profile.isPremium);
  const [livingError, setLivingError] = useState<string | null>(null);
  const [refreshAnchorBusy, setRefreshAnchorBusy] = useState(false);
  const [hasTelegramAuth, setHasTelegramAuth] = useState(false);
  const hasChartData = !!(data?.sun && data?.moon);

  const updateProfileAnchorCache = (reading: NatalAnchorReading, nextBalance?: number) => {
    if (chartId) {
      if (typeof nextBalance === 'number') {
        onUpdateProfile?.({ ...profile, lumiBalance: nextBalance });
      }
      return;
    }

    const intro = mapNatalAnchorToLegacyIntro(reading);
    const currentIntro = profile.generatedContent?.natalIntro || '';
    const currentBalance = profile.lumiBalance;
    if (currentIntro === intro && (typeof nextBalance !== 'number' || nextBalance === currentBalance)) {
      return;
    }

    const nextProfile: UserProfile = {
      ...profile,
      lumiBalance: typeof nextBalance === 'number' ? nextBalance : profile.lumiBalance,
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
    setHasTelegramAuth(Object.keys(getTelegramInitDataHeaders()).length > 0);
  }, []);

  useEffect(() => {
    setAnchorReading(cachedLegacyIntro);
    setAnchorLoading(!cachedLegacyIntro);
    setLivingReading(null);
    setLivingLoading(profile.isPremium);
    setLivingError(null);
  }, [cachedLegacyIntro, chartId, data?.sun?.sign, profile.isPremium]);

  useEffect(() => {
    let cancelled = false;

    const loadAnchor = async () => {
      if (!data) {
        setAnchorLoading(false);
        return;
      }

      try {
        const cached = await getCachedNatalAnchorLayer(String(profile.id), lang, chartId);
        if (cancelled) return;

        if (cached) {
          setAnchorReading(cached);
          setAnchorLoading(false);
          if (!chartId) {
            updateProfileAnchorCache(cached);
          }
          return;
        }

        const generated = await getNatalAnchorLayer(profile, data, chartId);
        if (cancelled) return;
        setAnchorReading(generated);
        setAnchorLoading(false);
        if (!chartId) {
          updateProfileAnchorCache(generated);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setAnchorReading((current) => current || cachedLegacyIntro);
          setAnchorLoading(false);
        }
      }
    };

    void loadAnchor();

    return () => {
      cancelled = true;
    };
  }, [
    cachedLegacyIntro,
    chartId,
    data,
    lang,
    profile.birthDate,
    profile.birthPlace,
    profile.birthTime,
    profile.id,
    profile.language,
    profile.name,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadLiving = async () => {
      if (!data) {
        setLivingReading(null);
        setLivingLoading(false);
        setLivingError(null);
        return;
      }

      if (!profile.isPremium) {
        setLivingReading(null);
        setLivingLoading(false);
        setLivingError(null);
        return;
      }

      setLivingLoading(true);
      setLivingError(null);

      try {
        const cached = await getCachedPremiumNatalLivingLayer(String(profile.id), lang, chartId);
        if (cancelled) return;

        if (cached) {
          setLivingReading(cached);
          setLivingLoading(false);
          return;
        }

        const generated = await getPremiumNatalLivingLayer(profile, data, chartId);
        if (cancelled) return;
        setLivingReading(generated);
        setLivingLoading(false);
      } catch (error: any) {
        console.error(error);
        if (!cancelled) {
          setLivingReading(null);
          setLivingLoading(false);
          setLivingError(error?.message || getText(lang, 'chart.living_error'));
        }
      }
    };

    void loadLiving();

    return () => {
      cancelled = true;
    };
  }, [
    chartId,
    data,
    lang,
    profile.birthDate,
    profile.birthPlace,
    profile.birthTime,
    profile.id,
    profile.isPremium,
    profile.language,
    profile.name,
  ]);

  const handleRefreshAnchor = async () => {
    const headers = getTelegramInitDataHeaders();
    if (!Object.keys(headers).length || refreshAnchorBusy || !data) return;

    setRefreshAnchorBusy(true);
    try {
      const res = await fetch('/api/astrology/refresh-natal-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          userId: profile.id,
          profile,
          chartData: data,
          chartId: chartId ?? undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || payload.error || 'refresh failed');
      }

      const nextReading = payload.reading
        ? coerceNatalAnchorReading(payload.reading, lang)
        : payload.intro
          ? coerceNatalAnchorReading(payload.intro, lang)
          : null;

      if (nextReading) {
        setAnchorReading(nextReading);
        updateProfileAnchorCache(nextReading, typeof payload.newBalance === 'number' ? payload.newBalance : undefined);
      } else if (typeof payload.newBalance === 'number') {
        onUpdateProfile?.({ ...profile, lumiBalance: payload.newBalance });
      }

      if (typeof payload.newBalance === 'number') {
        onBalanceUpdate?.(payload.newBalance);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshAnchorBusy(false);
    }
  };

  const localizedSun = data?.sun?.sign ? getZodiacSign(lang, data.sun.sign) : '—';
  const localizedMoon = data?.moon?.sign ? getZodiacSign(lang, data.moon.sign) : '—';
  const localizedRising = data?.rising?.sign ? getZodiacSign(lang, data.rising.sign) : '—';
  const lumiBalance = profile.lumiBalance ?? 0;
  const refreshAnchorDisabled = refreshAnchorBusy || lumiBalance < NATAL_INTRO_REFRESH_COST;

  const mainPlanets = useMemo(
    () => [
      { id: 'sun', data: data?.sun ?? null },
      { id: 'moon', data: data?.moon ?? null },
      { id: 'rising', data: data?.rising ?? null },
    ],
    [data]
  );

  const otherPlanets = useMemo(
    () => [
      { id: 'mercury', data: data?.mercury ?? null },
      { id: 'venus', data: data?.venus ?? null },
      { id: 'mars', data: data?.mars ?? null },
    ].filter((planet) => planet.data),
    [data]
  );

  if (!hasChartData) {
    return <Loading />;
  }

  return (
    <ReadingScreenShell className="pb-6">
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border-t-0 pt-4">
        <div className="px-0 py-1 sm:py-1.5">
          <p className="lumia-label tracking-[0.2em]">{getText(lang, 'chart.anchor_label')}</p>
          <h1 className="lumia-reading-display mt-3 text-astro-text">
            {anchorReading?.headline || getText(lang, 'chart.anchor_title')}
          </h1>
          <p className="lumia-reading-intro lumia-muted mx-auto mt-4 max-w-reading-wide">
            {anchorReading?.summary || getText(lang, 'chart.anchor_body')}
          </p>

          <div className="mx-auto mt-6 max-w-reading-wide border-t border-astro-border/15 pt-4 text-center text-xs leading-relaxed text-astro-subtext sm:text-[13px]">
            <p>
              {lang === 'ru'
                ? `Солнце в ${localizedSun}, Луна в ${localizedMoon}, Асцендент в ${localizedRising}.`
                : `Sun in ${localizedSun}, Moon in ${localizedMoon}, Rising in ${localizedRising}.`}
            </p>
          </div>

          <div className="mt-5">
            {anchorLoading && !anchorReading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-astro-highlight border-t-transparent" />
              </div>
            ) : anchorReading ? (
              <div className="mx-auto max-w-reading-wide">
                <FormattedAiText text={anchorReading.reading} variant="article" className="lumia-prose" />
              </div>
            ) : (
              <p className="lumia-muted text-sm leading-relaxed">{getText(lang, 'chart.anchor_loading')}</p>
            )}
          </div>

          {hasTelegramAuth && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => void handleRefreshAnchor()}
                disabled={refreshAnchorDisabled}
                className="flex min-h-[44px] w-full items-center rounded-xl bg-astro-highlight/12 px-4 py-3 text-left text-sm font-medium text-astro-highlight ring-1 ring-astro-highlight/28 transition-[box-shadow] hover:ring-astro-highlight/45 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshAnchorBusy
                  ? getText(lang, 'chart.refresh_intro_loading')
                  : getText(lang, 'chart.refresh_intro_cta').replace('{cost}', String(NATAL_INTRO_REFRESH_COST))}
              </button>
              {lumiBalance < NATAL_INTRO_REFRESH_COST && (
                <p className="mt-2 text-center text-xs text-astro-subtext">
                  {getText(lang, 'chart.refresh_intro_insufficient')}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.section>

      {anchorReading && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 sm:mt-5">
          <div className={READING_GLASS_SECTION_CLASS}>
            <div className="grid gap-5 lg:grid-cols-2">
              <ListBlock title={getText(lang, 'chart.anchor_strengths_title')} items={anchorReading.strengths} />
              <ListBlock title={getText(lang, 'chart.anchor_patterns_title')} items={anchorReading.patterns} />
            </div>
          </div>
        </motion.section>
      )}

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 sm:mt-7">
        <div className={READING_GLASS_SECTION_CLASS}>
          <p className="lumia-label tracking-[0.2em]">{getText(lang, 'chart.core_title')}</p>

          <div className="mt-4 space-y-2.5">
            {mainPlanets.map((planet) => (
              <div
                key={planet.id}
                className="border-b border-astro-border/12 px-0 py-3 last:border-b-0 sm:flex sm:items-center sm:gap-4"
              >
                <div className="flex items-center gap-3 sm:flex-1 sm:gap-4">
                  <span className="shrink-0 text-lg text-astro-highlight/90 sm:text-xl">{PLANET_SYMBOLS[planet.id]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="lumia-label text-[10px] tracking-[0.16em]">{PLANET_NAMES[planet.id]?.[lang]}</p>
                    <p className="mt-0.5 text-base font-semibold text-astro-text sm:text-lg">
                      {planet.data?.sign ? getZodiacSign(lang, planet.data.sign) : '—'}
                    </p>
                  </div>
                </div>
                <p className="mt-2 pl-10 text-xs leading-snug text-astro-subtext sm:mt-0 sm:max-w-[46%] sm:flex-none sm:pl-0 sm:text-right sm:text-[13px]">
                  {PLANET_MEANINGS[planet.id]?.[lang]}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {otherPlanets.map((planet) => (
              <span
                key={planet.id}
                className="inline-flex items-center gap-2 rounded-full border border-astro-border/55 bg-astro-bg/18 px-3 py-2 text-xs text-astro-subtext"
              >
                <span className="text-astro-highlight">{PLANET_SYMBOLS[planet.id]}</span>
                <span>{PLANET_NAMES[planet.id]?.[lang]}</span>
                <span>·</span>
                <span>{planet.data?.sign ? getZodiacSign(lang, planet.data.sign) : '—'}</span>
              </span>
            ))}
          </div>

        </div>
      </motion.section>

      <section className="mt-7 sm:mt-8">
        <div className={READING_GLASS_SECTION_CLASS}>
          <p className="lumia-label tracking-[0.2em]">{getText(lang, 'chart.living_label')}</p>
          <h2 className="mt-2 font-serif text-xl text-astro-text sm:text-2xl">{getText(lang, 'chart.living_title')}</h2>

          {profile.isPremium ? (
            <div className="mt-5">
              {livingLoading ? (
                <div className="flex min-h-[180px] items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-astro-highlight/40 border-t-astro-highlight" />
                </div>
              ) : livingReading ? (
                <div className="space-y-5">
                  <div className="border-b border-astro-border/20 pb-4">
                    <h3 className="font-serif text-lg text-astro-text sm:text-xl">{livingReading.headline}</h3>
                    <p className="lumia-muted mt-2 text-sm leading-relaxed sm:text-[15px]">{livingReading.summary}</p>
                  </div>

                  <div className="space-y-3">
                    <DetailLine label={getText(lang, 'chart.living_active_theme')} value={livingReading.activeTheme} />
                    <DetailLine label={getText(lang, 'chart.living_strength')} value={livingReading.strength} />
                    <DetailLine label={getText(lang, 'chart.living_vulnerability')} value={livingReading.vulnerability} />
                    <DetailLine label={getText(lang, 'chart.living_relationships')} value={livingReading.relationships} />
                    <DetailLine label={getText(lang, 'chart.living_money')} value={livingReading.money} />
                    <DetailLine label={getText(lang, 'chart.living_guidance')} value={livingReading.guidance} />
                  </div>
                </div>
              ) : (
                <p className="lumia-muted text-sm leading-relaxed">
                  {livingError || getText(lang, 'chart.living_loading')}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-5">
              <p className="max-w-prose text-sm leading-relaxed text-astro-text/80">
                {getText(lang, 'chart.living_premium_body')}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-astro-subtext">
                {getText(lang, 'chart.living_premium_note')}
              </p>
              <button
                type="button"
                onClick={requestPremium}
                className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-full border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-medium text-text-main transition-[box-shadow] hover:ring-1 hover:ring-black/10"
              >
                {getText(lang, 'chart.living_premium_cta')}
              </button>
            </div>
          )}
        </div>
      </section>
    </ReadingScreenShell>
  );
};
