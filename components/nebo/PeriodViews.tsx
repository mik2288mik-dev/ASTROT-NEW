import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Search, ChevronLeft, X } from 'lucide-react';
import type { UserProfile } from '../../types';
import { buildFutureMonth, natalPointsFromChart, type CalendarDay, type NatalPoints, type PersonalEvent, type SkyEvent } from '../../lib/futureCalendar';
import { buildLunarDays, phaseName, SIGNS_IN, type LunarDay } from '../../lib/lunarCalendar';
import { buildWeekTeaser } from '../../lib/futurePeriodTeaser';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { ZODIAC_KEYS } from '../../lib/zodiacKeys';
import {
  DATE_TOPIC_GROUPS, capitalize, findTopic, goodDayCount, rankDays, scoreDays, whyBad, whyGood, type ScoredDay,
} from '../../lib/goodDates';
import { loadExploreCharts, peekExploreCharts } from '../PersonalForecastFeed/exploreCharts';

let engineModule: Promise<typeof import('astronomy-engine')> | null = null;

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const WEEKDAYS_GENITIVE = ['понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы', 'воскресенья'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const keyOf = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (key: string, days: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return keyOf(d); };
const dayNum = (key: string) => Number(key.slice(8, 10));
const monthIdx = (key: string) => Number(key.slice(5, 7)) - 1;
const weekdayOf = (key: string) => (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7;
const dayTitle = (key: string) => `${WEEKDAYS_FULL[weekdayOf(key)]}, ${dayNum(key)} ${MONTHS_GEN[monthIdx(key)]}`;

type PeriodData = {
  /** Calendar days (personal and sky events) from the Monday of this week, 35 days. */
  calendar: CalendarDay[];
  lunar: LunarDay[];
  hasNatal: boolean;
  sunSign: number | null;
  startKey: string;
};

/** Everything the Week, Month and Dates screens need, calculated on the device. */
function usePeriodData(profile: UserProfile, todayKey: string): PeriodData | null {
  const userId = String(profile.id || 'guest');
  const [engine, setEngine] = useState<typeof import('astronomy-engine') | null>(null);
  const [natal, setNatal] = useState<NatalPoints | null>(() => natalPointsFromChart(peekExploreCharts(userId)?.find((chart) => chart.is_primary)?.chart_data ?? null));
  useEffect(() => {
    let active = true;
    engineModule ??= import('astronomy-engine');
    engineModule.then((loaded) => { if (active) setEngine(loaded); }).catch(() => { engineModule = null; });
    void loadExploreCharts(userId).then((charts) => { if (active) setNatal(natalPointsFromChart(charts.find((chart) => chart.is_primary)?.chart_data ?? null)); }).catch(() => undefined);
    return () => { active = false; };
  }, [userId]);

  return useMemo(() => {
    if (!engine) return null;
    const startKey = addDays(todayKey, -weekdayOf(todayKey));
    const endKey = addDays(startKey, 34);
    const months: CalendarDay[] = [];
    let y = Number(startKey.slice(0, 4));
    let m = Number(startKey.slice(5, 7));
    for (let guard = 0; guard < 3; guard += 1) {
      months.push(...buildFutureMonth(engine, y, m, natal, profile.birthTimezone || 'Europe/Moscow').days);
      if (`${y}-${String(m).padStart(2, '0')}` >= endKey.slice(0, 7)) break;
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    const calendar = months.filter((day) => day.dayKey >= startKey && day.dayKey <= endKey);
    const lunar = buildLunarDays(engine, new Date(`${startKey}T12:00:00Z`), 35);
    const sun = sunSignFromDate(profile.birthDate);
    const sunIndex = sun ? ZODIAC_KEYS.findIndex((key) => key.toLowerCase() === sun) : -1;
    return { calendar, lunar, hasNatal: Boolean(natal), sunSign: sunIndex >= 0 ? sunIndex : null, startKey };
  }, [engine, natal, profile.birthDate, profile.birthTimezone, todayKey]);
}

/** A day's ease on a -1.5…1.5 scale: transits to the chart, the Moon against the Sun's element, Mercury. */
function dayEase(day: CalendarDay | undefined, lunar: LunarDay | undefined, sunSign: number | null): number {
  let score = 0;
  for (const event of day?.personal ?? []) score += event.tone === 'good' ? 0.8 : -0.8;
  if (lunar && sunSign !== null) {
    if (lunar.sign % 4 === sunSign % 4) score += 0.35;
    else if ((lunar.sign - sunSign + 12) % 12 === 3 || (lunar.sign - sunSign + 12) % 12 === 9) score -= 0.35;
  }
  if (day?.mercuryRetrograde) score -= 0.2;
  if (day?.moonQuarter === 'full') score -= 0.25;
  return Math.max(-1.5, Math.min(1.5, score));
}

function MoodCurve({ values, labels, openCount, lockLabel, nowIndex }: { values: number[]; labels: string[]; openCount: number; lockLabel: string | null; nowIndex: number }) {
  const W = 326;
  const H = 112;
  const x = (i: number) => (values.length < 2 ? 0 : (i / (values.length - 1)) * W);
  const y = (v: number) => H / 2 - (v / 1.5) * (H / 2 - 8);
  const path = (from: number, to: number) => values.slice(from, to).map((v, i) => `${i ? 'L' : 'M'}${x(from + i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const open = Math.min(values.length, Math.max(1, openCount));
  return (
    <div className="nebo-curve">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="neboCurveLine" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2={H - 8}>
            <stop offset="0" stopColor="#16A34A" /><stop offset=".42" stopColor="#3B82F6" /><stop offset=".58" stopColor="#3B82F6" /><stop offset="1" stopColor="#EF4444" />
          </linearGradient>
        </defs>
        <path d={`M0 ${H / 2} H${W}`} stroke="rgba(118,118,128,.3)" strokeDasharray="3 4" />
        {open < values.length ? <path d={path(open - 1, values.length)} fill="none" stroke="rgba(118,118,128,.25)" strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" /> : null}
        <path d={path(0, open)} fill="none" stroke="url(#neboCurveLine)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {nowIndex >= 0 && nowIndex < open ? <span className="nebo-curve-now" style={{ left: `${(x(nowIndex) / W) * 100}%`, top: y(values[nowIndex]) }} /> : null}
      <span className="nebo-curve-hi">легче</span>
      <span className="nebo-curve-lo">острее</span>
      <div className="nebo-curve-ticks">{labels.map((label, i) => <span key={`${label}${i}`}>{label}</span>)}</div>
      {lockLabel ? <span className="nebo-curve-lock"><Lock size={11} aria-hidden /> {lockLabel}</span> : null}
    </div>
  );
}

const ELEMENT_ICON = ['energy', 'work', 'talk', 'calm'];

/** Picture and short title of a day: the strongest event, otherwise the Moon's sign. */
function dayFace(day: CalendarDay | undefined, lunar: LunarDay | undefined): { icon: string; title: string } {
  const sky = day?.sky.find((event) => event.kind === 'mercury-start') ?? day?.sky[0];
  const personal = day?.personal[0];
  if (sky?.kind === 'mercury-start') return { icon: 'retro', title: 'Меркурий разворачивается назад' };
  if (sky?.kind === 'eclipse') return { icon: 'careful', title: sky.headline };
  if (sky?.quarter === 'new') return { icon: 'newmoon', title: 'Новолуние: время загадывать' };
  if (sky?.quarter === 'full') return { icon: 'fullmoon', title: 'Полнолуние: эмоции ярче' };
  if (personal) {
    const icon = personal.planet === 'Venus' ? 'love' : personal.planet === 'Jupiter' ? (personal.tone === 'good' ? 'gift' : 'careful') : personal.planet === 'Mars' ? (personal.tone === 'good' ? 'energy' : 'careful') : personal.planet === 'Saturn' ? 'work' : 'start';
    return { icon, title: personal.headline };
  }
  if (day?.mercuryRetrograde) return { icon: 'talk', title: 'Переписки и звонки' };
  const sign = lunar?.sign ?? 0;
  const SIGN_TITLES = ['Хочется действовать', 'Спокойный, надёжный день', 'Много разговоров', 'День дома и близких', 'Хочется внимания', 'День порядка и мелочей', 'Легко договориться', 'Эмоции острее обычного', 'Тянет к новому', 'День серьёзных дел', 'День идей и друзей', 'Мягкий день, больше чувств'];
  return { icon: ELEMENT_ICON[sign % 4], title: SIGN_TITLES[sign] };
}

// ─────────────────────────── Неделя ───────────────────────────

export function WeekView({ profile, todayKey, premium, onRequestPremium, onReadWeek, onOpenDay }: {
  profile: UserProfile; todayKey: string; premium: boolean; onRequestPremium: () => void; onReadWeek: () => void; onOpenDay: () => void;
}) {
  const data = usePeriodData(profile, todayKey);
  if (!data) return <p className="nebo-period-loading" role="status">Считаем неделю…</p>;
  const week = data.calendar.slice(0, 7);
  const lunarWeek = data.lunar.slice(0, 7);
  const todayIndex = week.findIndex((day) => day.dayKey === todayKey);
  const retroStart = week.find((day) => day.sky.some((event) => event.kind === 'mercury-start'));
  const title = retroStart
    ? `Важные дела лучше успеть до ${WEEKDAYS_GENITIVE[weekdayOf(retroStart.dayKey)]}`
    : week.some((day) => day.tone === 'hard') && !week.some((day) => day.tone === 'good') ? 'Неделя требует терпения'
      : week.some((day) => day.tone === 'good') ? 'Неделя на твоей стороне' : 'Ровная неделя без резких поворотов';
  const lines = buildWeekTeaser({ days: week, fromKey: todayKey, toKey: week[6]?.dayKey ?? todayKey, hasNatal: data.hasNatal, language: 'ru' });
  const values = week.map((day, i) => dayEase(day, lunarWeek[i], data.sunSign));
  const openCount = premium ? 7 : Math.max(1, todayIndex + 1);
  const lockLabel = !premium && todayIndex < 6 ? `${WEEKDAYS[Math.min(6, todayIndex + 1)]} - вс в Plus` : null;

  return (
    <section className="nebo-period">
      <p className="nebo-period-kicker">{dayNum(week[0].dayKey)} - {dayNum(week[6].dayKey)} {MONTHS_GEN[monthIdx(week[6].dayKey)]}</p>
      <h1 className="nebo-period-title">{title}</h1>
      {lines.length ? <p className="nebo-period-text">{lines.join(' ')}</p> : null}
      <div className="nebo-period-card">
        <span className="nebo-tile-kicker">Настроение на неделе</span>
        <MoodCurve values={values} labels={WEEKDAYS} openCount={openCount} lockLabel={lockLabel} nowIndex={todayIndex} />
        <p className="nebo-period-note">{premium ? 'Выше линия: день легче. Ниже: острее, лучше без резких решений.' : 'Как пойдёт настроение дальше по неделе, видно в Plus.'}</p>
      </div>
      <div className="nebo-period-card is-list">
        {week.map((day, i) => {
          const state = day.dayKey < todayKey ? 'past' : day.dayKey === todayKey ? 'today' : 'future';
          const locked = state === 'future' && !premium;
          const face = dayFace(day, lunarWeek[i]);
          return (
            <button
              key={day.dayKey}
              type="button"
              className={`nebo-week-row is-${state}${locked ? ' is-locked' : ''}`}
              onClick={() => (state === 'today' ? onOpenDay() : locked ? onRequestPremium() : undefined)}
            >
              <span className="nebo-week-date"><small>{WEEKDAYS[i]}</small><b>{dayNum(day.dayKey)}</b></span>
              <img src={`/assets/day/${face.icon}.webp`} alt="" width={44} height={44} loading="lazy" />
              <span className="nebo-week-copy">
                <strong>{locked ? 'Откроется утром в 7:00' : face.title}</strong>
                <small>{state === 'today' ? 'сегодня' : state === 'past' ? 'прошёл' : locked ? 'в Plus видно заранее' : ''}</small>
              </span>
              {locked ? <Lock size={15} aria-hidden className="nebo-week-lock" /> : null}
            </button>
          );
        })}
      </div>
      <button type="button" className="nebo-period-cta" onClick={premium ? onReadWeek : onRequestPremium}>
        {premium ? 'Читать прогноз на неделю' : 'Открыть всю неделю с Plus'}
      </button>
    </section>
  );
}

// ─────────────────────────── Месяц ───────────────────────────

function MoonDot({ quarter }: { quarter: CalendarDay['moonQuarter'] }) {
  if (!quarter) return null;
  return <i className={`nebo-cal-moon is-${quarter}`} aria-hidden="true" />;
}

function eventText(event: PersonalEvent | SkyEvent): { title: string; body: string } {
  return { title: event.headline, body: event.body };
}

export function MonthView({ profile, todayKey, premium, onRequestPremium, onReadMonth }: {
  profile: UserProfile; todayKey: string; premium: boolean; onRequestPremium: () => void; onReadMonth: () => void;
}) {
  const data = usePeriodData(profile, todayKey);
  const [picked, setPicked] = useState<string | null>(null);
  if (!data) return <p className="nebo-period-loading" role="status">Считаем месяц…</p>;
  const days = data.calendar;
  const firstMonth = monthIdx(days[0].dayKey);
  const lastMonth = monthIdx(days[days.length - 1].dayKey);
  const weeks = [0, 1, 2, 3, 4].map((w) => {
    const slice = days.slice(w * 7, w * 7 + 7);
    const total = slice.reduce((sum, day, i) => sum + dayEase(day, data.lunar[w * 7 + i], data.sunSign), 0);
    return total / Math.max(1, slice.length);
  });
  const todayWeek = Math.floor(days.findIndex((day) => day.dayKey === todayKey) / 7);
  const labels = [0, 1, 2, 3, 4].map((w) => { const key = days[w * 7].dayKey; return w === 0 || monthIdx(key) !== monthIdx(days[(w - 1) * 7].dayKey) ? `${dayNum(key)} ${MONTHS_SHORT[monthIdx(key)]}` : String(dayNum(key)); });
  const events: Array<{ dayKey: string; title: string; body: string }> = [];
  for (const day of days) {
    if (day.dayKey < todayKey) continue;
    for (const event of [...day.sky, ...day.personal]) events.push({ dayKey: day.dayKey, ...eventText(event) });
  }
  const visibleEvents = premium ? events : events.slice(0, 3);
  const pickedDay = days.find((day) => day.dayKey === picked) ?? null;
  const pickedLunar = data.lunar.find((day) => day.dayKey === picked) ?? null;
  const pickedLocked = Boolean(pickedDay && !premium && pickedDay.dayKey > addDays(todayKey, 6));

  return (
    <section className="nebo-period">
      <p className="nebo-period-kicker">Следующие 5 недель</p>
      <h1 className="nebo-period-title">{MONTHS_NOM[firstMonth]}{lastMonth !== firstMonth ? ` - ${MONTHS_NOM[lastMonth].toLowerCase()}` : ''}</h1>
      <div className="nebo-period-card">
        <span className="nebo-tile-kicker">Настроение на 5 недель</span>
        <MoodCurve values={weeks} labels={labels} openCount={premium ? 5 : todayWeek + 1} lockLabel={premium ? null : 'дальше в Plus'} nowIndex={todayWeek} />
        <p className="nebo-period-note">{premium ? 'Видно, какие недели легче, а какие колючие.' : 'Какие дни дальше легче, а какие колючие, видно в Plus.'}</p>
      </div>
      <div className="nebo-period-card">
        <div className="nebo-cal-head" aria-hidden="true">{WEEKDAYS.map((name) => <span key={name}>{name}</span>)}</div>
        <div className="nebo-cal-grid">
          {days.map((day) => {
            const tone = day.tone === 'good' ? 'is-good' : day.mercuryRetrograde ? 'is-retro' : day.tone === 'hard' ? 'is-hard' : '';
            const locked = !premium && day.dayKey > addDays(todayKey, 6);
            return (
              <button
                key={day.dayKey}
                type="button"
                className={`nebo-cal-cell ${locked ? '' : tone}${day.dayKey === todayKey ? ' is-today' : ''}${day.dayKey < todayKey ? ' is-past' : ''}`}
                onClick={() => setPicked(day.dayKey)}
                aria-label={dayTitle(day.dayKey)}
              >
                {dayNum(day.dayKey)}
                <MoonDot quarter={day.moonQuarter} />
              </button>
            );
          })}
        </div>
        <div className="nebo-cal-legend"><span className="is-good">хорошие для тебя</span><span className="is-retro">Меркурий назад</span><span className="is-hard">напряжённые</span></div>
      </div>
      {visibleEvents.length ? (
        <div className="nebo-period-card is-list">
          {visibleEvents.map((event) => (
            <div key={`${event.dayKey}${event.title}`} className="nebo-month-event">
              <span className="nebo-week-date"><b>{dayNum(event.dayKey)}</b><small>{MONTHS_SHORT[monthIdx(event.dayKey)]}</small></span>
              <span className="nebo-week-copy"><strong>{event.title}</strong><small>{event.body}</small></span>
            </div>
          ))}
          {!premium && events.length > 3 ? <button type="button" className="nebo-period-more" onClick={onRequestPremium}>Ещё {events.length - 3} в Plus</button> : null}
        </div>
      ) : null}
      <button type="button" className="nebo-period-cta" onClick={premium ? onReadMonth : onRequestPremium}>
        {premium ? 'Читать прогноз на месяц' : 'Открыть весь месяц с Plus'}
      </button>

      {pickedDay ? (
        <div className="nebo-sheet-scrim" role="presentation" onClick={() => setPicked(null)}>
          <div className="nebo-day-pop" role="dialog" aria-modal="true" aria-label={dayTitle(pickedDay.dayKey)} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="nebo-day-pop-close" onClick={() => setPicked(null)} aria-label="Закрыть"><X size={18} aria-hidden /></button>
            <b className="nebo-day-pop-num">{dayNum(pickedDay.dayKey)}</b>
            <p className="nebo-day-pop-date">{MONTHS_GEN[monthIdx(pickedDay.dayKey)]}, {WEEKDAYS_FULL[weekdayOf(pickedDay.dayKey)].toLowerCase()}</p>
            {pickedLunar ? <h3>{phaseName(pickedLunar.phase)}</h3> : null}
            {pickedLocked ? (
              <>
                <p className="nebo-day-pop-text">Что этот день значит для тебя, видно с NEBO Plus.</p>
                <button type="button" className="nebo-period-cta" onClick={onRequestPremium}>Открыть с Plus</button>
              </>
            ) : (
              <>
                <dl className="nebo-day-pop-facts">
                  {pickedLunar ? <><dt>Луна</dt><dd>{SIGNS_IN[pickedLunar.sign]}, {pickedLunar.waxing ? 'растёт' : 'убывает'}</dd></> : null}
                  <dt>Меркурий</dt><dd>{pickedDay.mercuryRetrograde ? 'идёт назад: перепроверяй планы' : 'идёт вперёд'}</dd>
                  <dt>Для тебя</dt><dd>{pickedDay.tone === 'good' ? 'лёгкий день' : pickedDay.tone === 'hard' ? 'напряжённый день' : 'обычный день'}</dd>
                </dl>
                {[...pickedDay.sky, ...pickedDay.personal].map((event) => (
                  <p key={event.headline} className="nebo-day-pop-text"><b>{event.headline}.</b> {event.body}</p>
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ─────────────────────────── Даты ───────────────────────────

export function DatesView({ profile, todayKey, premium, onRequestPremium }: {
  profile: UserProfile; todayKey: string; premium: boolean; onRequestPremium: () => void;
}) {
  const data = usePeriodData(profile, todayKey);
  const [query, setQuery] = useState('');
  const [topicName, setTopicName] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  if (!data) return <p className="nebo-period-loading" role="status">Считаем даты…</p>;

  const topic = topicName ? findTopic(topicName) : null;
  if (topic) {
    const scored = scoreDays(topic, data.lunar, data.sunSign);
    const ranked = rankDays(scored, todayKey);
    const best = ranked[0] ?? null;
    const byKey = new Map(ranked.map((item) => [item.day.dayKey, item]));
    const picked: ScoredDay | null = pickedKey ? (byKey.get(pickedKey) ?? scored.find((item) => item.day.dayKey === pickedKey) ?? null) : null;
    const describe = (item: ScoredDay) => `${capitalize(whyGood(topic, item).join(', '))}. ${capitalize(topic.extra.give)}.`;
    return (
      <section className="nebo-period">
        <button type="button" className="nebo-dates-back" onClick={() => { setTopicName(null); setPickedKey(null); }}><ChevronLeft size={18} aria-hidden /> Все дела</button>
        <p className="nebo-dates-topic"><img src={`/assets/dates/${topic.sticker}.svg`} alt="" width={30} height={30} />{topic.name}</p>
        {best ? (
          <>
            <p className="nebo-period-kicker">Лучший день</p>
            <h1 className="nebo-period-title">{dayTitle(best.day.dayKey)}</h1>
            <p className="nebo-period-text">{describe(best)}</p>
          </>
        ) : (
          <>
            <h1 className="nebo-period-title">Хороших дней в ближайший месяц нет</h1>
            <p className="nebo-period-text">Если дело не ждёт, выбирай день без отметки «лучше не стоит» и перепроверяй детали.</p>
          </>
        )}
        <div className="nebo-period-card">
          <div className="nebo-cal-head" aria-hidden="true">{WEEKDAYS.map((name) => <span key={name}>{name}</span>)}</div>
          <div className="nebo-cal-grid">
            {scored.map((item) => {
              const rankedItem = byKey.get(item.day.dayKey);
              const cls = item.day.dayKey < todayKey ? 'is-past' : rankedItem?.category === 'best' ? 'is-best' : rankedItem ? 'is-good' : item.category === 'avoid' ? 'is-hard' : '';
              return (
                <button key={item.day.dayKey} type="button" className={`nebo-cal-cell ${cls}${item.day.dayKey === todayKey ? ' is-today' : ''}${pickedKey === item.day.dayKey ? ' is-picked' : ''}`} onClick={() => setPickedKey(item.day.dayKey)}>
                  {dayNum(item.day.dayKey)}
                </button>
              );
            })}
          </div>
          <div className="nebo-cal-legend"><span className="is-best">лучший</span><span className="is-good">хороший</span><span className="is-hard">лучше не стоит</span></div>
          {picked ? (
            <p className="nebo-dates-pick"><b>{dayTitle(picked.day.dayKey)}.</b> {byKey.has(picked.day.dayKey) ? describe(picked) : `${whyBad(topic, picked)}.`}</p>
          ) : null}
        </div>
        {ranked.length ? (
          <div className="nebo-period-card is-list">
            {ranked.slice(0, premium ? 6 : 2).map((item) => (
              <div key={item.day.dayKey} className="nebo-dates-row">
                <i className={item.category === 'best' ? 'is-best' : 'is-good'} aria-hidden="true" />
                <span><strong>{dayTitle(item.day.dayKey)}{item.category === 'best' ? ' · лучший день' : ''}</strong><small>{describe(item)}</small></span>
              </div>
            ))}
            {!premium && ranked.length > 2 ? <button type="button" className="nebo-period-more" onClick={onRequestPremium}>Ещё {ranked.length - 2} дня в Plus</button> : null}
          </div>
        ) : null}
      </section>
    );
  }

  const needle = query.trim().toLowerCase();
  let counter = 0;
  return (
    <section className="nebo-period">
      <p className="nebo-period-kicker">Хорошие даты</p>
      <h1 className="nebo-period-title">Для чего ищем день?</h1>
      <p className="nebo-period-text">Смотрим на твою карту и небо на месяц вперёд.</p>
      <label className="nebo-dates-search">
        <Search size={18} aria-hidden />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например: собеседование" aria-label="Поиск дела" />
      </label>
      {DATE_TOPIC_GROUPS.map((group, gi) => {
        const topics = group.topics.filter((item) => !needle || item.name.toLowerCase().includes(needle));
        if (!topics.length) return null;
        const shown = needle || open[gi] ? topics : topics.slice(0, 4);
        return (
          <div key={group.title} className="nebo-dates-group">
            <h2 className="nebo-tile-kicker">{group.title}</h2>
            <div className="nebo-dates-grid">
              {shown.map((item) => {
                counter += 1;
                const locked = !premium && counter > 3;
                const count = goodDayCount(item, data.lunar, data.sunSign, todayKey);
                const word = count % 10 === 1 && count % 100 !== 11 ? 'день' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'дня' : 'дней';
                return (
                  <button key={item.name} type="button" className="nebo-dates-item" onClick={() => (locked ? onRequestPremium() : setTopicName(item.name))}>
                    <img src={`/assets/dates/${item.sticker}.svg`} alt="" width={40} height={40} loading="lazy" />
                    <span><strong>{item.name}</strong><small>{locked ? 'Plus · ' : ''}{count} {word} за месяц</small></span>
                  </button>
                );
              })}
            </div>
            {!needle && topics.length > 4 ? (
              <button type="button" className="nebo-period-more" onClick={() => setOpen((value) => ({ ...value, [gi]: !value[gi] }))}>{open[gi] ? 'Свернуть' : `Ещё ${topics.length - 4}`}</button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
