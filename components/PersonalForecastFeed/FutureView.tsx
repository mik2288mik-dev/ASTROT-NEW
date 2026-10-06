import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react';
import type { UserProfile } from '../../types';
import { PERSONAL_FORECAST_ROLLING_DAY_COUNT, type ForecastSection } from '../../lib/personalForecastContract';
import {
  buildFutureMonth,
  DAY_GOALS,
  FREE_OPEN_DAYS,
  pickDays,
  type DayGoal,
  formatDayRu,
  monthNameRu,
  natalPointsFromChart,
  PREMIUM_DAILY_DAYS,
  type CalendarDay,
  type FutureMonth,
  type NatalPoints,
} from '../../lib/futureCalendar';
import { loadPersonalForecast, type PersonalForecastClientResult } from '../../services/personalForecastService';
import { reportClientError } from '../../services/clientErrorReport';
import { PremiumHook } from '../premium/PremiumHook';
import { ForecastSectionBlock } from './ForecastSectionBlock';
import { isRenderableTodaySection } from './editorialLayout';
import { loadExploreCharts, peekExploreCharts } from './exploreCharts';
import { buildMonthTeaser, buildWeekTeaser } from '../../lib/futurePeriodTeaser';

export type FuturePeriodTeasers = { week: string[]; month: string[] };

type FutureViewProps = {
  profile: UserProfile;
  premium: boolean;
  /** Days ahead NEBO+ opens, by the bought plan (30, 90 or 365). */
  horizonDays: number;
  /** Today in the person's timezone, YYYY-MM-DD. */
  todayKey: string;
  onRequestPremium: () => void;
  /** Last day of the current week, YYYY-MM-DD: the range of the week card. */
  weekEndKey: string;
  language?: 'ru' | 'en';
  /**
   * The week and month reading cards, shown first. They get opening lines built
   * from the person's calendar (null until the calendar is calculated).
   */
  renderPeriodCards?: (teasers: FuturePeriodTeasers | null) => ReactNode;
  /** Month to open first, YYYY-MM (e.g. the birthday month); kept within the open range. */
  initialMonthKey?: string;
};

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTHS_IN_RU = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MOON_MARK: Record<string, string> = { new: '●', first: '◐', full: '○', last: '◑' };

/** Title, the first two sentences of the day text and its closing thought. */
function briefDayReading(sections: ForecastSection[], locked: ReadonlySet<string>): { title: string; text: string; closing: string } {
  const open = sections.filter((section) => !locked.has(section.id));
  const main = open[0];
  const prose = (main?.contentBlocks ?? []).filter((block) => block.role !== 'action').map((block) => block.text.trim()).filter(Boolean).join(' ')
    || main?.text || '';
  const sentences = prose.match(/[^.!?…]+[.!?…]+(?:\s|$)/gu) ?? [prose];
  const closingBlock = open.flatMap((section) => section.contentBlocks).reverse().find((block) => block.role === 'action');
  return {
    title: main?.title?.trim() ?? '',
    text: sentences.slice(0, 2).join(' ').replace(/\s+/gu, ' ').trim(),
    closing: closingBlock?.text.trim() ?? '',
  };
}

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

export function FutureView({ profile, premium, horizonDays, todayKey, onRequestPremium, weekEndKey, language = 'ru', renderPeriodCards, initialMonthKey }: FutureViewProps) {
  const timezone = profile.birthTimezone || 'Europe/Moscow';
  const [todayYear, todayMonth] = todayKey.split('-').map(Number);
  const [cursor, setCursor] = useState(() => {
    const lastKey = addDays(todayKey, premium ? horizonDays : 30).slice(0, 7);
    const wanted = initialMonthKey && initialMonthKey > todayKey.slice(0, 7)
      ? (initialMonthKey < lastKey ? initialMonthKey : lastKey)
      : todayKey.slice(0, 7);
    return { year: Number(wanted.slice(0, 4)), month: Number(wanted.slice(5, 7)) };
  });
  const [engine, setEngine] = useState<typeof import('astronomy-engine') | null>(null);
  const [natal, setNatal] = useState<NatalPoints | null>(() => natalPointsFromChart(
    peekExploreCharts(String(profile.id || 'guest'))?.find((chart) => chart.is_primary)?.chart_data ?? null,
  ));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [goal, setGoal] = useState<DayGoal | null>(null);
  /** «Будущее» shows a short version first; the full reading opens on request. */
  const [fullReading, setFullReading] = useState(false);
  // `onRequest`: the day has no saved reading yet and waits for the person's tap.
  const [dayReading, setDayReading] = useState<{ dayKey: string; result: PersonalForecastClientResult | null; loading: boolean; error: boolean; onRequest?: boolean; checking?: boolean } | null>(null);

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

  const teasers: FuturePeriodTeasers | null = useMemo(() => {
    if (!engine) return null;
    const current = buildFutureMonth(engine, todayYear, todayMonth, natal, timezone);
    const days = weekEndKey.slice(0, 7) === todayKey.slice(0, 7)
      ? current.days
      : [...current.days, ...buildFutureMonth(engine, Number(weekEndKey.slice(0, 4)), Number(weekEndKey.slice(5, 7)), natal, timezone).days];
    const monthEnd = current.days[current.days.length - 1].dayKey;
    return {
      week: buildWeekTeaser({ days, fromKey: todayKey, toKey: weekEndKey, hasNatal: Boolean(natal), language }),
      month: buildMonthTeaser({ days: current.days, fromKey: todayKey, toKey: monthEnd, hasNatal: Boolean(natal), language, month: todayMonth }),
    };
  }, [engine, language, natal, timezone, todayKey, todayMonth, todayYear, weekEndKey]);

  const shift = (step: number) => {
    setSelectedKey(null);
    setGoal(null);
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

  /**
   * Generates the day reading once and stores it on the server, so the next
   * visit is an instant cache hit. A failure is retried quietly before the
   * person ever sees a retry button.
   */
  const openReading = (dayKey: string) => {
    setDayReading({ dayKey, result: null, loading: true, error: false });
    const attempt = (left: number, delayMs: number): void => {
      void loadPersonalForecast({ profile, period: 'day', periodKey: dayKey })
        .then((result) => setDayReading((current) => (current?.dayKey === dayKey ? { dayKey, result, loading: false, error: false } : current)))
        .catch((error) => {
          if (left > 0) {
            window.setTimeout(() => attempt(left - 1, delayMs * 2), delayMs);
            return;
          }
          reportClientError('future-day', error, dayKey);
          setDayReading((current) => (current?.dayKey === dayKey ? { dayKey, result: null, loading: false, error: true } : current));
        });
    };
    attempt(2, 2_500);
  };

  /**
   * The nearest days are prepared in advance and open by themselves. Later days
   * open from the saved reading when there is one; otherwise they are generated
   * only on the person's tap, so nobody pays for days nobody reads.
   */
  const showReading = (dayKey: string) => {
    if (daysBetween(todayKey, dayKey) < (premium ? PERSONAL_FORECAST_ROLLING_DAY_COUNT : FREE_OPEN_DAYS)) {
      openReading(dayKey);
      return;
    }
    setDayReading({ dayKey, result: null, loading: true, error: false, checking: true });
    void loadPersonalForecast({ profile, period: 'day', periodKey: dayKey, options: { cacheOnly: true } })
      .then((result) => setDayReading((current) => (current?.dayKey === dayKey ? { dayKey, result, loading: false, error: false } : current)))
      .catch(() => setDayReading((current) => (current?.dayKey === dayKey ? { dayKey, result: null, loading: false, error: false, onRequest: true } : current)));
  };

  useEffect(() => {
    setFullReading(false);
    if (!selectedKey || dayAccess(selectedKey) !== 'open') return;
    if (dayReading?.dayKey === selectedKey) return;
    showReading(selectedKey);
    // Re-run only when the selected day changes; reselecting keeps the loaded reading.
  }, [selectedKey]);

  if (!month) {
    return (
      <div className="future-view">
        {renderPeriodCards?.(null)}
        <p className="future-status" role="status">Считаем твой календарь…</p>
      </div>
    );
  }

  const leading = month.days[0].weekday;
  const selected = selectedKey ? month.days.find((day) => day.dayKey === selectedKey) ?? null : null;
  const visiblePersonal = month.personalEvents.filter((event) => event.dayKey >= todayKey);
  const showPersonal = premium || !natal;
  const monthIn = MONTHS_IN_RU[cursor.month - 1];
  const important = [...(showPersonal ? month.personalEvents : []), ...month.skyEvents]
    .filter((event) => event.dayKey >= todayKey || !isCurrentMonth)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  const picks = goal && natal ? pickDays(month, goal, todayKey) : [];
  const pickedKeys = new Set(showPersonal ? picks.map((pick) => pick.dayKey) : []);
  const upcomingDays = month.days.filter((day) => day.dayKey >= todayKey);
  const bestDays = upcomingDays.filter((day) => day.tone === 'good').map((day) => day.day);
  const cautionDays = upcomingDays.filter((day) => day.tone === 'hard').map((day) => day.day);

  const renderDay = (day: CalendarDay) => {
    const past = day.dayKey < todayKey;
    const classes = [
      'future-day',
      pickedKeys.has(day.dayKey) ? 'is-picked' : '',
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
        onClick={() => { setSelectedKey(day.dayKey); }}
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
          : 'Бесплатно: сегодня и завтра. Дальше, с NEBO+'}
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

      {showPersonal && natal && (bestDays.length || cautionDays.length) ? (
        <p className="future-best">
          {bestDays.length ? <span><b>Лучшие дни:</b> {bestDays.join(', ')}</span> : null}
          {cautionDays.length ? <span><b>Осторожно:</b> {cautionDays.join(', ')}</span> : null}
        </p>
      ) : null}

      {/* Calendar first (mockup v1), then the week and month readings. */}
      {renderPeriodCards?.(teasers)}

      {natal ? (
        <section className="future-planner" aria-labelledby="future-planner-title">
          <h3 id="future-planner-title">Подобрать день</h3>
          <div className="future-goals" role="group" aria-label="Цель">
            {DAY_GOALS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={goal === item.id}
                className={goal === item.id ? 'is-active' : undefined}
                onClick={() => setGoal((current) => (current === item.id ? null : item.id))}
              >
                {item.label}
              </button>
            ))}
          </div>
          {goal ? (
            !picks.length ? (
              <p className="future-status">В {monthIn} подходящих дней не нашлось, загляни в следующий месяц.</p>
            ) : showPersonal ? (
              <ul className="future-picks">
                {picks.map((pick) => (
                  <li key={pick.dayKey}>
                    <button type="button" onClick={() => { setSelectedKey(pick.dayKey); }}>
                      <b>{formatDayRu(pick.dayKey)}</b>
                      <span>{pick.reason}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" className="future-read is-locked" onClick={onRequestPremium}>
                <LockKeyhole size={15} aria-hidden="true" />
                {`Подходящих дней: ${picks.length}. Даты, в NEBO+`}
              </button>
            )
          ) : null}
        </section>
      ) : null}

      {selected ? (
        <section className="future-day-sheet" aria-live="polite">
          <div className="future-day-hero">
            <p>{selected.dayKey === todayKey ? 'Сегодня' : selected.dayKey === addDays(todayKey, 1) ? 'Завтра' : new Date(`${selected.dayKey}T12:00:00Z`).toLocaleDateString('ru-RU', { weekday: 'long', timeZone: 'UTC' })}</p>
            <h3>{formatDayRu(selected.dayKey)}</h3>
            {showPersonal && selected.personal[0] ? <span>{selected.personal[0].body}.</span> : null}
            {!showPersonal && selected.personal.length ? <span>В этот день у тебя личное событие. Что оно значит, в NEBO+.</span> : null}
            {!selected.personal.length && selected.sky[0] ? <span>{selected.sky[0].body}.</span> : null}
            {!selected.personal.length && !selected.sky.length ? <span>Спокойный день без особых событий на небе.</span> : null}
          </div>
          <div className="future-chips">
            {showPersonal ? selected.personal.map((event) => <span key={`${event.planet}-${event.point}-${event.aspect}`} className={`future-chip is-${event.tone}`}>{event.headline}</span>) : null}
            {selected.sky.map((event) => <span key={event.headline} className="future-chip">{event.headline}</span>)}
            {selected.mercuryRetrograde && !selected.sky.some((event) => event.kind === 'mercury-start') ? <span className="future-chip">Меркурий идёт назад</span> : null}
            <span className="future-chip">Луна в {selected.moonSignIn}</span>
          </div>
          {access === 'open' ? (
            dayReading?.dayKey === selected.dayKey ? (
              dayReading.checking ? <p className="future-status" role="status">Открываем день…</p>
                : dayReading.loading ? <p className="future-status" role="status">Готовим прогноз на {formatDayRu(selected.dayKey)}, обычно это до 20 секунд…</p>
                : dayReading.onRequest ? (
                  <button type="button" className="future-read" onClick={() => openReading(selected.dayKey)}>Узнать прогноз на {formatDayRu(selected.dayKey)}</button>
                ) : dayReading.error || !dayReading.result ? (
                  <>
                    <p className="future-status">Не получилось подготовить прогноз. Проверь соединение, если включён VPN, выключи его, и попробуй ещё раз.</p>
                    <button type="button" className="future-read" onClick={() => openReading(selected.dayKey)}>Повторить</button>
                  </>
                ) : (() => {
                  // The day text lives in `overview`; sections only add to it. Same filter as Today.
                  const locked = new Set(dayReading.result.lockedSectionIds);
                  const sections = [dayReading.result.forecast.overview, ...dayReading.result.forecast.sections]
                    .filter((section) => section && isRenderableTodaySection(section, locked));
                  if (sections.length && !fullReading) {
                    const brief = briefDayReading(sections, locked);
                    return (
                      <article className="future-brief" lang="ru">
                        {brief.title ? <h4>{brief.title}</h4> : null}
                        <p>{brief.text}</p>
                        {brief.closing ? <p className="future-brief-closing">{brief.closing}</p> : null}
                        <button type="button" className="future-more" onClick={() => setFullReading(true)}>Читать полностью</button>
                      </article>
                    );
                  }
                  return sections.length ? (
                    <article className="future-reading forecast-feed-story forecast-editorial-reading forecast-period-editorial-feed" lang="ru">
                      {sections.map((section) => (
                        <ForecastSectionBlock
                          key={section.id}
                          section={section}
                          period="day"
                          language="ru"
                          locked={locked.has(section.id)}
                          onRequestPremium={onRequestPremium}
                        />
                      ))}
                    </article>
                  ) : (
                    <>
                      <p className="future-status">Прогноз на этот день ещё готовится. Загляни через минуту.</p>
                      <button type="button" className="future-read" onClick={() => openReading(selected.dayKey)}>Проверить ещё раз</button>
                    </>
                  );
                })()
            ) : <p className="future-status" role="status">Готовим прогноз на {formatDayRu(selected.dayKey)}…</p>
          ) : access === 'locked' ? (
            <button type="button" className="future-read is-locked" onClick={onRequestPremium}><LockKeyhole size={15} aria-hidden="true" />Прогноз на этот день, в NEBO+</button>
          ) : access === 'events-only' ? (
            <p className="future-status">По дням открыт ближайший месяц. Этот день войдёт в него ближе к дате, а пока смотри главное месяца ниже.</p>
          ) : null}
        </section>
      ) : (
        <p className="future-hint">Нажми на день, покажем, чем он будет для тебя.</p>
      )}

      {!premium && natal && visiblePersonal.length ? (
        <PremiumHook
          title={`В ${monthIn} ${visiblePersonal.length} ${importantDaysWord(visiblePersonal.length)} для тебя`}
          items={visiblePersonal.slice(0, 4).map((event) => `${formatDayRu(event.dayKey)} - ${event.headline}`)}
          cta="Открыть своё будущее"
          note={`С NEBO+ каждый день на месяц вперёд и главное по месяцам, до года`}
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
              onClick={() => { setSelectedKey(event.dayKey); }}
            >
              <span className="future-event-date"><b>{Number(event.dayKey.slice(8))}</b>{WEEKDAYS[(new Date(`${event.dayKey}T12:00:00Z`).getUTCDay() + 6) % 7]}</span>
              <span className="future-event-copy">
                <strong className="future-event-headline">
                  <span>{event.headline}</span>
                  {'tone' in event ? <>{' '}<em className={`future-tag is-${event.tone}`}>лично</em></> : null}
                </strong>
                <small>{event.body}</small>
              </span>
            </button>
          ))}
        </section>
      ) : null}

    </div>
  );
}
