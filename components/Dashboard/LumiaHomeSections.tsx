import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  ArrowRight,
  Lock,
  Sparkles,
} from 'lucide-react';
import type { TodayPulse, TodayPulseLayerKey, TodayPulseLayers, TodayPulsePoint, TodayPulseResult } from '../../types';
import { lumiaImpactHaptic, lumiaSelectionHaptic } from '../../lib/haptics';
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

const PULSE_LAYER_LABELS: Record<LumiaHomeLanguage, Record<TodayPulseLayerKey, string>> = {
  ru: {
    energy: 'Энергия',
    focus: 'Фокус',
    emotions: 'Эмоции',
    money: 'Деньги',
    relationships: 'Контакт',
  },
  en: {
    energy: 'Energy',
    focus: 'Focus',
    emotions: 'Emotions',
    money: 'Money',
    relationships: 'Connection',
  },
};

const PULSE_LAYER_ORDER: TodayPulseLayerKey[] = ['energy', 'focus', 'emotions', 'money', 'relationships'];

const PULSE_SCORE_BANDS = [
  { min: 0, max: 49, label: { ru: 'спад', en: 'low' }, color: '#2f5f7a' },
  { min: 50, max: 63, label: { ru: 'ровно', en: 'steady' }, color: '#00a7ff' },
  { min: 64, max: 75, label: { ru: 'сильно', en: 'strong' }, color: '#18c964' },
  { min: 76, max: 100, label: { ru: 'пик', en: 'peak' }, color: '#ffb000' },
];

function pointToXY(point: TodayPulsePoint) {
  return {
    x: 12 + (point.hour / 23) * 396,
    y: 126 - (point.score / 100) * 96,
  };
}

function buildPulsePath(points: TodayPulsePoint[]) {
  if (!points.length) return '';
  const coords = points.map(pointToXY);
  return coords.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const prev = coords[index - 1];
    const midX = (prev.x + point.x) / 2;
    return `${path} C ${midX.toFixed(1)} ${prev.y.toFixed(1)}, ${midX.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, '');
}

function dominantLayer(layers: TodayPulseLayers): TodayPulseLayerKey {
  return PULSE_LAYER_ORDER.reduce((best, key) => (layers[key] > layers[best] ? key : best), 'energy' as TodayPulseLayerKey);
}

function pulseScoreBand(score: number) {
  return PULSE_SCORE_BANDS.find((band) => score >= band.min && score <= band.max) || PULSE_SCORE_BANDS[1];
}

function pulseScoreMeaning(score: number, language: LumiaHomeLanguage) {
  if (language === 'en') {
    if (score >= 76) return 'Best action slot: take the main task while energy and focus are both high.';
    if (score >= 64) return 'Strong slot: good for work, messages, decisions, and visible progress.';
    if (score >= 50) return 'Steady slot: keep a clean pace, finish small tasks, and avoid overload.';
    return 'Low slot: reduce pressure, restore, simplify, and postpone heavy choices.';
  }
  if (score >= 76) return 'Лучшее окно для действия: энергия и фокус достаточно высокие, бери главную задачу.';
  if (score >= 64) return 'Сильное окно: подходит для работы, переписок, решений и заметного прогресса.';
  if (score >= 50) return 'Ровный слот: держи спокойный темп, закрывай мелкое и не перегружай день.';
  return 'Спад: снижай давление, восстанавливайся и переноси тяжелые решения.';
}

function pulseIndexGuide(language: LumiaHomeLanguage) {
  return language === 'ru'
    ? 'Индекс 0-100: выше - больше энергии, фокуса и действия; ниже - восстановление и простой темп.'
    : 'Index 0-100: higher means more energy, focus, and action; lower means recovery and a simple pace.';
}

function pulseHeatBackground(point: TodayPulsePoint) {
  if (point.tone === 'caution') return 'linear-gradient(180deg,#ff4d6d 0%,#e50914 100%)';
  if (point.tone === 'restore') return 'linear-gradient(180deg,#7ddfff 0%,#00a7ff 100%)';
  if (point.score >= 76) return 'linear-gradient(180deg,#ffe45c 0%,#ff7a00 100%)';
  if (point.score >= 64) return 'linear-gradient(180deg,#82f2a4 0%,#18c964 100%)';
  if (point.score >= 52) return 'linear-gradient(180deg,#61d8ff 0%,#00a7ff 100%)';
  return 'linear-gradient(180deg,#6fb7d6 0%,#2f5f7a 100%)';
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

function PulseLayerChip({
  language,
  layerKey,
  value,
  active,
}: {
  language: LumiaHomeLanguage;
  layerKey: TodayPulseLayerKey;
  value: number;
  active: boolean;
}) {
  return (
    <div
      className={[
        'min-w-0 rounded-[0.72rem] px-2 py-1.5 ring-1 transition-colors',
        active ? 'bg-white/[0.22] ring-white/[0.26]' : 'bg-white/[0.075] ring-white/[0.08]',
      ].join(' ')}
    >
      <p className="mb-0 truncate font-lumiaHome text-[0.58rem] font-extrabold uppercase leading-none text-white/62">
        {PULSE_LAYER_LABELS[language][layerKey]}
      </p>
      <p className="mb-0 mt-1 font-lumiaHomeDisplay text-[0.88rem] font-extrabold leading-none text-white">{value}</p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/12">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#00a7ff,#18c964,#ffd400,#ff7a00)]"
          style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function PulseChart({
  language,
  pulse,
  selected,
  onSelect,
}: {
  language: LumiaHomeLanguage;
  pulse: TodayPulse;
  selected: TodayPulsePoint;
  onSelect: (point: TodayPulsePoint) => void;
}) {
  const safeId = useId().replace(/:/g, '');
  const lineId = `pulseLine-${safeId}`;
  const fillId = `pulseFill-${safeId}`;
  const glowId = `pulseGlow-${safeId}`;
  const path = useMemo(() => buildPulsePath(pulse.points), [pulse.points]);
  const selectedXY = pointToXY(selected);
  const peakHour = pulse.peakPoint.hour;
  const keyHours = new Set(pulse.keyMoments.map((point) => point.hour));
  const selectedBand = pulseScoreBand(selected.score);

  return (
    <div className="lumia-home-pulse-chart relative mt-3.5 h-[12.2rem] overflow-hidden rounded-[1.05rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_16%,rgba(255,228,92,0.22),transparent_32%),radial-gradient(circle_at_94%_72%,rgba(229,9,20,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.018))]" />
      <div className="absolute left-3 right-3 top-2 flex items-center justify-between gap-2">
        <div className="min-w-0 rounded-full border border-white/12 bg-black/18 px-2.5 py-1.5 font-lumiaHome text-[0.62rem] font-extrabold text-white/78 backdrop-blur-xl">
          {selected.time} · {language === 'ru' ? 'индекс' : 'index'} {selected.score}/100 · {selectedBand.label[language]}
        </div>
        <div className="rounded-full border border-white/12 bg-white/[0.11] px-2 py-1 font-lumiaHome text-[0.58rem] font-extrabold uppercase text-white/54 backdrop-blur-xl">
          {language === 'ru' ? 'лучшее' : 'best'} {pulse.peakPoint.time} · {pulse.peakPoint.score}
        </div>
      </div>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 150" preserveAspectRatio="none" aria-label="Пульс дня">
        <defs>
          <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#00a7ff" />
            <stop offset="36%" stopColor="#18c964" />
            <stop offset="67%" stopColor="#ffd400" />
            <stop offset="100%" stopColor="#e50914" />
          </linearGradient>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffd400" stopOpacity="0.36" />
            <stop offset="58%" stopColor="#e50914" stopOpacity="0.11" />
            <stop offset="100%" stopColor="#111111" stopOpacity="0" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-80%" width="140%" height="240%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.50 0 1 0 0 0.18 0 0 1 0 0.90 0 0 0 0.36 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={`${path} L 408 150 L 12 150 Z`} fill={`url(#${fillId})`} />
        {[6, 10, 14, 17, 21].map((hour) => {
          const x = 12 + (hour / 23) * 396;
          return <line key={hour} x1={x} x2={x} y1="18" y2="140" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
        })}
        <path d={path} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="12" strokeLinecap="round" />
        <path d={path} fill="none" stroke={`url(#${lineId})`} strokeWidth="5" strokeLinecap="round" filter={`url(#${glowId})`} />
        {pulse.points.map((point) => {
          const { x, y } = pointToXY(point);
          const isSelected = point.hour === selected.hour;
          const isPeak = point.hour === peakHour;
          const isKey = keyHours.has(point.hour);
          return (
            <g
              key={point.time}
              role="button"
              tabIndex={0}
              aria-label={`${point.time} ${point.title}`}
              onClick={() => onSelect(point)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(point);
              }}
              className="cursor-pointer"
            >
                <circle cx={x} cy={y} r="13" fill="transparent" />
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 7 : isPeak ? 5.8 : isKey ? 4.8 : 2.6}
                  fill={isSelected ? '#ffffff' : isPeak ? '#ffd400' : isKey ? '#ffffff' : 'rgba(255,255,255,0.34)'}
                  opacity={isKey || isSelected ? 1 : 0.58}
                />
                {isSelected ? <circle cx={x} cy={y} r="13" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="2" /> : null}
            </g>
          );
        })}
        <line x1={selectedXY.x} x2={selectedXY.x} y1="18" y2="140" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" strokeDasharray="4 6" />
      </svg>
      <div className="absolute inset-x-3 bottom-[4.05rem] flex gap-1.5">
        {pulse.windows.map((window) => {
          const start = Number.parseInt(window.start.slice(0, 2), 10);
          const endRaw = window.end === '00:00' ? 24 : Number.parseInt(window.end.slice(0, 2), 10);
          const duration = Math.max(1, endRaw - start);
          return (
            <button
              key={`${window.start}-${window.end}`}
              type="button"
              onClick={() => onSelect(pulse.points[start] || selected)}
              className="min-w-0 rounded-full border border-white/10 bg-black/18 px-1.5 py-1 text-center font-lumiaHome text-[0.52rem] font-extrabold uppercase leading-none text-white/58 backdrop-blur-xl"
              style={{ flex: `${duration} 1 0` }}
              title={`${window.start}-${window.end}`}
            >
              <span className="block truncate">{window.label}</span>
            </button>
          );
        })}
      </div>
      <div
        className="absolute inset-x-3 bottom-[2.55rem] grid h-[1.15rem] gap-[2px]"
        style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
        aria-label="Тепловая карта пульса дня"
      >
        {pulse.points.map((point) => {
          const isSelected = point.hour === selected.hour;
          const isKey = keyHours.has(point.hour);
          return (
            <button
              key={`heat-${point.time}`}
              type="button"
              aria-label={`${point.time}: ${point.score}`}
              title={`${point.time} · ${point.score}`}
              onClick={() => onSelect(point)}
              className={[
                'h-full min-w-0 rounded-[0.32rem] transition-transform active:scale-y-125',
                isSelected ? 'ring-2 ring-white shadow-[0_0_14px_rgba(255,255,255,0.58)]' : '',
                isKey && !isSelected ? 'ring-1 ring-white/[0.34]' : '',
              ].join(' ')}
              style={{
                background: pulseHeatBackground(point),
                opacity: isSelected ? 1 : isKey ? 0.92 : 0.62 + point.score / 280,
              }}
            />
          );
        })}
      </div>
      <div className="absolute inset-x-3 bottom-[1.45rem] flex justify-between font-lumiaHome text-[0.56rem] font-extrabold text-white/45">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>00</span>
      </div>
      <div className="absolute inset-x-3 bottom-2 flex items-center justify-between gap-1.5">
        {PULSE_SCORE_BANDS.map((band) => (
          <div key={band.label.ru} className="flex min-w-0 items-center gap-1 font-lumiaHome text-[0.5rem] font-extrabold uppercase text-white/48">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: band.color }} />
            <span className="truncate">{band.min}-{band.max} {band.label[language]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PulseDetail({
  language,
  point,
}: {
  language: LumiaHomeLanguage;
  point: TodayPulsePoint;
}) {
  const dominant = dominantLayer(point.layers);
  return (
    <div className="lumia-home-pulse-detail mt-3 rounded-[1.05rem] border border-white/12 bg-white/[0.105] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-0 font-lumiaHome text-[0.62rem] font-extrabold uppercase tracking-[0.07em] text-[#ffd400]">
            {point.time}
          </p>
          <h3 className="mb-0 mt-1 font-lumiaHomeDisplay text-[1.06rem] font-extrabold leading-none text-white">
            {point.title}
          </h3>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lumiaHome-purpleDeep shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
          <span className="font-lumiaHomeDisplay text-[1rem] font-extrabold">{point.score}</span>
        </div>
      </div>

      <p className="mb-0 mt-2.5 font-lumiaHome text-[0.76rem] font-semibold leading-snug text-white/78">
        {point.summary}
      </p>

      <div className="mt-3 rounded-[0.9rem] bg-white/[0.12] p-2.5 ring-1 ring-white/[0.1]">
        <div className="flex items-center justify-between gap-2">
          <p className="mb-0 font-lumiaHome text-[0.6rem] font-extrabold uppercase tracking-[0.07em] text-white/48">
            {language === 'ru' ? 'Что значит индекс' : 'Index meaning'}
          </p>
          <p className="mb-0 font-lumiaHomeDisplay text-[0.95rem] font-extrabold leading-none text-[#ffd400]">
            {point.score}/100
          </p>
        </div>
        <p className="mb-0 mt-1.5 font-lumiaHome text-[0.7rem] font-bold leading-snug text-white">
          {pulseScoreMeaning(point.score, language)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {PULSE_LAYER_ORDER.map((key) => (
          <PulseLayerChip key={key} language={language} layerKey={key} value={point.layers[key]} active={key === dominant} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[0.8rem] bg-white/[0.075] p-2 ring-1 ring-white/[0.08]">
          <p className="mb-1 font-lumiaHome text-[0.58rem] font-extrabold uppercase text-white/48">
            {language === 'ru' ? 'Лучше' : 'Best'}
          </p>
          <p className="mb-0 font-lumiaHome text-[0.68rem] font-bold leading-snug text-white">{point.bestFor.join(', ')}</p>
        </div>
        <div className="rounded-[0.8rem] bg-white/[0.075] p-2 ring-1 ring-white/[0.08]">
          <p className="mb-1 font-lumiaHome text-[0.58rem] font-extrabold uppercase text-white/48">
            {language === 'ru' ? 'Не стоит' : 'Avoid'}
          </p>
          <p className="mb-0 font-lumiaHome text-[0.68rem] font-bold leading-snug text-white">{point.avoid.join(', ')}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-[0.85rem] bg-black/10 p-2.5 ring-1 ring-white/[0.07]">
        <p className="mb-1 font-lumiaHome text-[0.58rem] font-extrabold uppercase tracking-[0.07em] text-white/42">
          {language === 'ru' ? 'Почему так посчитано' : 'Why this score'}
        </p>
        {point.reasons.slice(0, 3).map((reason) => (
          <p key={reason} className="mb-0 font-lumiaHome text-[0.67rem] font-semibold leading-snug text-white/64">
            {reason}
          </p>
        ))}
      </div>
    </div>
  );
}

function PulseLoadingState({ language }: { language: LumiaHomeLanguage }) {
  return (
    <div className="relative z-10">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="mb-0 font-lumiaHomeDisplay text-[0.98rem] font-extrabold uppercase leading-none tracking-normal text-white">
          {language === 'ru' ? 'Пульс дня' : 'Day pulse'}
        </h2>
        <Sparkles size={17} className="text-[#ffd400]" strokeWidth={2.1} aria-hidden />
      </div>
      <div className="mt-3.5 h-[8.7rem] animate-pulse rounded-[1.05rem] bg-white/[0.09]" />
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {PULSE_LAYER_ORDER.map((key) => (
          <div key={key} className="h-[3rem] animate-pulse rounded-[0.72rem] bg-white/[0.08]" />
        ))}
      </div>
      <div className="mt-3 h-[7.3rem] animate-pulse rounded-[1.05rem] bg-white/[0.08]" />
    </div>
  );
}

function PulseSetupState({ language, onSetup }: { language: LumiaHomeLanguage; onSetup?: () => void }) {
  return (
    <div className="relative z-10">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="mb-0 font-lumiaHomeDisplay text-[0.98rem] font-extrabold uppercase leading-none tracking-normal text-white">
          {language === 'ru' ? 'Пульс дня' : 'Day pulse'}
        </h2>
        <Sparkles size={17} className="text-[#ffd400]" strokeWidth={2.1} aria-hidden />
      </div>
      <div className="mt-3 rounded-[1.05rem] bg-white/[0.105] p-3 ring-1 ring-white/[0.1]">
        <p className="mb-0 font-lumiaHomeDisplay text-[1.05rem] font-extrabold leading-tight text-white">
          {language === 'ru' ? 'Нужны дата и место рождения' : 'Birth data needed'}
        </p>
        <p className="mb-0 mt-2 font-lumiaHome text-[0.76rem] font-semibold leading-snug text-white/72">
          {language === 'ru'
            ? 'Тогда Lumia честно рассчитает твой ритм по наталу, транзитам и локальному времени.'
            : 'Then Lumia can calculate your rhythm from natal data, transits, and local time.'}
        </p>
        {onSetup ? (
          <button
            type="button"
            onClick={onSetup}
            className="mt-3 inline-flex min-h-[2.45rem] items-center justify-center rounded-full bg-white px-4 font-lumiaHome text-[0.78rem] font-extrabold text-lumiaHome-purpleDeep"
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
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const selectedPoint = pulse?.points.find((point) => point.hour === (selectedHour ?? pulse.currentPoint.hour)) || pulse?.currentPoint || null;

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

  const selectPoint = (point: TodayPulsePoint) => {
    setSelectedHour(point.hour);
    if (point.tone === 'peak' || point.tone === 'caution') lumiaImpactHaptic('soft', 120);
    else lumiaSelectionHaptic(70);
    lumiaDebugLog('pulse_select', {
      time: point.time,
      score: point.score,
      tone: point.tone,
      layers: point.layers,
    });
  };

  return (
    <LumiaHomeLargeCard className="lumia-home-pulse-card bg-[linear-gradient(135deg,#101010_0%,#241315_46%,#7f1225_86%,#ff7a00_145%)] px-3.5 py-3.5 text-white shadow-[0_18px_44px_rgba(229,9,20,0.18)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_62%_5%,rgba(255,228,92,0.24),transparent_34%),radial-gradient(circle_at_8%_108%,rgba(0,167,255,0.22),transparent_38%),radial-gradient(circle_at_92%_92%,rgba(229,9,20,0.22),transparent_34%)]" />
      {isLoading ? (
        <PulseLoadingState language={language} />
      ) : pulseResult?.status === 'needs_setup' ? (
        <PulseSetupState language={language} onSetup={onSetup} />
      ) : pulse && selectedPoint ? (
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="mb-0 font-lumiaHomeDisplay text-[0.98rem] font-extrabold uppercase leading-none tracking-normal text-white">
                {copy.pulseTitle}
              </h2>
              <p className="mb-0 mt-1 font-lumiaHome text-[0.62rem] font-extrabold uppercase tracking-[0.07em] text-white/48">
                {formatPulseDate(pulse.date, language)} · {language === 'ru' ? 'локальный ритм' : 'local rhythm'}
              </p>
              <p className="mb-0 mt-1 max-w-[13.5rem] font-lumiaHome text-[0.68rem] font-bold leading-snug text-white/70">
                {pulseIndexGuide(language)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => selectPoint(pulse.currentPoint)}
                className="inline-flex min-h-[2rem] items-center justify-center rounded-full border border-white/14 bg-white/[0.12] px-2.5 font-lumiaHome text-[0.66rem] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13)] backdrop-blur-xl active:bg-white/[0.18]"
              >
                {language === 'ru' ? 'Сейчас' : 'Now'} {pulse.currentTime}
              </button>
              <Sparkles size={17} className="text-[#ffd400]" strokeWidth={2.1} aria-hidden />
            </div>
          </div>
          <PulseChart language={language} pulse={pulse} selected={selectedPoint} onSelect={selectPoint} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {pulse.windows.slice(1, 4).map((window) => (
              <button
                key={`${window.start}-${window.end}`}
                type="button"
                onClick={() => {
                  const hour = Number.parseInt(window.start.slice(0, 2), 10);
                  const point = pulse.points[hour] || selectedPoint;
                  selectPoint(point);
                }}
                className="min-h-[2.75rem] rounded-[0.8rem] bg-white/[0.075] px-2 text-center ring-1 ring-white/[0.08] transition-colors active:bg-white/[0.14]"
              >
                <p className="mb-0 font-lumiaHome text-[0.7rem] font-extrabold leading-tight text-white">{window.label}</p>
                <p className="mb-0 mt-0.5 font-lumiaHome text-[0.62rem] font-bold leading-tight text-white/56">{window.score}/100</p>
              </button>
            ))}
          </div>
          <PulseDetail language={language} point={selectedPoint} />
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
