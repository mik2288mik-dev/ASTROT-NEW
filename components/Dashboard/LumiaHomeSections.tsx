import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock3,
  MessageCircle,
  Lock,
  Moon,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  Users,
  Briefcase,
  X,
} from 'lucide-react';
import type {
  ActionTimingKey,
  ActionTimingRecommendation,
  DailyCheckInInput,
  TodayAssistantHomeResult,
  TodayPulse,
  TodayPulsePhase,
  TodayPulsePoint,
  TodayPulseResult,
} from '../../types';
import { buildTodayCheckInReference, type TodayCheckInReference } from '../../lib/todayCheckInReference';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { lumiaDebugLog } from '../../lib/lumiaDebug';
import {
  LumiaHomeLargeCard,
  LumiaHomePrimaryButton,
} from './LumiaHomePrimitives';
import {
  getLumiaHomeCopy,
  LUMIA_HOME_PREVIEW_ITEMS,
  type LumiaHomeLanguage,
} from './lumiaHomeContent';

export function LumiaHomeHeroCard({
  language,
  onOpen,
}: {
  language: LumiaHomeLanguage;
  onOpen: () => void;
}) {
  const copy = getLumiaHomeCopy(language);
  const titleLines = copy.heroTitle.split('\n');

  return (
    <LumiaHomeLargeCard className="lumia-home-hero-card min-h-[20.75rem] bg-white shadow-[0_16px_36px_rgba(17,19,23,0.08)]">
      <img
        src="/lumia-home/daily-hero-editorial-v1.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(244,247,250,0.88)_42%,rgba(21,94,239,0.14)_72%,rgba(21,94,239,0.04)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/80 via-[#155EEF]/10 to-transparent" />
      <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-white/52 blur-3xl" />

      <div className="relative z-10 flex min-h-[20.75rem] max-w-[92%] flex-col justify-between px-4 py-[1.125rem] sm:px-5">
        <div>
          <p className="mb-0 font-lumiaHome text-[0.72rem] font-extrabold uppercase tracking-[0.07em] text-lumiaHome-purpleDeep/82">
            {copy.heroDate}
          </p>
          <h1 className="lumia-home-display mb-0 mt-4 max-w-[21.5rem] text-[clamp(1.58rem,6.75vw,2.45rem)] uppercase leading-[0.98]">
            {titleLines.map((line) => (
              <span key={line} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
          </h1>
          <p className="lumia-home-body mb-0 mt-3.5 max-w-[17rem] whitespace-pre-line text-[0.86rem] font-semibold leading-[1.45] text-lumiaHome-purpleDeep">
            {copy.heroSummary}
          </p>
        </div>

        <LumiaHomePrimaryButton onClick={onOpen} className="mt-5 w-fit px-4 py-2.5 shadow-[0_12px_30px_rgba(90,47,88,0.22)]">
          {copy.heroCta}
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-lumiaHome-purple">
            <ArrowRight size={18} strokeWidth={2.4} />
          </span>
        </LumiaHomePrimaryButton>
      </div>
    </LumiaHomeLargeCard>
  );
}

function pointToWalletXY(point: TodayPulsePoint) {
  const progress = Math.max(0, Math.min(1, point.hour / 23));
  const scoreProgress = Math.max(0, Math.min(1, (point.score - 35) / 65));
  return {
    x: 22 + progress * 316,
    y: 98 - scoreProgress * 62,
  };
}

function buildWalletPulsePath(points: TodayPulsePoint[]) {
  if (!points.length) return '';
  const coords = points.map(pointToWalletXY);
  return coords.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const prev = coords[index - 1];
    const midX = (prev.x + point.x) / 2;
    return `${path} C ${midX.toFixed(1)} ${prev.y.toFixed(1)}, ${midX.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, '');
}

function buildWalletAreaPath(points: TodayPulsePoint[]) {
  const linePath = buildWalletPulsePath(points);
  if (!linePath || !points.length) return '';
  const coords = points.map(pointToWalletXY);
  const first = coords[0];
  const last = coords[coords.length - 1];
  return `${linePath} L ${last.x.toFixed(1)} 112 L ${first.x.toFixed(1)} 112 Z`;
}

function formatPulseDate(dateKey: string, language: LumiaHomeLanguage) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0));
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function timeToHour(time: string) {
  const hour = Number.parseInt(time.slice(0, 2), 10);
  return Number.isFinite(hour) ? hour : 0;
}

function formatWindowRange(point: TodayPulsePoint, pulse: TodayPulse) {
  const pointHour = point.hour;
  const window = pulse.windows.find((item) => {
    const start = timeToHour(item.start);
    const end = item.end === '00:00' ? 24 : timeToHour(item.end);
    return pointHour >= start && pointHour < end;
  });
  return window ? `${window.start}-${window.end}` : point.time;
}

function phaseStartPoint(pulse: TodayPulse, phase: TodayPulsePhase) {
  return pulse.points.find((point) => point.phase === phase) || null;
}

type TimelineMoment = {
  id: string;
  point: TodayPulsePoint;
  label: string;
  shortLabel: string;
  color: string;
};

function pickUniquePulsePoint(
  pulse: TodayPulse,
  preferred: TodayPulsePoint | null | undefined,
  targetHour: number,
  usedHours: Set<number>,
) {
  const candidates = [preferred, ...pulse.points]
    .filter((point): point is TodayPulsePoint => !!point)
    .filter((point) => !usedHours.has(point.hour));

  candidates.sort((a, b) => {
    const distance = Math.abs(a.hour - targetHour) - Math.abs(b.hour - targetHour);
    return distance || b.score - a.score;
  });

  return candidates[0] || preferred || pulse.points[targetHour] || pulse.points[0];
}

function buildTimelineMoments(pulse: TodayPulse, language: LumiaHomeLanguage) {
  const definitions = [
    {
      id: 'morning',
      preferred: phaseStartPoint(pulse, 'entry') || pulse.points[6],
      targetHour: 6,
      label: language === 'ru' ? 'утро' : 'morning',
      shortLabel: language === 'ru' ? 'утро' : 'am',
      color: '#155EEF',
    },
    {
      id: 'peak',
      preferred: pulse.peakPoint,
      targetHour: pulse.peakPoint.hour,
      label: language === 'ru' ? 'пик' : 'peak',
      shortLabel: language === 'ru' ? 'пик' : 'peak',
      color: '#00A66A',
    },
    {
      id: 'contact',
      preferred: phaseStartPoint(pulse, 'relationships') || phaseStartPoint(pulse, 'decisions') || pulse.points[17],
      targetHour: 17,
      label: language === 'ru' ? 'контакт' : 'contact',
      shortLabel: language === 'ru' ? 'связь' : 'talk',
      color: '#0B7DFF',
    },
    {
      id: 'slow',
      preferred: phaseStartPoint(pulse, 'reflection') || pulse.points[21],
      targetHour: 21,
      label: language === 'ru' ? 'спад' : 'slow',
      shortLabel: language === 'ru' ? 'спад' : 'slow',
      color: '#606772',
    },
    {
      id: 'restore',
      preferred: phaseStartPoint(pulse, 'restore') || pulse.points[23] || pulse.points[0],
      targetHour: 23,
      label: language === 'ru' ? 'восстановление' : 'restore',
      shortLabel: language === 'ru' ? 'восст.' : 'rest',
      color: '#155EEF',
    },
  ];

  const seen = new Set<number>();
  return definitions
    .map((item): TimelineMoment | null => {
      const point = pickUniquePulsePoint(pulse, item.preferred, item.targetHour, seen);
      if (!point) return null;
      seen.add(point.hour);
      return {
        id: item.id,
        point,
        label: item.label,
        shortLabel: item.shortLabel,
        color: item.color,
      };
    })
    .filter((item): item is TimelineMoment => !!item);
}

function buildNextCues(pulse: TodayPulse, point: TodayPulsePoint, language: LumiaHomeLanguage) {
  const currentHour = point.hour;
  const relationships = phaseStartPoint(pulse, 'relationships');
  const reflection = phaseStartPoint(pulse, 'reflection');
  const restore = phaseStartPoint(pulse, 'restore') || pulse.points[0];
  const cues: Array<{ time: string; text: string; icon: 'contact' | 'restore' }> = [];

  if (relationships && currentHour < relationships.hour) {
    cues.push({
      time: relationships.time,
      text: language === 'ru' ? 'мягче для общения' : 'softer for connection',
      icon: 'contact',
    });
  }

  if (reflection && currentHour < reflection.hour) {
    cues.push({
      time: reflection.time,
      text: language === 'ru' ? 'восстановление' : 'recovery',
      icon: 'restore',
    });
  }

  if (cues.length < 2 && restore) {
    cues.push({
      time: restore.time,
      text: language === 'ru' ? 'восстановление' : 'recovery',
      icon: 'restore',
    });
  }

  return cues.slice(0, 2);
}

function normalizeSummary(summary: string) {
  return summary.replace(/\s*Сильнее всего сейчас:.+$/u, '').replace(/\s*Strongest right now:.+$/u, '').trim();
}

function PulseChart({
  language,
  pulse,
  selectedPoint,
  onSelectPoint,
}: {
  language: LumiaHomeLanguage;
  pulse: TodayPulse;
  selectedPoint: TodayPulsePoint;
  onSelectPoint: (point: TodayPulsePoint) => void;
}) {
  const safeId = useId().replace(/:/g, '');
  const lineId = `pulseWalletLine-${safeId}`;
  const areaId = `pulseWalletArea-${safeId}`;
  const glowId = `pulseWalletGlow-${safeId}`;
  const chartRef = useRef<HTMLDivElement | null>(null);
  const linePath = useMemo(() => buildWalletPulsePath(pulse.points), [pulse.points]);
  const areaPath = useMemo(() => buildWalletAreaPath(pulse.points), [pulse.points]);
  const moments = useMemo(() => buildTimelineMoments(pulse, language), [language, pulse]);
  const selectedXY = pointToWalletXY(selectedPoint);
  const selectedIsMoment = moments.some((moment) => moment.point.hour === selectedPoint.hour);
  const selectedProgress = Math.max(0, Math.min(1, selectedPoint.hour / 23));
  const selectedPillTransform =
    selectedProgress < 0.14 ? 'translateX(0)' : selectedProgress > 0.86 ? 'translateX(-100%)' : 'translateX(-50%)';
  const selectedPillLabel = selectedPoint.time;
  const handleKeySelect = (event: React.KeyboardEvent<SVGGElement>, point: TodayPulsePoint) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectPoint(point);
    }
  };
  const handleChartPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const targetHour = Math.round(ratio * 23);
    const point =
      pulse.points.find((item) => item.hour === targetHour) ||
      pulse.points.reduce((closest, item) =>
        Math.abs(item.hour - targetHour) < Math.abs(closest.hour - targetHour) ? item : closest,
      );
    onSelectPoint(point);
  };

  return (
    <div className="lumia-home-pulse-chart relative mt-3.5 h-[10.4rem] overflow-hidden rounded-[1.18rem] bg-white shadow-[inset_0_0_0_1px_rgba(17,19,23,0.08),0_12px_26px_rgba(17,19,23,0.04)]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,247,250,0.82),rgba(255,255,255,0.18)),radial-gradient(circle_at_82%_8%,rgba(0,166,106,0.10),transparent_30%),radial-gradient(circle_at_12%_80%,rgba(21,94,239,0.08),transparent_34%)]" />
      <div ref={chartRef} className="absolute inset-x-2 top-2 h-[7.05rem] cursor-pointer touch-pan-y" onPointerDown={handleChartPointer}>
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-full bg-white px-2 py-0.5 font-lumiaHome text-[0.58rem] font-extrabold leading-none text-[#111317] shadow-[0_8px_18px_rgba(17,19,23,0.08)]"
          style={{ left: `${selectedProgress * 100}%`, transform: selectedPillTransform }}
        >
          {selectedPillLabel}
        </div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 132" preserveAspectRatio="none" aria-label="Пульс дня">
          <defs>
            <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#00a7ff" />
              <stop offset="36%" stopColor="#155EEF" />
              <stop offset="66%" stopColor="#00A66A" />
              <stop offset="100%" stopColor="#155EEF" />
            </linearGradient>
            <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#155EEF" stopOpacity="0.16" />
              <stop offset="52%" stopColor="#00A66A" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-80%" width="140%" height="240%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {[0, 6, 12, 18, 24].map((hour) => {
            const x = 22 + (Math.min(hour, 23) / 23) * 316;
            return <line key={hour} x1={x} x2={x} y1="26" y2="112" stroke="rgba(17,19,23,0.065)" strokeWidth="1" />;
          })}
          {[36, 60, 84, 108].map((y) => (
            <line key={y} x1="22" x2="338" y1={y} y2={y} stroke="rgba(17,19,23,0.055)" strokeWidth="1" />
          ))}
          <path d={areaPath} fill={`url(#${areaId})`} />
          <path d={linePath} fill="none" stroke="rgba(17,19,23,0.055)" strokeWidth="9" strokeLinecap="round" />
          <path d={linePath} fill="none" stroke={`url(#${lineId})`} strokeWidth="4.8" strokeLinecap="round" filter={`url(#${glowId})`} />
          <line x1={selectedXY.x} x2={selectedXY.x} y1="20" y2="116" stroke="rgba(21,94,239,0.42)" strokeWidth="1.4" />
          {moments.map((moment) => {
            const { x, y } = pointToWalletXY(moment.point);
            const isSelected = moment.point.hour === selectedPoint.hour;
            const isCurrent = moment.point.hour === pulse.currentPoint.hour;
            return (
              <g
                key={moment.id}
                role="button"
                tabIndex={0}
                aria-label={`${moment.label} ${moment.point.time}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onSelectPoint(moment.point)}
                onKeyDown={(event) => handleKeySelect(event, moment.point)}
                className="cursor-pointer outline-none"
              >
                <circle cx={x} cy={y} r="17" fill="transparent" />
                <circle cx={x} cy={y} r={isSelected ? 12 : 7.6} fill={isSelected ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.30)'} />
                <circle cx={x} cy={y} r={isSelected ? 7.2 : 4.8} fill="#ffffff" stroke={moment.color} strokeWidth={isSelected ? 3.6 : 2.1} />
                <circle cx={x} cy={y} r={isSelected ? 2.8 : 2} fill={moment.color} />
                {isCurrent && !isSelected ? (
                  <circle cx={x} cy={y} r="10.2" fill="none" stroke="rgba(21,94,239,0.28)" strokeWidth="2" strokeDasharray="3 3" />
                ) : null}
              </g>
            );
          })}
          {!selectedIsMoment ? (
            <g>
              <circle cx={selectedXY.x} cy={selectedXY.y} r="12" fill="rgba(255,255,255,0.62)" />
              <circle cx={selectedXY.x} cy={selectedXY.y} r="7.2" fill="#ffffff" stroke="#155EEF" strokeWidth="3.6" />
              <circle cx={selectedXY.x} cy={selectedXY.y} r="2.8" fill="#155EEF" />
            </g>
          ) : null}
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-5 bottom-[2.14rem] flex items-center justify-between font-lumiaHome text-[0.56rem] font-extrabold text-[#606772]/62">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <div className="absolute inset-x-2 bottom-1.5 grid grid-cols-5 gap-1">
        {moments.map((moment) => {
          const isSelected = moment.point.hour === selectedPoint.hour;
          return (
            <button
              key={moment.id}
              type="button"
              onClick={() => onSelectPoint(moment.point)}
              className={[
                'min-w-0 px-1 py-1 text-center font-lumiaHome leading-none transition',
                isSelected ? 'text-[#30132d]' : 'text-[#6f6870]/72',
              ].join(' ')}
            >
              <span className="block truncate text-[0.58rem] font-extrabold">{moment.shortLabel}</span>
              <span className="mt-0.5 block text-[0.52rem] font-bold opacity-75">{moment.point.time.slice(0, 2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PulseLoadingState({ language }: { language: LumiaHomeLanguage }) {
  return (
    <div className="relative z-10">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="lumia-pulse-kicker mb-0">
          {language === 'ru' ? 'ПУЛЬС ДНЯ' : 'Day pulse'}
        </h2>
        <div className="h-8 w-[6.5rem] animate-pulse rounded-full bg-[#F4F7FA]" />
      </div>
      <div className="mt-3 h-[4.8rem] max-w-[17rem] animate-pulse rounded-[1rem] bg-white/62" />
      <div className="mt-3 h-[6.15rem] animate-pulse rounded-[1.05rem] bg-white/45" />
      <div className="mt-3 grid gap-2">
        <div className="h-[3.35rem] animate-pulse rounded-[1rem] bg-white/58" />
        <div className="h-[3.35rem] animate-pulse rounded-[1rem] bg-white/42" />
      </div>
    </div>
  );
}

function PulseSetupState({ language, onSetup }: { language: LumiaHomeLanguage; onSetup?: () => void }) {
  return (
    <div className="relative z-10">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="lumia-pulse-kicker mb-0">
          {language === 'ru' ? 'Пульс дня' : 'Day pulse'}
        </h2>
        <Sparkles size={17} className="text-[#155EEF]" strokeWidth={2.1} aria-hidden />
      </div>
      <div className="mt-3 rounded-[1.05rem] bg-white/62 p-3 ring-1 ring-[#30132d]/[0.07]">
        <p className="mb-0 font-lumiaHomeDisplay text-[1.05rem] font-extrabold leading-tight text-[#30132d]">
          {language === 'ru' ? 'Нужны дата и место рождения' : 'Birth data needed'}
        </p>
        <p className="mb-0 mt-2 font-lumiaHome text-[0.76rem] font-semibold leading-snug text-[#4c4650]">
          {language === 'ru'
            ? 'Тогда Lumia честно рассчитает твой ритм по наталу, транзитам и локальному времени.'
            : 'Then Lumia can calculate your rhythm from natal data, transits, and local time.'}
        </p>
        {onSetup ? (
          <button
            type="button"
            onClick={onSetup}
            className="mt-3 inline-flex min-h-[2.45rem] items-center justify-center rounded-full bg-[#30132d] px-4 font-lumiaHome text-[0.78rem] font-extrabold text-white"
          >
            {language === 'ru' ? 'Заполнить профиль' : 'Complete profile'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function LumiaHomePulseCard({
  language,
  pulseResult,
  isLoading = false,
  onSetup,
}: {
  language: LumiaHomeLanguage;
  pulseResult?: TodayPulseResult | null;
  isLoading?: boolean;
  onSetup?: () => void;
}) {
  const copy = getLumiaHomeCopy(language);
  const pulse = pulseResult?.status === 'ready' ? pulseResult.pulse : null;
  const currentPoint = pulse?.currentPoint || null;
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  useEffect(() => {
    if (pulse) {
      setSelectedHour(pulse.currentPoint.hour);
      lumiaDebugLog('pulse_ready', {
        timezone: pulse.timezone,
        source: pulse.source,
        currentTime: pulse.currentTime,
        peak: { time: pulse.peakPoint.time, score: pulse.peakPoint.score },
      });
    }
  }, [pulse]);

  const selectedPoint = useMemo(() => {
    if (!pulse || !currentPoint) return null;
    const targetHour = selectedHour ?? currentPoint.hour;
    return pulse.points.find((point) => point.hour === targetHour) || currentPoint;
  }, [currentPoint, pulse, selectedHour]);

  const handleSelectPoint = (point: TodayPulsePoint) => {
    setSelectedHour(point.hour);
    lumiaSelectionHaptic(70);
    lumiaDebugLog('pulse_select', {
      time: point.time,
      phase: point.phase,
      score: point.score,
      tone: point.tone,
    });
  };

  const nextCues = pulse && selectedPoint ? buildNextCues(pulse, selectedPoint, language) : [];
  const currentRange = pulse && selectedPoint ? formatWindowRange(selectedPoint, pulse) : '';
  const currentSummary = selectedPoint ? normalizeSummary(selectedPoint.summary) : '';
  const bestNow = selectedPoint?.bestFor.slice(0, 3).join(' · ') || '';
  const avoidNow = selectedPoint?.avoid.slice(0, 3).join(' · ') || '';

  return (
    <LumiaHomeLargeCard className="lumia-home-pulse-card rounded-[1.55rem] border border-[#30132d]/[0.055] bg-white px-4 py-4 text-[#30132d] shadow-[0_14px_34px_rgba(31,22,54,0.055)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(21,94,239,0.08),transparent_32%),radial-gradient(circle_at_94%_32%,rgba(0,166,106,0.07),transparent_32%)]" />
      {isLoading ? (
        <PulseLoadingState language={language} />
      ) : pulseResult?.status === 'needs_setup' ? (
        <PulseSetupState language={language} onSetup={onSetup} />
      ) : pulse && currentPoint && selectedPoint ? (
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <h2 className="lumia-pulse-kicker mb-0">
                {copy.pulseTitle}
              </h2>
              <p className="mb-0 mt-1 font-lumiaHome text-[0.77rem] font-bold leading-none text-[#6f6870]">
                {formatPulseDate(pulse.date, language)}
              </p>
            </div>
            <div className="flex shrink-0 items-center rounded-full bg-white px-2.5 py-1.5 text-[#4f4851] shadow-[inset_0_0_0_1px_rgba(48,19,45,0.08),0_8px_18px_rgba(48,19,45,0.04)]">
              <Clock3 size={15} strokeWidth={2.2} aria-hidden />
              <button
                type="button"
                onClick={() => {
                  handleSelectPoint(currentPoint);
                }}
                className="ml-1 font-lumiaHome text-[0.73rem] font-extrabold leading-none"
              >
                {language === 'ru' ? 'Сейчас' : 'Now'} {pulse.currentTime}
              </button>
            </div>
          </div>

          <div className="mt-3.5 px-0.5">
            <h3 className="mb-0 font-lumiaHomeDisplay text-[clamp(1.56rem,7.1vw,2.18rem)] font-extrabold leading-[0.96] tracking-normal text-[#30132d]">
              {selectedPoint.title}
            </h3>
            <p className="mb-0 mt-1.5 font-lumiaHomeDisplay text-[1rem] font-extrabold leading-none text-[#155EEF]">
              {currentRange}
            </p>
            <p className="mb-0 mt-2 max-w-[20.5rem] font-lumiaHome text-[0.82rem] font-semibold leading-[1.34] text-[#2f2b31]">
              {currentSummary}
            </p>
          </div>

          <PulseChart language={language} pulse={pulse} selectedPoint={selectedPoint} onSelectPoint={handleSelectPoint} />

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-[1.05rem] bg-white px-2.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(0,166,106,0.16)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F7FA] text-[#00A66A]">
                <Check size={16} strokeWidth={2.7} />
              </span>
              <div className="min-w-0">
                <p className="mb-0 font-lumiaHome text-[0.8rem] font-extrabold leading-tight text-[#2f2b31]">
                  {language === 'ru' ? 'Лучше сейчас' : 'Best now'}
                </p>
                <p className="mb-0 mt-0.5 font-lumiaHome text-[0.74rem] font-semibold leading-snug text-[#6f6870]">
                  {bestNow}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-[1.05rem] bg-white px-2.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(225,25,55,0.16)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F7FA] text-[#E11937]">
                <X size={16} strokeWidth={2.7} />
              </span>
              <div className="min-w-0">
                <p className="mb-0 font-lumiaHome text-[0.8rem] font-extrabold leading-tight text-[#2f2b31]">
                  {language === 'ru' ? 'Не стоит' : 'Avoid'}
                </p>
                <p className="mb-0 mt-0.5 font-lumiaHome text-[0.74rem] font-semibold leading-snug text-[#6f6870]">
                  {avoidNow}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2.5 divide-y divide-[#30132d]/[0.065] px-0.5">
            {nextCues.map((cue) => (
              <div key={`${cue.time}-${cue.text}`} className="flex items-center gap-2.5 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F4F7FA] text-[#155EEF]">
                  {cue.icon === 'restore' ? <Moon size={14} strokeWidth={2.5} /> : <Sparkles size={13} strokeWidth={2.5} />}
                </span>
                <p className="mb-0 font-lumiaHome text-[0.77rem] font-semibold leading-snug text-[#4f4851]">
                  {language === 'ru' ? 'После' : 'After'} <span className="font-extrabold text-[#30132d]">{cue.time}</span> — {cue.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <PulseLoadingState language={language} />
      )}
    </LumiaHomeLargeCard>
  );
}

const ACTION_META: Record<ActionTimingKey, {
  ru: string;
  en: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = {
  message: { ru: 'Написать', en: 'Message', icon: MessageCircle },
  money: { ru: 'Деньги', en: 'Money', icon: PiggyBank },
  purchase: { ru: 'Купить', en: 'Buy', icon: ShoppingBag },
  serious_talk: { ru: 'Поговорить', en: 'Talk', icon: Users },
  work: { ru: 'Работа', en: 'Work', icon: Briefcase },
  rest: { ru: 'Отдых', en: 'Rest', icon: Moon },
};

const ACTION_ORDER: ActionTimingKey[] = ['message', 'serious_talk', 'purchase', 'money', 'work', 'rest'];

const CHECKIN_OPTIONS = {
  focus: [
    { value: 'low', ru: 'низкий', en: 'low' },
    { value: 'normal', ru: 'норм', en: 'ok' },
    { value: 'high', ru: 'высокий', en: 'high' },
  ],
  mood: [
    { value: 'heavy', ru: 'тяжело', en: 'heavy' },
    { value: 'steady', ru: 'ровно', en: 'steady' },
    { value: 'good', ru: 'хорошо', en: 'good' },
  ],
  people: [
    { value: 'social', ru: 'общение', en: 'contact' },
    { value: 'quiet', ru: 'тишина', en: 'quiet' },
  ],
  forecastFit: [
    { value: 'yes', ru: 'да', en: 'yes' },
    { value: 'partial', ru: 'частично', en: 'partly' },
    { value: 'no', ru: 'нет', en: 'no' },
  ],
} as const;

function TodayAssistantSkeleton({ language }: { language: LumiaHomeLanguage }) {
  return (
    <LumiaHomeLargeCard className="border border-[#30132d]/[0.06] bg-white/70 px-4 py-4">
      <div className="h-4 w-36 animate-pulse rounded-full bg-black/10" />
      <div className="mt-4 h-14 animate-pulse rounded-[1rem] bg-black/8" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="h-11 animate-pulse rounded-full bg-black/8" />
        <div className="h-11 animate-pulse rounded-full bg-black/8" />
        <div className="h-11 animate-pulse rounded-full bg-black/8" />
      </div>
      <p className="sr-only">{language === 'ru' ? 'Загрузка Сегодня' : 'Loading Today'}</p>
    </LumiaHomeLargeCard>
  );
}

function segmentedClass(active: boolean) {
  return [
    'min-h-[2.55rem] min-w-0 flex-1 whitespace-nowrap rounded-full px-3 py-2 text-[0.82rem] font-extrabold transition-colors',
    active ? 'bg-[#202020] text-white' : 'bg-white/58 text-[#4f4851]',
  ].join(' ');
}

const CHECKIN_FIELD_ORDER: Array<keyof DailyCheckInInput> = ['focus', 'mood', 'people', 'forecastFit'];

const CHECKIN_COPY = {
  ru: {
    focus: 'Фокус по факту',
    mood: 'Настроение по факту',
    people: 'Люди по факту',
    forecastFit: 'Совпал ориентир выше?',
    submit: 'Записать день',
    saving: 'Сохраняю...',
    edit: 'Изменить отметку',
    saved: 'Сегодня уже сохранено',
    savedTitle: 'Твоя отметка',
  },
  en: {
    focus: 'Actual focus',
    mood: 'Actual mood',
    people: 'Actual people mode',
    forecastFit: 'Did the cue above fit?',
    submit: 'Save day',
    saving: 'Saving...',
    edit: 'Edit check-in',
    saved: 'Saved for today',
    savedTitle: 'Your check-in',
  },
} as const;

function checkInOptionLabel(language: LumiaHomeLanguage, key: keyof DailyCheckInInput, value: string) {
  const option = CHECKIN_OPTIONS[key].find((item) => item.value === value);
  if (!option) return value;
  return language === 'ru' ? option.ru : option.en;
}

function TodayCheckInReferenceCard({
  language,
  reference,
}: {
  language: LumiaHomeLanguage;
  reference: TodayCheckInReference;
}) {
  return (
    <div className="mt-3 rounded-[1.35rem] bg-white/64 px-3.5 py-3.5 shadow-[inset_0_0_0_1px_rgba(48,19,45,0.07)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mb-0 font-lumiaHome text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-[#155EEF]">
            {language === 'ru' ? 'Сегодня сверяем вот это' : 'Compare against this'}
          </p>
          <h4 className="mb-0 mt-1 font-lumiaHomeDisplay text-[clamp(1.18rem,5.1vw,1.5rem)] font-extrabold leading-[1.03] tracking-normal text-[#30132d]">
            {reference.forecastTitle}
          </h4>
        </div>
        {reference.bestSlotRange ? (
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1.5 font-lumiaHome text-[0.72rem] font-extrabold leading-none text-[#155EEF] shadow-[inset_0_0_0_1px_rgba(21,94,239,0.18)]">
            {reference.bestSlotRange}
          </span>
        ) : null}
      </div>

      <p
        className="mb-0 mt-2 font-lumiaHome text-[0.84rem] font-semibold leading-snug text-[#3f3942]"
        style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {reference.forecastSummary}
      </p>

      {reference.bestSlotLabel ? (
        <p className="mb-0 mt-2 font-lumiaHome text-[0.74rem] font-bold leading-snug text-[#817982]">
          {language === 'ru' ? 'Главный ориентир' : 'Main cue'}: <span className="text-[#30132d]">{reference.bestSlotLabel}</span>
        </p>
      ) : null}

      {reference.bestFor.length > 0 ? (
        <div className="mt-2">
          <p className="mb-1 font-lumiaHome text-[0.68rem] font-extrabold uppercase tracking-[0.06em] text-[#2f7c4c]">
            {language === 'ru' ? 'Подходило' : 'Worked for'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reference.bestFor.map((item) => (
              <span key={item} className="rounded-full bg-[#f3fff8]/78 px-2.5 py-1 font-lumiaHome text-[0.68rem] font-extrabold text-[#2f7c4c]">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {reference.avoid ? (
        <p className="mb-0 mt-2 font-lumiaHome text-[0.74rem] font-bold leading-snug text-[#8a6670]">
          {language === 'ru' ? 'Лучше не тащить' : 'Better not to force'}: {reference.avoid}
        </p>
      ) : null}
    </div>
  );
}

function CheckInExpectation({
  reference,
  field,
  language,
}: {
  reference: TodayCheckInReference;
  field: keyof DailyCheckInInput;
  language: LumiaHomeLanguage;
}) {
  const expected = reference.expected[field];
  return (
    <div className="mb-2 rounded-[1rem] bg-white/42 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(48,19,45,0.045)]">
      <p className="mb-0 font-lumiaHome text-[0.66rem] font-extrabold uppercase tracking-[0.06em] text-[#155EEF]">
        {language === 'ru' ? 'Ожидание LUMIA' : 'LUMIA expected'}: <span className="text-[#30132d]">{expected.label}</span>
      </p>
      <p className="mb-0 mt-1 font-lumiaHome text-[0.72rem] font-bold leading-snug text-[#817982]">
        {expected.hint}
      </p>
    </div>
  );
}

function DailyCheckInCard({
  language,
  reference,
  initial,
  isSubmitting,
  onSubmit,
}: {
  language: LumiaHomeLanguage;
  reference: TodayCheckInReference;
  initial?: DailyCheckInInput;
  isSubmitting: boolean;
  onSubmit: (input: DailyCheckInInput) => Promise<void>;
}) {
  const [form, setForm] = useState<DailyCheckInInput>(initial || reference.initialInput);

  const setField = <K extends keyof DailyCheckInInput>(key: K, value: DailyCheckInInput[K]) => {
    lumiaSelectionHaptic(55);
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const labels = CHECKIN_COPY[language];

  return (
    <div className="mt-3 space-y-3">
      {CHECKIN_FIELD_ORDER.map((key) => (
        <div key={key}>
          <p className="mb-1.5 font-lumiaHome text-[0.74rem] font-extrabold uppercase tracking-[0.07em] text-[#817982]">
            {labels[key]}
          </p>
          <CheckInExpectation language={language} reference={reference} field={key} />
          <div className="flex gap-1.5 rounded-[1.1rem] bg-white/38 p-1 shadow-[inset_0_0_0_1px_rgba(48,19,45,0.055)]">
            {CHECKIN_OPTIONS[key].map((option) => (
              <button
                key={option.value}
                type="button"
                className={segmentedClass(form[key] === option.value)}
                onClick={() => setField(key, option.value as never)}
              >
                {language === 'ru' ? option.ru : option.en}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void onSubmit(form)}
        className="min-h-[2.9rem] w-full rounded-full bg-[#202020] px-4 py-3 font-lumiaHome text-[0.85rem] font-extrabold text-white disabled:opacity-60"
      >
        {isSubmitting ? labels.saving : labels.submit}
      </button>
    </div>
  );
}

function CompletedCheckInCard({
  language,
  entry,
  onEdit,
}: {
  language: LumiaHomeLanguage;
  entry?: DailyCheckInInput;
  onEdit: () => void;
}) {
  if (!entry) return null;
  const labels = CHECKIN_COPY[language];
  const items: Array<{ key: keyof DailyCheckInInput; label: string; value: string }> = CHECKIN_FIELD_ORDER.map((key) => ({
    key,
    label: labels[key],
    value: checkInOptionLabel(language, key, entry[key]),
  }));

  return (
    <div className="mt-3 rounded-[1.25rem] bg-white/58 px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(48,19,45,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-0 font-lumiaHome text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-[#155EEF]">
            {labels.saved}
          </p>
          <h4 className="mb-0 mt-1 font-lumiaHomeDisplay text-[1.15rem] font-extrabold leading-tight text-[#30132d]">
            {labels.savedTitle}
          </h4>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3fff8] text-[#2f7c4c]">
          <Check size={16} strokeWidth={2.8} />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-[0.95rem] bg-white/54 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(48,19,45,0.045)]">
            <p className="mb-0 font-lumiaHome text-[0.62rem] font-extrabold uppercase tracking-[0.06em] text-[#8d8490]">
              {item.label}
            </p>
            <p className="mb-0 mt-1 font-lumiaHome text-[0.82rem] font-extrabold leading-tight text-[#30132d]">
              {item.value}
            </p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-3 min-h-[2.55rem] w-full rounded-full bg-white/72 px-4 py-2.5 font-lumiaHome text-[0.82rem] font-extrabold text-[#30132d] shadow-[inset_0_0_0_1px_rgba(48,19,45,0.08)]"
      >
        {labels.edit}
      </button>
    </div>
  );
}

function ActionTimingResultView({
  language,
  recommendation,
}: {
  language: LumiaHomeLanguage;
  recommendation: ActionTimingRecommendation;
}) {
  const stateLabel = recommendation.state === 'now'
    ? (language === 'ru' ? 'Лучше сейчас' : 'Best now')
    : recommendation.state === 'later'
      ? (language === 'ru' ? 'Лучше позже' : 'Better later')
      : (language === 'ru' ? 'Ровный день' : 'Even day');
  return (
    <div className="mt-3.5 border-t border-[#171217]/[0.07] pt-3.5">
      <div className="rounded-[1.14rem] bg-white px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(17,19,23,0.08),0_10px_24px_rgba(17,19,23,0.035)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-0 font-lumiaHome text-[0.72rem] font-extrabold uppercase tracking-[0.055em] leading-tight text-[#155EEF]">
              {stateLabel}
            </p>
            <h4 className="mb-0 mt-1 font-lumiaHomeDisplay text-[1rem] font-extrabold leading-tight text-[#111317]">
              {recommendation.title}
            </h4>
          </div>
          <span className="shrink-0 rounded-full bg-[#F4F7FA] px-2.5 py-1.5 font-lumiaHomeDisplay text-[1rem] font-extrabold leading-none text-[#111317] shadow-[inset_0_0_0_1px_rgba(17,19,23,0.08)]">
            {recommendation.bestWindow.start}-{recommendation.bestWindow.end}
          </span>
        </div>
        <p className="mb-0 mt-2 font-lumiaHome text-[0.78rem] font-semibold leading-snug text-[#4f5660]">
          {recommendation.summary}
        </p>
        <p className="mb-0 mt-1.5 font-lumiaHome text-[0.72rem] font-bold leading-snug text-[#606772]">
          {recommendation.caution}
        </p>
      </div>
    </div>
  );
}

function ActionTimingCard({
  language,
  quickActions,
  onSelectAction,
}: {
  language: LumiaHomeLanguage;
  quickActions: ActionTimingRecommendation[];
  onSelectAction: (key: ActionTimingKey) => Promise<ActionTimingRecommendation>;
}) {
  const [selected, setSelected] = useState<ActionTimingKey | null>(quickActions[0]?.actionKey || null);
  const [result, setResult] = useState<ActionTimingRecommendation | null>(quickActions[0] || null);
  const [loadingKey, setLoadingKey] = useState<ActionTimingKey | null>(null);

  const select = async (key: ActionTimingKey) => {
    setSelected(key);
    setResult(quickActions.find((item) => item.actionKey === key) || null);
    setLoadingKey(key);
    lumiaSelectionHaptic(55);
    try {
      const next = await onSelectAction(key);
      setResult(next);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="mt-3">
      <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1.5">
        {ACTION_ORDER.map((key) => {
          const meta = ACTION_META[key];
          const Icon = meta.icon;
          const active = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => void select(key)}
              className={[
                'inline-flex min-h-[2.72rem] shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-left transition-colors',
                active
                  ? 'bg-[#202020] text-white shadow-[0_12px_26px_rgba(20,20,20,0.18)]'
                  : 'bg-white text-[#30132d] shadow-[inset_0_0_0_1px_rgba(48,19,45,0.08),0_8px_18px_rgba(48,19,45,0.035)]',
              ].join(' ')}
            >
              <Icon size={17} strokeWidth={2.25} />
              <span className="block whitespace-nowrap font-lumiaHome text-[0.74rem] font-extrabold leading-none">
                {language === 'ru' ? meta.ru : meta.en}
              </span>
            </button>
          );
        })}
      </div>
      {loadingKey ? (
        <div className="mt-3 h-[6.1rem] animate-pulse rounded-[1.2rem] bg-white/44" />
      ) : result ? (
        <ActionTimingResultView language={language} recommendation={result} />
      ) : null}
    </div>
  );
}

export function TodayAssistantCard({
  language,
  assistantResult,
  isLoading,
  onSetup,
  onSubmitCheckIn,
  onSelectAction,
}: {
  language: LumiaHomeLanguage;
  assistantResult?: TodayAssistantHomeResult | null;
  isLoading: boolean;
  onSetup?: () => void;
  onSubmitCheckIn: (input: DailyCheckInInput) => Promise<void>;
  onSelectAction: (key: ActionTimingKey) => Promise<ActionTimingRecommendation>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingCheckIn, setIsEditingCheckIn] = useState(false);

  if (isLoading) return <TodayAssistantSkeleton language={language} />;
  if (!assistantResult) return null;
  if (assistantResult.status === 'needs_setup') {
    return <PulseSetupState language={language} onSetup={onSetup} />;
  }

  const isEvening = assistantResult.dayMode === 'evening';
  const completed = assistantResult.checkIn.status === 'completed';
  const hasSavedCheckIn = completed && !!assistantResult.checkIn.entry;
  const checkInReference = buildTodayCheckInReference(
    isEvening ? (assistantResult.checkInPulse || assistantResult.pulse) : null,
    language,
    {
      dateMode: assistantResult.checkInDateMode,
      dateOverride: assistantResult.checkInDate,
    }
  );
  const title = isEvening
    ? (hasSavedCheckIn && !isEditingCheckIn ? (language === 'ru' ? 'День сохранён' : 'Day saved') : (language === 'ru' ? 'Сверим день' : 'Compare the day'))
    : assistantResult.dayMode === 'morning'
      ? (language === 'ru' ? 'Сегодня коротко' : 'Today in short')
      : (language === 'ru' ? 'Когда лучше?' : 'When is better?');
  const subtitle = isEvening
    ? (hasSavedCheckIn
        ? (isEditingCheckIn
            ? (language === 'ru' ? 'Можно спокойно поправить вечернюю отметку. Запись за день обновится, а не продублируется.' : 'You can edit today’s check-in. It updates the day, not duplicates it.')
            : (language === 'ru' ? 'Сегодня уже есть отметка. Ниже видно, что ты сравнил с прогнозом.' : 'Today is already saved. Below is what you compared with the forecast.'))
        : (language === 'ru' ? 'Отвечаем на вопросы ниже именно по этому ориентиру дня.' : 'Answer the questions below against this exact day cue.'))
    : (language === 'ru'
        ? 'Выбери действие, а Lumia подскажет: сейчас, позже или без сильного преимущества.'
        : 'Choose an action, and Lumia will say: now, later, or no strong edge.');

  const submit = async (input: DailyCheckInInput) => {
    setIsSubmitting(true);
    lumiaSelectionHaptic(80);
    try {
      await onSubmitCheckIn(input);
      setIsEditingCheckIn(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LumiaHomeLargeCard className="lumia-home-assistant-card rounded-[1.55rem] border border-[#30132d]/[0.055] bg-white px-4 py-4 text-[#30132d] shadow-[0_14px_34px_rgba(31,22,54,0.055)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_0%,rgba(21,94,239,0.07),transparent_30%),radial-gradient(circle_at_100%_46%,rgba(0,166,106,0.06),transparent_34%)]" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2">
          {assistantResult.dayMode === 'evening' ? (
            <h2 className="lumia-pulse-kicker lumia-pulse-kicker--compact mb-0 max-w-[14.5rem]">
              {language === 'ru' ? 'ВЕЧЕРНЯЯ ТОЧНОСТЬ' : 'Evening accuracy'}
            </h2>
          ) : (
            <h2 className="lumia-pulse-kicker lumia-pulse-kicker--compact mb-0 max-w-[14.5rem]">
              {language === 'ru' ? 'ЛИЧНЫЙ ПОМОЩНИК' : 'Personal assistant'}
            </h2>
          )}
          {isEvening && checkInReference.dateLabel ? (
            <span className="mt-1 shrink-0 rounded-full bg-white/66 px-2.5 py-1.5 font-lumiaHome text-[0.72rem] font-extrabold leading-none text-[#817982] shadow-[inset_0_0_0_1px_rgba(48,19,45,0.06)]">
              {checkInReference.dateLabel}
            </span>
          ) : null}
        </div>
        <h3 className="mb-0 mt-1 font-lumiaHomeDisplay text-[clamp(1.55rem,7vw,2.12rem)] font-extrabold leading-[0.98] tracking-normal text-[#30132d]">
          {title}
        </h3>
        <p className="mb-0 mt-2 font-lumiaHome text-[0.8rem] font-semibold leading-snug text-[#5f5861]">
          {subtitle}
        </p>

        {isEvening ? (
          <>
            <TodayCheckInReferenceCard language={language} reference={checkInReference} />
            {hasSavedCheckIn && !isEditingCheckIn ? (
              <>
                <CompletedCheckInCard
                  language={language}
                  entry={assistantResult.checkIn.entry}
                  onEdit={() => {
                    lumiaSelectionHaptic(55);
                    setIsEditingCheckIn(true);
                  }}
                />
                <div className="mt-3 rounded-[1.2rem] bg-white/48 px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(48,19,45,0.05)]">
                  <p className="mb-0 font-lumiaHome text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-[#155EEF]">
                    {assistantResult.accuracySummary.title}
                  </p>
                  <p className="mb-0 mt-2 font-lumiaHome text-[0.82rem] font-semibold leading-snug text-[#5f5861]">
                    {assistantResult.accuracySummary.summary}
                  </p>
                </div>
              </>
            ) : (
              <DailyCheckInCard
                language={language}
                reference={checkInReference}
                initial={completed ? assistantResult.checkIn.entry : undefined}
                isSubmitting={isSubmitting}
                onSubmit={submit}
              />
            )}
          </>
        ) : (
          <ActionTimingCard
            language={language}
            quickActions={assistantResult.quickActions}
            onSelectAction={onSelectAction}
          />
        )}

        <div className="mt-3 border-t border-[#171217]/[0.07] pt-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-[#155EEF]">
              <Sparkles size={15} strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="mb-0 font-lumiaHome text-[0.78rem] font-extrabold leading-tight text-[#30132d]">
                {assistantResult.patternTeaser.title}
              </p>
              <p className="mb-0 mt-1 font-lumiaHome text-[0.72rem] font-semibold leading-snug text-[#6f6870]">
                {assistantResult.patternTeaser.summary}
              </p>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#30132d]/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#155EEF,#00A66A)]"
              style={{
                width: `${Math.max(8, Math.min(100, Math.round((assistantResult.patternTeaser.progress.current / assistantResult.patternTeaser.progress.target) * 100)))}%`,
              }}
            />
          </div>
        </div>
      </div>
    </LumiaHomeLargeCard>
  );
}

function FullReadingPreview({
  label,
  imageSrc,
  locked,
}: {
  label: string;
  imageSrc: string;
  locked: boolean;
}) {
  return (
    <span
      className="relative inline-flex h-8 w-8 shrink-0 overflow-visible rounded-full border border-white/28 bg-white/10 p-[2px] shadow-[0_7px_16px_rgba(0,0,0,0.16)]"
      aria-label={label}
      title={label}
    >
      <img src={imageSrc} alt="" draggable={false} className="h-full w-full rounded-full object-cover" />
      <span className="absolute inset-[2px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(22,7,47,0.18))]" />
      {locked ? (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-white text-lumiaHome-purpleDeep shadow-[0_6px_14px_rgba(0,0,0,0.16)]">
          <Lock size={9} strokeWidth={2.35} />
        </span>
      ) : null}
    </span>
  );
}

export function LumiaHomeForecastCard({
  language,
  onOpen,
}: {
  language: LumiaHomeLanguage;
  onOpen: () => void;
}) {
  const forecast = getLumiaHomeCopy(language).forecast;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="lumia-home-large-card min-h-[14.6rem] bg-white p-3.5 text-left shadow-[0_14px_34px_rgba(17,19,23,0.08)] active:scale-[0.99]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(21,94,239,0.14),transparent_48%),radial-gradient(circle_at_16%_96%,rgba(0,166,106,0.10),transparent_52%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/38 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <p className="mb-0 font-lumiaHome text-[0.64rem] font-extrabold uppercase tracking-[0.07em] text-lumiaHome-purple">
            {forecast.label}
          </p>
          <h3 className="mb-0 mt-5 whitespace-pre-line font-lumiaHomeDisplay text-[1.27rem] font-extrabold leading-[1.04] tracking-normal text-lumiaHome-purpleDeep">
            {forecast.title}
          </h3>
          <p className="mb-0 mt-3 whitespace-pre-line font-lumiaHome text-[0.82rem] font-semibold leading-[1.42] text-lumiaHome-purpleDeep/76">
            {forecast.body}
          </p>
        </div>

        <span className="mt-5 inline-flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-full border border-lumiaHome-purple/24 bg-white/70 px-3.5 font-lumiaHome text-[0.8rem] font-extrabold text-lumiaHome-purple shadow-[0_10px_22px_rgba(90,47,88,0.07)]">
          <span className="min-w-0 leading-tight">{forecast.cta}</span>
          <ArrowRight size={17} strokeWidth={2.35} />
        </span>
      </div>
    </button>
  );
}

export function LumiaHomePremiumTeaseCard({
  language,
  isUnlocked,
  onOpen,
}: {
  language: LumiaHomeLanguage;
  isUnlocked: boolean;
  onOpen: () => void;
}) {
  const full = getLumiaHomeCopy(language).full;
  const previewItems = LUMIA_HOME_PREVIEW_ITEMS[language];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="lumia-home-large-card min-h-[14.6rem] bg-[linear-gradient(145deg,#111317_0%,#155EEF_64%,#00A66A_132%)] p-3.5 text-left text-white shadow-[0_16px_38px_rgba(21,94,239,0.18)] active:scale-[0.99]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_9%,rgba(255,255,255,0.16),transparent_42%),radial-gradient(circle_at_8%_95%,rgba(0,166,106,0.24),transparent_42%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#171314]/70 to-transparent" />
      {!isUnlocked ? (
        <span className="absolute right-3.5 top-3.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/18">
          <Lock size={13} strokeWidth={2.2} />
        </span>
      ) : null}

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <p className="mb-0 pr-7 font-lumiaHome text-[0.64rem] font-extrabold uppercase tracking-[0.07em] text-white/72">
            {full.label}
          </p>
          <h3 className="mb-0 mt-5 whitespace-pre-line pr-1 font-lumiaHomeDisplay text-[1.16rem] font-extrabold leading-[1.08] tracking-normal text-white">
            {full.title}
          </h3>
        </div>

        <div className="mt-4">
          <div className="mb-3 flex items-center gap-1.5">
            {previewItems.map((item) => (
              <FullReadingPreview key={item.label} {...item} locked={!isUnlocked} />
            ))}
          </div>

          <span className="inline-flex min-h-[2.8rem] w-full items-center justify-between gap-2 rounded-full bg-white px-3.5 font-lumiaHome text-[0.76rem] font-extrabold text-lumiaHome-purple shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
            <span className="min-w-0 leading-tight">{full.cta}</span>
            <ArrowRight className="shrink-0" size={17} strokeWidth={2.35} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function LumiaHomeContentCards({
  language,
  isPremium,
  onOpenForecast,
  onOpenFull,
}: {
  language: LumiaHomeLanguage;
  isPremium: boolean;
  onOpenForecast: () => void;
  onOpenFull: () => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <LumiaHomeForecastCard language={language} onOpen={onOpenForecast} />
      <LumiaHomePremiumTeaseCard language={language} isUnlocked={isPremium} onOpen={onOpenFull} />
    </section>
  );
}
