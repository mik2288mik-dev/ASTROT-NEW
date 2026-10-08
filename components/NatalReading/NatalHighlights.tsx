import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import {
  buildBigThree,
  buildChartMoments,
  buildSkyEventMoments,
  ELEMENT_LABEL_RU,
  ELEMENT_SIGNS_RU,
  ELEMENT_ORDER,
  type MomentTone,
  type NatalMoment,
} from '../../lib/natalMoments';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { planetArtStyle } from './planetArt';
import styles from './NatalHighlights.module.css';

const TILE_TONE: Record<'sun' | 'moon' | 'ascendant', string> = {
  sun: styles.day,
  moon: styles.evening,
  ascendant: styles.sunset,
};

const BADGE_TONE: Record<MomentTone, string> = {
  day: styles.day,
  evening: styles.evening,
  sunset: styles.sunset,
  neutral: styles.neutral,
};

/** Sky events need astronomy-engine; it is loaded once and only for the overview. */
let skyEngine: Promise<typeof import('astronomy-engine')> | null = null;

function MoonGlyph({ illumination, waxing }: { illumination: number; waxing: boolean }) {
  const lit = Math.max(0, Math.min(100, illumination)) / 100;
  // Terminator as an ellipse: rx shrinks from full disc to zero and flips past half.
  const rx = Math.abs(1 - 2 * lit) * 11;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = lit > 0.5 ? (waxing ? 1 : 0) : (waxing ? 0 : 1);
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="11" fill="rgba(255,255,255,0.25)" />
      <path d={`M14 3 A11 11 0 0 ${sweepOuter} 14 25 A${rx} 11 0 0 ${sweepInner} 14 3 Z`} fill="#fff" />
    </svg>
  );
}

function SunGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="6" fill="#fff" />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4;
        return (
          <line
            key={index}
            x1={14 + Math.cos(angle) * 9}
            y1={14 + Math.sin(angle) * 9}
            x2={14 + Math.cos(angle) * 12}
            y2={14 + Math.sin(angle) * 12}
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function MomentCard({ moment }: { moment: NatalMoment }) {
  const { visual } = moment;
  if (visual.kind === 'elements') {
    const max = Math.max(1, ...ELEMENT_ORDER.map((element) => visual.counts[element]));
    return (
      <article className={styles.moment}>
        <div className={styles.momentBody}>
          <p className={styles.kicker}>{moment.kicker}</p>
          <h3 className={styles.momentHeadline}>{moment.headline}</h3>
          <p className={styles.elementIntro}>
            Двенадцать знаков делятся на четыре стихии, по три знака в каждой. Цифра показывает, сколько твоих планет стоит в знаках этой стихии.
          </p>
          <div className={styles.elementBars}>
            {ELEMENT_ORDER.map((element) => (
              <div key={element} className={styles.elementBar}>
                <span>{ELEMENT_LABEL_RU[element]} · {visual.counts[element]}</span>
                <span className={styles.elementTrack}>
                  <span
                    className={`${styles.elementFill} ${styles[element]}`}
                    style={{ width: `${(visual.counts[element] / max) * 100}%` }}
                  />
                </span>
                <small className={styles.elementWho}>
                  {ELEMENT_SIGNS_RU[element]}
                  {visual.planets?.[element]?.length ? `: ${visual.planets[element].join(', ')}` : ': у тебя здесь нет планет'}
                </small>
              </div>
            ))}
          </div>
          {moment.body ? <p className={styles.momentText}>{moment.body}</p> : null}
        </div>
      </article>
    );
  }

  const badgeClass = `${styles.badge} ${BADGE_TONE[moment.tone]}${visual.kind === 'number' && visual.value.length > 3 ? ` ${styles.small}` : ''}`;
  return (
    <article className={styles.moment}>
      <span className={badgeClass} aria-hidden="true">
        {visual.kind === 'number' ? visual.value : null}
        {visual.kind === 'moon' ? <MoonGlyph illumination={visual.illumination} waxing={visual.waxing} /> : null}
        {visual.kind === 'sun' ? <SunGlyph /> : null}
        {visual.kind === 'retrograde' ? <RotateCcw size={20} strokeWidth={2} /> : null}
      </span>
      <div className={styles.momentBody}>
        <p className={styles.kicker}>{moment.kicker}</p>
        <h3 className={styles.momentHeadline}>{moment.headline}</h3>
        <p className={styles.momentText}>{moment.body}</p>
      </div>
    </article>
  );
}

/** `part` lets the overview put the big three before the story and the highlights after it. */
export function NatalHighlights({ chart, part = 'all' }: { chart: NatalChartDataV2; part?: 'all' | 'big-three' | 'moments' }) {
  const bigThree = useMemo(() => buildBigThree(chart), [chart]);
  const chartMoments = useMemo(() => buildChartMoments(chart), [chart]);
  const [skyMoments, setSkyMoments] = useState<NatalMoment[]>([]);

  useEffect(() => {
    let active = true;
    setSkyMoments([]);
    if (part === 'big-three') return () => { active = false; };
    skyEngine ??= import('astronomy-engine');
    skyEngine
      .then((engine) => {
        if (active) setSkyMoments(buildSkyEventMoments(chart, engine));
      })
      .catch(() => {
        skyEngine = null;
      });
    return () => { active = false; };
  }, [chart, part]);

  // A solstice or equinox is the Sun entering a sign: one moment instead of two.
  const seasonMoment = skyMoments.find((moment) => moment.id === 'sky:season');
  const sunEdge = chartMoments.find((moment) => moment.id === 'sun-edge:start');
  const moments = [
    ...skyMoments.map((moment) => (moment === seasonMoment && sunEdge
      ? { ...moment, body: `${moment.body} ${sunEdge.headline}.` }
      : moment)),
    ...chartMoments.filter((moment) => !(seasonMoment && moment === sunEdge)),
  ];

  return (
    <>
      {part !== 'moments' && bigThree.length ? (
        <section className={styles.block} aria-labelledby="natal-big-three">
          <h2 id="natal-big-three" className={styles.heading}>Главное о тебе</h2>
          <div className={styles.bigThree}>
            {bigThree.map((tile) => (
              // The Ascendant is a sign, not a planet: it keeps its plain tone.
              <div
                key={tile.key}
                className={`${styles.tile} ${TILE_TONE[tile.key]}${tile.key === 'ascendant' ? '' : ` ${styles.withArt}`}`}
                style={tile.key === 'ascendant' ? undefined : planetArtStyle(tile.key)}
              >
                <span className={styles.tileIcon} aria-hidden="true">
                  <ZodiacIcon sign={tile.sign} size={18} strokeWidth={1.7} />
                </span>
                <span className={styles.tileLabel}>{tile.label}</span>
                <span className={styles.tileSign}>{tile.signLabel}</span>
                <span className={styles.tileTrait}>{tile.role}: {tile.trait}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {part !== 'big-three' && moments.length ? (
        <section className={`${styles.block}${part === 'moments' ? ` ${styles.afterStory}` : ''}`} aria-labelledby="natal-moments">
          <h2 id="natal-moments" className={styles.heading}>Фишки твоей карты</h2>
          <div className={styles.moments}>
            {moments.map((moment) => <MomentCard key={moment.id} moment={moment} />)}
          </div>
        </section>
      ) : null}
    </>
  );
}
