import React, { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  nextTodayBroadcastIndex,
  resolveTodayBroadcasts,
  resolveTodayClockLayout,
  resolveTodayClockPreset,
  resolveTodayLinePreset,
  type TodayBroadcastPreset,
  type TodayClockLayout,
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
  monthShort: string;
  monthLong: string;
  weekdayShort: string;
  weekdayLong: string;
  dateLong: string;
  time: string;
  semanticLabel: string;
};

type ClockDisplayKind = 'time' | 'date' | 'day' | 'month' | 'weekday';

type ClockDisplay = {
  primary: string;
  primaryKind: ClockDisplayKind;
  secondary: string;
  secondaryKind: ClockDisplayKind;
  meta: string;
};

type BroadcastState = {
  scope: string;
  index: number;
  interacted: boolean;
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
  const monthShort = cleanShortLabel(new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  }).format(displayDate));
  const monthLong = new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(displayDate);
  const weekdayShort = cleanShortLabel(new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(displayDate));
  const weekdayLong = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(displayDate);
  const dateLong = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(displayDate);
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
    monthShort,
    monthLong,
    weekdayShort,
    weekdayLong,
    dateLong,
    time,
    semanticLabel: language === 'ru'
      ? `${semanticDate}, ${time}`
      : `${semanticDate}, ${time}`,
  };
}

function clockDisplay(parts: ClockParts, layout: TodayClockLayout): ClockDisplay {
  if (layout === 'time-first') {
    return {
      primary: parts.time,
      primaryKind: 'time',
      secondary: parts.dateLong,
      secondaryKind: 'date',
      meta: parts.weekdayShort,
    };
  }
  if (layout === 'date-first') {
    return {
      primary: parts.dateLong,
      primaryKind: 'date',
      secondary: parts.time,
      secondaryKind: 'time',
      meta: parts.weekdayShort,
    };
  }
  if (layout === 'calendar-split') {
    return {
      primary: parts.day,
      primaryKind: 'day',
      secondary: parts.monthLong,
      secondaryKind: 'month',
      meta: `${parts.weekdayShort} · ${parts.time}`,
    };
  }
  return {
    primary: parts.weekdayLong,
    primaryKind: 'weekday',
    secondary: parts.time,
    secondaryKind: 'time',
    meta: `${parts.day} ${parts.monthShort}`,
  };
}

function longValueClass(value: string): string {
  return value.length >= 10 ? 'is-long' : '';
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

function ElectronicReadout({
  parts,
  layout,
}: {
  parts: ClockParts;
  layout: TodayClockLayout;
}) {
  const display = clockDisplay(parts, layout);
  return (
    <span className={`today-calendar-clock-readout is-${layout}`}>
      <span className={[
        'today-calendar-clock-primary',
        `is-${display.primaryKind}`,
        longValueClass(display.primary),
      ].filter(Boolean).join(' ')}>
        {display.primary}
      </span>
      <span className={[
        'today-calendar-clock-secondary',
        `is-${display.secondaryKind}`,
        longValueClass(display.secondary),
      ].filter(Boolean).join(' ')}>
        {display.secondary}
      </span>
      <span className="today-calendar-clock-meta">{display.meta}</span>
    </span>
  );
}

function FlipReadout({
  parts,
  layout,
}: {
  parts: ClockParts;
  layout: TodayClockLayout;
}) {
  const display = clockDisplay(parts, layout);
  return (
    <span className={`today-calendar-clock-flip-grid is-${layout}`}>
      <span className={[
        'today-calendar-clock-flap',
        'is-primary',
        `is-${display.primaryKind}`,
        longValueClass(display.primary),
      ].filter(Boolean).join(' ')}>
        {display.primary}
      </span>
      <span className={[
        'today-calendar-clock-flap',
        'is-secondary',
        `is-${display.secondaryKind}`,
        longValueClass(display.secondary),
      ].filter(Boolean).join(' ')}>
        {display.secondary}
      </span>
      <span className="today-calendar-clock-flip-meta">{display.meta}</span>
    </span>
  );
}

function TodayBroadcastScene({
  broadcast,
  active,
}: {
  broadcast: TodayBroadcastPreset;
  active: boolean;
}) {
  const className = [
    'today-calendar-clock-broadcast-scene',
    active ? 'is-active' : '',
  ].filter(Boolean).join(' ');

  return (
    <span
      className={className}
      data-broadcast-scene={broadcast.id}
      aria-hidden="true"
    >
      <img
        src={broadcast.imageSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
      />
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
  const todayBroadcasts = useMemo(
    () => resolveTodayBroadcasts(periodKey),
    [periodKey],
  );
  const broadcastScope = todayBroadcasts.map((broadcast) => broadcast.id).join('|');
  const [broadcastState, setBroadcastState] = useState<BroadcastState>(() => ({
    scope: broadcastScope,
    index: 0,
    interacted: false,
  }));
  const preset = useMemo(
    () => resolveTodayClockPreset(userId, periodKey),
    [periodKey, userId],
  );
  const layout = useMemo(
    () => resolveTodayClockLayout(userId, periodKey),
    [periodKey, userId],
  );
  const parts = useMemo(
    () => buildClockParts(now, periodKey, timezone, language),
    [language, now, periodKey, timezone],
  );
  const broadcastStateIsCurrent = broadcastState.scope === broadcastScope;
  const broadcastIndex = broadcastStateIsCurrent
    ? broadcastState.index
    : 0;
  const broadcastInteracted = broadcastStateIsCurrent && broadcastState.interacted;
  const activeBroadcast = todayBroadcasts[broadcastIndex] ?? todayBroadcasts[0];
  const broadcastActionLabel = language === 'ru'
    ? `Сменить картинку на телевизоре. ${broadcastIndex + 1} из ${todayBroadcasts.length}. Дата и время: ${parts.semanticLabel}.`
    : `Change the TV picture. ${broadcastIndex + 1} of ${todayBroadcasts.length}. Date and time: ${parts.semanticLabel}.`;
  const broadcastStatus = broadcastInteracted
    ? (language === 'ru'
        ? `Картинка ${broadcastIndex + 1} из ${todayBroadcasts.length}.`
        : `Picture ${broadcastIndex + 1} of ${todayBroadcasts.length}.`)
    : '';

  const advanceBroadcast = () => {
    setBroadcastState((current) => {
      const currentIndex = current.scope === broadcastScope
        ? current.index
        : 0;
      return {
        scope: broadcastScope,
        index: nextTodayBroadcastIndex(currentIndex),
        interacted: true,
      };
    });
  };

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
    <span className="today-calendar-clock-shell">
      <button
        type="button"
        className="today-calendar-clock"
        aria-label={broadcastActionLabel}
        data-clock-family={preset.family}
        data-clock-layout={layout}
        data-clock-preset={preset.id}
        data-day-signal={signal}
        data-broadcast-id={activeBroadcast.id}
        data-broadcast-index={broadcastIndex + 1}
        style={clockStyle(preset)}
        onClick={advanceBroadcast}
        suppressHydrationWarning
      >
        <time
          className="today-calendar-clock-time"
          dateTime={periodKey.slice(0, 10)}
          aria-label={parts.semanticLabel}
          suppressHydrationWarning
        >
          <span className="today-calendar-clock-hardware" aria-hidden="true">
            <span className="today-calendar-clock-face">
              <span className="today-calendar-clock-broadcast-pane">
                {todayBroadcasts.map((broadcast, index) => (
                  <TodayBroadcastScene
                    key={broadcast.id}
                    broadcast={broadcast}
                    active={index === broadcastIndex}
                  />
                ))}
                <span className="today-calendar-clock-channel-indicator" aria-hidden="true">
                  {todayBroadcasts.map((broadcast, index) => (
                    <span
                      key={`${broadcast.id}-indicator`}
                      className={index === broadcastIndex ? 'is-active' : undefined}
                    />
                  ))}
                </span>
              </span>
              <span className="today-calendar-clock-readout-pane">
                {preset.family === 'flip' ? (
                  <FlipReadout parts={parts} layout={layout} />
                ) : (
                  <ElectronicReadout parts={parts} layout={layout} />
                )}
              </span>
            </span>
            <span className="today-calendar-clock-foot is-left" />
            <span className="today-calendar-clock-foot is-right" />
          </span>
        </time>
      </button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {broadcastStatus}
      </span>
    </span>
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
