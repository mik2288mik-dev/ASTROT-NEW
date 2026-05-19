import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock3,
  Lock,
  Moon,
  Sparkles,
  X,
} from 'lucide-react';
import type { TodayPulse, TodayPulsePhase, TodayPulsePoint, TodayPulseResult } from '../../types';
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
    <LumiaHomeLargeCard className="lumia-home-hero-card min-h-[20.75rem] bg-[#ffe45c] shadow-[0_18px_44px_rgba(239,35,60,0.16)]">
      <img
        src="/lumia-home/daily-hero-editorial-v1.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,247,211,0.98)_0%,rgba(255,228,92,0.84)_38%,rgba(255,122,0,0.26)_68%,rgba(255,122,0,0.06)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#ffd400]/78 via-[#ff7a00]/18 to-transparent" />
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
    x: 18 + progress * 324,
    y: 76 - scoreProgress * 42,
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
  return `${linePath} L ${last.x.toFixed(1)} 86 L ${first.x.toFixed(1)} 86 Z`;
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
      color: '#7c4dff',
    },
    {
      id: 'peak',
      preferred: pulse.peakPoint,
      targetHour: pulse.peakPoint.hour,
      label: language === 'ru' ? 'пик' : 'peak',
      shortLabel: language === 'ru' ? 'пик' : 'peak',
      color: '#ef3b62',
    },
    {
      id: 'contact',
      preferred: phaseStartPoint(pulse, 'relationships') || phaseStartPoint(pulse, 'decisions') || pulse.points[17],
      targetHour: 17,
      label: language === 'ru' ? 'контакт' : 'contact',
      shortLabel: language === 'ru' ? 'связь' : 'talk',
      color: '#ff8a00',
    },
    {
      id: 'slow',
      preferred: phaseStartPoint(pulse, 'reflection') || pulse.points[21],
      targetHour: 21,
      label: language === 'ru' ? 'спад' : 'slow',
      shortLabel: language === 'ru' ? 'спад' : 'slow',
      color: '#00a7ff',
    },
    {
      id: 'restore',
      preferred: phaseStartPoint(pulse, 'restore') || pulse.points[23] || pulse.points[0],
      targetHour: 23,
      label: language === 'ru' ? 'восстановление' : 'restore',
      shortLabel: language === 'ru' ? 'восст.' : 'rest',
      color: '#805ad5',
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
  const linePath = useMemo(() => buildWalletPulsePath(pulse.points), [pulse.points]);
  const areaPath = useMemo(() => buildWalletAreaPath(pulse.points), [pulse.points]);
  const moments = useMemo(() => buildTimelineMoments(pulse, language), [language, pulse]);
  const selectedXY = pointToWalletXY(selectedPoint);
  const selectedIsMoment = moments.some((moment) => moment.point.hour === selectedPoint.hour);
  const handleKeySelect = (event: React.KeyboardEvent<SVGGElement>, point: TodayPulsePoint) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectPoint(point);
    }
  };

  return (
    <div className="lumia-home-pulse-chart relative mt-3 h-[6.2rem] overflow-hidden rounded-[1.05rem] border border-white/38 bg-white/[0.16]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.46),rgba(255,255,255,0.08)),radial-gradient(circle_at_16%_16%,rgba(0,167,255,0.10),transparent_34%),radial-gradient(circle_at_90%_92%,rgba(255,122,0,0.12),transparent_36%)]" />
      <svg className="absolute inset-x-0 top-0 h-[4.9rem] w-full" viewBox="0 0 360 92" preserveAspectRatio="none" aria-label="Пульс дня">
        <defs>
          <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#00a7ff" />
            <stop offset="34%" stopColor="#8b1cff" />
            <stop offset="57%" stopColor="#ef233c" />
            <stop offset="76%" stopColor="#ff7a00" />
            <stop offset="100%" stopColor="#ffd400" />
          </linearGradient>
          <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff7a00" stopOpacity="0.22" />
            <stop offset="42%" stopColor="#ef233c" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-80%" width="140%" height="240%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M 18 86 H 342" fill="none" stroke="rgba(48,19,45,0.065)" strokeWidth="1" strokeLinecap="round" />
        <path d={areaPath} fill={`url(#${areaId})`} />
        <path d={linePath} fill="none" stroke="rgba(48,19,45,0.08)" strokeWidth="8" strokeLinecap="round" />
        <path d={linePath} fill="none" stroke={`url(#${lineId})`} strokeWidth="4.2" strokeLinecap="round" filter={`url(#${glowId})`} />
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
              onClick={() => onSelectPoint(moment.point)}
              onKeyDown={(event) => handleKeySelect(event, moment.point)}
              className="cursor-pointer outline-none"
            >
              <circle cx={x} cy={y} r="16" fill="transparent" />
              <circle cx={x} cy={y} r={isSelected ? 12 : 7.8} fill={isSelected ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.28)'} />
              <circle cx={x} cy={y} r={isSelected ? 7.6 : 4.9} fill="#fffaf1" stroke={moment.color} strokeWidth={isSelected ? 3.8 : 2.1} />
              <circle cx={x} cy={y} r={isSelected ? 2.9 : 2.1} fill={moment.color} />
              {isCurrent && !isSelected ? (
                <circle cx={x} cy={y} r="10.4" fill="none" stroke="rgba(239,59,98,0.28)" strokeWidth="2" strokeDasharray="3 3" />
              ) : null}
            </g>
          );
        })}
        {!selectedIsMoment ? (
          <g>
            <circle cx={selectedXY.x} cy={selectedXY.y} r="12" fill="rgba(255,255,255,0.58)" />
            <circle cx={selectedXY.x} cy={selectedXY.y} r="7.6" fill="#fffaf1" stroke="#ff9f1c" strokeWidth="3.8" />
            <circle cx={selectedXY.x} cy={selectedXY.y} r="2.9" fill="#ff7a00" />
          </g>
        ) : null}
      </svg>
      <div className="pointer-events-none absolute left-2.5 right-2.5 top-1.5 flex items-center justify-between font-lumiaHome text-[0.55rem] font-extrabold text-[#5f5761]/46">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <div className="absolute inset-x-1.5 bottom-1 grid grid-cols-5 gap-1">
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
          {language === 'ru' ? 'Пульс дня' : 'Day pulse'}
        </h2>
        <div className="h-8 w-[6.5rem] animate-pulse rounded-full bg-[#f8dca9]/70" />
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
        <Sparkles size={17} className="text-[#ff9f1c]" strokeWidth={2.1} aria-hidden />
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
    <LumiaHomeLargeCard className="lumia-home-pulse-card border border-[#30132d]/[0.065] bg-[linear-gradient(145deg,#fffdf9_0%,#fff3dc_48%,#ffe8f1_100%)] px-3.5 py-3.5 text-[#30132d] shadow-[0_16px_38px_rgba(160,68,86,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(255,188,74,0.22),transparent_34%),radial-gradient(circle_at_96%_72%,rgba(239,59,98,0.15),transparent_35%),radial-gradient(circle_at_58%_10%,rgba(255,255,255,0.46),transparent_30%)]" />
      <div className="pointer-events-none absolute bottom-[7.6rem] right-[-3.8rem] h-20 w-[74%] rotate-[-10deg] rounded-[999px] bg-[linear-gradient(90deg,rgba(255,255,255,0.30),rgba(255,138,0,0.12),rgba(239,59,98,0.12))] blur-md" />
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
            <div className="flex shrink-0 items-center rounded-full bg-[#ffe8bd]/72 px-2.5 py-1.5 text-[#7a3b08] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
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
            <p className="mb-0 mt-1.5 font-lumiaHomeDisplay text-[1rem] font-extrabold leading-none text-[#ef3b62]">
              {currentRange}
            </p>
            <p className="mb-0 mt-2 max-w-[20.5rem] font-lumiaHome text-[0.82rem] font-semibold leading-[1.34] text-[#2f2b31]">
              {currentSummary}
            </p>
          </div>

          <PulseChart language={language} pulse={pulse} selectedPoint={selectedPoint} onSelectPoint={handleSelectPoint} />

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2.5 rounded-[1rem] bg-[#f3fff8]/58 px-2.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(24,201,100,0.09)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#18c964] text-white shadow-[0_8px_15px_rgba(24,201,100,0.24)]">
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
            <div className="flex items-center gap-2.5 rounded-[1rem] bg-[#fff2f4]/58 px-2.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(239,35,60,0.08)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ef233c] text-white shadow-[0_8px_15px_rgba(239,35,60,0.22)]">
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
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fff2d1] text-[#f29b20]">
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
      className="lumia-home-large-card min-h-[14.6rem] bg-[#fff7d3] p-3.5 text-left shadow-[0_14px_34px_rgba(255,122,0,0.12)] active:scale-[0.99]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(0,167,255,0.22),transparent_48%),radial-gradient(circle_at_16%_96%,rgba(255,122,0,0.28),transparent_52%)]" />
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
      className="lumia-home-large-card min-h-[14.6rem] bg-[linear-gradient(145deg,#8b1cff_0%,#ef233c_58%,#ff7a00_126%)] p-3.5 text-left text-white shadow-[0_16px_38px_rgba(239,35,60,0.22)] active:scale-[0.99]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_9%,rgba(255,212,0,0.34),transparent_42%),radial-gradient(circle_at_8%_95%,rgba(0,167,255,0.24),transparent_42%)]" />
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
