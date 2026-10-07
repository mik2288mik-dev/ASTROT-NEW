import { useEffect, useState } from 'react';
import { buildSkyMonitor, type SkyMonitor } from '../../lib/skyMonitor';
import { loadExploreCharts, peekExploreCharts } from './exploreCharts';
import type { ChartListItem } from '../../services/storageService';
import { LiveSky, MoonCanvas } from '../home/LiveSky';
import { useSkyNow } from '../home/useSkyNow';

function housesFrom(charts: ChartListItem[] | null): number[] | null {
  const primary = charts?.find((chart) => chart.is_primary)?.chart_data as
    | { houses?: Array<{ house: number; longitude: number }>; chartQuality?: { housesReliable?: boolean } }
    | undefined;
  if (!primary?.chartQuality?.housesReliable) return null;
  const houses = [...(primary.houses ?? [])].sort((a, b) => a.house - b.house).map((house) => house.longitude);
  return houses.length === 12 ? houses : null;
}

type TodaySkyMonitorProps = {
  userId: string;
  /** Calendar day the home screen shows; the monitor recomputes when it changes. */
  periodKey: string;
};

let skyEngine: Promise<typeof import('astronomy-engine')> | null = null;

const TIMELINE_DAYS = 60;

function formatDay(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

function daysWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/** The same textured Moon as on the home sky, at today's phase. */
function MoonGlyph({ illumination, waxing }: { illumination: number; waxing: boolean }) {
  const lit = Math.max(0, Math.min(100, illumination)) / 100;
  const angle = (Math.acos(1 - 2 * lit) * 180) / Math.PI;
  return <MoonCanvas phase={waxing ? angle : 360 - angle} night className="today-sky-glyph" />;
}

function MercuryGlyph() {
  return (
    <svg className="today-sky-glyph" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(255,255,255,0.18)" />
      <circle cx="24" cy="25" r="6.5" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M18.5 13.5a5.5 5.5 0 0 0 11 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 31.5v6.5M20.8 34.8h6.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TodaySkyMonitor({ userId, periodKey }: TodaySkyMonitorProps) {
  const [sky, setSky] = useState<SkyMonitor | null>(null);
  const [failed, setFailed] = useState(false);
  const now = useSkyNow();

  useEffect(() => {
    let active = true;
    skyEngine ??= import('astronomy-engine');
    const engine = skyEngine;
    // Sky facts first; the personal houses arrive with the chart a moment later.
    void engine
      .then((loaded) => {
        if (active) setSky(buildSkyMonitor(loaded, new Date(), housesFrom(peekExploreCharts(userId))));
        return Promise.all([loaded, loadExploreCharts(userId)]);
      })
      .then(([loaded, charts]) => {
        const houses = housesFrom(charts);
        if (active && houses) setSky(buildSkyMonitor(loaded, new Date(), houses));
      })
      .catch((error: unknown) => {
        skyEngine = null;
        if (active) setFailed(true);
        console.warn('[TodaySkyMonitor] sky calculation failed:', error instanceof Error ? error.message : error);
      });
    return () => { active = false; };
  }, [periodKey, userId]);

  if (failed && !sky) return null;
  // The block sits right under the forecast, so it holds its place while the sky is calculated:
  // the entry tiles below must not jump down when the card appears.
  if (!sky) {
    return (
      <section id="today-sky" className="today-sky" aria-labelledby="today-sky-title" aria-busy="true">
        <h2 id="today-sky-title" className="today-explore-heading">Небо сегодня</h2>
        <div className="today-sky-card is-placeholder" />
      </section>
    );
  }
  const { moon, mercury, calendar } = sky;
  const nowMs = Date.now();
  const window = mercury.window;
  const timeline = window && window.start.getTime() - nowMs < TIMELINE_DAYS * 86_400_000
    ? {
        left: Math.max(0, ((window.start.getTime() - nowMs) / (TIMELINE_DAYS * 86_400_000)) * 100),
        width: Math.min(100, ((window.end.getTime() - Math.max(nowMs, window.start.getTime())) / (TIMELINE_DAYS * 86_400_000)) * 100),
      }
    : null;

  return (
    <section id="today-sky" className="today-sky" aria-labelledby="today-sky-title">
      <h2 id="today-sky-title" className="today-explore-heading">Небо сегодня</h2>
      <div className={`today-sky-card${now ? ' is-live' : ''}`}>
        {now ? <LiveSky sunAltitude={now.sunAltitude} moonPhase={null} className="today-sky-canvas" /> : null}
        <div className="today-sky-row">
          <MoonGlyph illumination={moon.illumination} waxing={moon.waxing} />
          <div className="today-sky-copy">
            <p className="today-sky-kicker">Луна</p>
            <p className="today-sky-title">{moon.phaseLabel} · {moon.illumination}%</p>
            <p className="today-sky-text">Сейчас в {moon.signIn}. {moon.advice}.</p>
          </div>
        </div>
        <ol className="today-sky-calendar" aria-label="Ближайшие фазы Луны">
          {calendar.map((item, index) => (
            <li key={item.label} className={index === 0 ? 'is-next' : undefined}>
              <b>{formatDay(item.date)}</b>
              {item.label}
            </li>
          ))}
        </ol>
        {moon.personal ? (
          <p className="today-sky-personal">Для тебя: Луна идёт по {moon.personal.house} дому, {moon.personal.area}</p>
        ) : null}

        <div className="today-sky-divider" />

        <div className="today-sky-row">
          <MercuryGlyph />
          <div className="today-sky-copy">
            <p className="today-sky-kicker">Меркурий</p>
            {mercury.retrograde ? (
              <>
                <p className="today-sky-title">Ретроградный{window ? ` до ${formatDay(window.end)}` : ''}</p>
                <p className="today-sky-text">Сейчас в {mercury.signIn}. Перепроверяй договорённости, билеты и сообщения перед отправкой.</p>
              </>
            ) : (
              <>
                <p className="today-sky-title">Идёт прямо</p>
                <p className="today-sky-text">
                  {window && mercury.daysUntilStart
                    ? `Ретроград начнётся через ${mercury.daysUntilStart} ${daysWord(mercury.daysUntilStart)}: с ${formatDay(window.start)} по ${formatDay(window.end)}${mercury.windowSignIn ? `, в ${mercury.windowSignIn}` : ''}.`
                    : `Сейчас в ${mercury.signIn}. Ретроградов в ближайшие месяцы нет.`}
                </p>
              </>
            )}
          </div>
        </div>
        {timeline ? (
          <>
            <div className="today-sky-timeline" aria-hidden="true">
              <i style={{ left: `${timeline.left}%`, width: `${timeline.width}%` }} />
              <em />
            </div>
            <div className="today-sky-timeline-labels" aria-hidden="true">
              <span>сегодня</span>
              <span>{window ? `${formatDay(window.start)} - ${formatDay(window.end)}` : ''}</span>
            </div>
          </>
        ) : null}
        {mercury.personal && window ? (
          <p className="today-sky-personal">
            Для тебя: {mercury.retrograde ? 'проходит' : 'пройдёт'} по {mercury.personal.house} дому, {mercury.personal.area}
          </p>
        ) : null}
      </div>
    </section>
  );
}
