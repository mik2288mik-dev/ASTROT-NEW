import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, ChevronDown, Heart, Lock, Sparkles, WalletCards } from 'lucide-react';
import type {
  ForecastDailyReading,
  ForecastDaypartReading,
  InterpretationSection,
  NatalChartData,
  UserProfile,
} from '../types';
import { getFullDaypartForecast, loadDailySignHoroscope } from '../services/astrologyService';
import { loadHumanDailySection, type HumanReadingError } from '../services/natalReadingService';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getZodiacSign } from '../constants';
import { getHoroscopeBackground } from '../lib/visualBackgrounds';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import type { HumanDailySectionKey } from '../lib/natalHumanShared';

interface HoroscopeProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onRequestPremium?: () => void;
  onBackgroundSignChange?: (sign: string | null) => void;
}

const ZODIAC_SIGNS = [
  ['Aries', '21.03 - 19.04'],
  ['Taurus', '20.04 - 20.05'],
  ['Gemini', '21.05 - 20.06'],
  ['Cancer', '21.06 - 22.07'],
  ['Leo', '23.07 - 22.08'],
  ['Virgo', '23.08 - 22.09'],
  ['Libra', '23.09 - 22.10'],
  ['Scorpio', '23.10 - 21.11'],
  ['Sagittarius', '22.11 - 21.12'],
  ['Capricorn', '22.12 - 19.01'],
  ['Aquarius', '20.01 - 18.02'],
  ['Pisces', '19.02 - 20.03'],
] as const;

type ZodiacKey = (typeof ZODIAC_SIGNS)[number][0];
type HoroscopeLayer = 'sign' | 'chart' | 'love' | 'work_money';

type LayerConfig = {
  id: HoroscopeLayer;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  price?: number;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  background: string;
};

const LAYER_PRICES: Record<Exclude<HoroscopeLayer, 'sign'>, number> = {
  chart: 50,
  love: 35,
  work_money: 35,
};

function normalizeSign(sign?: string | null): ZodiacKey {
  const found = ZODIAC_SIGNS.find(([key]) => key.toLowerCase() === String(sign || '').toLowerCase());
  return (found?.[0] || 'Aries') as ZodiacKey;
}

function haptic(kind: 'select' | 'open' = 'select') {
  try {
    const webApp = (window as any)?.Telegram?.WebApp;
    if (kind === 'open') {
      webApp?.HapticFeedback?.impactOccurred?.('light');
    } else {
      webApp?.HapticFeedback?.selectionChanged?.();
    }
  } catch {}
}

function buildSignFallback(sign: ZodiacKey, date: string, language: 'ru' | 'en'): ForecastDailyReading {
  const signLabel = getZodiacSign(language, sign);
  if (language === 'en') {
    return {
      date,
      headline: `${signLabel}: choose one honest rhythm`,
      summary: `Today ${signLabel} feels steadier when the day is not overloaded with other people’s urgency.`,
      chance: 'A simple decision can return a sense of calm control.',
      risk: 'The soft risk is answering too quickly before the real priority is clear.',
      focus: 'Choose one thing and give it a small, visible step.',
      reading:
        `For ${signLabel}, today is less about speed and more about choosing the right pace. Do not turn every signal around you into a command. Notice what actually deserves your attention and let the rest stay in the background.\n\nThis is a good day to move through one clean action instead of many scattered attempts. The clearer your inner yes or no, the easier it becomes to protect your energy.`,
      context: 'This is a general zodiac horoscope. The personal layer uses your full natal chart.',
      advice: ['Keep the day simple.', 'Do not answer from pressure.', 'Let one small action carry the day.'],
    };
  }

  return {
    date,
    headline: `${signLabel}: выберите один честный ритм`,
    summary: `Сегодня ${signLabel} легче держит опору, когда день не перегружен чужой срочностью.`,
    chance: 'Простой выбор может вернуть ощущение спокойного контроля.',
    risk: 'Мягкий риск дня - отвечать слишком быстро, пока настоящий приоритет ещё не ясен.',
    focus: 'Выберите одно дело и сделайте по нему небольшой, но видимый шаг.',
    reading:
      `Для знака ${signLabel} этот день не про скорость, а про правильный темп. Не превращайте каждый сигнал вокруг в команду к действию. Заметьте, что правда требует внимания, а остальное оставьте фоном.\n\nСегодня лучше сработает одно чистое действие, чем много разрозненных попыток. Чем яснее внутреннее «да» или «нет», тем легче беречь силы и не расплескать день.`,
    context: 'Это общий гороскоп по знаку. Персональный слой строится по полной натальной карте.',
    advice: ['Упростите день.', 'Не отвечайте из давления.', 'Пусть одно маленькое действие соберёт ритм.'],
  };
}

function getLayerConfigs(selectedSign: ZodiacKey): LayerConfig[] {
  return [
    {
      id: 'sign',
      eyebrow: 'free',
      title: 'Гороскоп знака',
      subtitle: 'Общий прогноз на сегодня по вашему знаку.',
      cta: 'Читать',
      icon: Sparkles,
      background: getHoroscopeBackground(selectedSign),
    },
    {
      id: 'chart',
      eyebrow: 'premium / lumi',
      title: 'По моей карте',
      subtitle: 'Личный день по натальной карте и текущему фону.',
      cta: 'Открыть слой',
      price: LAYER_PRICES.chart,
      icon: WalletCards,
      background: '/natal-gateway/daily-horoscope.webp',
    },
    {
      id: 'love',
      eyebrow: 'premium / lumi',
      title: 'Любовь сегодня',
      subtitle: 'Эмоции, близость и разговоры без лишних догадок.',
      cta: 'Открыть сферу',
      price: LAYER_PRICES.love,
      icon: Heart,
      background: '/natal-gateway/synastry-union.webp',
    },
    {
      id: 'work_money',
      eyebrow: 'premium / lumi',
      title: 'Работа и деньги',
      subtitle: 'Фокус, решения, темп и денежная собранность.',
      cta: 'Открыть сферу',
      price: LAYER_PRICES.work_money,
      icon: BriefcaseBusiness,
      background: '/natal-gateway/personality-map.webp',
    },
  ];
}

function splitParagraphs(text?: string) {
  return String(text || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function SignPicker({
  language,
  selectedSign,
  onSelect,
}: {
  language: 'ru' | 'en';
  selectedSign: ZodiacKey;
  onSelect: (sign: ZodiacKey) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {ZODIAC_SIGNS.map(([sign]) => {
        const active = sign === selectedSign;
        return (
          <button
            key={sign}
            type="button"
            onClick={() => onSelect(sign)}
            className={`min-h-[52px] rounded-[18px] border px-2 text-left transition ${
              active
                ? 'border-[#1f1f1f]/20 bg-white/86 shadow-[0_16px_38px_rgba(0,0,0,0.08)]'
                : 'border-white/55 bg-white/44'
            }`}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-[#202024]">
              <ZodiacIcon sign={sign} size={15} />
              {getZodiacSign(language, sign)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LayerCarousel({
  layers,
  activeLayer,
  premium,
  onSelect,
}: {
  layers: LayerConfig[];
  activeLayer: HoroscopeLayer;
  premium: boolean;
  onSelect: (layer: HoroscopeLayer) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Partial<Record<HoroscopeLayer, HTMLButtonElement | null>>>({});
  const activeRef = useRef(activeLayer);
  const frameRef = useRef<number | null>(null);
  const scrollSelectionRef = useRef(false);

  useEffect(() => {
    activeRef.current = activeLayer;
    if (scrollSelectionRef.current) return;
    const root = scrollRef.current;
    const item = itemRefs.current[activeLayer];
    if (!root || !item) return;
    const left = item.offsetLeft - (root.clientWidth - item.clientWidth) / 2;
    root.scrollTo({ left, behavior: 'smooth' });
  }, [activeLayer]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    []
  );

  const handleScroll = () => {
    const root = scrollRef.current;
    if (!root || frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const rootCenter = root.scrollLeft + root.clientWidth / 2;
      let nextLayer = activeRef.current;
      let bestDistance = Number.POSITIVE_INFINITY;

      layers.forEach((layer) => {
        const item = itemRefs.current[layer.id];
        if (!item) return;
        const itemCenter = item.offsetLeft + item.clientWidth / 2;
        const distance = Math.abs(itemCenter - rootCenter);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextLayer = layer.id;
        }
      });

      if (nextLayer !== activeRef.current) {
        activeRef.current = nextLayer;
        scrollSelectionRef.current = true;
        haptic();
        onSelect(nextLayer);
        window.setTimeout(() => {
          scrollSelectionRef.current = false;
        }, 120);
      }
    });
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="-mx-5 mt-7 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        className="flex snap-x snap-mandatory gap-3"
        style={{
          paddingLeft: 'max(1.25rem, calc((100vw - min(80vw, 22rem)) / 2))',
          paddingRight: 'max(1.25rem, calc((100vw - min(80vw, 22rem)) / 2))',
        }}
      >
        {layers.map((layer) => {
          const Icon = layer.icon;
          const active = layer.id === activeLayer;
          const locked = layer.id !== 'sign' && !premium;
          return (
            <button
              key={layer.id}
              ref={(node) => {
                itemRefs.current[layer.id] = node;
              }}
              type="button"
              onClick={() => {
                haptic();
                onSelect(layer.id);
              }}
              className={`relative h-[13.2rem] w-[min(80vw,22rem)] shrink-0 snap-center overflow-hidden rounded-[30px] text-left transition duration-300 active:scale-[0.985] ${
                active ? 'scale-100 shadow-[0_24px_78px_rgba(0,0,0,0.18)]' : 'scale-[0.94] opacity-80'
              }`}
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(9,10,15,0.70), rgba(9,10,15,0.30) 54%, rgba(9,10,15,0.06)), url(${layer.background})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/12" />
              <div className="relative flex h-full flex-col justify-between p-5 text-white">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-white/22 bg-white/12 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/88 backdrop-blur-md">
                    {layer.eyebrow}
                  </span>
                  <span className="rounded-full bg-white/14 p-2.5 backdrop-blur-md">
                    {locked ? <Lock size={15} /> : <Icon size={15} strokeWidth={1.7} />}
                  </span>
                </div>
                <div>
                  <h3 className="max-w-[14rem] text-[26px] font-semibold leading-[0.98] tracking-[-0.03em]">
                    {layer.title}
                  </h3>
                  <p className="mt-2 max-w-[16rem] text-[13px] leading-snug text-white/78">{layer.subtitle}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KeyLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="border-t border-black/10 py-4 first:border-t-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#817d86]">{label}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[#2b2b2f]">{value}</p>
    </div>
  );
}

function ReadingSurface({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="px-1 pb-3 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8d739c]">{eyebrow}</p>
      <h2 className="mt-3 text-[28px] font-semibold leading-[1.05] tracking-[-0.035em] text-[#202024]">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-[15px] leading-relaxed text-[#64616a]">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </article>
  );
}

function LockedLayer({
  config,
  error,
  onUnlock,
  onPremium,
  loading,
}: {
  config: LayerConfig;
  error?: string | null;
  onUnlock: () => void;
  onPremium?: () => void;
  loading: boolean;
}) {
  return (
    <article className="px-1 pb-3 pt-2">
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-black/8 bg-white/58 p-3 shadow-sm backdrop-blur-xl">
          <Lock size={17} strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8d739c]">личный слой</p>
          <h2 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[#202024]">
            {config.title}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#57545d]">{config.subtitle}</p>
        </div>
      </div>

      {error ? <p className="mt-4 text-[13px] leading-relaxed text-[#7d5960]">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUnlock}
          disabled={loading}
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Открываю...' : `Открыть за ${config.price || 35} Lumi`}
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          onClick={onPremium}
          className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-black/8 bg-white/58 px-5 text-[14px] font-semibold text-[#202024]"
        >
          Premium
        </button>
      </div>
    </article>
  );
}

function PersonalDay({ reading }: { reading: ForecastDaypartReading }) {
  return (
    <ReadingSurface eyebrow="по моей карте" title={reading.headline} subtitle={reading.summary}>
      <div>
        <KeyLine label="Фокус" value={reading.focus} />
        <KeyLine label="Отношения" value={reading.relationships} />
        <KeyLine label="Деньги" value={reading.money} />
        <KeyLine label="Что делать" value={reading.guidance} />
      </div>
    </ReadingSurface>
  );
}

function HumanSectionBlock({ section }: { section: InterpretationSection }) {
  const paragraphs = splitParagraphs(section.content);
  return (
    <ReadingSurface eyebrow="персонально" title={section.title} subtitle={section.subtitle}>
      <div className="space-y-4">
        {paragraphs.slice(0, 4).map((paragraph, index) => (
          <p key={index} className="text-[15.5px] leading-[1.72] text-[#2f2d33]">
            {paragraph}
          </p>
        ))}
      </div>
      {section.bullets?.length ? (
        <div className="mt-5 grid gap-2">
          {section.bullets.slice(0, 4).map((bullet) => (
            <p key={bullet} className="border-t border-black/10 py-3 text-[13.5px] leading-relaxed text-[#36333a]">
              {bullet}
            </p>
          ))}
        </div>
      ) : null}
    </ReadingSurface>
  );
}

export const Horoscope: React.FC<HoroscopeProps> = memo(
  ({ profile, chartData, onUpdateProfile, onOpenChart, onRequestPremium, onBackgroundSignChange }) => {
    const language = profile.language === 'en' ? 'en' : 'ru';
    const today = getMoscowTodayKey();
    const userId = String(profile.id || '');
    const profileRef = useRef(profile);

    useEffect(() => {
      profileRef.current = profile;
    }, [profile]);

    const initialSign = useMemo(() => normalizeSign(chartData?.sun?.sign), [chartData?.sun?.sign]);
    const [selectedSign, setSelectedSign] = useState<ZodiacKey>(initialSign);
    const [activeLayer, setActiveLayer] = useState<HoroscopeLayer>('sign');
    const [showSignPicker, setShowSignPicker] = useState(false);
    const [signReading, setSignReading] = useState<ForecastDailyReading>(() =>
      buildSignFallback(initialSign, today, language)
    );
    const [personalDay, setPersonalDay] = useState<ForecastDaypartReading | null>(null);
    const [loveSection, setLoveSection] = useState<InterpretationSection | null>(null);
    const [workSection, setWorkSection] = useState<InterpretationSection | null>(null);
    const [loadingLayer, setLoadingLayer] = useState<HoroscopeLayer | null>(null);
    const [layerError, setLayerError] = useState<string | null>(null);

    useEffect(() => {
      setSelectedSign(initialSign);
    }, [initialSign]);

    useEffect(() => {
      onBackgroundSignChange?.(selectedSign);
      return () => onBackgroundSignChange?.(null);
    }, [onBackgroundSignChange, selectedSign]);

    useEffect(() => {
      let cancelled = false;
      setSignReading(buildSignFallback(selectedSign, today, language));
      const load = async () => {
        try {
          const reading = await loadDailySignHoroscope(selectedSign, today, language);
          if (!cancelled) setSignReading(reading);
        } catch {}
      };
      void load();
      return () => {
        cancelled = true;
      };
    }, [language, selectedSign, today]);

    const layers = useMemo(() => getLayerConfigs(selectedSign), [selectedSign]);
    const activeConfig = layers.find((item) => item.id === activeLayer) || layers[0];
    const zodiacLabel = getZodiacSign(language, selectedSign);
    const zodiacDate = ZODIAC_SIGNS.find(([sign]) => sign === selectedSign)?.[1] || '';
    const updateLumiBalance = (lumiBalance?: number) => {
      if (typeof lumiBalance !== 'number' || !onUpdateProfile) return;
      onUpdateProfile({ ...profileRef.current, lumiBalance });
    };

    const getFriendlyError = (error: unknown, fallback: string) => {
      const err = error as HumanReadingError;
      if (err?.code === 'INSUFFICIENT_LUMI') {
        return 'На балансе не хватает Lumi. Можно открыть Premium или пополнить кошелёк.';
      }
      if (err?.status === 403 || err?.status === 409) {
        return fallback;
      }
      return 'Не получилось загрузить слой. Попробуйте ещё раз чуть позже.';
    };

    const loadLayer = async (layer: HoroscopeLayer, spendLumi = false) => {
      if (layer === 'sign') return;
      if (!userId || !chartData) {
        setLayerError('Для персонального слоя нужна сохранённая натальная карта.');
        return;
      }

      setLoadingLayer(layer);
      setLayerError(null);

      try {
        if (layer === 'chart') {
          const result = await getFullDaypartForecast(profileRef.current, chartData, 'day', {
            accessTier: profileRef.current.isPremium ? 'premium' : 'lumi',
            allowLumiSpend: spendLumi,
          });
          setPersonalDay(result.reading);
          updateLumiBalance(result.lumiBalance);
        }

        if (layer === 'love') {
          const result = await loadHumanDailySection(userId, 'daily_love' as HumanDailySectionKey, undefined, today, {
            accessTier: profileRef.current.isPremium ? 'premium' : 'lumi',
            allowLumiSpend: spendLumi,
          });
          setLoveSection(result.content);
          updateLumiBalance(result.lumiBalance);
        }

        if (layer === 'work_money') {
          const result = await loadHumanDailySection(
            userId,
            'daily_work_business' as HumanDailySectionKey,
            undefined,
            today,
            {
              accessTier: profileRef.current.isPremium ? 'premium' : 'lumi',
              allowLumiSpend: spendLumi,
            }
          );
          setWorkSection(result.content);
          updateLumiBalance(result.lumiBalance);
        }

        haptic('open');
      } catch (error) {
        setLayerError(
          getFriendlyError(
            error,
            `Этот слой можно открыть в Premium или разово за ${activeConfig.price || 35} Lumi.`
          )
        );
      } finally {
        setLoadingLayer(null);
      }
    };

    useEffect(() => {
      if (activeLayer === 'sign') return;
      const alreadyLoaded =
        (activeLayer === 'chart' && personalDay) ||
        (activeLayer === 'love' && loveSection) ||
        (activeLayer === 'work_money' && workSection);
      if (alreadyLoaded) return;
      void loadLayer(activeLayer, false);
    }, [activeLayer]);

    const selectLayer = (layer: HoroscopeLayer) => {
      setActiveLayer(layer);
      setLayerError(null);
    };

    const chooseSign = (sign: ZodiacKey) => {
      haptic();
      setSelectedSign(sign);
      setActiveLayer('sign');
      setShowSignPicker(false);
    };

    const renderLayerContent = () => {
      if (activeLayer === 'sign') {
        return (
          <ReadingSurface eyebrow="гороскоп знака" title={signReading.headline}>
            <div className="space-y-4">
              {splitParagraphs(signReading.reading).map((paragraph, index) => (
                <p key={index} className="text-[15.5px] leading-[1.72] text-[#2f2d33]">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="mt-5">
              <KeyLine label="Лучший шаг" value={signReading.focus} />
              <KeyLine label="Возможность" value={signReading.chance} />
              <KeyLine label="Мягкий риск" value={signReading.risk} />
            </div>
          </ReadingSurface>
        );
      }

      if (activeLayer === 'chart' && personalDay) return <PersonalDay reading={personalDay} />;
      if (activeLayer === 'love' && loveSection) return <HumanSectionBlock section={loveSection} />;
      if (activeLayer === 'work_money' && workSection) return <HumanSectionBlock section={workSection} />;

      return (
        <LockedLayer
          config={activeConfig}
          error={layerError}
          loading={loadingLayer === activeLayer}
          onUnlock={() => void loadLayer(activeLayer, true)}
          onPremium={onRequestPremium}
        />
      );
    };

    return (
      <div className="min-h-full pb-12 font-sans">
        <section className="flex min-h-[58dvh] flex-col justify-end px-5 pb-8 pt-4">
          <div className="max-w-[21rem]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-[#817d86]">
              Гороскоп · {formatLumiaDate(today, language)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSignPicker((value) => !value)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/65 bg-white/56 px-3 text-[13px] font-medium text-[#24242a] shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl"
              >
                <ZodiacIcon sign={selectedSign} size={16} />
                {zodiacLabel}
                <span className="text-[#8d8890]">· {zodiacDate}</span>
                <ChevronDown size={15} className={showSignPicker ? 'rotate-180 transition' : 'transition'} />
              </button>
              <span className="inline-flex min-h-[38px] items-center rounded-full border border-white/60 bg-white/42 px-3 text-[12px] text-[#615e66] backdrop-blur-xl">
                общий прогноз
              </span>
            </div>

            {showSignPicker ? (
              <SignPicker language={language} selectedSign={selectedSign} onSelect={chooseSign} />
            ) : null}

            <h1 className="mt-8 text-[clamp(3.1rem,15vw,4.7rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-[#202024]">
              Гороскоп
            </h1>
            <p className="mt-5 max-w-[18.5rem] text-[17px] leading-[1.55] text-[#393840]">
              {signReading.summary}
            </p>

            <button
              type="button"
              onClick={() => {
                haptic('open');
                setActiveLayer('sign');
                document.getElementById('horoscope-reading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="mt-7 inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full bg-[#1f1f1f] px-6 text-[15px] font-semibold text-white shadow-[0_20px_48px_rgba(0,0,0,0.18)] active:scale-[0.985]"
            >
              Читать сегодня
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <section id="horoscope-reading" className="px-5 pb-8">
          <LayerCarousel
            layers={layers}
            activeLayer={activeLayer}
            premium={profile.isPremium}
            onSelect={selectLayer}
          />

          <div className="mt-5">{renderLayerContent()}</div>

          {activeLayer === 'chart' && personalDay && onOpenChart ? (
            <button
              type="button"
              onClick={onOpenChart}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/58 px-4 text-[13px] font-semibold text-[#202024] shadow-sm backdrop-blur-xl"
            >
              Открыть натальную карту
              <ArrowRight size={15} />
            </button>
          ) : null}
        </section>
      </div>
    );
  }
);

Horoscope.displayName = 'Horoscope';
