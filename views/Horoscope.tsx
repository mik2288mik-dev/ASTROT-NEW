import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, ChevronDown, Heart, Sparkles, WalletCards } from 'lucide-react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'framer-motion';
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
import { cn } from '../lib/cn';
import { getHoroscopeBackground } from '../lib/visualBackgrounds';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { SparklesCore } from '../components/ui/sparkles';
import type { HumanDailySectionKey } from '../lib/natalHumanShared';

type HoroscopeLayer = 'sign' | 'chart' | 'love' | 'work_money';
type HoroscopeTone = 'sign' | 'chart' | 'love' | 'work';
type HoroscopeBackgroundState = { sign: string | null; tone: HoroscopeTone };

interface HoroscopeProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onRequestPremium?: () => void;
  onBackgroundChange?: (state: HoroscopeBackgroundState | null) => void;
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

type LayerConfig = {
  id: HoroscopeLayer;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  price?: number;
  tone: HoroscopeTone;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  background: string;
};

const LAYER_PRICES: Record<Exclude<HoroscopeLayer, 'sign'>, number> = {
  chart: 50,
  love: 35,
  work_money: 35,
};

const SLIDE_OFFSETS = [-1, 0, 1] as const;

function mod(value: number, total: number) {
  return ((value % total) + total) % total;
}

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
  } catch {
    /* Telegram haptics are optional */
  }
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
  const zodiacBackground = getHoroscopeBackground(selectedSign);
  return [
    {
      id: 'sign',
      eyebrow: 'free',
      title: 'Гороскоп знака',
      subtitle: 'Общий прогноз на сегодня по вашему знаку.',
      cta: 'Выбрать знак',
      tone: 'sign',
      icon: Sparkles,
      background: zodiacBackground,
    },
    {
      id: 'chart',
      eyebrow: 'premium / lumi',
      title: 'По моей карте',
      subtitle: 'Личный день по натальной карте и текущему фону.',
      cta: 'Открыть слой',
      price: LAYER_PRICES.chart,
      tone: 'chart',
      icon: WalletCards,
      background: zodiacBackground,
    },
    {
      id: 'love',
      eyebrow: 'premium / lumi',
      title: 'Любовь сегодня',
      subtitle: 'Эмоции, близость и разговоры без лишних догадок.',
      cta: 'Открыть сферу',
      price: LAYER_PRICES.love,
      tone: 'love',
      icon: Heart,
      background: zodiacBackground,
    },
    {
      id: 'work_money',
      eyebrow: 'premium / lumi',
      title: 'Работа и деньги',
      subtitle: 'Фокус, решения, темп и денежная собранность.',
      cta: 'Открыть сферу',
      price: LAYER_PRICES.work_money,
      tone: 'work',
      icon: BriefcaseBusiness,
      background: zodiacBackground,
    },
  ];
}

function splitParagraphs(text?: string, limit = 2) {
  return String(text || '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function slideOverlayClass(tone: HoroscopeTone) {
  if (tone === 'chart') {
    return 'bg-[linear-gradient(180deg,rgba(246,251,255,0.50)_0%,rgba(232,241,255,0.35)_32%,rgba(220,232,252,0.18)_58%,rgba(248,251,255,0.82)_100%)]';
  }
  if (tone === 'love') {
    return 'bg-[linear-gradient(180deg,rgba(255,248,249,0.56)_0%,rgba(255,234,239,0.35)_34%,rgba(235,190,204,0.14)_58%,rgba(255,247,248,0.84)_100%)]';
  }
  if (tone === 'work') {
    return 'bg-[linear-gradient(180deg,rgba(251,249,238,0.58)_0%,rgba(240,235,212,0.36)_34%,rgba(206,198,160,0.13)_58%,rgba(255,252,242,0.86)_100%)]';
  }
  return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.44)_0%,rgba(255,251,242,0.34)_34%,rgba(255,255,255,0.12)_58%,rgba(255,250,240,0.82)_100%)]';
}

function sparkleColor(tone: HoroscopeTone) {
  if (tone === 'love') return '#f5b8ca';
  if (tone === 'work') return '#d5bd7d';
  if (tone === 'chart') return '#93b7e8';
  return '#ffffff';
}

function SparkleTitle({
  tone,
  children,
  className,
}: {
  tone: HoroscopeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      <h1
        className={cn(
          'max-w-[19rem] font-semibold leading-[0.97] tracking-[-0.052em] text-[#202024]',
          className
        )}
      >
        {children}
      </h1>
      <div className="pointer-events-none relative mt-3 h-9 w-[min(18rem,78vw)] overflow-hidden [mask-image:radial-gradient(190px_52px_at_35%_0%,white_0%,white_36%,transparent_82%)]">
        <div className="absolute left-0 top-1 h-px w-[78%] bg-gradient-to-r from-transparent via-white/90 to-transparent blur-[1px]" />
        <div className="absolute left-0 top-1 h-px w-[70%] bg-gradient-to-r from-transparent via-[#8c6bb3]/38 to-transparent" />
        <SparklesCore
          background="transparent"
          minSize={0.32}
          maxSize={0.9}
          particleDensity={36}
          particleColor={sparkleColor(tone)}
          speed={0.75}
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
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
    <div className="mt-3 grid max-h-[14.5rem] grid-cols-3 gap-2 overflow-y-auto pr-1">
      {ZODIAC_SIGNS.map(([sign]) => {
        const active = sign === selectedSign;
        return (
          <button
            key={sign}
            type="button"
            onClick={() => onSelect(sign)}
            className={cn(
              'min-h-[46px] rounded-[17px] border px-2 text-left backdrop-blur-xl transition active:scale-[0.98]',
              active ? 'border-black/12 bg-white/78 shadow-sm' : 'border-white/42 bg-white/34'
            )}
          >
            <span className="flex items-center gap-2 text-[12.5px] font-medium text-[#202024]">
              <ZodiacIcon sign={sign} size={14} />
              {getZodiacSign(language, sign)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function KeyLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="border-t border-black/10 py-3.5 first:border-t-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#817d86]">{label}</p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#2b2b2f]">{value}</p>
    </div>
  );
}

type HoroscopeSlideProps = {
  layer: LayerConfig;
  offset: number;
  viewportWidth: number;
  dragX: MotionValue<number>;
  children: React.ReactNode;
};

const HoroscopeSlide = memo<HoroscopeSlideProps>(({ layer, offset, viewportWidth, dragX, children }) => {
  const x = useTransform(dragX, (latest) => latest + offset * viewportWidth);
  const contentX = useTransform(dragX, (latest) => (latest / Math.max(viewportWidth, 1)) * -26);
  const contentOpacity = useTransform(
    dragX,
    [-viewportWidth * 0.58, 0, viewportWidth * 0.58],
    [0.42, 1, 0.42]
  );

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{
        x,
        zIndex: offset === 0 ? 30 : 10,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
      aria-hidden={offset !== 0}
    >
      <div className={cn('pointer-events-none absolute inset-0', slideOverlayClass(layer.tone))} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/26 to-transparent" />

      <motion.div
        className="pointer-events-none absolute inset-x-0 inset-y-0 z-30 px-5 pb-[calc(3.25rem+max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))] pt-[clamp(0.75rem,2.5vh,1.4rem)]"
        style={{ x: contentX, opacity: contentOpacity }}
      >
        <div className="pointer-events-auto mx-auto flex h-full max-w-[23rem] flex-col">{children}</div>
      </motion.div>
    </motion.section>
  );
});

HoroscopeSlide.displayName = 'HoroscopeSlide';

function HoroscopeSwipeDeck({
  layers,
  activeIndex,
  onIndexChange,
  renderSlide,
}: {
  layers: LayerConfig[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  renderSlide: (layer: LayerConfig) => React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(390);
  const dragX = useMotionValue(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const updateWidth = () => setViewportWidth(Math.max(node.getBoundingClientRect().width, 320));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const commitIndex = (nextIndex: number) => {
    const resolved = mod(nextIndex, layers.length);
    activeIndexRef.current = resolved;
    onIndexChange(resolved);
    dragX.set(0);
  };

  const settle = (direction: -1 | 0 | 1, velocity = 0) => {
    animationRef.current?.stop();

    if (direction !== 0) haptic('select');

    if (shouldReduceMotion) {
      commitIndex(activeIndexRef.current + direction);
      return;
    }

    const targetX = direction === 0 ? 0 : -direction * viewportWidth;
    animationRef.current = animate(dragX, targetX, {
      type: 'spring',
      stiffness: direction === 0 ? 300 : 238,
      damping: direction === 0 ? 32 : 29,
      mass: 0.88,
      velocity,
      onComplete: () => commitIndex(activeIndexRef.current + direction),
    });
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = viewportWidth * 0.16;
    const direction =
      info.offset.x < -threshold || info.velocity.x < -420
        ? 1
        : info.offset.x > threshold || info.velocity.x > 420
          ? -1
          : 0;
    settle(direction, info.velocity.x);
  };

  return (
    <div ref={rootRef} className="relative h-full min-h-[calc(100dvh-10.75rem)] overflow-hidden">
      {SLIDE_OFFSETS.map((offset) => {
        const layer = layers[mod(activeIndex + offset, layers.length)];
        return (
          <HoroscopeSlide
            key={`${layer.id}-${offset}`}
            layer={layer}
            offset={offset}
            viewportWidth={viewportWidth}
            dragX={dragX}
          >
            {renderSlide(layer)}
          </HoroscopeSlide>
        );
      })}

      <motion.div
        drag={shouldReduceMotion ? false : 'x'}
        dragConstraints={{ left: -viewportWidth, right: viewportWidth }}
        dragElastic={0.035}
        dragMomentum={false}
        onDragStart={() => animationRef.current?.stop()}
        onDragEnd={handleDragEnd}
        style={{ x: dragX, touchAction: 'pan-y' }}
        className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(0.72rem+max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))] z-40 flex items-center justify-center gap-2">
        {layers.map((layer, index) => (
          <button
            key={`horoscope-dot-${layer.id}`}
            type="button"
            onClick={() => {
              haptic();
              commitIndex(index);
            }}
            className={cn(
              'pointer-events-auto h-2 rounded-full bg-black/20 transition-all duration-300',
              index === activeIndex ? 'w-7 bg-[#1f1f1f]' : 'w-2'
            )}
            aria-label={layer.title}
          />
        ))}
      </div>
    </div>
  );
}

export const Horoscope: React.FC<HoroscopeProps> = memo(
  ({ profile, chartData, onUpdateProfile, onOpenChart, onRequestPremium, onBackgroundChange }) => {
    const language = profile.language === 'en' ? 'en' : 'ru';
    const today = getMoscowTodayKey();
    const userId = String(profile.id || '');
    const profileRef = useRef(profile);

    useEffect(() => {
      profileRef.current = profile;
    }, [profile]);

    const initialSign = useMemo(() => normalizeSign(chartData?.sun?.sign), [chartData?.sun?.sign]);
    const [selectedSign, setSelectedSign] = useState<ZodiacKey>(initialSign);
    const [activeIndex, setActiveIndex] = useState(0);
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

    const layers = useMemo(() => getLayerConfigs(selectedSign), [selectedSign]);
    const activeConfig = layers[activeIndex] || layers[0];
    const activeLayer = activeConfig.id;
    const zodiacLabel = getZodiacSign(language, selectedSign);
    const zodiacDate = ZODIAC_SIGNS.find(([sign]) => sign === selectedSign)?.[1] || '';

    useEffect(() => {
      onBackgroundChange?.({ sign: selectedSign, tone: activeConfig.tone });
      return () => onBackgroundChange?.(null);
    }, [activeConfig.tone, onBackgroundChange, selectedSign]);

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
          getFriendlyError(error, `Этот слой можно открыть в Premium или разово за ${activeConfig.price || 35} Lumi.`)
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

    const chooseSign = (sign: ZodiacKey) => {
      haptic();
      setSelectedSign(sign);
      setActiveIndex(0);
      setShowSignPicker(false);
      setLayerError(null);
    };

    const renderLockedLayer = (layer: LayerConfig) => {
      const Icon = layer.icon;
      return (
        <div className="mt-auto max-h-full overflow-y-auto pb-2 pr-1">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b6b82] backdrop-blur-xl">
            <Icon size={14} strokeWidth={1.7} />
            {layer.eyebrow}
          </div>
          <SparkleTitle tone={layer.tone} className="max-w-[18rem] text-[clamp(2.2rem,10vw,3.05rem)]">
            {layer.title}
          </SparkleTitle>
          <p className="mt-4 max-w-[19rem] text-[16px] leading-[1.55] text-[#3f3d45]">{layer.subtitle}</p>
          <p className="mt-4 max-w-[19rem] text-[14.5px] leading-relaxed text-[#625f68]">
            Этот слой связывает день с вашей картой. Его можно открыть точечно за Lumi или читать каждый день в
            Premium.
          </p>
          {layerError ? <p className="mt-3 text-[13px] leading-relaxed text-[#7d5960]">{layerError}</p> : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadLayer(layer.id, true)}
              disabled={loadingLayer === layer.id}
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-[14px] font-semibold text-white shadow-[0_18px_42px_rgba(0,0,0,0.16)] disabled:opacity-60"
            >
              {loadingLayer === layer.id ? 'Открываю...' : `Открыть за ${layer.price || 35} Lumi`}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={onRequestPremium}
              className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-black/8 bg-white/52 px-5 text-[14px] font-semibold text-[#202024] backdrop-blur-xl"
            >
              Premium
            </button>
          </div>
        </div>
      );
    };

    const renderSignSlide = () => {
      const paragraphs = splitParagraphs(signReading.reading, 2);
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div className="pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSignPicker((value) => !value)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/58 bg-white/54 px-3 text-[13px] font-medium text-[#24242a] shadow-[0_12px_32px_rgba(0,0,0,0.05)] backdrop-blur-xl"
              >
                <ZodiacIcon sign={selectedSign} size={16} />
                {zodiacLabel}
                <span className="text-[#8d8890]">· {zodiacDate}</span>
                <ChevronDown size={15} className={showSignPicker ? 'rotate-180 transition' : 'transition'} />
              </button>
              <span className="inline-flex min-h-[38px] items-center rounded-full border border-white/48 bg-white/34 px-3 text-[12px] text-[#66636b] backdrop-blur-xl">
                {formatLumiaDate(today, language)}
              </span>
            </div>
            {showSignPicker ? (
              <SignPicker language={language} selectedSign={selectedSign} onSelect={chooseSign} />
            ) : null}
          </div>

          <div className="mt-auto max-h-[calc(100%-4.2rem)] overflow-y-auto pb-2 pr-1">
            <p className="mb-3 inline-flex rounded-full border border-white/42 bg-white/38 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b6b82] backdrop-blur-xl">
              Гороскоп знака
            </p>
            <SparkleTitle tone="sign" className="max-w-[18.8rem] text-[clamp(2.15rem,9.2vw,2.9rem)]">
              {zodiacLabel}: гороскоп на сегодня
            </SparkleTitle>
            <p className="mt-1 max-w-[19rem] text-[16.5px] leading-[1.55] text-[#34333a]">{signReading.summary}</p>
            <div className="mt-4 space-y-3">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="max-w-[19.5rem] text-[14.5px] leading-[1.62] text-[#47444c]">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="mt-4 max-w-[20rem]">
              <KeyLine label="Лучший шаг" value={signReading.focus} />
              <KeyLine label="Мягкий риск" value={signReading.risk} />
            </div>
          </div>
        </div>
      );
    };

    const renderPersonalDay = (reading: ForecastDaypartReading) => (
      <div className="mt-auto max-h-full overflow-y-auto pb-2 pr-1">
        <p className="mb-3 inline-flex rounded-full border border-white/42 bg-white/38 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6d778c] backdrop-blur-xl">
          По моей карте
        </p>
        <SparkleTitle tone="chart" className="max-w-[19rem] text-[clamp(2.1rem,9.5vw,2.85rem)]">
          {reading.headline}
        </SparkleTitle>
        <p className="mt-1 max-w-[19.2rem] text-[15.5px] leading-[1.6] text-[#3d3a40]">{reading.summary}</p>
        <div className="mt-4 max-w-[20rem]">
          <KeyLine label="Фокус" value={reading.focus} />
          <KeyLine label="Отношения" value={reading.relationships} />
          <KeyLine label="Деньги" value={reading.money} />
          <KeyLine label="Что делать" value={reading.guidance} />
        </div>
        {onOpenChart ? (
          <button
            type="button"
            onClick={onOpenChart}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/56 px-4 text-[13px] font-semibold text-[#202024] shadow-sm backdrop-blur-xl"
          >
            Открыть натальную карту
            <ArrowRight size={15} />
          </button>
        ) : null}
      </div>
    );

    const renderHumanSection = (section: InterpretationSection, layer: LayerConfig) => (
      <div className="mt-auto max-h-full overflow-y-auto pb-2 pr-1">
        <p className="mb-3 inline-flex rounded-full border border-white/42 bg-white/38 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b6b82] backdrop-blur-xl">
          {layer.title}
        </p>
        <SparkleTitle tone={layer.tone} className="max-w-[19rem] text-[clamp(2.05rem,9vw,2.75rem)]">
          {section.title}
        </SparkleTitle>
        {section.subtitle ? (
          <p className="mt-1 max-w-[19rem] text-[14.5px] leading-relaxed text-[#68646e]">{section.subtitle}</p>
        ) : null}
        <div className="mt-4 space-y-3">
          {splitParagraphs(section.content, 3).map((paragraph, index) => (
            <p key={index} className="max-w-[19.5rem] text-[14.5px] leading-[1.62] text-[#3b3840]">
              {paragraph}
            </p>
          ))}
        </div>
        {section.bullets?.length ? (
          <div className="mt-4 max-w-[20rem]">
            {section.bullets.slice(0, 3).map((bullet) => (
              <KeyLine key={bullet} label="Важно" value={bullet} />
            ))}
          </div>
        ) : null}
      </div>
    );

    const renderSlide = (layer: LayerConfig) => {
      if (layer.id === 'sign') return renderSignSlide();
      if (layer.id === 'chart' && personalDay) return renderPersonalDay(personalDay);
      if (layer.id === 'love' && loveSection) return renderHumanSection(loveSection, layer);
      if (layer.id === 'work_money' && workSection) return renderHumanSection(workSection, layer);
      return renderLockedLayer(layer);
    };

    return (
      <div className="h-full min-h-full font-sans">
        <HoroscopeSwipeDeck
          layers={layers}
          activeIndex={activeIndex}
          onIndexChange={(index) => {
            setActiveIndex(index);
            setLayerError(null);
            setShowSignPicker(false);
          }}
          renderSlide={renderSlide}
        />
      </div>
    );
  }
);

Horoscope.displayName = 'Horoscope';
