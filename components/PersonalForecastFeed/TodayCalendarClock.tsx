import React, { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  resolveTodayClockPreset,
  resolveTodayLinePreset,
  type TodayClockPreset,
} from '../../lib/todayVisualPresets';

type TodayCalendarClockProps = {
  userId: string;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  signal?: TodayClockSignal;
};

export type TodayClockSignal = 'green' | 'yellow' | 'red';

type ClockParts = {
  day: string;
  month: string;
  weekday: string;
  time: string;
  semanticLabel: string;
};

function dateFromPeriodKey(periodKey: string): Date {
  const match = periodKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date();
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

function cleanShortLabel(value: string): string {
  return value.replace('.', '').trim().toLocaleUpperCase();
}

function buildClockParts(
  now: Date,
  periodKey: string,
  timezone: string,
  language: 'ru' | 'en',
): ClockParts {
  const locale = language === 'ru' ? 'ru-RU' : 'en-GB';
  const displayDate = dateFromPeriodKey(periodKey);
  const day = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    timeZone: 'UTC',
  }).format(displayDate);
  const month = cleanShortLabel(new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  }).format(displayDate));
  const weekday = cleanShortLabel(new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(displayDate));
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).format(now);
  const semanticDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(displayDate);

  return {
    day,
    month,
    weekday,
    time,
    semanticLabel: language === 'ru'
      ? `${semanticDate}, ${time}`
      : `${semanticDate}, ${time}`,
  };
}

function clockStyle(preset: TodayClockPreset): CSSProperties {
  return {
    '--today-clock-case': preset.caseColor,
    '--today-clock-face': preset.faceColor,
    '--today-clock-digits': preset.digitColor,
    '--today-clock-edge': preset.edgeColor,
    '--today-clock-accent': preset.accentColor,
    '--today-clock-radius': preset.radius,
    '--today-clock-tilt': `${preset.tiltDeg}deg`,
  } as CSSProperties;
}

function ElectronicReadout({ parts }: { parts: ClockParts }) {
  const readout = (
    <>
      <span className="today-calendar-clock-date">
        {parts.day} {parts.month}
      </span>
      <span className="today-calendar-clock-meta">
        {parts.weekday} / {parts.time}
      </span>
    </>
  );

  return (
    <span className="today-calendar-clock-readout">
      {readout}
    </span>
  );
}

function FlipReadout({ parts }: { parts: ClockParts }) {
  return (
    <span className="today-calendar-clock-flip-grid">
      <span className="today-calendar-clock-flap is-day">{parts.day}</span>
      <span className="today-calendar-clock-flap is-month">{parts.month}</span>
      <span className="today-calendar-clock-flip-meta">
        {parts.weekday} · {parts.time}
      </span>
    </span>
  );
}

export function TodayCalendarClock({
  userId,
  periodKey,
  timezone,
  language,
  signal,
}: TodayCalendarClockProps) {
  const [now, setNow] = useState(() => new Date());
  const preset = useMemo(
    () => resolveTodayClockPreset(userId, periodKey),
    [periodKey, userId],
  );
  const parts = useMemo(
    () => buildClockParts(now, periodKey, timezone, language),
    [language, now, periodKey, timezone],
  );

  useEffect(() => {
    let timer: number | null = null;

    const scheduleMinuteRefresh = () => {
      if (timer !== null) window.clearTimeout(timer);
      if (document.visibilityState === 'hidden') return;
      const current = new Date();
      setNow(current);
      const delay = 60_000 - (current.getTime() % 60_000) + 40;
      timer = window.setTimeout(scheduleMinuteRefresh, delay);
    };

    const handleVisibilityChange = () => scheduleMinuteRefresh();
    scheduleMinuteRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <time
      className="today-calendar-clock"
      dateTime={periodKey.slice(0, 10)}
      aria-label={parts.semanticLabel}
      data-clock-family={preset.family}
      data-clock-preset={preset.id}
      data-day-signal={signal}
      style={clockStyle(preset)}
      suppressHydrationWarning
    >
      <span className="today-calendar-clock-hardware" aria-hidden="true">
        <span className="today-calendar-clock-face">
          {preset.family === 'flip' ? (
            <FlipReadout parts={parts} />
          ) : (
            <ElectronicReadout parts={parts} />
          )}
        </span>
        <span className="today-calendar-clock-foot is-left" />
        <span className="today-calendar-clock-foot is-right" />
      </span>
    </time>
  );
}

export function TodayLineField({
  userId,
  periodKey,
}: Pick<TodayCalendarClockProps, 'userId' | 'periodKey'>) {
  const preset = useMemo(
    () => resolveTodayLinePreset(userId, periodKey),
    [periodKey, userId],
  );

  return (
    <svg
      className="today-line-field"
      viewBox="0 0 390 58"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-line-preset={preset.id}
    >
      {preset.paths.map((pathValue, index) => (
        <path key={`${preset.id}-path-${index + 1}`} d={pathValue} />
      ))}
      {preset.dots.map((dot, index) => (
        <circle
          key={`${preset.id}-dot-${index + 1}`}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r ?? 2.1}
        />
      ))}
    </svg>
  );
}
