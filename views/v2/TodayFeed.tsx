import React, { memo, useEffect, useMemo, useState } from 'react';
import type {
  HoroscopeLayer,
  HoroscopeOpenOptions,
  NatalChartData,
  PersonalDailySection,
  UserProfile,
} from '../../types';
import { getZodiacSign } from '../../constants';
import { getMoscowTodayKey, formatLumiaDate } from '../../lib/date-utils';
import { hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import { getDailyMotivation, getTimeGreeting } from '../../lib/localDailyMotivation';
import {
  getLocalDailyMetrics,
  getMetricLabels,
  getPulseDailyMetrics,
} from '../../lib/localDailyMetrics';
import { ZODIAC_KEYS } from '../../lib/localSignCompatibilityScores';
import { normalizeZodiacKey } from '../../lib/horoscope/signDaily';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedTodayAssistantHome,
  getTodayAssistantHome,
} from '../../services/astrologyService';
import { MonoPage } from '../../components/mono-ui/MonoPage';
import { MonoStagger, MonoStaggerItem } from '../../components/mono-ui/MonoMotion';
import { MonoIllustChart, MonoIllustHoroscope } from '../../components/mono-ui/MonoIllustrations';
import { LzFeedHeader } from '../../components/lumia-ui/v2/LzFeedHeader';
import { LzMetricsBento } from '../../components/lumia-ui/v2/LzMetricsBento';
import { LzFeedHeroCard } from '../../components/lumia-ui/v2/LzFeedHeroCard';
import { LzUnionCompact } from '../../components/lumia-ui/v2/LzUnionCompact';
import { LzAskPresets, getAskPresetQuestions } from '../../components/lumia-ui/v2/LzAskPresets';

type TodayFeedProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer, options?: HoroscopeOpenOptions) => void;
  onOpenPersonalDaily: (section?: PersonalDailySection) => void;
  onCreateNatalChart?: () => void;
  onOpenOracle?: (question?: string) => void;
  onOpenSynastry?: () => void;
  onOpenSettings?: () => void;
  onRequestPremium?: (source?: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  initialTodaySection?: string | null;
};

function defaultPartnerSign(userSign: string): string {
  const normalized = normalizeZodiacKey(userSign);
  if (!normalized) return ZODIAC_KEYS[1];
  const index = ZODIAC_KEYS.indexOf(normalized);
  return ZODIAC_KEYS[(index + 4) % ZODIAC_KEYS.length];
}

export const TodayFeed = memo<TodayFeedProps>(({
  profile,
  chartData,
  chartId,
  onOpenHoroscopeLayer,
  onOpenPersonalDaily,
  onCreateNatalChart,
  onOpenOracle,
  onOpenSynastry,
  onOpenSettings,
  onRequestPremium,
  scrollRef,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);
  const selectedSign = String(profile.selectedZodiacSign || chartData?.sun?.sign || ZODIAC_KEYS[0]).trim();

  const [signReading, setSignReading] = useState<Awaited<ReturnType<typeof getCachedDailySignHoroscope>>>(null);
  const [signLoading, setSignLoading] = useState(!!selectedSign);
  const [personal, setPersonal] = useState(
    () => (hasChart && premium ? getCachedTodayAssistantHome(profile, chartId, undefined, chartData) : null),
  );
  const [personalLoading, setPersonalLoading] = useState(hasChart && premium && !personal);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [signA, setSignA] = useState(selectedSign);
  const [signB, setSignB] = useState(() => defaultPartnerSign(selectedSign));

  useEffect(() => {
    setSignA(selectedSign);
    setSignB(defaultPartnerSign(selectedSign));
  }, [selectedSign]);

  useEffect(() => {
    if (!selectedSign) {
      setSignLoading(false);
      return;
    }
    let alive = true;
    setSignLoading(true);
    void getCachedDailySignHoroscope(selectedSign, today, language)
      .then((cached) => cached || ensureDailySignHoroscope(selectedSign, today, language))
      .then((reading) => {
        if (alive) setSignReading(reading);
      })
      .catch(() => {
        if (alive) setSignReading(null);
      })
      .finally(() => {
        if (alive) setSignLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [language, selectedSign, today]);

  useEffect(() => {
    if (!hasChart || !premium || !chartData) {
      setPersonalLoading(false);
      return;
    }
    const cached = getCachedTodayAssistantHome(profile, chartId, undefined, chartData);
    if (cached) {
      setPersonal(cached);
      setPersonalLoading(false);
      return;
    }
    let alive = true;
    setPersonalLoading(true);
    void getTodayAssistantHome(profile, chartData, chartId)
      .then((result) => {
        if (alive) setPersonal(result);
      })
      .catch(() => {
        if (alive) setPersonal(null);
      })
      .finally(() => {
        if (alive) setPersonalLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [chartData, chartId, hasChart, premium, profile]);

  useEffect(() => {
    try {
      const tgUser = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { photo_url?: unknown } } } } })
        ?.Telegram?.WebApp?.initDataUnsafe?.user;
      setAvatarUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setAvatarUrl(null);
    }
  }, []);

  const hour = new Date().getHours();
  const motivation = getDailyMotivation(today, language);
  const greeting = getTimeGreeting(language, hour);
  const userInitial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
  const metricLabels = getMetricLabels(language);

  const metrics = useMemo(() => {
    if (personal && personal.status === 'ready') {
      return getPulseDailyMetrics(personal.pulse, language);
    }
    return (
      getLocalDailyMetrics(selectedSign, today, language) || {
        mood: 62,
        energy: 58,
        communication: 64,
        focus: 71,
        footnote: language === 'ru' ? 'Пик 12:00–15:00 · держись одного приоритета' : 'Peak 12:00–15:00 · stay with one priority',
      }
    );
  }, [language, personal, selectedSign, today]);

  const signName = normalizeZodiacKey(selectedSign)
    ? getZodiacSign(language, normalizeZodiacKey(selectedSign)!)
    : (language === 'ru' ? 'Гороскоп' : 'Horoscope');

  const horoscopeSummary = signLoading
    ? (language === 'ru' ? 'Готовим разбор дня…' : 'Preparing today’s reading…')
    : signReading?.summary || (language === 'ru' ? 'Открой полный разбор знака на сегодня' : 'Open your full sign reading for today');

  const natalSummary = !hasChart
    ? (language === 'ru' ? 'Создай карту — узнай, кто ты на самом деле' : 'Create your chart to see who you really are')
    : personalLoading
    ? (language === 'ru' ? 'Смотрим твою карту…' : 'Reading your chart…')
    : chartData
    ? (language === 'ru'
      ? `Сегодня акцент на ${getZodiacSign(language, chartData.sun.sign)} и ${getZodiacSign(language, chartData.moon.sign)}`
      : `Today’s lens: ${getZodiacSign(language, chartData.sun.sign)} and ${getZodiacSign(language, chartData.moon.sign)}`)
    : (language === 'ru' ? 'Открой разбор по натальной карте' : 'Open your natal breakdown');

  const askQuestions = getAskPresetQuestions(language);

  return (
    <MonoPage scrollRef={scrollRef} className="lz-feed-page px-4">
      <div className="mx-auto w-full max-w-md pb-8">
        <MonoStagger className="space-y-0">
          <MonoStaggerItem>
            <LzFeedHeader
              greeting={greeting}
              name={profile.name}
              motivation={motivation}
              dateLabel={formatLumiaDate(today, language)}
              avatarSrc={avatarUrl}
              avatarInitial={userInitial}
              onAvatarClick={onOpenSettings}
            />
          </MonoStaggerItem>

          <MonoStaggerItem>
            <LzMetricsBento
              metrics={{
                mood: metrics.mood,
                energy: metrics.energy,
                communication: metrics.communication,
                focus: metrics.focus,
              }}
              labels={metricLabels}
              sectionLabel={language === 'ru' ? 'Сегодня' : 'Today'}
              footnote={metrics.footnote}
              onMetricClick={() => {
                lumiaSelectionHaptic();
                if (hasChart && premium) onOpenPersonalDaily('overview');
                else if (!hasChart) onCreateNatalChart?.();
                else onRequestPremium?.('personal_daily');
              }}
            />
          </MonoStaggerItem>

          <MonoStaggerItem>
            <LzFeedHeroCard
              tag={language === 'ru' ? 'сегодня' : 'today'}
              title={signName}
              summary={horoscopeSummary}
              actionLabel={language === 'ru' ? 'Читать' : 'Read'}
              artSlot="homeHoroscope"
              illustration={<MonoIllustHoroscope size={112} />}
              delay={0.05}
              onClick={() => {
                lumiaSelectionHaptic();
                onOpenHoroscopeLayer('sign', { source: 'today_feed' });
              }}
            />
          </MonoStaggerItem>

          <MonoStaggerItem>
            <LzFeedHeroCard
              tag={language === 'ru' ? 'карта' : 'chart'}
              title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
              summary={natalSummary}
              actionLabel={hasChart ? (language === 'ru' ? 'Карта' : 'Open chart') : (language === 'ru' ? 'Создать' : 'Create')}
              artSlot="homeNatal"
              illustration={<MonoIllustChart size={112} />}
              delay={0.1}
              onClick={() => {
                lumiaSelectionHaptic();
                if (hasChart) onCreateNatalChart?.();
                else onCreateNatalChart?.();
              }}
            />
          </MonoStaggerItem>

          <MonoStaggerItem>
            <LzUnionCompact
              language={language}
              signA={signA}
              signB={signB}
              onChangeSignA={setSignA}
              onChangeSignB={setSignB}
              onOpenUnion={onOpenSynastry}
              onRequestPremium={() => onRequestPremium?.('synastry')}
              isPremium={premium}
            />
          </MonoStaggerItem>

          <MonoStaggerItem>
            <LzAskPresets
              title={language === 'ru' ? 'Спроси Lumia' : 'Ask Lumia'}
              questions={askQuestions}
              onPick={(question) => onOpenOracle?.(question)}
            />
          </MonoStaggerItem>
        </MonoStagger>
      </div>
    </MonoPage>
  );
});

TodayFeed.displayName = 'TodayFeed';
