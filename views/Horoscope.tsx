import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  DailyHoroscope,
  ForecastDailyReading,
  ForecastDaypartReading,
  ForecastWeeklyReading,
  NatalChartData,
  UserProfile,
} from '../types';
import {
  ensureWeeklyForecastLayer,
  getCachedDailyForecastLayer,
  getCachedDailyHoroscope,
  getCachedFullDaypartForecast,
  getCachedWeeklyForecastLayer,
  getDailyForecastLayer,
  getDailyHoroscope,
  getFullDaypartForecast,
  mapForecastDailyToLegacyHoroscope,
  mapLegacyHoroscopeToForecastDailyReading,
} from '../services/astrologyService';
import { Loading } from '../components/ui/Loading';
import { formatIsoWeekPeriodLabel, formatLumiaDate, getMoscowIsoWeekKey, getMoscowTodayKey } from '../lib/date-utils';
import { getZodiacSign } from '../constants';
import { READING_GLASS_SECTION_CLASS } from '../components/layout/ReadingLayout';
import { ReadingScreenShell } from '../components/layout/ScreenShell';

interface HoroscopeProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onRequestPremium?: () => void;
}

const ZODIAC_DATES: Record<string, string> = {
  Aries: '21.03 - 19.04',
  Taurus: '20.04 - 20.05',
  Gemini: '21.05 - 20.06',
  Cancer: '21.06 - 22.07',
  Leo: '23.07 - 22.08',
  Virgo: '23.08 - 22.09',
  Libra: '23.09 - 22.10',
  Scorpio: '23.10 - 21.11',
  Sagittarius: '22.11 - 21.12',
  Capricorn: '22.12 - 19.01',
  Aquarius: '20.01 - 18.02',
  Pisces: '19.02 - 20.03',
};

function buildDailyFallback(
  language: 'ru' | 'en',
  sign: string,
  dateKey: string
): ForecastDailyReading {
  const signLabel = getZodiacSign(language, sign);
  return language === 'ru'
    ? {
        date: dateKey,
        headline: 'День просит меньше суеты и больше внутренней собранности',
        summary: `Сегодня для знака ${signLabel} полезнее держаться простого ритма и не разбрасываться на всё сразу.`,
        chance: 'Один точный шаг сегодня даст больше, чем несколько поспешных решений.',
        risk: 'Лишняя спешка и перегрузка мелкими задачами быстро забирают ясность.',
        focus: 'Собери день вокруг одного действительно важного приоритета.',
        reading:
          'Сегодня лучше не пытаться выиграть у дня скоростью. Намного полезнее заметить, где тебе уже нужна внутренняя опора, и сохранить ритм без лишнего давления на себя.',
        context:
          'Общий фон дня усиливает чувствительность к перегрузке, поэтому спокойный фокус будет работать сильнее, чем резкий разгон.',
        advice: [
          'Не перегружай первую половину дня лишними решениями.',
          'Оставь место для одного важного разговора или точного шага.',
          'Не требуй от себя мгновенного результата там, где важнее устойчивость.',
        ],
      }
    : {
        date: dateKey,
        headline: 'The day asks for less noise and more inner steadiness',
        summary: `For ${signLabel} today works better through a simple rhythm than through rush.`,
        chance: 'One clear step will do more than several rushed decisions.',
        risk: 'Too much speed and scattered attention can quickly drain clarity.',
        focus: 'Build the day around one priority that truly matters.',
        reading:
          'Today is not about trying to outrun the day. It is more useful to notice where you need an inner anchor and protect your rhythm without extra pressure.',
        context:
          'The overall tone amplifies sensitivity to overload, so calm focus works better than acceleration.',
        advice: [
          'Do not overload the first half of the day with extra decisions.',
          'Leave room for one meaningful conversation or precise step.',
          'Do not demand instant results where steadiness matters more.',
        ],
      };
}

function buildEveningFallback(language: 'ru' | 'en', dateKey: string): ForecastDaypartReading {
  return language === 'ru'
    ? {
        date: dateKey,
        slot: 'evening',
        headline: 'Вечер лучше проживать спокойнее и честнее',
        summary: 'К вечеру полезнее снижать шум и возвращаться к себе, а не добивать день новыми задачами.',
        focus: 'Посмотри не только на события дня, но и на то, что они в тебе подняли.',
        relationships: 'Близость вечером строится через честное присутствие, а не через правильные формулировки.',
        money: 'Поздние решения лучше не принимать на усталости: вечер скорее для сверки, чем для резких разворотов.',
        guidance: 'Заверши день мягко и без лишнего давления на себя.',
      }
    : {
        date: dateKey,
        slot: 'evening',
        headline: 'Evening works better through quiet and honesty',
        summary: 'By evening, lowering the noise helps more than adding new tasks.',
        focus: 'Notice not only what happened today, but what it stirred in you.',
        relationships: 'Closeness at night grows through honest presence rather than perfect wording.',
        money: 'Late decisions are better not made from fatigue; evening is more for review than for hard turns.',
        guidance: 'Close the day gently and without extra pressure on yourself.',
      };
}

function buildWeeklyFallback(
  language: 'ru' | 'en',
  periodKey: string,
  periodLabel: string
): ForecastWeeklyReading {
  return language === 'ru'
    ? {
        periodKey,
        periodLabel,
        headline: 'Неделя просит ясности и ровного шага',
        summary: 'Сейчас полезнее держать фокус на главном и не распылять силы на второстепенное.',
        focus: 'Выбери одну опорную линию на неделю и поддерживай её спокойной дисциплиной.',
      }
    : {
        periodKey,
        periodLabel,
        headline: 'This week rewards clarity and steady pacing',
        summary: 'It helps to protect your focus and avoid spending energy on side noise.',
        focus: 'Pick one meaningful line for the week and support it with calm consistency.',
      };
}

function Section({
  label,
  title,
  intro,
  children,
}: {
  label: string;
  title: string;
  intro?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <section className={READING_GLASS_SECTION_CLASS}>
      <p className="lumia-label tracking-[0.2em]">{label}</p>
      <h2 className="mt-2 font-serif text-[1.9rem] leading-tight text-astro-text sm:text-[2.1rem]">
        {title}
      </h2>
      {intro ? (
        <p className="lumia-reading-intro lumia-muted mt-3 max-w-reading-wide">
          {intro}
        </p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
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
      <p className="mt-1.5 text-[15px] leading-relaxed text-astro-text sm:text-base">{value}</p>
    </div>
  );
}

export const Horoscope = memo<HoroscopeProps>(
  ({ profile, chartData, onUpdateProfile, onOpenChart, onRequestPremium }) => {
    const profileRef = useRef(profile);
    profileRef.current = profile;

    const language = useMemo(() => (profile.language === 'en' ? 'en' : 'ru'), [profile.language]);
    const today = getMoscowTodayKey();
    const weekKey = getMoscowIsoWeekKey();
    const sunSign = chartData?.sun?.sign || 'Aries';
    const zodiacLabel = getZodiacSign(language, sunSign);
    const zodiacDates = ZODIAC_DATES[sunSign] || '';

    const dailyFallback = useMemo(
      () => buildDailyFallback(language, sunSign, today),
      [language, sunSign, today]
    );
    const eveningFallback = useMemo(
      () => buildEveningFallback(language, today),
      [language, today]
    );
    const weeklyFallback = useMemo(
      () => buildWeeklyFallback(language, weekKey, formatIsoWeekPeriodLabel(weekKey, language)),
      [language, weekKey]
    );

    const [dailyReading, setDailyReading] = useState<ForecastDailyReading>(dailyFallback);
    const [eveningReading, setEveningReading] = useState<ForecastDaypartReading | null>(
      profile.isPremium ? eveningFallback : null
    );
    const [weeklyReading, setWeeklyReading] = useState<ForecastWeeklyReading | null>(
      profile.isPremium ? weeklyFallback : null
    );

    const syncLegacyIntoProfile = (legacy: DailyHoroscope) => {
      if (!onUpdateProfile) return;

      const current = profileRef.current;
      const nextProfile = { ...current };
      if (!nextProfile.generatedContent) {
        nextProfile.generatedContent = { timestamps: {} };
      } else {
        nextProfile.generatedContent = { ...nextProfile.generatedContent };
      }

      nextProfile.generatedContent.dailyHoroscope = legacy;
      nextProfile.generatedContent.timestamps = {
        ...(nextProfile.generatedContent.timestamps || {}),
        dailyHoroscopeGenerated: Date.now(),
      };
      onUpdateProfile(nextProfile);
    };

    const applyDailyForecast = (
      reading: ForecastDailyReading,
      options?: { syncProfile?: boolean; source?: string }
    ) => {
      setDailyReading(reading);

      if (options?.syncProfile) {
        syncLegacyIntoProfile(
          mapForecastDailyToLegacyHoroscope(reading, {
            source: options?.source,
            persisted: true,
          })
        );
      }
    };

    useEffect(() => {
      setDailyReading(dailyFallback);
      setEveningReading(profile.isPremium ? eveningFallback : null);
      setWeeklyReading(profile.isPremium ? weeklyFallback : null);
    }, [dailyFallback, eveningFallback, profile.isPremium, weeklyFallback]);

    useEffect(() => {
      let cancelled = false;

      const loadDaily = async () => {
        if (!chartData) return;

        const legacy = profile.generatedContent?.dailyHoroscope;
        if (legacy?.content?.length) {
          setDailyReading(mapLegacyHoroscopeToForecastDailyReading(legacy, language));
        }

        try {
          const cached = await getCachedDailyForecastLayer(String(profile.id));
          if (cancelled) return;
          if (cached) {
            applyDailyForecast(cached, { syncProfile: true, source: 'cache' });
            return;
          }
        } catch {}

        try {
          const cachedLegacy = await getCachedDailyHoroscope(String(profile.id), language);
          if (cancelled) return;
          if (cachedLegacy?.content?.length) {
            const mapped = mapLegacyHoroscopeToForecastDailyReading(cachedLegacy, language);
            setDailyReading(mapped);
            syncLegacyIntoProfile(cachedLegacy);
            return;
          }
        } catch {}

        try {
          const generated = await getDailyForecastLayer(profileRef.current, chartData);
          if (cancelled) return;
          applyDailyForecast(generated, { syncProfile: true, source: 'generated' });
          return;
        } catch {}

        try {
          const legacyGenerated = await getDailyHoroscope(profileRef.current, chartData);
          if (cancelled) return;
          const mapped = mapLegacyHoroscopeToForecastDailyReading(legacyGenerated, language);
          setDailyReading(mapped);
          syncLegacyIntoProfile(legacyGenerated);
        } catch {}
      };

      void loadDaily();

      return () => {
        cancelled = true;
      };
    }, [chartData, language, profile.generatedContent?.dailyHoroscope, profile.id]);

    useEffect(() => {
      let cancelled = false;

      const loadPremiumLayers = async () => {
        if (!chartData || !profile.isPremium) return;

        try {
          const cachedEvening = await getCachedFullDaypartForecast(String(profile.id), 'evening', {
            accessTier: 'premium',
            dateKey: today,
          });
          if (cancelled) return;

          if (cachedEvening) {
            setEveningReading(cachedEvening);
          } else {
            const generatedEvening = await getFullDaypartForecast(profileRef.current, chartData, 'evening', {
              accessTier: 'premium',
            });
            if (!cancelled) {
              setEveningReading(generatedEvening.reading);
            }
          }
        } catch {}

        try {
          const cachedWeekly = await getCachedWeeklyForecastLayer(String(profile.id), undefined, weekKey);
          if (cancelled) return;

          if (cachedWeekly) {
            setWeeklyReading(cachedWeekly);
          } else {
            const generatedWeekly = await ensureWeeklyForecastLayer(profileRef.current, chartData, weekKey);
            if (!cancelled) {
              setWeeklyReading(generatedWeekly);
            }
          }
        } catch {}
      };

      void loadPremiumLayers();

      return () => {
        cancelled = true;
      };
    }, [chartData, profile.id, profile.isPremium, today, weekKey]);

    if (!chartData) {
      return <Loading />;
    }

    const quietCta =
      profile.isPremium && onOpenChart
        ? {
            label: language === 'en' ? 'Open your chart' : 'К карте',
            onClick: onOpenChart,
          }
        : !profile.isPremium && onRequestPremium
          ? {
              label: language === 'en' ? 'Open your personal layer' : 'Открыть личный слой',
              onClick: onRequestPremium,
            }
          : null;

    return (
      <ReadingScreenShell className="pb-8">
        <section className="border-t-0 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="lumia-label tracking-[0.2em]">
                {language === 'en' ? 'Horoscope' : 'Гороскоп'}
              </p>
              <h1 className="mt-2 font-serif text-[2rem] leading-tight text-astro-text sm:text-[2.2rem]">
                {language === 'en' ? 'Your day by sign' : 'Твой день по знаку'}
              </h1>
            </div>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-astro-subtext">
              {formatLumiaDate(today, language)}
            </span>
          </div>

          <div className="mt-5 border-t border-astro-border/10 pt-4">
            <p className="lumia-label text-[10px] tracking-[0.16em]">
              {language === 'en' ? 'Sun sign' : 'Солнце'}
            </p>
            <p className="mt-1 text-xl font-semibold text-astro-text sm:text-2xl">{zodiacLabel}</p>
            <p className="mt-1 text-sm text-astro-subtext">{zodiacDates}</p>
          </div>
        </section>

        {profile.isPremium ? (
          <Section
            label={language === 'en' ? 'Personal forecast' : 'Личный прогноз на сегодня'}
            title={dailyReading.focus}
            intro={dailyReading.summary}
          >
            <p className="text-[15px] leading-relaxed text-astro-text sm:text-base">{dailyReading.context}</p>
          </Section>
        ) : null}

        <Section
          label={language === 'en' ? 'General rhythm of the day' : 'Общий ритм дня'}
          title={dailyReading.headline}
          intro={dailyReading.summary}
        >
          <p className="text-[15px] leading-relaxed text-astro-text sm:text-base">{dailyReading.reading}</p>
        </Section>

        <section className={READING_GLASS_SECTION_CLASS}>
          <p className="lumia-label tracking-[0.2em]">
            {language === 'en' ? 'What matters today' : 'Что важно сегодня'}
          </p>
          <div className="mt-4 space-y-4">
            <DetailLine
              label={language === 'en' ? 'Chance of the day' : 'Шанс дня'}
              value={dailyReading.chance}
            />
            <DetailLine
              label={language === 'en' ? 'Risk of the day' : 'Риск дня'}
              value={dailyReading.risk}
            />
            <DetailLine
              label={language === 'en' ? 'Focus of the day' : 'Фокус дня'}
              value={dailyReading.focus}
            />
          </div>
        </section>

        {profile.isPremium && eveningReading ? (
          <Section
            label={language === 'en' ? 'Evening' : 'Вечер'}
            title={eveningReading.headline}
            intro={eveningReading.summary}
          >
            <div className="space-y-4">
              <DetailLine
                label={language === 'en' ? 'Main tone' : 'Главный акцент'}
                value={eveningReading.focus}
              />
              <DetailLine
                label={language === 'en' ? 'Relationships' : 'Отношения'}
                value={eveningReading.relationships}
              />
              <DetailLine
                label={language === 'en' ? 'Guidance' : 'Как пройти вечер'}
                value={eveningReading.guidance}
              />
            </div>
          </Section>
        ) : null}

        {profile.isPremium && weeklyReading ? (
          <Section
            label={language === 'en' ? 'Week' : 'Неделя'}
            title={weeklyReading.headline}
            intro={weeklyReading.summary}
          >
            <div className="space-y-4">
              <DetailLine
                label={language === 'en' ? 'Period' : 'Период'}
                value={weeklyReading.periodLabel}
              />
              <DetailLine
                label={language === 'en' ? 'Focus' : 'Главный фокус'}
                value={weeklyReading.focus}
              />
            </div>
          </Section>
        ) : null}

        {quietCta ? (
          <section className={READING_GLASS_SECTION_CLASS}>
            <button
              type="button"
              onClick={quietCta.onClick}
              className="inline-flex items-center px-0 py-1 text-sm font-medium text-astro-highlight underline underline-offset-4 transition-opacity hover:opacity-70"
            >
              {quietCta.label}
            </button>
          </section>
        ) : null}
      </ReadingScreenShell>
    );
  }
);

Horoscope.displayName = 'Horoscope';
