import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, Coins, Heart, Lock, MessageCircle, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import {
  DailyHoroscope,
  ForecastDailyReading,
  ForecastDaypartReading,
  ForecastDaypartSlot,
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
import { formatLumiaDate, getMoscowIsoWeekKey, getMoscowTodayKey } from '../lib/date-utils';
import { getZodiacSign } from '../constants';
import { getMoonPhase } from '../lib/horoscope/moonPhase';
import { getQuestionOfDay } from '../lib/horoscope/questionOfDay';
import { MoonPhaseIcon } from '../components/Horoscope/MoonPhaseIcon';
import { Divider, SectionLabel } from '../components/NatalReading/SectionLabel';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { getHoroscopeBackground } from '../lib/visualBackgrounds';

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

type Lens = 'work' | 'love' | 'money' | 'communication' | 'energy';

function buildDailyFallback(language: 'ru' | 'en', sign: string, dateKey: string): ForecastDailyReading {
  const signLabel = getZodiacSign(language, sign);

  return language === 'ru'
    ? {
        date: dateKey,
        headline: 'День лучше раскрывается через ясность и мягкий фокус',
        summary: `Сегодня ${signLabel} важнее не ускоряться, а выбрать один честный приоритет.`,
        chance: 'Есть шанс аккуратно сдвинуть важное дело, если не распыляться на чужой шум.',
        risk: 'Главный риск дня — взять на себя слишком много и потерять внутреннюю ясность.',
        focus: 'Выберите один участок дня, где нужен спокойный, конкретный шаг.',
        reading:
          'Сегодня карта лучше работает не через резкий рывок, а через собранность. День может подсветить, где вы уже устали от лишних задач, разговоров или ожиданий. Чем честнее вы отделите главное от второстепенного, тем легче станет действовать без напряжения.',
        context:
          'Это не общий прогноз по знаку: здесь важен ваш личный ритм карты. День просит меньше суеты и больше внутренней точности.',
        advice: [
          'Не начинайте день с десяти мелких решений',
          'Оставьте место для одного спокойного разговора или точного шага',
          'Не доказывайте всем и себе, что можете все сразу',
        ],
      }
    : {
        date: dateKey,
        headline: 'The day opens through clarity and gentle focus',
        summary: `For ${signLabel}, today works better through one honest priority than speed.`,
        chance: 'You can move an important thing forward if you avoid scattering attention.',
        risk: 'The main risk is taking on too much and losing inner clarity.',
        focus: 'Choose one area of the day that needs a calm, concrete step.',
        reading:
          'Today works better through steadiness than a hard push. The day may show where you are tired of extra tasks, conversations, or expectations. The more clearly you separate what matters from what is just noise, the easier action becomes.',
        context:
          'This is not a generic sign forecast: your personal chart rhythm matters here.',
        advice: [
          'Do not start the day with ten small decisions',
          'Leave space for one calm conversation or precise step',
          'Do not prove that you can handle everything at once',
        ],
      };
}

function buildDaypartFallback(
  language: 'ru' | 'en',
  dateKey: string,
  slot: ForecastDaypartSlot
): ForecastDaypartReading {
  const ruMeta = {
    morning: {
      headline: 'Утро просит бережного входа в день',
      summary: 'Начните с простого порядка: тело, пространство, первый понятный шаг.',
      focus: 'Не хватайтесь за все сразу.',
      relationships: 'В общении утром лучше меньше додумывать и больше уточнять.',
      money: 'Финансовые решения утром полезнее сверить, чем ускорять.',
      guidance: 'Дайте себе мягкий старт без лишнего давления.',
    },
    day: {
      headline: 'Днем важен один рабочий фокус',
      summary: 'Середина дня подходит для конкретного дела, которое можно довести до видимого результата.',
      focus: 'Выберите одну задачу и закройте ее аккуратно.',
      relationships: 'Договариваться легче через конкретику, а не намеки.',
      money: 'День хорош для порядка в деньгах, планах и обязательствах.',
      guidance: 'Не распыляйтесь: сегодня выигрывает точность.',
    },
    evening: {
      headline: 'Вечер возвращает к себе',
      summary: 'К вечеру лучше снижать шум, а не добивать день новыми задачами.',
      focus: 'Посмотрите не только на события дня, но и на то, что они в вас подняли.',
      relationships: 'Близость вечером строится через честное присутствие, а не правильные слова.',
      money: 'Поздние решения лучше не принимать на усталости — вечер для сверки.',
      guidance: 'Завершите день мягко, без давления на себя.',
    },
  } satisfies Record<ForecastDaypartSlot, Omit<ForecastDaypartReading, 'date' | 'slot'>>;

  const enMeta = {
    morning: {
      headline: 'Morning asks for a gentle start',
      summary: 'Begin with simple order: body, space, and one clear first step.',
      focus: 'Do not grab everything at once.',
      relationships: 'In the morning, clarify more and assume less.',
      money: 'Money decisions are better reviewed than rushed.',
      guidance: 'Give yourself a soft start without extra pressure.',
    },
    day: {
      headline: 'Midday rewards one working focus',
      summary: 'The middle of the day supports one practical task with a visible result.',
      focus: 'Choose one task and close it cleanly.',
      relationships: 'Agreements work better through specifics than hints.',
      money: 'The day is useful for order in money, plans, and commitments.',
      guidance: 'Do not scatter: precision wins today.',
    },
    evening: {
      headline: 'Evening brings you back to yourself',
      summary: 'By evening, lowering the noise helps more than adding new tasks.',
      focus: 'Notice not only what happened today, but what it stirred in you.',
      relationships: 'Closeness grows through honest presence rather than perfect wording.',
      money: 'Late decisions are better not made from fatigue — evening is for review.',
      guidance: 'Close the day gently and without extra pressure.',
    },
  } satisfies Record<ForecastDaypartSlot, Omit<ForecastDaypartReading, 'date' | 'slot'>>;

  return {
    date: dateKey,
    slot,
    ...(language === 'ru' ? ruMeta[slot] : enMeta[slot]),
  };
}

function buildWeeklyFallback(language: 'ru' | 'en', periodKey: string): ForecastWeeklyReading {
  return language === 'ru'
    ? {
        periodKey,
        periodLabel: '',
        headline: 'Неделя ясности и ровного шага',
        summary: 'Сейчас полезнее держать фокус на главном и не распылять силы на второстепенное.',
        focus: 'Выберите одну опорную линию на неделю и поддерживайте ее спокойной дисциплиной.',
      }
    : {
        periodKey,
        periodLabel: '',
        headline: 'A week that rewards clarity and steady pacing',
        summary: 'Protect your focus and avoid spending energy on side noise.',
        focus: 'Pick one meaningful line for the week and support it with calm consistency.',
      };
}

const KeyValueRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <li className="flex items-baseline gap-3 border-t border-[#f2f2f2] py-3 first:border-t-0 first:pt-0">
    <span className="w-[92px] shrink-0 text-[11px] uppercase tracking-[0.16em] text-[#9a9a9a]">
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

const DaypartCard: React.FC<{ title: string; reading: ForecastDaypartReading }> = ({ title, reading }) => (
  <div className="rounded-[24px] border border-[#f0f0f0] bg-[#fbfaf7] px-4 py-4">
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#9a9a9a]">{title}</p>
    <h3 className="mt-2 font-lora text-[16px] leading-[1.35] text-[#1f1f1f]">{reading.headline}</h3>
    <p className="mt-2 font-lora text-[14px] leading-[1.65] text-[#3a3a3a]">{reading.summary}</p>
  </div>
);

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
    const zodiacBackground = getHoroscopeBackground(sunSign);

    const moon = useMemo(() => getMoonPhase(new Date()), []);
    const todayQuestion = useMemo(() => getQuestionOfDay(sunSign), [sunSign]);

    const dailyFallback = useMemo(
      () => buildDailyFallback(language, sunSign, today),
      [language, sunSign, today]
    );
    const daypartFallbacks = useMemo(
      () => ({
        morning: buildDaypartFallback(language, today, 'morning'),
        day: buildDaypartFallback(language, today, 'day'),
        evening: buildDaypartFallback(language, today, 'evening'),
      }),
      [language, today]
    );
    const weeklyFallback = useMemo(
      () => buildWeeklyFallback(language, weekKey),
      [language, weekKey]
    );

    const [dailyReading, setDailyReading] = useState<ForecastDailyReading>(dailyFallback);
    const [dayparts, setDayparts] = useState<Record<ForecastDaypartSlot, ForecastDaypartReading | null>>({
      morning: profile.isPremium ? daypartFallbacks.morning : null,
      day: profile.isPremium ? daypartFallbacks.day : null,
      evening: profile.isPremium ? daypartFallbacks.evening : null,
    });
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
      setDayparts({
        morning: profile.isPremium ? daypartFallbacks.morning : null,
        day: profile.isPremium ? daypartFallbacks.day : null,
        evening: profile.isPremium ? daypartFallbacks.evening : null,
      });
      setWeeklyReading(profile.isPremium ? weeklyFallback : null);
    }, [dailyFallback, daypartFallbacks, profile.isPremium, weeklyFallback]);

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

        const slots: ForecastDaypartSlot[] = ['morning', 'day', 'evening'];
        await Promise.all(
          slots.map(async (slot) => {
            try {
              const cached = await getCachedFullDaypartForecast(String(profile.id), slot, {
                accessTier: 'premium',
                dateKey: today,
              });
              if (cancelled) return;
              if (cached) {
                setDayparts((prev) => ({ ...prev, [slot]: cached }));
                return;
              }
              const generated = await getFullDaypartForecast(profileRef.current, chartData, slot, {
                accessTier: 'premium',
              });
              if (!cancelled) {
                setDayparts((prev) => ({ ...prev, [slot]: generated.reading }));
              }
            } catch {}
          })
        );

        try {
          const cachedWeekly = await getCachedWeeklyForecastLayer(String(profile.id), undefined, weekKey);
          if (cancelled) return;
          if (cachedWeekly) {
            setWeeklyReading(cachedWeekly);
          } else {
            const generatedWeekly = await ensureWeeklyForecastLayer(profileRef.current, chartData, weekKey);
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

    const lensTexts: Record<Lens, string> = {
      work:
        dayparts.day?.guidance ||
        dayparts.day?.focus ||
        (language === 'en'
          ? 'In work, choose one money or project area and bring it into a cleaner shape.'
          : 'В работе выберите один денежный или проектный участок и доведите его до более ясного вида.'),
      love:
        dayparts.evening?.relationships ||
        (language === 'en'
          ? 'In closeness today, calm presence is stronger than perfect wording.'
          : 'В близости сегодня спокойное присутствие сильнее, чем идеально подобранные слова.'),
      money:
        dayparts.day?.money ||
        dayparts.evening?.money ||
        (language === 'en'
          ? 'Money decisions work better through review and order than impulse.'
          : 'Денежные решения сегодня лучше идут через порядок и сверку, а не через импульс.'),
      communication:
        dailyReading.context ||
        (language === 'en'
          ? 'Today it helps to clarify instead of guessing what the other person meant.'
          : 'Сегодня полезнее уточнять, чем додумывать за другого человека.'),
      energy:
        dayparts.morning?.guidance ||
        dayparts.evening?.guidance ||
        (language === 'en'
          ? 'Your energy is steadier when the day has fewer unnecessary decisions.'
          : 'Энергия держится ровнее, когда в дне меньше лишних решений.'),
    };

    const lensConfig: Array<{ id: Lens; icon: LucideIcon; ru: string; en: string }> = [
      { id: 'work', icon: Briefcase, ru: 'Работа', en: 'Work' },
      { id: 'love', icon: Heart, ru: 'Любовь', en: 'Love' },
      { id: 'money', icon: Coins, ru: 'Деньги', en: 'Money' },
      { id: 'communication', icon: MessageCircle, ru: 'Общение', en: 'Talks' },
      { id: 'energy', icon: Zap, ru: 'Энергия', en: 'Energy' },
    ];

    return (
      <div
        className="min-h-full pb-16 font-sans"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.54) 28%, rgba(255,255,255,0.88) 64%, rgba(255,255,255,0.98) 100%), url(${zodiacBackground})`,
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      >
        <section className="flex min-h-[34dvh] flex-col justify-end px-5 pb-7 pt-10">
          <p className="text-[10.5px] uppercase tracking-[0.22em] text-[#77747a]">
            {language === 'en' ? 'Today by your chart' : 'Сегодня по моей карте'} ·{' '}
            {formatLumiaDate(today, language)}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-[20px] border border-white/70 bg-white/58 px-3 py-1 text-[12px] text-[#2f3034] shadow-[0_12px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl">
              <ZodiacIcon sign={sunSign} size={14} />
              <span>{zodiacLabel}</span>
              {zodiacDates ? <span className="text-[#9a9a9a]"> · {zodiacDates}</span> : null}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-[20px] border border-white/70 bg-white/58 px-3 py-1 text-[12px] text-[#2f3034] shadow-[0_12px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl">
              <MoonPhaseIcon slot={moon.slot} size={14} />
              <span>
                {moon.shortLabel} · {moon.illumination}%
              </span>
            </span>
          </div>

          <h1 className="mt-7 max-w-[19rem] text-[clamp(2.35rem,12vw,3.35rem)] leading-[0.98] tracking-[-0.02em] text-[#202024]">
            {language === 'en' ? 'Today for your map' : 'День по твоей карте'}
          </h1>
          <p className="mt-4 max-w-[18rem] text-[15px] leading-relaxed text-[#3f3d42]">
            {dailyReading.summary}
          </p>
        </section>

        <Divider />

        <section className="px-5 pb-7 pt-7">
          <SectionLabel>{language === 'en' ? 'Main energy of the day' : 'Главная энергия дня'}</SectionLabel>

          <h2 className="mt-5 max-w-[21rem] text-[23px] leading-[1.18] tracking-[-0.01em] text-[#1f1f1f]">
            {dailyReading.headline}
          </h2>

          <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.78] text-[#2d2d2d]">
            {dailyReading.reading}
          </p>

          <ul className="mt-6">
            <KeyValueRow label={language === 'en' ? 'Best step' : 'Лучший шаг'} value={dailyReading.focus} />
            <KeyValueRow label={language === 'en' ? 'Chance' : 'Возможность'} value={dailyReading.chance} />
            <KeyValueRow label={language === 'en' ? 'Soft risk' : 'Мягкий риск'} value={dailyReading.risk} />
          </ul>

          {dailyReading.advice?.[0] ? (
            <p className="mt-5 font-lora text-[14px] italic leading-[1.7] text-[#5e5e5e]">
              {dailyReading.advice[0]}
            </p>
          ) : null}
        </section>

        <Divider />

        <section className="px-5 pb-7 pt-7">
          <SectionLabel>{language === 'en' ? 'Moon today' : 'Луна сегодня'}</SectionLabel>
          <div className="mt-5 flex items-start gap-4">
            <div className="shrink-0 rounded-full bg-[#f4f4f4] p-2.5">
              <MoonPhaseIcon slot={moon.slot} size={26} />
            </div>
            <div className="min-w-0">
              <p className="font-lora text-[16px] leading-[1.4] text-[#1f1f1f]">{moon.label}</p>
              <p className="mt-2 font-lora text-[14.5px] leading-[1.8] text-[#3a3a3a]">{moon.meaning}</p>
            </div>
          </div>
        </section>

        <Divider />

        <section className="px-5 pb-7 pt-7">
          <SectionLabel>{language === 'en' ? 'Question of the day' : 'Вопрос дня'}</SectionLabel>
          <div className="mt-5 rounded-[24px] bg-white/42 px-5 py-4 ring-1 ring-black/[0.04] backdrop-blur-xl">
            <p className="text-[14.5px] italic leading-[1.75] text-[#3a3a3a]">{todayQuestion}</p>
          </div>
        </section>

        <Divider />

        <section className="px-5 pb-7 pt-7">
          <SectionLabel>
            {language === 'en' ? 'Personal layers' : 'Персональные слои дня'}
          </SectionLabel>

          {profile.isPremium ? (
            <>
              <div className="mt-5 grid gap-3">
                <DaypartCard title={language === 'en' ? 'Morning' : 'Утро'} reading={dayparts.morning || daypartFallbacks.morning} />
                <DaypartCard title={language === 'en' ? 'Day' : 'День'} reading={dayparts.day || daypartFallbacks.day} />
                <DaypartCard title={language === 'en' ? 'Evening' : 'Вечер'} reading={dayparts.evening || daypartFallbacks.evening} />
              </div>

              <p className="mt-6 font-lora text-[15px] leading-[1.85] text-[#2d2d2d]">{dailyReading.context}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {lensConfig.map((item) => (
                  <Pill
                    key={item.id}
                    active={lens === item.id}
                    Icon={item.icon}
                    label={language === 'en' ? item.en : item.ru}
                    onClick={() => setLens(lens === item.id ? null : item.id)}
                  />
                ))}
              </div>

              {lens ? (
                <p className="mt-4 font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d]">{lensTexts[lens]}</p>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-[28px] bg-white/46 p-5 ring-1 ring-black/[0.05] backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white p-2.5 shadow-sm">
                  <Lock size={16} strokeWidth={1.7} />
                </div>
                <div>
                  <h3 className="font-lora text-[18px] leading-[1.35] text-[#1f1f1f]">
                    {language === 'en' ? 'Open the full day' : 'Открыть полный день'}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#5f5f5f]">
                    {language === 'en'
                      ? 'Morning, day, evening, work, love, money, communication, and energy by your chart.'
                      : 'Утро, день, вечер, работа, любовь, деньги, общение и энергия по твоей карте.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-[#4b4652]">
                    <span className="rounded-full bg-white px-2.5 py-1">Premium</span>
                    <span className="rounded-full bg-white px-2.5 py-1">40–60 Lumi</span>
                    <span className="rounded-full bg-white px-2.5 py-1">
                      {language === 'en' ? 'Sphere 25–40 Lumi' : 'Сфера 25–40 Lumi'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onRequestPremium}
                    className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-[13px] font-semibold text-white"
                  >
                    <Sparkles size={15} strokeWidth={1.7} />
                    {language === 'en' ? 'See options' : 'Посмотреть доступ'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {profile.isPremium && weeklyReading ? (
          <>
            <Divider />
            <section className="px-5 pb-7 pt-7">
              <SectionLabel>{language === 'en' ? 'This week' : 'На этой неделе'}</SectionLabel>
              <p className="mt-5 font-lora text-[16px] leading-[1.4] text-[#1f1f1f]">{weeklyReading.headline}</p>
              <p className="mt-3 font-lora text-[14.5px] leading-[1.8] text-[#3a3a3a]">{weeklyReading.focus}</p>
            </section>
          </>
        ) : null}

        {!profile.isPremium ? (
          <>
            <Divider />
            <section className="px-5 pb-10 pt-7">
              <p className="font-lora text-[15px] leading-[1.8] text-[#2d2d2d]">
                {language === 'en'
                  ? 'The deeper layer is built from your full chart, not only your Sun sign.'
                  : 'Глубокий слой дня строится по полной карте, а не только по знаку Солнца.'}
              </p>
              <button
                type="button"
                onClick={onRequestPremium}
                className="mt-5 rounded-[20px] bg-[#1f1f1f] px-5 py-2.5 text-[13px] text-white"
              >
                {language === 'en' ? 'Open personal day' : 'Открыть личный день'}
              </button>
            </section>
          </>
        ) : onOpenChart ? (
          <>
            <Divider />
            <section className="px-5 pb-10 pt-7">
              <button
                type="button"
                onClick={onOpenChart}
                className="text-[14px] text-[#6f4ea8] underline underline-offset-4"
              >
                {language === 'en' ? 'Open your natal map →' : 'К твоей натальной карте →'}
              </button>
            </section>
          </>
        ) : null}
      </div>
    );
  }
);

Horoscope.displayName = 'Horoscope';
