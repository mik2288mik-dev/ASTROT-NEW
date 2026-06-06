import React, { memo, useEffect, useMemo, useState } from 'react';
import type { ForecastDailyReading, HoroscopeLayer, HoroscopeOpenOptions, NatalChartData, PersonalDailySection, TodayAssistantHomeResult, UserProfile } from '../types';
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import { getContentPolicy } from '../lib/contentMatrix';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getZodiacSign } from '../constants';
import { getCachedDailySignHoroscope, ensureDailySignHoroscope, getCachedTodayAssistantHome, getTodayAssistantHome } from '../services/astrologyService';

type DashboardProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer, options?: HoroscopeOpenOptions) => void;
  onOpenPersonalDaily: (section?: PersonalDailySection) => void;
  onCreateNatalChart?: () => void;
  onOpenSettings?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  initialTodaySection?: string | null;
};

const FALLBACKS = {
  background: 'Сегодня полезнее выбрать один ясный приоритет и не разгонять тревогу лишними решениями.',
  dayCard: 'Сначала закончи то, что уже начато. Один спокойный разговор и один завершённый шаг сегодня дадут больше, чем попытка успеть всё сразу. Если появится срочная новая идея, запиши её, но не меняй план до вечера. Так день останется собранным и понятным.',
  micro: 'Не принимай важное решение на первой эмоции.',
  moon: 'Луна сегодня напоминает: пауза перед ответом часто полезнее скорости.',
  retrograde: 'Если планы буксуют, сначала перепроверь детали и только потом меняй направление.',
};

function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="space-y-2" aria-busy="true">{Array.from({ length: lines }).map((_, index) => <div key={index} className="h-3 animate-pulse rounded-full bg-black/10" style={{ width: `${95 - index * 12}%` }} />)}</div>;
}

function Card({ title, text, onClick, locked = false, loading = false, label }: { title: string; text: string; onClick?: () => void; locked?: boolean; loading?: boolean; label?: string }) {
  const Component = onClick ? 'button' : 'section';
  return <Component type={onClick ? 'button' : undefined} onClick={onClick} className="w-full rounded-[22px] border border-black/10 bg-white p-5 text-left shadow-[0_14px_34px_rgba(0,0,0,0.05)]">
    {label ? <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8c6bb1]">{label}</p> : null}
    <h2 className="mt-1 text-[20px] font-semibold leading-tight text-[#202024]">{title}{locked ? ' · Premium' : ''}</h2>
    <div className="mt-3">{loading ? <Skeleton /> : <p className="text-[14px] leading-relaxed text-[#68646e] line-clamp-4">{text}</p>}</div>
  </Component>;
}

export const Dashboard = memo<DashboardProps>(({ profile, chartData, chartId, onOpenHoroscopeLayer, onOpenPersonalDaily, onCreateNatalChart, scrollRef }) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);
  const selectedSign = String(profile.selectedZodiacSign || chartData?.sun?.sign || '').trim();
  const [signReading, setSignReading] = useState<ForecastDailyReading | null>(null);
  const [signLoading, setSignLoading] = useState(!!selectedSign);
  const [personal, setPersonal] = useState<TodayAssistantHomeResult | null>(() => hasChart && premium ? getCachedTodayAssistantHome(profile, chartId, undefined, chartData) : null);
  const [personalLoading, setPersonalLoading] = useState(hasChart && premium && !personal);

  // Policies are the source of truth for the compact home surfaces.
  const dayCardPolicy = getContentPolicy('day_card');
  const signPolicy = getContentPolicy('sign_daily_horoscope');
  const microPolicy = getContentPolicy('push_daily');
  const timingPolicy = getContentPolicy('action_timing');
  const personalPolicy = getContentPolicy('personal_daily');

  useEffect(() => {
    if (!selectedSign) { setSignLoading(false); return; }
    let alive = true;
    setSignLoading(true);
    void getCachedDailySignHoroscope(selectedSign, today, language)
      .then((cached) => cached || ensureDailySignHoroscope(selectedSign, today, language))
      .then((reading) => { if (alive) setSignReading(reading); })
      .catch(() => { if (alive) setSignReading(null); })
      .finally(() => { if (alive) setSignLoading(false); });
    return () => { alive = false; };
  }, [language, selectedSign, today]);

  useEffect(() => {
    if (!hasChart || !premium || !chartData) { setPersonalLoading(false); return; }
    const cached = getCachedTodayAssistantHome(profile, chartId, undefined, chartData);
    if (cached) { setPersonal(cached); setPersonalLoading(false); return; }
    let alive = true;
    setPersonalLoading(true);
    void getTodayAssistantHome(profile, chartData, chartId)
      .then((result) => { if (alive) setPersonal(result); })
      .catch(() => { if (alive) setPersonal(null); })
      .finally(() => { if (alive) setPersonalLoading(false); });
    return () => { alive = false; };
  }, [chartData, chartId, hasChart, premium, profile]);

  const readyPersonal = personal?.status === 'ready' ? personal : null;
  const conversation = readyPersonal?.quickActions.find((item) => item.actionKey === 'serious_talk');
  const personalSummary = readyPersonal?.pulse.currentPoint.summary || FALLBACKS.dayCard;
  const risk = readyPersonal?.pulse.currentPoint.avoid[0] || FALLBACKS.micro;
  const openHoroscope = (layer: HoroscopeLayer = 'sign', options?: HoroscopeOpenOptions) => onOpenHoroscopeLayer(layer, options);
  const openPersonalDaily = (section: PersonalDailySection = 'overview') => onOpenPersonalDaily(section);

  return <div ref={scrollRef} className="h-full overflow-y-auto bg-[#faf9f7] px-4 pb-[var(--lumia-bottom-tab-clearance)] pt-5 font-sans">
    <div className="mx-auto max-w-[25rem] space-y-3">
      <header className="pb-2"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8c6bb1]">{formatLumiaDate(today, language)}</p><h1 className="mt-2 text-[34px] font-semibold leading-none text-[#202024]">Что сегодня важно</h1><p className="mt-3 text-[15px] leading-relaxed text-[#68646e]">{FALLBACKS.background}</p></header>

      <Card title="Мягкий совет дня" text={FALLBACKS.dayCard} label={`${dayCardPolicy.words.min}–${dayCardPolicy.words.max} слов`} />
      <div className="grid grid-cols-2 gap-3"><Card title="Луна сегодня · ретроград" text={`${FALLBACKS.moon} ${FALLBACKS.retrograde}`} /><Card title="Не делай это на эмоциях" text={risk} label={`${microPolicy.words.min}–${microPolicy.words.max} слов`} /></div>

      {selectedSign ? <Card title={`Гороскоп: ${getZodiacSign(language, selectedSign)}`} text={signReading?.reading || signReading?.summary || FALLBACKS.background} loading={signLoading} label={`${signPolicy.words.min}–${signPolicy.words.max} слов`} onClick={() => openHoroscope('sign', { mode: 'single', source: 'home_card_today' })} /> : <Card title="Выбрать знак" text="Открой общий гороскоп без натальной карты и выбери любой знак." onClick={() => openHoroscope('sign')} />}

      {!hasChart ? <Card title="Создать натальную карту" text="Создай натальную карту, чтобы Lumia говорила точнее и открыла личный день." onClick={onCreateNatalChart} /> : null}

      {hasChart && premium ? <>
        <Card title="Сегодня для тебя" text={personalSummary} loading={personalLoading} label={`${personalPolicy.words.min}–${personalPolicy.words.max} слов`} onClick={() => openPersonalDaily('overview')} />
        <div className="grid grid-cols-2 gap-3">
          <Card title="Что может задеть" text={risk} onClick={() => openPersonalDaily('overview')} />
          <Card title="Лучшее время для разговора" text={conversation ? `${conversation.bestWindow.label}. ${conversation.summary}` : 'Выбери спокойное окно, когда не нужно отвечать на бегу.'} loading={personalLoading} label={`${timingPolicy.words.min}–${timingPolicy.words.max} слов`} onClick={() => openPersonalDaily('overview')} />
          <Card title="Деньги и решения" text="Проверь условия до покупки или обещания. Не соглашайся только из-за срочности." onClick={() => openPersonalDaily('money')} />
          <Card title="Что с тобой сегодня" text={readyPersonal?.pulse.currentPoint.title || 'Короткий личный фон дня по твоей карте.'} loading={personalLoading} onClick={() => openPersonalDaily('overview')} />
        </div>
      </> : hasChart ? <div className="grid grid-cols-2 gap-3"><Card title="Сегодня для тебя" text="Личный фокус дня откроется в Premium." locked onClick={() => openPersonalDaily('overview')} /><Card title="Деньги и решения" text="Где не действовать на эмоциях — по твоей карте." locked onClick={() => openPersonalDaily('money')} /></div> : null}

    </div>
  </div>;
});
Dashboard.displayName = 'Dashboard';
