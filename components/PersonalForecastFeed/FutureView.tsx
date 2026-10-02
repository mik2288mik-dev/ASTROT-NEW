import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  buildFutureMonth,
  FREE_OPEN_DAYS,
  formatDayRu,
  monthNameRu,
  natalPointsFromChart,
  PREMIUM_DAILY_DAYS,
  type CalendarDay,
  type FutureMonth,
  type NatalPoints,
} from '../../lib/futureCalendar';
import { loadPersonalForecast, type PersonalForecastClientResult } from '../../services/personalForecastService';
import { PremiumHook } from '../premium/PremiumHook';
import { ForecastSectionBlock } from './ForecastSectionBlock';
import { loadExploreCharts, peekExploreCharts } from './exploreCharts';

type FutureViewProps = {
  profile: UserProfile;
  premium: boolean;
  /** Days ahead NEBO+ opens, by the bought plan (30, 90 or 365). */
  horizonDays: number;
  /** Today in the person's timezone, YYYY-MM-DD. */
  todayKey: string;
  onRequestPremium: () => void;
  /** The AI month reading for the current month, shown to NEBO+ under the calendar. */
  monthReading?: ReactNode;
};

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTHS_IN_RU = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MOON_MARK: Record<string, string> = { new: '●', first: '◐', full: '○', last: '◑' };

let calendarEngine: Promise<typeof import('astronomy-engine')> | null = null;

function addDays(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function importantDaysWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'важный день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'важных дня';
  return 'важных дней';
}

export function FutureView({ profile, premium, horizonDays, todayKey, onRequestPremium, monthReading }: FutureViewProps) {
  const timezone = profile.birthTimezone || 'Europe/Moscow';
  const [todayYear, todayMonth] = todayKey.split('-').map(Number);
  const [cursor, setCursor] = useState({ year: todayYear, month: todayMonth });
  const [engine, setEngine] = useState<typeof import('astronomy-engine') | null>(null);
  const [natal, setNatal] = useState<NatalPoints | null>(() => natalPointsFromChart(
    peekExploreCharts(String(profile.id || 'guest'))?.find((chart) => chart.is_primary)?.chart_data ?? null,
  ));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dayReading, setDayReading] = useState<{ dayKey: string; result: PersonalForecastClientResult | null; loading: boolean; error: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    calendarEngine ??= import('astronomy-engine');
    void calendarEngine.then((loaded) => { if (active) setEngine(loaded); }).catch(() => { calendarEngine = null; });
    void loadExploreCharts(String(profile.id || 'guest')).then((charts) => {
      if (active) setNatal(natalPointsFromChart(charts.find((chart) => chart.is_primary)?.chart_data ?? null));
    });
    return () => { active = false; };
  }, [profile.id]);

  const lastOpenKey = addDays(todayKey, premium ? horizonDays : 30);
  const [lastYear, lastMonth] = lastOpenKey.split('-').map(Number);
  const monthIndex = (year: number, month: number) => year * 12 + month;
  const canGoBack = monthIndex(cursor.year, cursor.month) > monthIndex(todayYear, todayMonth);
  const canGoForward = monthIndex(cursor.year, cursor.month) < monthIndex(lastYear, lastMonth);
  const isCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth;

  const month: FutureMonth | null = useMemo(
    () => (engine ? buildFutureMonth(engine, cursor.year, cursor.month, natal, timezone) : null),
    [cursor.month, cursor.year, engine, natal, timezone],
  );

  const shift = (step: number) => {
    setSelectedKey(null);
    setCursor((current) => {
      const index = current.year * 12 + (current.month - 1) + step;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  };

  const dayAccess = (dayKey: string): 'open' | 'locked' | 'events-only' | 'past' => {
    const offset = daysBetween(todayKey, dayKey);
    if (offset < 0) return 'past';
    if (offset < FREE_OPEN_DAYS) return 'open';
    if (!premium) return 'locked';
    return offset <= PREMIUM_DAILY_DAYS ? 'open' : 'events-only';
  };

  const openReading = (dayKey: string) => {
    setDayReading({ dayKey, result: null, loading: true, error: false });
    void loadPersonalForecast({ profile, period: 'day', periodKey: dayKey })
      .then((result) => setDayReading((current) => (current?.dayKey === dayKey ? { dayKey, result, loading: false, error: false } : current)))
      .catch(() => setDayReading((current) => (current?.dayKey === dayKey ? { dayKey, result: null, loading: false, error: true } : current)));
  };

  if (!month) {
    return <p className="future-status" role="status">Считаем твой календарь…</p>;
  }

  const leading = month.days[0].weekday;
  const selected = selectedKey ? month.days.find((day) => day.dayKey === selectedKey) ?? null : null;
  const visiblePersonal = month.personalEvents.filter((event) => event.dayKey >= todayKey);
  const showPersonal = premium || !natal;
  const monthIn = MONTHS_IN_RU[cursor.month - 1];
  const important = [...(showPersonal ? month.personalEvents : []), ...month.skyEvents]
    .filter((event) => event.dayKey >= todayKey || !isCurrentMonth)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  const renderDay = (day: CalendarDay) => {
    const past = day.dayKey < todayKey;
    const classes = [
      'future-day',
      past ? 'is-past' : '',
      day.dayKey === todayKey ? 'is-today' : '',
      day.dayKey === selectedKey ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    return (
      <button
        key={day.dayKey}
        type="button"
        className={classes}
        disabled={past}
        aria-label={`${formatDayRu(day.dayKey)}${day.moonQuarter ? ', фаза Луны' : ''}${showPersonal && day.tone ? (day.tone === 'good' ? ', лёгкий день' : ', напряжённый день') : ''}`}
        onClick={() => { setSelectedKey(day.dayKey); setDayReading(null); }}
      >
        <span className="future-day-number">{day.day}</span>
        <span className="future-day-marks" aria-hidden="true">
          {day.moonQuarter ? <span className="future-moon">{MOON_MARK[day.moonQuarter]}</span> : null}
          {day.eclipse ? <span className="future-moon">◎</span> : null}
          {showPersonal && day.tone ? <span className={`future-dot is-${day.tone}`} /> : null}
          {!showPersonal && day.personal.length ? <span className="future-dot is-hidden" /> : null}
        </span>
        {day.mercuryRetrograde ? <span className="future-retro" aria-hidden="true" /> : null}
      </button>
    );
  };

  const access = selected ? dayAccess(selected.dayKey) : null;

  return (
    <div className="future-view">
      <header className="future-month-header">
        <button type="button" onClick={() => shift(-1)} disabled={!canGoBack} aria-label="Предыдущий месяц"><ChevronLeft size={20} /></button>
        <h2>{monthNameRu(cursor.month)} {cursor.year}</h2>
        <button type="button" onClick={() => shift(1)} disabled={!canGoForward} aria-label="Следующий месяц"><ChevronRight size={20} /></button>
      </header>
      <p className="future-access">
        {premium
          ? horizonDays > PREMIUM_DAILY_DAYS
            ? `NEBO+ · по дням до ${formatDayRu(addDays(todayKey, PREMIUM_DAILY_DAYS))}, по месяцам до ${formatDayRu(lastOpenKey)}`
            : `NEBO+ · каждый день до ${formatDayRu(lastOpenKey)}`
          : 'Бесплатно: сегодня и завтра. Дальше — с NEBO+'}
      </p>

      <div className="future-weekdays" aria-hidden="true">{WEEKDAYS.map((name) => <span key={name}>{name}</span>)}</div>
      <div className="future-grid">
        {Array.from({ length: leading }, (_, index) => <span key={`pad-${index}`} className="future-pad" />)}
        {month.days.map(renderDay)}
      </div>
      <div className="future-legend" aria-hidden="true">
        {showPersonal && natal ? <><span><i className="future-dot is-good" />лёгкий день</span><span><i className="future-dot is-hard" />напряжённый</span></> : null}
        {!showPersonal ? <span><i className="future-dot is-hidden" />твой важный день</span> : null}
        <span>● ○ Луна</span>
        <span><i className="future-retro-sample" />Меркурий назад</span>
      </div>

      {selected ? (
        <section className="future-day-sheet" aria-live="polite">
          <div className="future-day-hero">
            <p>{selected.dayKey === todayKey ? 'Сегодня' : selected.dayKey === addDays(todayKey, 1) ? 'Завтра' : new Date(`${selected.dayKey}T12:00:00Z`).toLocaleDateString('ru-RU', { weekday: 'long', timeZone: 'UTC' })}</p>
            <h3>{formatDayRu(selected.dayKey)}</h3>
            {showPersonal && selected.personal[0] ? <span>{selected.personal[0].body}.</span> : null}
            {!showPersonal && selected.personal.length ? <span>В этот день у тебя личное событие. Что оно значит — в NEBO+.</span> : null}
            {!selected.personal.length && selected.sky[0] ? <span>{selected.sky[0].body}.</span> : null}
            {!selected.personal.length && !selected.sky.length ? <span>Спокойный день без особых событий на небе.</span> : null}
          </div>
          <div className="future-chips">
            {showPersonal ? selected.personal.map((event) => <span key={`${event.planet}-${event.point}-${event.aspect}`} className={`future-chip is-${event.tone}`}>{event.headline}</span>) : null}
            {selected.sky.map((event) => <span key={event.headline} className="future-chip">{event.headline}</span>)}
            {selected.mercuryRetrograde && !selected.sky.some((event) => event.kind === 'mercury-start') ? <span className="future-chip">Меркурий идёт назад</span> : null}
          </div>
          {access === 'open' ? (
            dayReading?.dayKey === selected.dayKey ? (
              dayReading.loading ? <p className="future-status" role="status">Готовим прогноз на {formatDayRu(selected.dayKey)}…</p>
                : dayReading.error || !dayReading.result ? (
                  <>
                    <p className="future-status">Прогноз не загрузился. Попробуй ещё раз.</p>
                    <button type="button" className="future-read" onClick={() => openReading(selected.dayKey)}>Повторить</button>
                  </>
                ) : (
                  <article className="future-reading forecast-feed-story forecast-editorial-reading forecast-period-editorial-feed" lang="ru">
                    {dayReading.result.forecast.sections.map((section) => (
                      <ForecastSectionBlock
                        key={section.id}
                        section={section}
                        period="day"
                        language="ru"
                        locked={dayReading.result!.lockedSectionIds.includes(section.id)}
                        onRequestPremium={onRequestPremium}
                      />
                    ))}
                  </article>
                )
            ) : <button type="button" className="future-read" onClick={() => openReading(selected.dayKey)}>Читать прогноз на этот день</button>
          ) : access === 'locked' ? (
            <button type="button" className="future-read is-locked" onClick={onRequestPremium}><LockKeyhole size={15} aria-hidden="true" />Прогноз на этот день — в NEBO+</button>
          ) : access === 'events-only' ? (
            <p className="future-status">По дням открыт ближайший месяц. Этот день войдёт в него ближе к дате, а пока смотри главное месяца ниже.</p>
          ) : null}
        </section>
      ) : (
        <p className="future-hint">Нажми на день — покажем, чем он будет для тебя.</p>
      )}

      {!premium && natal && visiblePersonal.length ? (
        <PremiumHook
          title={`В ${monthIn} ${visiblePersonal.length} ${importantDaysWord(visiblePersonal.length)} для тебя`}
          items={visiblePersonal.slice(0, 4).map((event) => `${formatDayRu(event.dayKey)} — ${event.headline}`)}
          cta="Открыть своё будущее"
          note={`С NEBO+ каждый день на месяц вперёд и главное по месяцам — до года`}
          onOpen={onRequestPremium}
        />
      ) : null}

      {!isCurrentMonth ? (
        <section className="future-summary">
          <p>{monthNameRu(cursor.month)} {cursor.year} · главное</p>
          <h3>{month.summary.headline}</h3>
          {month.summary.body ? <span>{month.summary.body}</span> : null}
        </section>
      ) : null}

      {important.length ? (
        <section className="future-important" aria-labelledby="future-important-title">
          <h3 id="future-important-title">Важное в {monthIn}</h3>
          {important.map((event) => (
            <button
              type="button"
              key={`${event.dayKey}-${event.headline}`}
              className="future-event"
              onClick={() => { setSelectedKey(event.dayKey); setDayReading(null); }}
            >
              <span className="future-event-date"><b>{Number(event.dayKey.slice(8))}</b>{WEEKDAYS[(new Date(`${event.dayKey}T12:00:00Z`).getUTCDay() + 6) % 7]}</span>
              <span className="future-event-copy">
                <strong>{event.headline}{'tone' in event ? <em className={`future-tag is-${event.tone}`}>лично</em> : null}</strong>
                <small>{event.body}</small>
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {isCurrentMonth && monthReading ? (
        <section className="future-month-reading" aria-label={`Прогноз на ${monthNameRu(cursor.month).toLowerCase()}`}>
          <h3>Прогноз на {monthNameRu(cursor.month).toLowerCase()}</h3>
          {monthReading}
        </section>
      ) : null}
    </div>
  );
}
