import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Briefcase, Zap, Lock, type LucideIcon } from 'lucide-react';
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
import {
  formatLumiaDate,
  getMoscowIsoWeekKey,
  getMoscowTodayKey,
} from '../lib/date-utils';
import { getZodiacSign } from '../constants';
import { getMoonPhase } from '../lib/horoscope/moonPhase';
import { getQuestionOfDay } from '../lib/horoscope/questionOfDay';
import { MoonPhaseIcon } from '../components/Horoscope/MoonPhaseIcon';
import { SectionLabel, Divider } from '../components/NatalReading/SectionLabel';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';

interface HoroscopeProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onRequestPremium?: () => void;
}

const ZODIAC_DATES: Record<string, string> = {
  Aries: '21.03 — 19.04',
  Taurus: '20.04 — 20.05',
  Gemini: '21.05 — 20.06',
  Cancer: '21.06 — 22.07',
  Leo: '23.07 — 22.08',
  Virgo: '23.08 — 22.09',
  Libra: '23.09 — 22.10',
  Scorpio: '23.10 — 21.11',
  Sagittarius: '22.11 — 21.12',
  Capricorn: '22.12 — 19.01',
  Aquarius: '20.01 — 18.02',
  Pisces: '19.02 — 20.03',
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
        headline: 'Ровный ритм важнее скорости',
        summary: `Сегодня для ${signLabel} полезнее держаться простого ритма, чем разгоняться на всём подряд.`,
        chance: 'Один точный шаг сегодня даст больше, чем несколько поспешных решений.',
        risk: 'Лишняя спешка и перегрузка мелкими задачами быстро забирают ясность.',
        focus: 'Один настоящий приоритет на день — этого достаточно.',
        reading:
          'Сегодня день не про то, чтобы выиграть гонку. Он про то, чтобы заметить, где у тебя уже сбит ритм, и аккуратно вернуть его. Не давить, не торопить — двигаться так, как тебе удобно.',
        context:
          'Личный фон дня усиливает чувствительность к перегрузке. Спокойный фокус сегодня работает сильнее, чем резкий разгон.',
        advice: [
          'Не перегружай первую половину дня лишними решениями',
          'Оставь место для одного важного разговора или точного шага',
          'Не требуй от себя мгновенного результата там, где важнее устойчивость',
        ],
      }
    : {
        date: dateKey,
        headline: 'Steady pace beats speed today',
        summary: `For ${signLabel} today works better through a simple rhythm than rush.`,
        chance: 'One clear step will do more than several rushed decisions.',
        risk: 'Too much speed and scattered attention quickly drain clarity.',
        focus: 'Build the day around one priority that truly matters.',
        reading:
          'Today is not about outrunning the day. It is more useful to notice where you have lost your rhythm and gently bring it back.',
        context:
          'Your personal weather amplifies sensitivity to overload. Calm focus works better than acceleration.',
        advice: [
          'Do not overload the first half of the day with extra decisions',
          'Leave room for one meaningful conversation or precise step',
          'Do not demand instant results where steadiness matters more',
        ],
      };
}

function buildEveningFallback(language: 'ru' | 'en', dateKey: string): ForecastDaypartReading {
  return language === 'ru'
    ? {
        date: dateKey,
        slot: 'evening',
        headline: 'Вечер про возвращение к себе',
        summary: 'К вечеру лучше снижать шум, чем добивать день новыми задачами.',
        focus: 'Посмотри не только на события дня, но и на то, что они в тебе подняли.',
        relationships: 'Близость вечером строится через честное присутствие, а не через правильные слова.',
        money: 'Поздние решения лучше не принимать на усталости — вечер для сверки.',
        guidance: 'Заверши день мягко, без давления на себя.',
      }
    : {
        date: dateKey,
        slot: 'evening',
        headline: 'Evening is for coming back to yourself',
        summary: 'By evening, lowering the noise helps more than adding new tasks.',
        focus: 'Notice not only what happened today, but what it stirred in you.',
        relationships: 'Closeness at night grows through honest presence rather than perfect wording.',
        money: 'Late decisions are better not made from fatigue — evening is for review.',
        guidance: 'Close the day gently and without extra pressure on yourself.',
      };
}

function buildWeeklyFallback(
  language: 'ru' | 'en',
  periodKey: string
): ForecastWeeklyReading {
  return language === 'ru'
    ? {
        periodKey,
        periodLabel: '',
        headline: 'Неделя ясности и ровного шага',
        summary: 'Сейчас полезнее держать фокус на главном и не распылять силы на второстепенное.',
        focus: 'Выбери одну опорную линию на неделю и поддерживай её спокойной дисциплиной.',
      }
    : {
        periodKey,
        periodLabel: '',
        headline: 'A week that rewards clarity and steady pacing',
        summary: 'It helps to protect your focus and avoid spending energy on side noise.',
        focus: 'Pick one meaningful line for the week and support it with calm consistency.',
      };
}

/* ---------- shared UI bits ---------- */

const KeyValueRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <li className="flex items-baseline gap-3 border-t border-[#f2f2f2] py-3 first:border-t-0 first:pt-0">
    <span className="w-[78px] shrink-0 text-[11px] uppercase tracking-[0.16em] text-[#9a9a9a]">
      {label}
    </span>
    <span className="flex-1 font-lora text-[14.5px] leading-[1.7] text-[#2d2d2d]">{value}</span>
  </li>
);

const Pill: React.FC<{
  active: boolean;
  Icon: LucideIcon;
  label: string;
  onClick: () => void;
}> = ({ active, Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-[20px] px-3.5 py-1.5 text-[12.5px] transition ${
      active
        ? 'bg-[#1f1f1f] text-white'
        : 'border border-[#ececec] bg-white text-[#3a3a3a] hover:border-[#d8d8d8]'
    }`}
  >
    <Icon size={14} strokeWidth={1.7} />
    <span>{label}</span>
  </button>
);

type Lens = 'love' | 'work' | 'energy';

/* ----------------------- main view ----------------------- */

export const Horoscope = memo<HoroscopeProps>(
  ({ profile, chartData, onUpdateProfile, onOpenChart, onRequestPremium }) => {
    const profileRef = useRef(profile);
    profileRef.current = profile;

    const language = useMemo(
      () => (profile.language === 'en' ? 'en' : 'ru'),
      [profile.language]
    );
    const today = getMoscowTodayKey();
    const weekKey = getMoscowIsoWeekKey();
    const sunSign = chartData?.sun?.sign || 'Aries';
    const zodiacLabel = getZodiacSign(language, sunSign);
    const zodiacDates = ZODIAC_DATES[sunSign] || '';

    const moon = useMemo(() => getMoonPhase(new Date()), []);
    const todayQuestion = useMemo(() => getQuestionOfDay(sunSign), [sunSign]);

    const dailyFallback = useMemo(
      () => buildDailyFallback(language, sunSign, today),
      [language, sunSign, today]
    );
    const eveningFallback = useMemo(
      () => buildEveningFallback(language, today),
      [language, today]
    );
    const weeklyFallback = useMemo(
      () => buildWeeklyFallback(language, weekKey),
      [language, weekKey]
    );

    const [dailyReading, setDailyReading] = useState<ForecastDailyReading>(dailyFallback);
    const [eveningReading, setEveningReading] = useState<ForecastDaypartReading | null>(
      profile.isPremium ? eveningFallback : null
    );
    const [weeklyReading, setWeeklyReading] = useState<ForecastWeeklyReading | null>(
      profile.isPremium ? weeklyFallback : null
    );
    const [lens, setLens] = useState<Lens | null>(null);

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
            const generatedEvening = await getFullDaypartForecast(
              profileRef.current,
              chartData,
              'evening',
              { accessTier: 'premium' }
            );
            if (!cancelled) setEveningReading(generatedEvening.reading);
          }
        } catch {}
        try {
          const cachedWeekly = await getCachedWeeklyForecastLayer(
            String(profile.id),
            undefined,
            weekKey
          );
          if (cancelled) return;
          if (cachedWeekly) {
            setWeeklyReading(cachedWeekly);
          } else {
            const generatedWeekly = await ensureWeeklyForecastLayer(
              profileRef.current,
              chartData,
              weekKey
            );
            if (!cancelled) setWeeklyReading(generatedWeekly);
          }
        } catch {}
      };
      void loadPremiumLayers();
      return () => {
        cancelled = true;
      };
    }, [chartData, profile.id, profile.isPremium, today, weekKey]);

    if (!chartData) return <Loading />;

    /** Personal lenses for premium — pulled from evening data, not from daily,
     *  to avoid repeating what we already showed in the main "Сегодня" block. */
    const lensTexts: Record<Lens, string> = {
      love:
        eveningReading?.relationships ||
        'Сегодня в близости важнее присутствие, чем правильные слова.',
      work:
        eveningReading?.money ||
        'В делах день про точные шаги, а не про размах.',
      energy:
        eveningReading?.guidance ||
        'Тело сегодня просит ровного ритма — без рывков.',
    };

    return (
      <div className="min-h-full bg-white pb-16 font-sans">
        {/* HERO — quiet identity strip, no big headline */}
        <section className="px-5 pt-7 pb-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#9a9a9a]">
            {language === 'en' ? 'Horoscope' : 'Гороскоп'} · {formatLumiaDate(today, language)}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-[20px] border border-[#ececec] bg-white px-3 py-1 text-[12px] text-[#3a3a3a]">
              <ZodiacIcon sign={sunSign} size={14} />
              <span>{zodiacLabel}</span>
              {zodiacDates ? <span className="text-[#9a9a9a]"> · {zodiacDates}</span> : null}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-[20px] border border-[#ececec] bg-white px-3 py-1 text-[12px] text-[#3a3a3a]">
              <MoonPhaseIcon slot={moon.slot} size={14} />
              <span>
                {moon.shortLabel} · {moon.illumination}%
              </span>
            </span>
          </div>
        </section>

        <Divider />

        {/* СЕГОДНЯ — single, unified daily block */}
        <section className="px-5 pt-7 pb-7">
          <SectionLabel>
            {language === 'en' ? 'Today' : 'Сегодня'}
          </SectionLabel>

          <h1 className="mt-5 font-lora text-[20px] leading-[1.3] tracking-[-0.005em] text-[#1f1f1f]">
            {dailyReading.headline}
          </h1>

          <p className="mt-4 font-lora text-[15px] leading-[1.85] text-[#2d2d2d] whitespace-pre-line">
            {dailyReading.reading}
          </p>

          <ul className="mt-6">
            <KeyValueRow
              label={language === 'en' ? 'Chance' : 'Шанс'}
              value={dailyReading.chance}
            />
            <KeyValueRow
              label={language === 'en' ? 'Risk' : 'Риск'}
              value={dailyReading.risk}
            />
            <KeyValueRow
              label={language === 'en' ? 'Focus' : 'Фокус'}
              value={dailyReading.focus}
            />
          </ul>

          {dailyReading.advice && dailyReading.advice[0] ? (
            <p className="mt-5 font-lora italic text-[14px] leading-[1.7] text-[#5e5e5e]">
              — {dailyReading.advice[0]}
            </p>
          ) : null}
        </section>

        <Divider />

        {/* ЛУНА */}
        <section className="px-5 pt-7 pb-7">
          <SectionLabel>{language === 'en' ? 'Moon today' : 'Луна сегодня'}</SectionLabel>
          <div className="mt-5 flex items-start gap-4">
            <div className="shrink-0 rounded-full p-2.5" style={{ background: '#f4f4f4' }}>
              <MoonPhaseIcon slot={moon.slot} size={26} />
            </div>
            <div className="min-w-0">
              <p className="font-lora text-[16px] leading-[1.4] text-[#1f1f1f]">{moon.label}</p>
              <p className="mt-2 font-lora text-[14.5px] leading-[1.8] text-[#3a3a3a]">
                {moon.meaning}
              </p>
            </div>
          </div>
        </section>

        <Divider />

        {/* ВОПРОС ДНЯ */}
        <section className="px-5 pt-7 pb-7">
          <SectionLabel>{language === 'en' ? 'A question for you' : 'Вопрос дня'}</SectionLabel>
          <div className="mt-5 px-5 py-4" style={{ background: '#f9f9f9' }}>
            <p className="font-lora italic text-[14.5px] leading-[1.75] text-[#3a3a3a]">
              {todayQuestion}
            </p>
          </div>
        </section>

        <Divider />

        {/* ЛИЧНЫЙ ПРОГНОЗ — premium */}
        <section className="px-5 pt-7 pb-7">
          <SectionLabel>
            {language === 'en' ? 'Your personal forecast' : 'Личный прогноз по карте'}
          </SectionLabel>

          {profile.isPremium ? (
            <>
              <p className="mt-5 font-lora text-[15px] leading-[1.85] text-[#2d2d2d]">
                {dailyReading.context}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill
                  active={lens === 'love'}
                  Icon={Heart}
                  label={language === 'en' ? 'In love' : 'В любви'}
                  onClick={() => setLens(lens === 'love' ? null : 'love')}
                />
                <Pill
                  active={lens === 'work'}
                  Icon={Briefcase}
                  label={language === 'en' ? 'In work' : 'В работе'}
                  onClick={() => setLens(lens === 'work' ? null : 'work')}
                />
                <Pill
                  active={lens === 'energy'}
                  Icon={Zap}
                  label={language === 'en' ? 'Energy' : 'Энергия'}
                  onClick={() => setLens(lens === 'energy' ? null : 'energy')}
                />
              </div>

              {lens ? (
                <p className="mt-4 font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d]">
                  {lensTexts[lens]}
                </p>
              ) : null}
            </>
          ) : (
            <div className="mt-5 relative overflow-hidden border border-[#f0f0f0]">
              <div className="select-none px-5 py-7" style={{ filter: 'blur(5px)' }} aria-hidden>
                <p className="font-lora text-[15px] leading-[1.8] text-[#2d2d2d]">
                  Сегодня твоя личная карта откликается на день определённым образом —
                  и в одних делах энергия будет твоей, а в других стоит подождать.
                </p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={onRequestPremium}
                  className="flex items-center gap-2 rounded-[20px] bg-[#1f1f1f] px-4 py-2 text-[13px] text-white transition hover:bg-[#000]"
                >
                  <Lock size={14} strokeWidth={1.6} />
                  <span>{language === 'en' ? 'Open' : 'Открыть'}</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ВЕЧЕР — premium */}
        {profile.isPremium && eveningReading ? (
          <>
            <Divider />
            <section className="px-5 pt-7 pb-7">
              <SectionLabel>{language === 'en' ? 'Evening' : 'Вечер'}</SectionLabel>
              <p className="mt-5 font-lora text-[16px] leading-[1.4] text-[#1f1f1f]">
                {eveningReading.headline}
              </p>
              <p className="mt-3 font-lora italic text-[14px] leading-[1.7] text-[#5e5e5e]">
                {eveningReading.guidance}
              </p>
            </section>
          </>
        ) : null}

        {/* НЕДЕЛЯ — premium */}
        {profile.isPremium && weeklyReading ? (
          <>
            <Divider />
            <section className="px-5 pt-7 pb-7">
              <SectionLabel>{language === 'en' ? 'This week' : 'На этой неделе'}</SectionLabel>
              <p className="mt-5 font-lora text-[16px] leading-[1.4] text-[#1f1f1f]">
                {weeklyReading.headline}
              </p>
              <p className="mt-3 font-lora text-[14.5px] leading-[1.8] text-[#3a3a3a]">
                {weeklyReading.focus}
              </p>
            </section>
          </>
        ) : null}

        {/* CTA / Open chart */}
        {!profile.isPremium ? (
          <>
            <Divider />
            <section className="px-5 pt-7 pb-10">
              <p className="font-lora text-[15px] leading-[1.8] text-[#2d2d2d]">
                {language === 'en'
                  ? 'There is a deeper layer of this day for you — by your chart, not just by your sun sign.'
                  : 'У сегодняшнего дня есть отдельный слой именно для тебя — по твоей карте, а не только по знаку.'}
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={onRequestPremium}
                  className="rounded-[20px] bg-[#1f1f1f] px-5 py-2.5 text-[13px] text-white"
                >
                  {language === 'en' ? 'Open personal forecast' : 'Открыть личный прогноз'}
                </button>
              </div>
            </section>
          </>
        ) : onOpenChart ? (
          <>
            <Divider />
            <section className="px-5 pt-7 pb-10">
              <button
                type="button"
                onClick={onOpenChart}
                className="text-[14px] text-[#6f4ea8] underline underline-offset-4"
              >
                {language === 'en' ? 'Open your chart →' : 'К твоей карте →'}
              </button>
            </section>
          </>
        ) : null}
      </div>
    );
  }
);

Horoscope.displayName = 'Horoscope';
