import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { buildSeasonPath, type SeasonPath } from '../../lib/seasonPath';
import { loadExploreCharts, peekExploreCharts } from '../PersonalForecastFeed/exploreCharts';
import type { ChartListItem } from '../../services/storageService';

let engine: Promise<typeof import('astronomy-engine')> | null = null;

function cuspsOf(charts: ChartListItem[] | null): number[] | null {
  const chart = charts?.find((item) => item.is_primary)?.chart_data;
  if (!chart?.chartQuality?.housesReliable) return null;
  const cusps = [...(chart.houses ?? [])].sort((a, b) => a.house - b.house).map((house) => house.longitude);
  return cusps.length === 12 ? cusps : null;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** «Твоя осень»: the season's path of the Sun through your own houses, with real dates. */
export function SeasonCard({ userId, todayKey, onOpenFuture }: { userId: string; todayKey: string; onOpenFuture: () => void }) {
  const [path, setPath] = useState<SeasonPath | null>(null);

  useEffect(() => {
    let active = true;
    engine ??= import('astronomy-engine');
    const render = (astro: typeof import('astronomy-engine'), charts: ChartListItem[] | null) => {
      if (active) setPath(buildSeasonPath(astro, new Date(), cuspsOf(charts)));
    };
    void engine
      .then((astro) => {
        render(astro, peekExploreCharts(userId));
        return loadExploreCharts(userId).then((charts) => render(astro, charts));
      })
      .catch(() => { engine = null; });
    return () => { active = false; };
  }, [todayKey, userId]);

  if (!path || !path.steps.length) return null;

  return (
    <section className="season" aria-labelledby="season-title">
      <h2 id="season-title" className="today-explore-heading">{path.title}</h2>
      <button type="button" className="season-card" onClick={onOpenFuture}>
        {path.title === 'Твоя осень' ? (
        <span className="season-leaf" aria-hidden="true">
          <svg viewBox="0 0 120 120"><path d="M95 18C60 18 25 40 22 82c-1 9 2 16 2 16s7-3 15-4c42-6 59-42 56-76z" fill="#f0a24a" /><path d="M24 98C42 70 62 52 90 26" stroke="#c4761f" strokeWidth="3" fill="none" /></svg>
        </span>
        ) : null}
        {path.title === 'Твоя осень' ? (
          <span className="season-falling" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <svg key={index} viewBox="0 0 120 120" className={`season-fall is-${index}`}>
                <path d="M95 18C60 18 25 40 22 82c-1 9 2 16 2 16s7-3 15-4c42-6 59-42 56-76z" fill={index % 2 ? '#e8893a' : '#f2b25c'} />
              </svg>
            ))}
          </span>
        ) : null}
        <span className="season-kicker">По твоей карте</span>
        <span className="season-headline">{path.headline}</span>
        <span className="season-steps">
          {path.steps.map((step) => (
            <span key={step.date.toISOString()} className="season-step">
              <b>{formatDay(step.date)}</b>
              <span>{step.text}</span>
            </span>
          ))}
        </span>
        <span className="season-cta">Открыть календарь <ChevronRight size={16} aria-hidden="true" /></span>
      </button>
    </section>
  );
}
