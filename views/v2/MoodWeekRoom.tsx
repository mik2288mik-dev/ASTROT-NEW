import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Check, Lock } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { VideoBackground } from '../../components/lumia-ui/VideoBackground';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  buildMoodReport,
  DEFAULT_REMINDER_TIMES,
  isMoodWeekFinished,
  MOOD_LEVELS,
  MOOD_SLOT_LABELS,
  MOOD_SLOTS,
  MOOD_WEEK_DAYS,
  moodWeekDayNumber,
  slotForHour,
  validReminderTimes,
  weekDayKeys,
  type MoodCheckin,
  type MoodSlot,
  type MoodWeek,
} from '../../lib/moodWeek';
import { buildFutureMonth, natalPointsFromChart, type NatalPoints } from '../../lib/futureCalendar';
import { localDayKey } from '../../lib/upcomingSky';
import { loadFeatureState, peekFeatureState, saveFeatureState } from '../../services/featureStateService';
import { nativeNotificationsAvailable, setNativeMoodWeek } from '../../services/nativeNotifications';
import { loadExploreCharts, peekExploreCharts } from '../../components/PersonalForecastFeed/exploreCharts';

const REMINDER_OPTIONS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

let moodEngine: Promise<typeof import('astronomy-engine')> | null = null;

function asWeek(value: unknown): MoodWeek | null {
  const week = value as MoodWeek | null;
  return week && typeof week.startDayKey === 'string' && Array.isArray(week.reminderTimes) && week.checkins && typeof week.checkins === 'object' ? week : null;
}

type MoodWeekRoomProps = { profile: UserProfile; onBack: () => void };

/** «Неделя настроения»: four five-second check-ins a day for a week, then an honest report. */
export function MoodWeekRoom({ profile, onBack }: MoodWeekRoomProps) {
  const ru = profile.language !== 'en';
  const language: 'ru' | 'en' = ru ? 'ru' : 'en';
  const userId = String(profile.id || 'guest');
  const timezone = profile.birthTimezone || 'Europe/Moscow';
  const [items, setItems] = useState<Record<string, unknown>>(() => peekFeatureState(userId, 'mood_week'));
  const [times, setTimes] = useState<[string, string]>(DEFAULT_REMINDER_TIMES);
  const [reminderState, setReminderState] = useState<'scheduled' | 'off' | 'unavailable' | null>(null);
  const [engine, setEngine] = useState<typeof import('astronomy-engine') | null>(null);
  const [natal, setNatal] = useState<NatalPoints | null>(
    () => natalPointsFromChart(peekExploreCharts(userId)?.find((chart) => chart.is_primary)?.chart_data ?? null),
  );
  const [openReport, setOpenReport] = useState<string | null>(null);
  const now = new Date();
  const todayKey = localDayKey(now, timezone);
  const currentSlot = slotForHour(Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: timezone }).format(now)) % 24);

  useEffect(() => {
    let active = true;
    void loadFeatureState(userId, 'mood_week').then((loaded) => { if (active) setItems(loaded); });
    void loadExploreCharts(userId).then((charts) => {
      if (active) setNatal(natalPointsFromChart(charts.find((chart) => chart.is_primary)?.chart_data ?? null));
    });
    moodEngine ??= import('astronomy-engine');
    void moodEngine.then((loaded) => { if (active) setEngine(loaded); }).catch(() => { moodEngine = null; });
    return () => { active = false; };
  }, [userId]);

  const weeks = useMemo(
    () => Object.entries(items)
      .filter(([key]) => key.startsWith('week:'))
      .map(([, value]) => asWeek(value))
      .filter((week): week is MoodWeek => Boolean(week))
      .sort((a, b) => b.startDayKey.localeCompare(a.startDayKey)),
    [items],
  );
  const latest = weeks[0] ?? null;
  const activeWeek = latest && !isMoodWeekFinished(latest, todayKey) ? latest : null;
  const finishedWeeks = weeks.filter((week) => isMoodWeekFinished(week, todayKey));

  const saveWeek = useCallback((week: MoodWeek) => {
    const key = `week:${week.startDayKey}`;
    setItems((previous) => ({ ...previous, [key]: week }));
    void saveFeatureState(userId, 'mood_week', key, week);
  }, [userId]);

  const dayContext = useCallback((week: MoodWeek) => {
    if (!engine) return {};
    const months = new Map<string, ReturnType<typeof buildFutureMonth>>();
    return Object.fromEntries(weekDayKeys(week).map((dayKey) => {
      const monthKey = dayKey.slice(0, 7);
      if (natal && !months.has(monthKey)) months.set(monthKey, buildFutureMonth(engine, Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)), natal, timezone));
      const tone = natal ? months.get(monthKey)?.days.find((day) => day.dayKey === dayKey)?.tone ?? null : null;
      const moonAngle = engine.MoonPhase(new Date(`${dayKey}T12:00:00Z`));
      return [dayKey, { tone, moonAngle }];
    }));
  }, [engine, natal, timezone]);

  const reportWeek = openReport ? weeks.find((week) => week.startDayKey === openReport) ?? null : null;
  const report = useMemo(
    () => (reportWeek ? buildMoodReport(reportWeek, dayContext(reportWeek), language) : null),
    [dayContext, language, reportWeek],
  );

  useEffect(() => {
    if (reportWeek && !reportWeek.reportSeenAt) saveWeek({ ...reportWeek, reportSeenAt: new Date().toISOString() });
  }, [reportWeek, saveWeek]);

  useEffect(() => {
    document.querySelector('.mood-room')?.closest('.lumia-main-scroll')?.scrollTo({ top: 0 });
  }, [openReport]);

  const startWeek = async () => {
    lumiaSelectionHaptic();
    if (!validReminderTimes(times)) return;
    const week: MoodWeek = { startDayKey: todayKey, reminderTimes: times, checkins: {} };
    saveWeek(week);
    setReminderState(await setNativeMoodWeek(userId, { startDayKey: week.startDayKey, reminderTimes: week.reminderTimes }));
  };

  const stopWeek = async () => {
    if (!activeWeek) return;
    const key = `week:${activeWeek.startDayKey}`;
    setItems((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    void saveFeatureState(userId, 'mood_week', key, null);
    void setNativeMoodWeek(userId, null);
  };

  const mark = (week: MoodWeek, dayKey: string, slot: MoodSlot, patch: Partial<MoodCheckin>) => {
    lumiaSelectionHaptic();
    const previous = week.checkins[dayKey]?.[slot];
    const entry = { mood: previous?.mood ?? 0, power: previous?.power ?? 0, ...patch, at: new Date().toISOString() };
    saveWeek({ ...week, checkins: { ...week.checkins, [dayKey]: { ...week.checkins[dayKey], [slot]: entry } } });
  };

  const dateLabel = (dayKey: string) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${dayKey}T12:00:00Z`));
  const weekdayShort = (dayKey: string) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-US', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${dayKey}T12:00:00Z`));

  if (reportWeek && report) {
    return (
      <div className="fresh-page mood-room">
        <AppTopBar title={ru ? 'Отчёт недели' : 'Week report'} onBack={() => setOpenReport(null)} />
        <article className="mood-report">
          <p className="mood-kicker">{`${dateLabel(reportWeek.startDayKey)} — ${dateLabel(weekDayKeys(reportWeek)[MOOD_WEEK_DAYS - 1])}`}</p>
          <h1 className="mood-title">{ru ? 'Твоя неделя настроения' : 'Your mood week'}</h1>
          <p className="mood-summary">{report.summary}</p>
          {report.average ? (
            <>
              <section className="mood-chart" aria-label={ru ? 'Настроение по дням' : 'Mood by day'}>
                <h2>{ru ? 'По дням' : 'By day'}</h2>
                <div className="mood-bars">
                  {report.days.map((day) => (
                    <div key={day.dayKey} className={`mood-bar${day.dayKey === report.bestDay ? ' is-best' : ''}${day.dayKey === report.worstDay ? ' is-worst' : ''}`}>
                      <span className="mood-bar-track">
                        <span className="mood-bar-mood" style={{ height: `${((day.mood ?? 0) / 5) * 100}%` }} />
                        <span className="mood-bar-power" style={{ height: `${((day.power ?? 0) / 5) * 100}%` }} />
                      </span>
                      <small>{weekdayShort(day.dayKey)}</small>
                    </div>
                  ))}
                </div>
                <p className="mood-legend"><i className="is-mood" />{ru ? 'настроение' : 'mood'}<i className="is-power" />{ru ? 'силы' : 'strength'}</p>
              </section>
              <section className="mood-chart" aria-label={ru ? 'По времени суток' : 'By time of day'}>
                <h2>{ru ? 'По времени суток' : 'By time of day'}</h2>
                <ul className="mood-slots-report">
                  {report.slots.map((slot) => (
                    <li key={slot.slot}>
                      <span>{MOOD_SLOT_LABELS[slot.slot][language]}</span>
                      <span className="mood-line-track"><span style={{ width: `${((slot.mood ?? 0) / 5) * 100}%` }} /></span>
                      <b>{slot.mood === null ? '—' : String(slot.mood).replace('.', ru ? ',' : '.')}</b>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="mood-insight">
                <h2>{ru ? 'И прогноз' : 'And the forecast'}</h2>
                <p>{report.forecastLine}</p>
                {report.moonLine ? (
                  <>
                    <h2>{ru ? 'И Луна' : 'And the Moon'}</h2>
                    <p>{report.moonLine}</p>
                  </>
                ) : null}
              </section>
            </>
          ) : null}
          <p className="mood-private"><Lock size={14} aria-hidden="true" />{ru ? 'Отчёт видишь только ты. Он сохранён в профиле.' : 'Only you can see this report. It is saved in your profile.'}</p>
          <button type="button" className="mood-primary" onClick={() => setOpenReport(null)}>{ru ? 'Готово' : 'Done'}</button>
        </article>
      </div>
    );
  }

  if (activeWeek) {
    const dayNumber = moodWeekDayNumber(activeWeek, todayKey) ?? 1;
    const today = activeWeek.checkins[todayKey] ?? {};
    return (
      <div className="fresh-page mood-room">
        <AppTopBar title={ru ? 'Неделя настроения' : 'Mood week'} onBack={onBack} />
        <section className="mood-active">
          <p className="mood-kicker">{ru ? `День ${dayNumber} из ${MOOD_WEEK_DAYS}` : `Day ${dayNumber} of ${MOOD_WEEK_DAYS}`}</p>
          <h1 className="mood-title">{ru ? 'Как ты сейчас?' : 'How are you now?'}</h1>
          <div className="mood-days" aria-label={ru ? 'Дни недели' : 'Days of the week'}>
            {weekDayKeys(activeWeek).map((dayKey) => {
              const count = Object.values(activeWeek.checkins[dayKey] ?? {}).filter((entry) => entry && entry.mood && entry.power).length;
              return (
                <span key={dayKey} className={`mood-day${dayKey === todayKey ? ' is-today' : ''}${dayKey > todayKey ? ' is-future' : ''}`}>
                  <small>{weekdayShort(dayKey)}</small>
                  <b>{count}/4</b>
                </span>
              );
            })}
          </div>
          <div className="mood-slots">
            {MOOD_SLOTS.map((slot) => {
              const entry = today[slot];
              const done = Boolean(entry?.mood && entry?.power);
              const ahead = MOOD_SLOTS.indexOf(slot) > MOOD_SLOTS.indexOf(currentSlot);
              return (
                <section key={slot} className={`mood-slot${slot === currentSlot ? ' is-current' : ''}${done ? ' is-done' : ''}`} aria-label={MOOD_SLOT_LABELS[slot][language]}>
                  <header>
                    <strong>{MOOD_SLOT_LABELS[slot][language]}</strong>
                    <small>{done ? <><Check size={14} aria-hidden="true" />{ru ? 'отмечено' : 'done'}</> : MOOD_SLOT_LABELS[slot].hint[language]}</small>
                  </header>
                  {ahead && !done ? (
                    <p className="mood-slot-later">{ru ? 'Отметка откроется позже' : 'Opens later'}</p>
                  ) : (
                    (['mood', 'power'] as const).map((scale) => (
                      <div key={scale} className="mood-scale" role="radiogroup" aria-label={scale === 'mood' ? (ru ? 'Настроение' : 'Mood') : (ru ? 'Силы' : 'Strength')}>
                        <span className="mood-scale-label">{scale === 'mood' ? (ru ? 'Настроение' : 'Mood') : (ru ? 'Силы' : 'Strength')}</span>
                        <div className="mood-scale-options">
                          {MOOD_LEVELS[scale][language].map((label, index) => (
                            <button
                              key={label}
                              type="button"
                              role="radio"
                              aria-checked={entry?.[scale] === index + 1}
                              className={`mood-scale-option is-${index + 1}${entry?.[scale] === index + 1 ? ' is-chosen' : ''}`}
                              onClick={() => mark(activeWeek, todayKey, slot, { [scale]: index + 1 })}
                            >
                              <span className="mood-scale-dot" aria-hidden="true">{index + 1}</span>
                              <small>{label}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </section>
              );
            })}
          </div>
          <p className="mood-note">
            <BellRing size={14} aria-hidden="true" />
            {nativeNotificationsAvailable()
              ? (ru ? `Напомним в ${activeWeek.reminderTimes[0]} и ${activeWeek.reminderTimes[1]}. В эти дни они заменяют обычные уведомления.` : `Reminders at ${activeWeek.reminderTimes[0]} and ${activeWeek.reminderTimes[1]}. They replace the usual notifications these days.`)
              : (ru ? 'Напоминания приходят в Android-приложении. Здесь — просто заглядывай пару раз в день.' : 'Reminders come in the Android app. Here, just drop by a couple of times a day.')}
          </p>
          {reminderState === 'off' ? <p className="mood-note">{ru ? 'Уведомления выключены — включи их в настройках, чтобы получать напоминания.' : 'Notifications are off — turn them on in settings to get reminders.'}</p> : null}
          <button type="button" className="mood-link" onClick={() => { void stopWeek(); }}>{ru ? 'Прервать неделю' : 'Stop the week'}</button>
        </section>
      </div>
    );
  }

  return (
    <div className="fresh-page mood-room">
      <AppTopBar title={ru ? 'Неделя настроения' : 'Mood week'} onBack={onBack} />
      {finishedWeeks[0] && !finishedWeeks[0].reportSeenAt ? (
        <button type="button" className="mood-ready" onClick={() => setOpenReport(finishedWeeks[0].startDayKey)}>
          <strong>{ru ? 'Твой отчёт готов' : 'Your report is ready'}</strong>
          <span>{ru ? 'Пики и спады недели, время суток, прогноз и Луна' : 'Peaks and dips, time of day, the forecast and the Moon'}</span>
        </button>
      ) : null}
      <section className="mood-intro">
        <div className="mood-hero video-hero">
          <VideoBackground id="mood-week" />
          <h1 className="mood-title">{ru ? 'Неделя, чтобы понять себя' : 'A week to understand yourself'}</h1>
          <p>{ru
            ? 'Семь дней по четыре отметки: утром, днём, вечером и перед сном. Настроение и силы — две кнопки, пять секунд. Через неделю покажем, когда тебе лучше и труднее, и честно сравним с прогнозом и Луной.'
            : 'Seven days, four check-ins: morning, day, evening and before bed. Mood and strength — two taps, five seconds. After a week we show when you feel better or worse and compare honestly with the forecast and the Moon.'}</p>
        </div>
        <fieldset className="mood-times">
          <legend>{ru ? 'Когда напоминать' : 'When to remind'}</legend>
          {[0, 1].map((index) => (
            <label key={index}>
              <span>{index === 0 ? (ru ? 'Первое' : 'First') : (ru ? 'Второе' : 'Second')}</span>
              <select
                value={times[index]}
                onChange={(event) => setTimes((current) => (index === 0 ? [event.target.value, current[1]] : [current[0], event.target.value]))}
              >
                {REMINDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
          {!validReminderTimes(times) ? (
            <p className="mood-error" role="alert">{ru ? 'Между напоминаниями нужно хотя бы три часа, с 9:00 до 21:00.' : 'Reminders need at least three hours between them, 9:00–21:00.'}</p>
          ) : null}
          <p className="mood-note">{ru ? 'Два напоминания в день, и только в эти семь дней — вместо обычных уведомлений.' : 'Two reminders a day, only for these seven days — instead of the usual notifications.'}</p>
        </fieldset>
        <button type="button" className="mood-primary" disabled={!validReminderTimes(times)} onClick={() => { void startWeek(); }}>
          {ru ? 'Начать неделю' : 'Start the week'}
        </button>
      </section>
      {finishedWeeks.length ? (
        <section className="mood-history" aria-labelledby="mood-history-title">
          <h2 id="mood-history-title">{ru ? 'Мои отчёты' : 'My reports'}</h2>
          <ul>
            {finishedWeeks.map((week) => (
              <li key={week.startDayKey}>
                <button type="button" onClick={() => setOpenReport(week.startDayKey)}>
                  <span>{`${dateLabel(week.startDayKey)} — ${dateLabel(weekDayKeys(week)[MOOD_WEEK_DAYS - 1])}`}</span>
                  {!week.reportSeenAt ? <b>{ru ? 'новый' : 'new'}</b> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mood-private"><Lock size={14} aria-hidden="true" />{ru ? 'Отметки видишь только ты.' : 'Only you can see your check-ins.'}</p>
    </div>
  );
}
