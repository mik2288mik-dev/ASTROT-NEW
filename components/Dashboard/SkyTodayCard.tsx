import React, { memo, useId, useMemo, useState } from 'react';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  formatSkyDegree,
  getSkyTodayNarrative,
  type SkyTodaySnapshot,
} from '../../lib/skyToday';

type SkyTodayCardProps = {
  snapshot: SkyTodaySnapshot | null;
  language: 'ru' | 'en';
};

export const SkyTodayCard = memo<SkyTodayCardProps>(({ snapshot, language }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const narrative = useMemo(
    () => (snapshot ? getSkyTodayNarrative(snapshot, language) : null),
    [language, snapshot],
  );

  if (!snapshot || !narrative) return null;

  const moonSign = narrative.moonPosition.split(' · ').at(-1) || snapshot.moon.sign;
  const mercurySign = narrative.mercuryPosition.split(' · ')[0] || snapshot.mercury.sign;
  const exactMoon = `${formatSkyDegree(snapshot.moon.degree, language)} · ${moonSign}`;
  const exactMercury = `${formatSkyDegree(snapshot.mercury.degree, language)} · ${mercurySign}`;
  const ru = language === 'ru';

  return (
    <section
      className="home-sky-today-card"
      aria-labelledby="home-sky-today-title"
      data-source={snapshot.source}
    >
      <div className="home-sky-today-heading">
        <div>
          <h2 id="home-sky-today-title">{ru ? 'Небо сегодня' : 'Sky today'}</h2>
          <p>{ru ? 'Общий фон без привязки к натальной карте' : 'A shared background, not a natal reading'}</p>
        </div>
      </div>

      <div className="home-sky-today-grid">
        <article className="home-sky-today-item">
          <span className="home-sky-today-symbol" aria-hidden>☾</span>
          <div className="home-sky-today-item-copy">
            <h3>{ru ? 'Луна' : 'Moon'}</h3>
            <p className="home-sky-today-position">{narrative.moonPosition}</p>
            <span className="home-sky-today-context-label">
              {ru ? 'Как это может ощущаться' : 'How it may feel'}
            </span>
            <p className="home-sky-today-description">{narrative.moonDescription}</p>
          </div>
        </article>

        <article className="home-sky-today-item">
          <span className="home-sky-today-symbol" aria-hidden>☿</span>
          <div className="home-sky-today-item-copy">
            <h3>{ru ? 'Меркурий' : 'Mercury'}</h3>
            <p className="home-sky-today-position">{narrative.mercuryPosition}</p>
            <span className="home-sky-today-context-label">
              {ru ? 'Общий фон' : 'Shared background'}
            </span>
            <p className="home-sky-today-description">{narrative.mercuryDescription}</p>
          </div>
        </article>
      </div>

      <button
        type="button"
        className="home-sky-today-more"
        onClick={() => {
          lumiaSelectionHaptic();
          setDetailsOpen((value) => !value);
        }}
        aria-expanded={detailsOpen}
        aria-controls={detailsId}
      >
        {detailsOpen ? (ru ? 'Свернуть' : 'Hide details') : (ru ? 'Подробнее' : 'Details')}
      </button>

      {detailsOpen ? (
        <div id={detailsId} className="home-sky-today-details">
          <div className="home-sky-today-detail-row">
            <h3>{ru ? 'Точное положение' : 'Exact position'}</h3>
            <p>{ru ? 'Луна' : 'Moon'} — {exactMoon}<br />{ru ? 'Меркурий' : 'Mercury'} — {exactMercury}</p>
          </div>
          <div className="home-sky-today-detail-row">
            <h3>{ru ? 'Что значит эта фаза' : 'What this phase means'}</h3>
            <p>{narrative.phaseMeaning}</p>
          </div>
          <div className="home-sky-today-detail-row">
            <h3>{ru ? 'Общий фон' : 'Shared background'}</h3>
            <p>{narrative.mercuryMotionMeaning}</p>
          </div>
          <p className="home-sky-today-note">
            {ru
              ? 'Это общий фон текущего неба. Личный разбор по натальной карте находится выше.'
              : 'This is the shared current sky. Your natal-based personal reading is above.'}
          </p>
        </div>
      ) : null}
    </section>
  );
});

SkyTodayCard.displayName = 'SkyTodayCard';
