import { useEffect, useState } from 'react';
import { buildSkyMonitor, type SkyMonitor } from '../../lib/skyMonitor';
import { loadExploreCharts, peekExploreCharts } from './exploreCharts';
import type { ChartListItem } from '../../services/storageService';
import { MoonCanvas } from '../home/LiveSky';

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

export function TodaySkyMonitor({ userId, periodKey }: TodaySkyMonitorProps) {
  const [sky, setSky] = useState<SkyMonitor | null>(null);
  const [failed, setFailed] = useState(false);
  const [retroOpen, setRetroOpen] = useState(false);

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
  const window = mercury.window;

  const retroNow = mercury.retrograde;
  const retroSoon = !retroNow && Boolean(window && mercury.daysUntilStart);
  const retroLabel = retroNow
    ? `Идёт сейчас${window ? ` · до ${formatDay(window.end)}` : ''}`
    : retroSoon && window
      ? `Через ${mercury.daysUntilStart} ${daysWord(mercury.daysUntilStart!)} · ${formatDay(window.start)} - ${formatDay(window.end)}`
      : '';

  // Canvas «Сегодня»: the Moon as a tile, Mercury retrograde as a red card that opens its explanation.
  return (
    <section data-telemetry-content="Небо сегодня" id="today-sky" className="nebo-sky" aria-label="Небо сегодня">
      <div className="nebo-sky-tiles">
        <div data-telemetry-content="Небо сегодня · Луна" className="nebo-sky-tile">
          <p className="nebo-sky-tile-label">Луна сегодня</p>
          <div className="nebo-sky-moon">
            <MoonGlyph illumination={moon.illumination} waxing={moon.waxing} />
            <strong>{moon.phaseLabel}</strong>
          </div>
          <p className="nebo-sky-tile-text">в {moon.signIn}</p>
          <p className="nebo-sky-tile-note">Освещена на {moon.illumination}%</p>
        </div>
        <div className="nebo-sky-tile">
          <p className="nebo-sky-tile-label">Ближайшие фазы</p>
          <ol className="nebo-sky-phases" aria-label="Ближайшие фазы Луны">
            {calendar.slice(0, 3).map((item) => (
              <li key={item.label}><b>{formatDay(item.date)}</b> {item.label}</li>
            ))}
          </ol>
        </div>
      </div>
      {moon.personal ? (
        <p className="nebo-sky-personal">Луна идёт по твоему {moon.personal.house} дому: {moon.personal.area}</p>
      ) : null}

      {retroLabel ? (
        <button
          type="button"
          data-telemetry-content="Небо сегодня · Меркурий"
          className={retroNow ? 'nebo-retro-card is-now' : 'nebo-retro-card'}
          aria-expanded={retroOpen}
          onClick={() => setRetroOpen((open) => !open)}
        >
          <span className="nebo-retro-glyph" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M12 7a4 4 0 1 1 0 8a4 4 0 1 1 0-8M8.4 2.6a3.6 3.6 0 0 0 7.2 0M12 15v6.4M9 18.4h6" />
            </svg>
          </span>
          <span className="nebo-retro-copy">
            <span className="nebo-retro-label">{retroLabel}</span>
            <strong>{retroNow ? 'Ретроградный Меркурий' : 'Скоро ретроградный Меркурий'}</strong>
            <span className="nebo-retro-sub">Что он значит для тебя</span>
          </span>
          <svg className={retroOpen ? 'nebo-retro-chevron is-open' : 'nebo-retro-chevron'} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      ) : null}
      {retroLabel && retroOpen ? (
        <div className="nebo-retro-more">
          <p>
            Ретроградный Меркурий: несколько недель кажется, что Меркурий идёт по небу назад. Меркурий отвечает за разговоры,
            переписку, договоры и поездки, поэтому в эти дни люди чаще путаются в словах, сроках и билетах.
          </p>
          <p>
            {retroNow
              ? `Сейчас он в ${mercury.signIn}. Перечитывай сообщения перед отправкой, перепроверяй договорённости и билеты.`
              : `Начнётся ${formatDay(window!.start)}${mercury.windowSignIn ? `, в ${mercury.windowSignIn}` : ''}. Важное лучше подписать и купить до этого.`}
          </p>
          {mercury.personal ? (
            <p>Для тебя: {retroNow ? 'проходит' : 'пройдёт'} по твоему {mercury.personal.house} дому, {mercury.personal.area}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
