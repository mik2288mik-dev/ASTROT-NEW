import React from 'react';
import type { KnowledgeDiagramId, KnowledgeLanguage } from '../../lib/knowledge';
import styles from './AstrologyEncyclopedia.module.css';

type KnowledgeDiagramProps = {
  diagram: KnowledgeDiagramId;
  language: KnowledgeLanguage;
};

const labels = {
  ru: {
    east: 'восток', horizon: 'горизонт', ecliptic: 'эклиптика', asc: 'ASC',
    earth: 'Земля', planet: 'планета', apparent: 'видимая петля',
    sun: 'Солнце', newMoon: 'новолуние', fullMoon: 'полнолуние',
    orbit: 'орбита Луны', nodeNorth: 'Северный узел', nodeSouth: 'Южный узел',
    houses: '12 секторов',
  },
  en: {
    east: 'east', horizon: 'horizon', ecliptic: 'ecliptic', asc: 'ASC',
    earth: 'Earth', planet: 'planet', apparent: 'apparent loop',
    sun: 'Sun', newMoon: 'new moon', fullMoon: 'full moon',
    orbit: 'Moon orbit', nodeNorth: 'North Node', nodeSouth: 'South Node',
    houses: '12 sectors',
  },
} as const;

function AscendantDiagram({ language }: { language: KnowledgeLanguage }) {
  const l = labels[language];
  return (
    <svg viewBox="0 0 360 220" role="img" aria-label={language === 'ru' ? 'Пересечение восточного горизонта и эклиптики' : 'Intersection of the eastern horizon and ecliptic'}>
      <path className={styles.diagramLine} d="M32 126H328" />
      <path className={styles.diagramAccent} d="M48 174C106 58 246 42 320 154" />
      <circle className={styles.diagramPoint} cx="93" cy="126" r="7" />
      <path className={styles.diagramArrow} d="M93 126H50m0 0 12-7m-12 7 12 7" />
      <text x="34" y="112">{l.east}</text>
      <text x="234" y="118">{l.horizon}</text>
      <text x="232" y="68">{l.ecliptic}</text>
      <text className={styles.diagramStrongText} x="102" y="151">{l.asc}</text>
    </svg>
  );
}

function HousesDiagram({ language }: { language: KnowledgeLanguage }) {
  const l = labels[language];
  const lines = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI) / 6;
    return {
      x: 180 + Math.cos(angle) * 92,
      y: 110 + Math.sin(angle) * 92,
    };
  });
  return (
    <svg viewBox="0 0 360 220" role="img" aria-label={language === 'ru' ? 'Круг, разделённый на двенадцать домов' : 'Circle divided into twelve houses'}>
      <circle className={styles.diagramLine} cx="180" cy="110" r="92" />
      {lines.map((point, index) => (
        <line className={styles.diagramLine} key={index} x1="180" y1="110" x2={point.x} y2={point.y} />
      ))}
      <circle className={styles.diagramPaper} cx="180" cy="110" r="34" />
      <text className={styles.diagramStrongText} x="180" y="106" textAnchor="middle">{l.houses}</text>
      <text x="180" y="126" textAnchor="middle">{language === 'ru' ? 'границы = куспиды' : 'boundaries = cusps'}</text>
    </svg>
  );
}

function AspectsDiagram({ language }: { language: KnowledgeLanguage }) {
  const aspectLines = [
    ['0°', 180, 26, 180, 26],
    ['60°', 180, 110, 256, 66],
    ['90°', 180, 110, 272, 110],
    ['120°', 180, 110, 226, 190],
    ['180°', 88, 110, 272, 110],
  ] as const;
  return (
    <svg viewBox="0 0 360 220" role="img" aria-label={language === 'ru' ? 'Основные углы аспектов на круге' : 'Major aspect angles on a circle'}>
      <circle className={styles.diagramLine} cx="180" cy="110" r="92" />
      {aspectLines.slice(1).map(([label, x1, y1, x2, y2]) => (
        <g key={label}>
          <line className={styles.diagramAccent} x1={x1} y1={y1} x2={x2} y2={y2} />
          <text className={styles.diagramStrongText} x={x2 + (x2 > 180 ? 6 : -28)} y={y2 - 7}>{label}</text>
        </g>
      ))}
      <circle className={styles.diagramPoint} cx="180" cy="26" r="6" />
      <text className={styles.diagramStrongText} x="189" y="30">0°</text>
    </svg>
  );
}

function RetrogradeDiagram({ language }: { language: KnowledgeLanguage }) {
  const l = labels[language];
  return (
    <svg viewBox="0 0 360 220" role="img" aria-label={language === 'ru' ? 'Видимая петля планеты из-за движения Земли' : 'Apparent planetary loop caused by relative motion'}>
      <circle className={styles.diagramLine} cx="118" cy="122" r="46" />
      <circle className={styles.diagramPoint} cx="118" cy="76" r="7" />
      <text x="82" y="188">{l.earth}</text>
      <circle className={styles.diagramLine} cx="254" cy="94" r="62" />
      <circle className={styles.diagramPoint} cx="298" cy="51" r="6" />
      <text x="244" y="174">{l.planet}</text>
      <path className={styles.diagramAccent} d="M32 54c44-32 74 28 112 8 42-22 24-70 75-44 37 18 13 68 65 62 24-3 38-18 50-32" />
      <path className={styles.diagramArrow} d="m334 48-12-1m12 1-5 11" />
      <text className={styles.diagramStrongText} x="116" y="32">{l.apparent}</text>
    </svg>
  );
}

function MoonPhasesDiagram({ language }: { language: KnowledgeLanguage }) {
  const l = labels[language];
  return (
    <svg viewBox="0 0 360 220" role="img" aria-label={language === 'ru' ? 'Положения Солнца, Земли и Луны при новолунии и полнолунии' : 'Sun, Earth, and Moon positions at new and full moon'}>
      <circle className={styles.diagramSun} cx="42" cy="110" r="25" />
      <text x="18" y="151">{l.sun}</text>
      <path className={styles.diagramRay} d="M72 82H326M72 110H326M72 138H326" />
      <circle className={styles.diagramEarth} cx="210" cy="110" r="24" />
      <text x="191" y="151">{l.earth}</text>
      <circle className={styles.diagramMoon} cx="146" cy="110" r="12" />
      <circle className={styles.diagramMoon} cx="302" cy="110" r="12" />
      <text x="112" y="85">{l.newMoon}</text>
      <text x="274" y="85">{l.fullMoon}</text>
      <path className={styles.diagramLine} d="M210 34a76 76 0 1 1 0 152" />
    </svg>
  );
}

function LunarNodesDiagram({ language }: { language: KnowledgeLanguage }) {
  const l = labels[language];
  return (
    <svg viewBox="0 0 360 220" role="img" aria-label={language === 'ru' ? 'Пересечение плоскости лунной орбиты с эклиптикой' : 'Intersection of the lunar orbit and ecliptic plane'}>
      <ellipse className={styles.diagramLine} cx="180" cy="110" rx="132" ry="52" />
      <ellipse className={styles.diagramAccent} cx="180" cy="110" rx="132" ry="52" transform="rotate(-18 180 110)" />
      <circle className={styles.diagramEarth} cx="180" cy="110" r="20" />
      <circle className={styles.diagramPoint} cx="54" cy="126" r="6" />
      <circle className={styles.diagramPoint} cx="306" cy="94" r="6" />
      <text className={styles.diagramStrongText} x="38" y="151">{l.nodeSouth}</text>
      <text className={styles.diagramStrongText} x="236" y="73">{l.nodeNorth}</text>
      <text x="132" y="196">{l.orbit}</text>
    </svg>
  );
}

export function KnowledgeDiagram({ diagram, language }: KnowledgeDiagramProps) {
  const content = diagram === 'ascendant' ? <AscendantDiagram language={language} />
    : diagram === 'houses' ? <HousesDiagram language={language} />
      : diagram === 'aspects' ? <AspectsDiagram language={language} />
        : diagram === 'retrograde-motion' ? <RetrogradeDiagram language={language} />
          : diagram === 'moon-phases' ? <MoonPhasesDiagram language={language} />
            : <LunarNodesDiagram language={language} />;

  return (
    <figure className={styles.diagram}>
      {content}
      <figcaption>
        {language === 'ru' ? 'Схема показывает принцип и не соблюдает масштаб.' : 'Diagram shows the principle and is not to scale.'}
      </figcaption>
    </figure>
  );
}
