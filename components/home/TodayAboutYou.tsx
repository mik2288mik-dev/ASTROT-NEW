import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { NatalChartData } from '../../types';
import { birthFacts, birthInstant, buildFastTransits, chartFactOfDay, dayIndex, skyComparisonFacts, todayMoonFacts, transitFactOfDay, type BirthFact, type ChartFact } from '../../lib/aboutYouFacts';
import { loadExploreCharts, peekExploreCharts } from '../PersonalForecastFeed/exploreCharts';
import { worldTwinOfDay, worldTwinsOfDay } from '../../lib/worldTwins';
import { dailyPhrase } from '../../lib/dailyPhrases';
import { loadFeatureState, peekFeatureState, saveFeatureState } from '../../services/featureStateService';

type TodayAboutYouProps = {
  userId: string;
  todayKey: string;
  birthDate: string;
  birthTime: string | null | undefined;
  birthTimeKnown: boolean;
  /** One concrete step from today's forecast; the card hides the task without it. */
  task: string | null;
  /** Closing row of the card, such as the question of the day. */
  children?: React.ReactNode;
};

let engine: Promise<typeof import('astronomy-engine')> | null = null;
const FACTS_PER_PAGE = 4;
const MAX_FACTS = 12;

function previousDay(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Days in a row with the task done, counting back from today (or yesterday). */
function streakOf(done: Record<string, unknown>, todayKey: string): number {
  let day = done[todayKey] ? todayKey : previousDay(todayKey);
  let count = 0;
  while (done[day]) {
    count += 1;
    day = previousDay(day);
  }
  return count;
}

function daysWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

function PickMeFinger() {
  return (
    <span className="about-pickme" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <path d="M14 6c1.7 0 3 1.3 3 3v9l1.2-.5c1.6-.6 3.3.3 3.8 1.9l.2.5 1.1-.4c1.6-.5 3.3.4 3.8 2l.1.4.9-.2c1.6-.4 3.2.6 3.6 2.2l1.3 6.4c.6 3-1 6-3.9 7.1L25 39H17l-7.6-9.5c-1-1.2-.8-3 .4-4 1.1-.9 2.7-.9 3.8 0l.4.4V9c0-1.7 1.3-3 3-3z" fill="#fff" stroke="#1f1d1a" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <em>нажми</em>
    </span>
  );
}

/** «Сегодня о тебе»: a chart fact that changes daily, birth facts and a mini-task from today's forecast. */
export function TodayAboutYou({ userId, todayKey, birthDate, birthTime, birthTimeKnown, task, children }: TodayAboutYouProps) {
  const [chart, setChart] = useState<NatalChartData | null>(
    () => peekExploreCharts(userId)?.find((item) => item.is_primary)?.chart_data ?? null,
  );
  const [moonAtBirth, setMoonAtBirth] = useState<number | null>(null);
  const [todayFact, setTodayFact] = useState<ChartFact | null>(null);
  const [moonToday, setMoonToday] = useState<BirthFact[]>([]);
  const [sky, setSky] = useState<ReturnType<typeof skyComparisonFacts> | null>(null);
  const [factPage, setFactPage] = useState(0);
  useEffect(() => { setFactPage(0); }, [todayKey]);
  const [done, setDone] = useState<Record<string, unknown>>(() => peekFeatureState(userId, 'daily_task'));

  useEffect(() => {
    let active = true;
    void loadExploreCharts(userId).then((charts) => {
      if (active) setChart(charts.find((item) => item.is_primary)?.chart_data ?? null);
    });
    void loadFeatureState(userId, 'daily_task').then((items) => { if (active) setDone(items); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let active = true;
    const instant = birthInstant(birthDate, birthTimeKnown ? birthTime : null, chart?.timezone ?? null);
    if (!instant) return undefined;
    engine ??= import('astronomy-engine');
    void engine
      .then((astro) => {
        if (active) setMoonAtBirth(astro.Illumination(astro.Body.Moon, instant).phase_fraction * 100);
      })
      .catch(() => { engine = null; });
    return () => { active = false; };
  }, [birthDate, birthTime, birthTimeKnown, chart?.timezone]);

  useEffect(() => {
    let active = true;
    if (!chart) return undefined;
    engine ??= import('astronomy-engine');
    void engine
      .then((astro) => { if (active) setTodayFact(transitFactOfDay(chart, buildFastTransits(astro, todayKey))); })
      .catch(() => { engine = null; });
    return () => { active = false; };
  }, [chart, todayKey]);

  useEffect(() => {
    let active = true;
    engine ??= import('astronomy-engine');
    void engine
      .then((astro) => { if (active) setMoonToday(todayMoonFacts(astro, todayKey)); })
      .catch(() => { engine = null; });
    return () => { active = false; };
  }, [todayKey]);

  useEffect(() => {
    let active = true;
    engine ??= import('astronomy-engine');
    void engine
      .then((astro) => { if (active) setSky(skyComparisonFacts(astro, todayKey, chart, moonAtBirth)); })
      .catch(() => { engine = null; });
    return () => { active = false; };
  }, [chart, moonAtBirth, todayKey]);

  // Today's aspect to the chart; the old chart-only fact is the fallback while it is not ready or none is close enough.
  const fact = useMemo(() => todayFact ?? chartFactOfDay(chart, todayKey), [todayFact, chart, todayKey]);
  const birth = useMemo(() => birthFacts({
    birthDate,
    birthTime,
    birthTimeKnown,
    rising: chart?.rising?.sign ?? null,
    risingReliable: chart?.chartQuality?.ascendantReliable === true,
    moonAtBirth,
    todayKey,
  }), [birthDate, birthTime, birthTimeKnown, chart, moonAtBirth, todayKey]);
  // Four different kinds of tile, never the same theme twice: what the world got in your birth year,
  // today's sky against your birth, a rare personal sky event (or a second world fact), the birthday countdown.
  const facts = useMemo(() => {
    const day = dayIndex(todayKey);
    const countdown = birth[birth.length - 1];
    const rest = birth.slice(0, -1).filter((item) => !item.value.startsWith('Луна'));
    const rotating = rest.length ? rest[day % rest.length] : null;
    const twin = worldTwinOfDay(birthDate, day);
    const secondTwin = worldTwinOfDay(birthDate, day, 1);
    return [
      twin ?? sky?.moonSign ?? moonToday[0] ?? null,
      sky?.birthSky ?? moonToday[1] ?? null,
      sky?.moonSign ?? sky?.planetReturn ?? secondTwin ?? rotating,
      countdown,
    ].filter((item, index, list): item is BirthFact => Boolean(item) && list.indexOf(item) === index);
  }, [birth, birthDate, moonToday, sky, todayKey]);

  // «Ещё факты»: today's four first, then the rest of the day's pool, four at a time, up to twelve.
  const factPages = useMemo(() => {
    const day = dayIndex(todayKey);
    const pool: BirthFact[] = [...facts];
    const seen = new Set(pool.map((item) => item.value));
    const extras: Array<BirthFact | null | undefined> = [
      ...worldTwinsOfDay(birthDate, day),
      sky?.moonSign,
      sky?.planetReturn,
      ...birth.slice(0, -1).filter((item) => !item.value.startsWith('Луна')),
      ...moonToday,
    ];
    for (const item of extras) {
      if (!item || seen.has(item.value) || pool.length >= MAX_FACTS) continue;
      seen.add(item.value);
      pool.push(item);
    }
    const pages: BirthFact[][] = [];
    for (let index = 0; index < pool.length; index += FACTS_PER_PAGE) pages.push(pool.slice(index, index + FACTS_PER_PAGE));
    // A last page of one tile looks unfinished; fold it into the previous one.
    if (pages.length > 1 && pages[pages.length - 1].length < 2) pages[pages.length - 2].push(...pages.pop()!);
    return pages;
  }, [birth, birthDate, facts, moonToday, sky, todayKey]);
  const shownFacts = factPages[Math.min(factPage, factPages.length - 1)] ?? facts;
  const hasMoreFacts = factPage < factPages.length - 1;

  const phrase = dailyPhrase(userId, dayIndex(todayKey));
  const isDone = Boolean(done[todayKey]);
  const streak = streakOf(done, todayKey);

  if (!fact && !facts.length) return null;

  const toggle = () => {
    const next = { ...done };
    if (isDone) delete next[todayKey];
    else next[todayKey] = true;
    // Only recent days matter for the streak; keep the record small.
    const keys = Object.keys(next).sort().slice(-60);
    const compact = Object.fromEntries(keys.map((key) => [key, true]));
    setDone(compact);
    void saveFeatureState(userId, 'daily_task', todayKey, isDone ? null : true);
    for (const key of Object.keys(next)) {
      if (!(key in compact)) void saveFeatureState(userId, 'daily_task', key, null);
    }
  };

  return (
    <section className="about-you" aria-labelledby="about-you-title">
      <h2 id="about-you-title" className="today-explore-heading about-you-heading">
        Сегодня о тебе <small>меняется каждый день</small>
      </h2>
      <div className="about-you-card">
        {fact ? (
          <>
            <p className="about-you-kicker">{fact.kicker ?? 'Фишка твоей карты'}</p>
            <p className="about-you-title">{fact.title}</p>
            <p className="about-you-text">{fact.text}</p>
          </>
        ) : null}
        {shownFacts.length ? (
          <div className="about-you-facts" key={factPage}>
            {shownFacts.map((item) => (
              <div key={item.caption}>
                <b>{item.value}</b>
                <span>{item.caption}</span>
              </div>
            ))}
          </div>
        ) : null}
        {factPages.length > 1 ? (
          <button
            type="button"
            className="about-you-more"
            onClick={() => setFactPage((page) => (hasMoreFacts ? page + 1 : 0))}
          >
            {hasMoreFacts ? 'Ещё факты' : 'Сначала'}
          </button>
        ) : null}
        <div className="about-you-phrase">
          <p className="about-you-kicker">Фраза дня</p>
          <p className="about-you-phrase-text">{phrase}</p>
        </div>
        {task ? (
          <div className={`about-you-task${isDone ? ' is-done' : ''}`}>
            {!isDone ? <PickMeFinger /> : null}
            <button
              type="button"
              className="about-you-check"
              aria-pressed={isDone}
              aria-label={isDone ? 'Отметить как не сделанное' : 'Отметить как сделанное'}
              onClick={toggle}
            >
              <Check size={18} strokeWidth={3} aria-hidden="true" />
            </button>
            <div>
              <p className="about-you-kicker">Мини-задание дня · по прогнозу</p>
              <p className="about-you-task-text">{task}</p>
              <p className="about-you-why">
                Зачем: одно маленькое действие помогает прожить день «в тему» и заметить, что прогноз работает. Отметь, когда сделаешь.
              </p>
              {streak > 1 ? <p className="about-you-streak">Серия: {streak} {daysWord(streak)} подряд</p> : null}
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
