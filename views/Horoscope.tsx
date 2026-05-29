import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, ChevronDown, Heart, Sparkles, WalletCards } from 'lucide-react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import type {
  ForecastDailyReading,
  ForecastDaypartReading,
  HoroscopeLayer,
  InterpretationSection,
  NatalChartData,
  UserProfile,
} from '../types';
import { getCachedFullDaypartForecast, getFullDaypartForecast, loadDailySignHoroscope } from '../services/astrologyService';
import { getCachedHumanDailySection, loadHumanDailySection, type HumanReadingError } from '../services/natalReadingService';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getZodiacSign } from '../constants';
import { cn } from '../lib/cn';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { useSwipeBack } from '../lib/useSwipeBack';
import type { HumanDailySectionKey } from '../lib/natalHumanShared';

type HoroscopeTone = 'sign' | 'chart' | 'love' | 'work';
type HoroscopeBackgroundState = { sign: string | null; tone: HoroscopeTone };

interface HoroscopeProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onRequestPremium?: () => void;
  onBack?: () => void | Promise<void>;
  onBackgroundChange?: (state: HoroscopeBackgroundState | null) => void;
  initialLayer?: HoroscopeLayer;
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
  title: string;
  subtitle: string;
  price?: number;
  tone: HoroscopeTone;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
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
  } catch {
    /* Telegram haptics are optional */
  }
}

function getLayerConfigs(): LayerConfig[] {
  return [
    {
      id: 'sign',
      title: 'Гороскоп',
      subtitle: 'Общий прогноз по знаку на сегодня.',
      tone: 'sign',
      icon: Sparkles,
    },
    {
      id: 'chart',
      title: 'Личный прогноз',
      subtitle: 'Персональный разбор дня по карте рождения и текущей дате.',
      price: LAYER_PRICES.chart,
      tone: 'chart',
      icon: WalletCards,
    },
    {
      id: 'love',
      title: 'Любовь сегодня',
      subtitle: 'Эмоции, близость и разговоры без лишних догадок.',
      price: LAYER_PRICES.love,
      tone: 'love',
      icon: Heart,
    },
    {
      id: 'work_money',
      title: 'Работа и деньги',
      subtitle: 'Фокус, решения, темп и денежная собранность.',
      price: LAYER_PRICES.work_money,
      tone: 'work',
      icon: BriefcaseBusiness,
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
      <div className="pointer-events-none relative mt-3 h-7 w-[min(18rem,78vw)] overflow-hidden [mask-image:radial-gradient(190px_46px_at_35%_0%,white_0%,white_38%,transparent_82%)]">
        <div
          className="absolute left-0 top-1 h-px w-[78%] bg-gradient-to-r from-transparent via-white/90 to-transparent blur-[1px]"
          style={{ boxShadow: `0 0 18px ${sparkleColor(tone)}` }}
        />
        <div
          className="absolute left-0 top-1 h-px w-[70%] bg-gradient-to-r from-transparent to-transparent"
          style={{ backgroundImage: `linear-gradient(90deg, transparent, ${sparkleColor(tone)}99, transparent)` }}
        />
        <span
          className="absolute left-[18%] top-0 h-1.5 w-1.5 rounded-full opacity-70"
          style={{ backgroundColor: sparkleColor(tone), boxShadow: `0 0 14px ${sparkleColor(tone)}` }}
        />
        <span
          className="absolute left-[52%] top-2 h-1 w-1 rounded-full opacity-50"
          style={{ backgroundColor: sparkleColor(tone), boxShadow: `0 0 12px ${sparkleColor(tone)}` }}
        />
        <span
          className="absolute left-[76%] top-1 h-1.5 w-1.5 rounded-full opacity-45"
          style={{ backgroundColor: sparkleColor(tone), boxShadow: `0 0 12px ${sparkleColor(tone)}` }}
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
    <div className="mt-4 grid max-h-[14.5rem] grid-cols-3 gap-x-4 gap-y-3 overflow-y-auto pr-1">
      {ZODIAC_SIGNS.map(([sign]) => {
        const active = sign === selectedSign;
        return (
          <button
            key={sign}
            type="button"
            onClick={() => onSelect(sign)}
            className={cn(
              'min-h-[34px] border-b pb-1 text-left transition active:scale-[0.98]',
              active ? 'border-[#1f1f1f] text-[#1f1f1f]' : 'border-black/10 text-[#68646e]'
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
        className="pointer-events-none absolute inset-x-0 inset-y-0 z-30 px-5 pb-[calc(3.25rem+max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))] pt-[calc(max(env(safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px))+15.75rem)]"
        style={{ x: contentX, opacity: contentOpacity }}
      >
        <div className="pointer-events-auto mx-auto flex h-full max-w-[23rem] flex-col">{children}</div>
      </motion.div>
    </motion.section>
  );
});

HoroscopeSlide.displayName = 'HoroscopeSlide';

export const Horoscope: React.FC<HoroscopeProps> = memo(
  ({
    profile,
    chartData,
    chartId,
    initialLayer = 'sign',
    onUpdateProfile,
    onOpenChart,
    onRequestPremium,
    onBack,
    onBackgroundChange,
  }) => {
    const language = profile.language === 'en' ? 'en' : 'ru';
    const today = getMoscowTodayKey();
    const userId = String(profile.id || '');
    const profileRef = useRef(profile);
    const layerRefs = useRef<Record<HoroscopeLayer, HTMLElement | null>>({
      sign: null,
      chart: null,
      love: null,
      work_money: null,
    });
    const autoOpenedLayerRef = useRef<string | null>(null);

    useEffect(() => {
      profileRef.current = profile;
    }, [profile]);

    const initialSign = useMemo(() => normalizeSign(chartData?.sun?.sign), [chartData?.sun?.sign]);
    const [selectedSign, setSelectedSign] = useState<ZodiacKey>(initialSign);
    const [showSignPicker, setShowSignPicker] = useState(false);
    const [signReading, setSignReading] = useState<ForecastDailyReading | null>(null);
    const [signLoading, setSignLoading] = useState(false);
    const [signError, setSignError] = useState<string | null>(null);
    const [personalDay, setPersonalDay] = useState<ForecastDaypartReading | null>(null);
    const [loveSection, setLoveSection] = useState<InterpretationSection | null>(null);
    const [workSection, setWorkSection] = useState<InterpretationSection | null>(null);
    const [loadingLayer, setLoadingLayer] = useState<HoroscopeLayer | null>(null);
    const [layerError, setLayerError] = useState<string | null>(null);

    useEffect(() => {
      setSelectedSign(initialSign);
    }, [initialSign]);

    const layers = useMemo(() => getLayerConfigs(), []);
    const activeConfig = layers.find((layer) => layer.id === initialLayer) || layers[0];
    const zodiacLabel = getZodiacSign(language, selectedSign);

    useEffect(() => {
      onBackgroundChange?.({ sign: selectedSign, tone: activeConfig.tone });
      return () => onBackgroundChange?.(null);
    }, [activeConfig.tone, onBackgroundChange, selectedSign]);

    const loadSignReading = React.useCallback(() => {
      let cancelled = false;
      setSignLoading(true);
      setSignError(null);
      setSignReading(null);

      loadDailySignHoroscope(selectedSign, today, language)
        .then((reading) => {
          if (!cancelled) setSignReading(reading);
        })
        .catch(() => {
          if (!cancelled) {
            setSignError(
              language === 'en'
                ? 'The horoscope is temporarily unavailable. Please try again.'
                : 'Гороскоп сейчас недоступен. Попробуй ещё раз.'
            );
          }
        })
        .finally(() => {
          if (!cancelled) setSignLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [language, selectedSign, today]);

    useEffect(() => loadSignReading(), [loadSignReading]);

    useEffect(() => {
      if (!userId || !chartData) return;
      let cancelled = false;

      const hydrateCachedLayers = async () => {
        const forecastAccessTier = profileRef.current.isPremium ? 'premium' : 'stars';
        const [cachedDay, cachedLove, cachedWork] = await Promise.allSettled([
          getCachedFullDaypartForecast(userId, 'day', {
            chartId: chartId ?? null,
            accessTier: forecastAccessTier,
            dateKey: today,
          }),
          getCachedHumanDailySection(userId, 'daily_love' as HumanDailySectionKey, chartId ?? undefined, today),
          getCachedHumanDailySection(
            userId,
            'daily_work_business' as HumanDailySectionKey,
            chartId ?? undefined,
            today
          ),
        ]);

        if (cancelled) return;
        if (cachedDay.status === 'fulfilled' && cachedDay.value) setPersonalDay(cachedDay.value);
        if (cachedLove.status === 'fulfilled' && cachedLove.value?.content) setLoveSection(cachedLove.value.content);
        if (cachedWork.status === 'fulfilled' && cachedWork.value?.content) setWorkSection(cachedWork.value.content);
      };

      void hydrateCachedLayers();
      return () => {
        cancelled = true;
      };
    }, [chartData, chartId, today, userId]);

    const getFriendlyError = (error: unknown, fallback: string) => {
      const err = error as HumanReadingError;
      if (err?.code === 'STARS_PAYMENT_REQUIRED') {
        return 'Этот прогноз открывается разово за Stars через Telegram payment.';
      }
      if (err?.code === 'CONTENT_GENERATION_UNAVAILABLE' || err?.status === 503) {
        return 'Прогноз сейчас не подготовился. Попробуйте ещё раз: если доступ уже открыт, повторного списания не будет.';
      }
      if (err?.status === 403 || err?.status === 409) {
        return fallback;
      }
      return 'Не получилось открыть прогноз. Попробуйте ещё раз чуть позже.';
    };

    const loadLayer = async (layer: HoroscopeLayer) => {
      if (layer === 'sign') return;
      if (!userId || !chartData) {
        setLayerError('Для персонального прогноза нужна сохранённая натальная карта.');
        return;
      }

      setLoadingLayer(layer);
      setLayerError(null);

      try {
        if (layer === 'chart') {
          const result = await getFullDaypartForecast(profileRef.current, chartData, 'day', {
            accessTier: profileRef.current.isPremium ? 'premium' : 'stars',
          });
          setPersonalDay(result.reading);
        }

        if (layer === 'love') {
          const result = await loadHumanDailySection(userId, 'daily_love' as HumanDailySectionKey, chartId ?? undefined, today, {
            accessTier: profileRef.current.isPremium ? 'premium' : 'stars',
          });
          setLoveSection(result.content);
        }

        if (layer === 'work_money') {
          const result = await loadHumanDailySection(
            userId,
            'daily_work_business' as HumanDailySectionKey,
            chartId ?? undefined,
            today,
            {
              accessTier: profileRef.current.isPremium ? 'premium' : 'stars',
            }
          );
          setWorkSection(result.content);
        }

        haptic('open');
      } catch (error) {
        const currentLayer = layers.find((item) => item.id === layer);
        setLayerError(
          getFriendlyError(error, `Этот прогноз можно открыть в Premium или разово за ${currentLayer?.price || 35} Stars.`)
        );
      } finally {
        setLoadingLayer(null);
      }
    };

    useEffect(() => {
      const key = `${initialLayer}:${today}:${userId}:${profile.isPremium ? 'premium' : 'basic'}`;
      window.requestAnimationFrame(() => {
        layerRefs.current[initialLayer]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });

      if (initialLayer !== 'sign' && profile.isPremium && autoOpenedLayerRef.current !== key) {
        autoOpenedLayerRef.current = key;
        void loadLayer(initialLayer);
      }
    }, [initialLayer, profile.isPremium, today, userId]);

    const chooseSign = (sign: ZodiacKey) => {
      haptic();
      setSelectedSign(sign);
      setShowSignPicker(false);
      setLayerError(null);
    };

    const renderLockedLayer = (layer: LayerConfig) => {
      const Icon = layer.icon;
      const price = layer.price || 35;
      const isPremium = !!profileRef.current.isPremium;
      const primaryLabel = loadingLayer === layer.id
        ? 'Открываю...'
        : isPremium
          ? 'Открыть прогноз'
          : `Открыть за ${price} Stars`;
      const handlePrimaryAction = () => {
        haptic('open');
        if (isPremium) {
          void loadLayer(layer.id);
          return;
        }
        void loadLayer(layer.id);
      };

      return (
        <div className="relative flex h-full min-h-0 flex-col justify-end overflow-hidden pb-2">
          <div className="pointer-events-none absolute -right-7 top-[18%] opacity-[0.13]">
            <Icon size={168} strokeWidth={0.8} />
          </div>
          <div className="pointer-events-none absolute left-2 top-[24%] h-28 w-28 rounded-full bg-white/20 blur-3xl" />

          <div className="relative max-w-[min(82vw,22rem)] pb-2">
            <SparkleTitle tone={layer.tone} className="max-w-[min(82vw,22rem)] text-[clamp(2.35rem,10vw,3.2rem)]">
              {layer.title}
            </SparkleTitle>
            <p className="mt-2 max-w-[min(82vw,22rem)] text-[17px] leading-[1.58] text-[#34323a]">
              {layer.subtitle}
            </p>
            <p className="mt-5 max-w-[min(82vw,21rem)] text-[14.5px] leading-relaxed text-[#625f68]">
              Этот прогноз можно открыть разово или читать каждый день вместе с Premium.
            </p>
            {layerError ? <p className="mt-4 text-[13px] leading-relaxed text-[#7d5960]">{layerError}</p> : null}
          </div>

          <div className="relative mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={loadingLayer === layer.id}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-[14px] font-semibold text-white shadow-[0_18px_42px_rgba(0,0,0,0.16)] disabled:opacity-60"
            >
              {primaryLabel}
              <ArrowRight size={16} />
            </button>
            {!isPremium ? (
              <button
                type="button"
                onClick={onRequestPremium}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white/58 px-5 text-[14px] font-semibold text-[#202024] shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur-xl"
              >
                Открыть Premium
              </button>
            ) : null}
          </div>
        </div>
      );
    };

    const renderSignSlide = () => {
      const paragraphs = splitParagraphs(signReading?.reading, 2);
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div className="pt-1">
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#5f5b64]">
              <button
                type="button"
                onClick={() => setShowSignPicker((value) => !value)}
                className="inline-flex items-center gap-2 text-[#24242a] transition active:scale-[0.985]"
              >
                <ZodiacIcon sign={selectedSign} size={16} />
                {zodiacLabel}
                <ChevronDown size={14} className={showSignPicker ? 'rotate-180 transition' : 'transition'} />
              </button>
              <span className="text-[#928d96]">·</span>
              <span>{formatLumiaDate(today, language)}</span>
            </div>
            {showSignPicker ? (
              <SignPicker language={language} selectedSign={selectedSign} onSelect={chooseSign} />
            ) : null}
          </div>

          <div className="mt-auto max-h-[calc(100%-4.2rem)] overflow-y-auto pb-2 pr-1">
            <SparkleTitle tone="sign" className="max-w-[min(82vw,22rem)] text-[clamp(2.65rem,13vw,4.05rem)]">
              Гороскоп
            </SparkleTitle>
            {signLoading ? (
              <div className="mt-4 max-w-[min(82vw,22rem)] space-y-3" aria-busy="true">
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-black/10" />
                <div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-black/10" />
              </div>
            ) : signError ? (
              <div className="mt-4 max-w-[min(82vw,22rem)] rounded-[18px] border border-[#d9b9b0] bg-white/64 px-4 py-3 text-[13px] leading-relaxed text-[#7d5960]">
                <p>{signError}</p>
                <button
                  type="button"
                  onClick={() => {
                    void loadSignReading();
                  }}
                  className="mt-3 inline-flex min-h-[36px] items-center rounded-full bg-white px-3 text-[12px] font-semibold text-[#202024]"
                >
                  {language === 'en' ? 'Try again' : 'Повторить'}
                </button>
              </div>
            ) : signReading ? (
              <>
                <p className="mt-2 max-w-[min(82vw,22rem)] text-[17px] leading-[1.58] text-[#34333a]">
                  {signReading.summary}
                </p>
                <div className="mt-4 space-y-3">
                  {paragraphs.map((paragraph, index) => (
                    <p key={index} className="max-w-[min(82vw,22rem)] text-[15px] leading-[1.68] text-[#47444c]">
                      {paragraph}
                    </p>
                  ))}
                </div>
                <div className="mt-4 max-w-[min(82vw,22rem)]">
                  <KeyLine label="Лучший шаг" value={signReading.focus} />
                  <KeyLine label="Мягкий риск" value={signReading.risk} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      );
    };

    const renderPersonalDay = (reading: ForecastDaypartReading) => (
      <div className="mt-auto max-h-full overflow-y-auto pb-2 pr-1">
        <SparkleTitle tone="chart" className="max-w-[min(82vw,22rem)] text-[clamp(2.35rem,10vw,3.2rem)]">
          Личный прогноз
        </SparkleTitle>
        <p className="mt-2 max-w-[min(82vw,22rem)] text-[17px] leading-[1.58] text-[#34333a]">
          {reading.summary || reading.headline}
        </p>
        <div className="mt-4 max-w-[min(82vw,22rem)]">
          <KeyLine label="Фокус дня" value={reading.focus} />
          <KeyLine label="Отношения" value={reading.relationships} />
          <KeyLine label="Деньги" value={reading.money} />
          <KeyLine label="Что делать" value={reading.guidance} />
        </div>
        {onOpenChart ? (
          <button
            type="button"
            onClick={onOpenChart}
            className="mt-4 inline-flex min-h-[40px] items-center gap-2 text-[13px] font-semibold text-[#202024] underline decoration-black/20 underline-offset-4"
          >
            Открыть карту
            <ArrowRight size={15} />
          </button>
        ) : null}
      </div>
    );

    const renderHumanSection = (section: InterpretationSection, layer: LayerConfig) => (
      <div className="mt-auto max-h-full overflow-y-auto pb-2 pr-1">
        <SparkleTitle tone={layer.tone} className="max-w-[min(82vw,22rem)] text-[clamp(2.25rem,9.4vw,3rem)]">
          {layer.title}
        </SparkleTitle>
        {section.subtitle ? (
          <p className="mt-2 max-w-[min(82vw,22rem)] text-[15px] leading-relaxed text-[#68646e]">{section.subtitle}</p>
        ) : null}
        <div className="mt-4 space-y-3">
          {splitParagraphs(section.content, 3).map((paragraph, index) => (
            <p key={index} className="max-w-[min(82vw,22rem)] text-[15px] leading-[1.66] text-[#3b3840]">
              {paragraph}
            </p>
          ))}
        </div>
        {section.bullets?.length ? (
          <div className="mt-4 max-w-[min(82vw,22rem)]">
            {section.bullets.slice(0, 3).map((bullet) => (
              <KeyLine key={bullet} label="Важно" value={bullet} />
            ))}
          </div>
        ) : null}
      </div>
    );


    useSwipeBack({
      enabled: !!onBack,
      onSwipeBack: () => {
        void onBack?.();
      },
      threshold: 72,
      edgeWidth: 34,
    });

    return (
      <div className="h-full min-h-full font-sans">
        <div className="mx-auto flex w-full max-w-[25rem] flex-col gap-3 px-4 pb-[calc(1.25rem+max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))] pt-[calc(max(env(safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px))+0.8rem)]">
          {layers.map((layer, index) => {
            const isOpen =
              layer.id === 'sign' ||
              (layer.id === 'chart' && !!personalDay) ||
              (layer.id === 'love' && !!loveSection) ||
              (layer.id === 'work_money' && !!workSection);

            return (
              <section
                key={layer.id}
                ref={(node) => {
                  layerRefs.current[layer.id] = node;
                }}
                className="rounded-[22px] border border-black/10 bg-white/68 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-md"
              >
                {layer.id === 'sign'
                  ? renderSignSlide()
                  : layer.id === 'chart' && personalDay
                    ? renderPersonalDay(personalDay)
                    : layer.id === 'love' && loveSection
                      ? renderHumanSection(loveSection, layer)
                      : layer.id === 'work_money' && workSection
                        ? renderHumanSection(workSection, layer)
                        : renderLockedLayer(layer)}

                {isOpen && index < layers.length - 1 ? <div className="mt-4 border-t border-black/10" /> : null}
              </section>
            );
          })}
        </div>
      </div>
    );
  }
);

Horoscope.displayName = 'Horoscope';
