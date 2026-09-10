import React, { type ComponentType } from 'react';
import type { KnowledgeDiagramId, KnowledgeLanguage } from '../../lib/knowledge';
import styles from './AstrologyEncyclopedia.module.css';

type DiagramProps = { language: KnowledgeLanguage };
type KnowledgeDiagramProps = DiagramProps & { diagram: KnowledgeDiagramId };

const copy = {
  ru: {
    scale: 'Схема упрощена и не соблюдает масштаб.',
    ascendant: ['Как найти Асцендент', 'Точка зодиака, которая поднимается над восточным горизонтом.', 'Горизонт и эклиптика пересекаются на востоке — это и есть ASC.'],
    houses: ['Как устроены дома', 'Карта делится на 12 секторов. Линия начинает дом, пространство после неё и есть дом.', 'Линии — куспиды, цветные секторы — дома.'],
    aspects: ['Пять основных аспектов', 'Угол измеряют по кругу между двумя точками карты.', 'Чем ближе угол к указанному числу, тем точнее аспект. Допуск называют орбисом.'],
    retrograde: ['Почему планета будто идёт назад', 'Планета не разворачивается. Меняется линия взгляда с движущейся Земли.', 'В космосе обе планеты продолжают путь вперёд; петля появляется только на фоне звёзд.'],
    moon: ['Почему меняются фазы Луны', 'Солнце всегда освещает половину Луны. С Земли мы видим эту половину под разными углами.', 'Фазы — не тень Земли. Земная тень нужна только для лунного затмения.'],
    nodes: ['Откуда берутся лунные узлы', 'Орбита Луны наклонена и дважды пересекает плоскость эклиптики.', 'Узлы — две точки пересечения, а не небесные тела.'],
    eclipses: ['Солнечное и лунное затмения', 'Для затмения Солнце, Земля и Луна должны выстроиться почти на одной линии около узла.', 'Наклон орбиты Луны мешает такому выравниванию происходить каждый месяц.'],
    lilith: ['Что показывает Чёрная Луна', 'Лилит — расчётная координата, связанная с дальней областью лунной орбиты.', 'В отмеченной точке нет второй Луны, планеты или другого тела.'],
    zodiac: ['Как устроен зодиак', 'Эклиптический круг делят на 12 равных знаков по 30°.', 'Знак — участок круга, а не рисунок созвездия на небе.'],
  },
  en: {
    scale: 'Simplified diagram, not to scale.',
    ascendant: ['How to locate the Ascendant', 'The zodiac point rising across the eastern horizon.', 'The horizon and ecliptic meet in the east — that point is the ASC.'],
    houses: ['How houses work', 'The chart is divided into 12 sectors. A line begins a house; the space after it is the house.', 'Lines are cusps; coloured sectors are houses.'],
    aspects: ['Five major aspects', 'The angle is measured around the circle between two chart points.', 'The closer the angle is to the number shown, the more exact the aspect. The tolerance is the orb.'],
    retrograde: ['Why a planet seems to go backwards', 'The planet does not turn around. Our line of sight changes from the moving Earth.', 'Both planets keep moving forward in space; the loop appears only against the stars.'],
    moon: ['Why Moon phases change', 'The Sun always lights half the Moon. From Earth we see that half at changing angles.', 'Phases are not Earth’s shadow. Earth’s shadow is involved only in a lunar eclipse.'],
    nodes: ['Where lunar nodes come from', 'The Moon’s tilted orbit crosses the ecliptic plane twice.', 'Nodes are two crossing points, not celestial bodies.'],
    eclipses: ['Solar and lunar eclipses', 'An eclipse needs the Sun, Earth, and Moon nearly aligned close to a node.', 'The Moon’s tilted orbit prevents that alignment every month.'],
    lilith: ['What Black Moon shows', 'Lilith is a calculated coordinate associated with the distant part of the lunar orbit.', 'There is no second moon, planet, or other body at the marked point.'],
    zodiac: ['How the zodiac works', 'The ecliptic circle is divided into 12 equal 30° signs.', 'A sign is a section of the circle, not a constellation drawing.'],
  },
} as const;

function SvgText({ x, y, children, anchor = 'start', strong = false }: { x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end'; strong?: boolean }) {
  return <text x={x} y={y} textAnchor={anchor} className={strong ? styles.diagramStrongText : undefined}>{children}</text>;
}

function AscendantDiagram({ language }: DiagramProps) {
  const ru = language === 'ru';
  return (
    <svg viewBox="0 0 360 330" role="img" aria-label={copy[language].ascendant[1]}>
      <rect className={styles.diagramSky} x="16" y="18" width="328" height="222" rx="22" />
      <path className={styles.diagramGround} d="M16 168H344V240H16z" />
      <circle className={styles.diagramSun} cx="305" cy="60" r="22" />
      <path className={styles.diagramRay} d="M305 27V17m0 76v10m-33-43h-10m76 0h10m-66-23-8-8m54 54 8 8m-54-8-8 8m54-54 8-8" />
      <path className={styles.diagramHorizon} d="M36 168H324" />
      <path className={styles.diagramEcliptic} d="M42 218C102 98 244 70 326 188" />
      <circle className={styles.diagramAscPoint} cx="73" cy="168" r="9" />
      <path className={styles.diagramArrow} d="M74 168H40m0 0 11-7m-11 7 11 7" />
      <circle className={styles.diagramObserver} cx="180" cy="146" r="9" />
      <path className={styles.diagramObserver} d="M180 156v35m-17-18h34m-17 18-14 24m14-24 14 24" />
      <SvgText x={30} y={148} strong>{ru ? 'ВОСТОК' : 'EAST'}</SvgText>
      <SvgText x={202} y={158}>{ru ? 'горизонт' : 'horizon'}</SvgText>
      <SvgText x={232} y={104}>{ru ? 'эклиптика' : 'ecliptic'}</SvgText>
      <SvgText x={91} y={194} strong>ASC</SvgText>
      <g className={styles.diagramSteps}>
        <rect x="22" y="258" width="98" height="52" rx="14" />
        <rect x="131" y="258" width="98" height="52" rx="14" />
        <rect x="240" y="258" width="98" height="52" rx="14" />
      </g>
      <SvgText x={71} y={279} anchor="middle" strong>{ru ? '1 · восток' : '1 · east'}</SvgText>
      <SvgText x={71} y={297} anchor="middle">{ru ? 'край неба' : 'sky edge'}</SvgText>
      <SvgText x={180} y={279} anchor="middle" strong>{ru ? '2 · пересечение' : '2 · crossing'}</SvgText>
      <SvgText x={180} y={297} anchor="middle">{ru ? 'двух линий' : 'of two lines'}</SvgText>
      <SvgText x={289} y={279} anchor="middle" strong>{ru ? '3 · точка ASC' : '3 · ASC point'}</SvgText>
      <SvgText x={289} y={297} anchor="middle">{ru ? 'в этот момент' : 'at that moment'}</SvgText>
    </svg>
  );
}

const sectorColors = ['#d9b66f', '#8fb0a7', '#879fbd', '#9b8bb0', '#bf8478', '#88a9ad'];

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function sectorPath(index: number) {
  const start = polar(180, 154, 118, index * 30);
  const end = polar(180, 154, 118, (index + 1) * 30);
  return `M180 154 L${start.x} ${start.y} A118 118 0 0 1 ${end.x} ${end.y} Z`;
}

function HousesDiagram({ language }: DiagramProps) {
  const ru = language === 'ru';
  return (
    <svg viewBox="0 0 360 360" role="img" aria-label={copy[language].houses[1]}>
      {Array.from({ length: 12 }, (_, index) => (
        <path key={index} d={sectorPath(index)} fill={sectorColors[index % sectorColors.length]} stroke="#fff" strokeWidth="3" />
      ))}
      <circle cx="180" cy="154" r="118" className={styles.diagramOutline} />
      <circle cx="180" cy="154" r="43" className={styles.diagramCenter} />
      {Array.from({ length: 12 }, (_, index) => {
        const point = polar(180, 154, 88, index * 30 + 15);
        return <SvgText key={index} x={point.x} y={point.y + 5} anchor="middle" strong>{index + 1}</SvgText>;
      })}
      <SvgText x={180} y={148} anchor="middle" strong>{ru ? 'КАРТА' : 'CHART'}</SvgText>
      <SvgText x={180} y={168} anchor="middle">12</SvgText>
      <path className={styles.diagramCallout} d="M180 36V15H92" />
      <circle className={styles.diagramCalloutPoint} cx="180" cy="36" r="5" />
      <SvgText x={20} y={19} strong>{ru ? 'КУСПИД = линия' : 'CUSP = line'}</SvgText>
      <path className={styles.diagramCallout} d="M77 94 42 72H20" />
      <circle className={styles.diagramCalloutPoint} cx="77" cy="94" r="5" />
      <SvgText x={20} y={56} strong>{ru ? 'ДОМ = сектор' : 'HOUSE = sector'}</SvgText>
      <g className={styles.diagramLegendCard}>
        <rect x="24" y="292" width="312" height="48" rx="14" />
        <SvgText x={180} y={313} anchor="middle" strong>{ru ? 'Каждый дом начинается с куспида' : 'Each house begins at a cusp'}</SvgText>
        <SvgText x={180} y={330} anchor="middle">{ru ? 'и занимает пространство до следующей линии' : 'and continues until the next line'}</SvgText>
      </g>
    </svg>
  );
}

const aspects = [
  { ru: 'Соединение', en: 'Conjunction', angle: '0°', x: 88, y: 72, a: [56, 80], b: [62, 80], color: '#ff7868' },
  { ru: 'Секстиль', en: 'Sextile', angle: '60°', x: 272, y: 72, a: [240, 88], b: [283, 63], color: '#38a980' },
  { ru: 'Квадрат', en: 'Square', angle: '90°', x: 88, y: 230, a: [55, 244], b: [88, 211], color: '#f19c38' },
  { ru: 'Тригон', en: 'Trine', angle: '120°', x: 272, y: 230, a: [240, 246], b: [288, 218], color: '#6c8be8' },
  { ru: 'Оппозиция', en: 'Opposition', angle: '180°', x: 180, y: 388, a: [135, 388], b: [225, 388], color: '#976bd8' },
] as const;

function AspectsDiagram({ language }: DiagramProps) {
  return (
    <svg viewBox="0 0 360 480" role="img" aria-label={copy[language].aspects[1]}>
      {aspects.map((aspect, index) => (
        <g key={aspect.angle}>
          <rect className={styles.diagramMiniCard} x={index === 4 ? 98 : aspect.x - 78} y={aspect.y - 58} width={index === 4 ? 164 : 156} height="128" rx="18" />
          <circle cx={aspect.x} cy={aspect.y + 8} r="44" fill="none" stroke="#d9d9d9" strokeWidth="2" />
          <line x1={aspect.x} y1={aspect.y + 8} x2={aspect.a[0]} y2={aspect.a[1]} stroke={aspect.color} strokeWidth="4" strokeLinecap="round" />
          <line x1={aspect.x} y1={aspect.y + 8} x2={aspect.b[0]} y2={aspect.b[1]} stroke={aspect.color} strokeWidth="4" strokeLinecap="round" />
          <circle cx={aspect.a[0]} cy={aspect.a[1]} r="7" fill={aspect.color} />
          <circle cx={aspect.b[0]} cy={aspect.b[1]} r="7" fill={aspect.color} />
          <SvgText x={aspect.x} y={aspect.y - 31} anchor="middle" strong>{language === 'ru' ? aspect.ru : aspect.en}</SvgText>
          <SvgText x={aspect.x} y={aspect.y + 14} anchor="middle" strong>{aspect.angle}</SvgText>
        </g>
      ))}
      <SvgText x={180} y={470} anchor="middle">{language === 'ru' ? 'орбис = небольшой допуск около точного угла' : 'orb = a small tolerance around the exact angle'}</SvgText>
    </svg>
  );
}

function RetrogradeDiagram({ language }: DiagramProps) {
  const ru = language === 'ru';
  return (
    <svg viewBox="0 0 360 420" role="img" aria-label={copy[language].retrograde[1]}>
      <defs><clipPath id="retro-space-clip"><rect x="16" y="18" width="328" height="184" rx="22" /></clipPath></defs>
      <rect className={styles.diagramPanelWarm} x="16" y="18" width="328" height="184" rx="22" />
      <g clipPath="url(#retro-space-clip)">
        <SvgText x={32} y={46} strong>{ru ? '1 · В КОСМОСЕ' : '1 · IN SPACE'}</SvgText>
        <circle className={styles.diagramSun} cx="80" cy="116" r="24" />
        <ellipse className={styles.diagramOrbit} cx="80" cy="116" rx="58" ry="52" />
        <ellipse className={styles.diagramOrbit} cx="80" cy="116" rx="124" ry="84" />
        <circle className={styles.diagramEarth} cx="122" cy="79" r="12" />
        <circle className={styles.diagramPlanet} cx="190" cy="50" r="9" />
        <path className={styles.diagramForward} d="M111 169c20 12 43 17 65 15m-65-15 4 12m-4-12 13-1M247 85c11 17 15 37 12 57m-12-57 12 5m-12-5 1 13" />
        <SvgText x={214} y={103}>{ru ? 'обе продолжают' : 'both continue'}</SvgText>
        <SvgText x={214} y={121} strong>{ru ? 'вперёд →' : 'forward →'}</SvgText>
        <line className={styles.diagramSight} x1="122" y1="79" x2="190" y2="50" />
      </g>
      <rect className={styles.diagramPanelSky} x="16" y="220" width="328" height="178" rx="22" />
      <SvgText x={32} y={250} strong>{ru ? '2 · НА НЕБЕ С ЗЕМЛИ' : '2 · IN EARTH’S SKY'}</SvgText>
      {[42, 78, 119, 164, 212, 258, 307].map((x, index) => <circle key={x} className={styles.diagramStar} cx={x} cy={282 + (index % 3) * 29} r={index % 2 ? 2 : 3} />)}
      <path className={styles.diagramLoop} d="M38 353C91 330 117 364 151 348c31-15 16-58 55-47 31 9 9 51 42 55 26 3 45-21 72-7" />
      <path className={styles.diagramLoopArrow} d="m320 349-14-3m14 3-6 12" />
      <SvgText x={180} y={386} anchor="middle" strong>{ru ? 'видимая петля — не разворот планеты' : 'apparent loop — the planet does not turn'}</SvgText>
    </svg>
  );
}

function MoonFace({ x, y, type }: { x: number; y: number; type: 'new' | 'first' | 'full' | 'last' }) {
  return (
    <g>
      <circle cx={x} cy={y} r="24" fill="#263243" />
      {type === 'full' ? <circle cx={x} cy={y} r="22" fill="#fff8d7" /> : null}
      {type === 'first' ? <path d={`M${x} ${y - 22}a22 22 0 0 1 0 44z`} fill="#fff8d7" /> : null}
      {type === 'last' ? <path d={`M${x} ${y - 22}a22 22 0 0 0 0 44z`} fill="#fff8d7" /> : null}
      <circle cx={x} cy={y} r="24" fill="none" stroke="#687386" strokeWidth="2" />
    </g>
  );
}

function MoonPhasesDiagram({ language }: DiagramProps) {
  const ru = language === 'ru';
  return (
    <svg viewBox="0 0 360 500" role="img" aria-label={copy[language].moon[1]}>
      <circle className={styles.diagramSun} cx="180" cy="45" r="28" />
      <SvgText x={180} y={88} anchor="middle" strong>{ru ? 'СОЛНЕЧНЫЙ СВЕТ ↓' : 'SUNLIGHT ↓'}</SvgText>
      <path className={styles.diagramLightBeam} d="M118 99h124l42 222H76z" />
      <circle className={styles.diagramMoonOrbit} cx="180" cy="222" r="102" />
      <circle className={styles.diagramEarth} cx="180" cy="222" r="27" />
      <SvgText x={180} y={227} anchor="middle" strong>{ru ? 'ЗЕМЛЯ' : 'EARTH'}</SvgText>
      <circle className={styles.diagramMoon} cx="180" cy="120" r="16" />
      <circle className={styles.diagramMoon} cx="282" cy="222" r="16" />
      <circle className={styles.diagramMoon} cx="180" cy="324" r="16" />
      <circle className={styles.diagramMoon} cx="78" cy="222" r="16" />
      <path className={styles.diagramOrbitArrow} d="M278 196c-4-22-15-42-30-57m30 57-9-10m9 10 3-14" />
      <SvgText x={180} y={354} anchor="middle">{ru ? 'положение Луны меняется' : 'the Moon changes position'}</SvgText>
      <MoonFace x={45} y={410} type="new" />
      <MoonFace x={135} y={410} type="first" />
      <MoonFace x={225} y={410} type="full" />
      <MoonFace x={315} y={410} type="last" />
      <SvgText x={45} y={451} anchor="middle" strong>{ru ? 'Новая' : 'New'}</SvgText>
      <SvgText x={135} y={451} anchor="middle" strong>{ru ? '¼ цикла' : '¼ cycle'}</SvgText>
      <SvgText x={225} y={451} anchor="middle" strong>{ru ? 'Полная' : 'Full'}</SvgText>
      <SvgText x={315} y={451} anchor="middle" strong>{ru ? '¾ цикла' : '¾ cycle'}</SvgText>
      <SvgText x={180} y={485} anchor="middle">{ru ? 'мы видим разную часть освещённой половины' : 'we see a changing part of the sunlit half'}</SvgText>
    </svg>
  );
}

function LunarNodesDiagram({ language }: DiagramProps) {
  const ru = language === 'ru';
  return (
    <svg viewBox="0 0 360 350" role="img" aria-label={copy[language].nodes[1]}>
      <rect className={styles.diagramPlane} x="22" y="146" width="316" height="72" rx="18" />
      <SvgText x={180} y={207} anchor="middle" strong>{ru ? 'ПЛОСКОСТЬ ЭКЛИПТИКИ' : 'ECLIPTIC PLANE'}</SvgText>
      <path className={styles.diagramTiltedOrbit} d="M32 260C106 313 254 65 328 118" />
      <circle className={styles.diagramEarth} cx="180" cy="182" r="27" />
      <circle className={styles.diagramMoon} cx="295" cy="100" r="15" />
      <circle className={styles.diagramNorthNode} cx="111" cy="182" r="9" />
      <circle className={styles.diagramSouthNode} cx="249" cy="182" r="9" />
      <path className={styles.diagramNodeArrowNorth} d="M88 214c13-10 22-22 29-37m-29 37 1-13m-1 13 13-3" />
      <path className={styles.diagramNodeArrowSouth} d="M226 149c13 10 22 22 29 37m-29-37 1 13m-1-13 13 3" />
      <SvgText x={53} y={242} strong>{ru ? 'Северный узел' : 'North Node'}</SvgText>
      <SvgText x={53} y={259}>{ru ? 'Луна идёт вверх' : 'Moon moves upward'}</SvgText>
      <SvgText x={218} y={129} strong>{ru ? 'Южный узел' : 'South Node'}</SvgText>
      <SvgText x={218} y={146}>{ru ? 'Луна идёт вниз' : 'Moon moves downward'}</SvgText>
      <g className={styles.diagramLegendCard}>
        <rect x="28" y="298" width="304" height="38" rx="13" />
        <SvgText x={180} y={322} anchor="middle" strong>{ru ? '● узел = точка пересечения' : '● node = crossing point'}</SvgText>
      </g>
    </svg>
  );
}

function EclipsesDiagram({ language }: DiagramProps) {
  const ru = language === 'ru';
  return (
    <svg viewBox="0 0 360 400" role="img" aria-label={copy[language].eclipses[1]}>
      <rect className={styles.diagramPanelWarm} x="16" y="16" width="328" height="170" rx="22" />
      <SvgText x={32} y={44} strong>{ru ? 'СОЛНЕЧНОЕ ЗАТМЕНИЕ' : 'SOLAR ECLIPSE'}</SvgText>
      <circle className={styles.diagramSun} cx="62" cy="104" r="29" />
      <circle className={styles.diagramMoon} cx="177" cy="104" r="16" />
      <circle className={styles.diagramEarth} cx="295" cy="104" r="27" />
      <path className={styles.diagramShadow} d="M193 92 268 80v48l-75-12z" />
      <SvgText x={177} y={150} anchor="middle">{ru ? 'Луна между Солнцем и Землёй' : 'Moon between Sun and Earth'}</SvgText>
      <rect className={styles.diagramPanelSky} x="16" y="204" width="328" height="170" rx="22" />
      <SvgText x={32} y={232} strong>{ru ? 'ЛУННОЕ ЗАТМЕНИЕ' : 'LUNAR ECLIPSE'}</SvgText>
      <circle className={styles.diagramSun} cx="62" cy="292" r="29" />
      <circle className={styles.diagramEarth} cx="177" cy="292" r="27" />
      <path className={styles.diagramShadow} d="M204 274 326 259v66l-122-15z" />
      <circle className={styles.diagramEclipsedMoon} cx="295" cy="292" r="16" />
      <SvgText x={177} y={346} anchor="middle">{ru ? 'Земля между Солнцем и Луной' : 'Earth between Sun and Moon'}</SvgText>
      <SvgText x={180} y={394} anchor="middle" strong>{ru ? 'затмение возможно только рядом с лунным узлом' : 'an eclipse is possible only near a lunar node'}</SvgText>
    </svg>
  );
}

function LilithDiagram({ language }: DiagramProps) {
  const ru = language === 'ru';
  return (
    <svg viewBox="0 0 360 350" role="img" aria-label={copy[language].lilith[1]}>
      <ellipse className={styles.diagramLilithOrbit} cx="180" cy="155" rx="142" ry="82" />
      <circle className={styles.diagramEarth} cx="118" cy="155" r="28" />
      <circle className={styles.diagramMoon} cx="298" cy="106" r="16" />
      <circle className={styles.diagramLilithPoint} cx="322" cy="155" r="12" />
      <path className={styles.diagramLilithCross} d="m316 149 12 12m0-12-12 12" />
      <path className={styles.diagramCallout} d="M322 143V72H236" />
      <SvgText x={232} y={50} strong>{ru ? 'ЛИЛИТ / АПОГЕЙ' : 'LILITH / APOGEE'}</SvgText>
      <SvgText x={232} y={68}>{ru ? 'самая дальняя область' : 'most distant region'}</SvgText>
      <SvgText x={118} y={160} anchor="middle" strong>{ru ? 'ЗЕМЛЯ' : 'EARTH'}</SvgText>
      <SvgText x={278} y={86}>{ru ? 'Луна' : 'Moon'}</SvgText>
      <g className={styles.diagramWarningCard}>
        <rect x="30" y="262" width="300" height="64" rx="16" />
        <circle cx="63" cy="294" r="15" />
        <path d="m56 287 14 14m0-14-14 14" />
        <SvgText x={91} y={289} strong>{ru ? 'ЗДЕСЬ НЕТ ОБЪЕКТА' : 'NO OBJECT IS HERE'}</SvgText>
        <SvgText x={91} y={308}>{ru ? 'это координата, которую рассчитывают' : 'it is a calculated coordinate'}</SvgText>
      </g>
    </svg>
  );
}

function ZodiacWheelDiagram({ language }: DiagramProps) {
  const ru = language === 'ru';
  return (
    <svg viewBox="0 0 360 370" role="img" aria-label={copy[language].zodiac[1]}>
      {Array.from({ length: 12 }, (_, index) => <path key={index} d={sectorPath(index)} fill={sectorColors[index % sectorColors.length]} stroke="#fff" strokeWidth="3" />)}
      <circle cx="180" cy="154" r="118" className={styles.diagramOutline} />
      <circle cx="180" cy="154" r="54" className={styles.diagramCenter} />
      {Array.from({ length: 12 }, (_, index) => {
        const point = polar(180, 154, 86, index * 30 + 15);
        return <SvgText key={index} x={point.x} y={point.y + 4} anchor="middle" strong>{index + 1}</SvgText>;
      })}
      <SvgText x={180} y={148} anchor="middle" strong>360°</SvgText>
      <SvgText x={180} y={169} anchor="middle">12 × 30°</SvgText>
      <path className={styles.diagramAngleArc} d="M180 20a134 134 0 0 1 67 18" />
      <SvgText x={228} y={25} strong>30°</SvgText>
      <g className={styles.diagramLegendCard}>
        <rect x="24" y="292" width="312" height="56" rx="15" />
        <SvgText x={180} y={316} anchor="middle" strong>{ru ? '12 равных участков эклиптики' : '12 equal sections of the ecliptic'}</SvgText>
        <SvgText x={180} y={335} anchor="middle">{ru ? 'названия знаков идут по порядку круга' : 'sign names follow the circle in order'}</SvgText>
      </g>
    </svg>
  );
}

const DIAGRAMS: Record<KnowledgeDiagramId, ComponentType<DiagramProps>> = {
  ascendant: AscendantDiagram,
  aspects: AspectsDiagram,
  eclipses: EclipsesDiagram,
  houses: HousesDiagram,
  'lilith-apogee': LilithDiagram,
  'lunar-nodes': LunarNodesDiagram,
  'moon-phases': MoonPhasesDiagram,
  'retrograde-motion': RetrogradeDiagram,
  'zodiac-wheel': ZodiacWheelDiagram,
};

const contentKey: Record<KnowledgeDiagramId, keyof typeof copy.ru> = {
  ascendant: 'ascendant', aspects: 'aspects', eclipses: 'eclipses', houses: 'houses',
  'lilith-apogee': 'lilith', 'lunar-nodes': 'nodes', 'moon-phases': 'moon',
  'retrograde-motion': 'retrograde', 'zodiac-wheel': 'zodiac',
};

const RASTER_DIAGRAMS: Partial<Record<KnowledgeDiagramId, string>> = {
  ascendant: 'ascendant',
  eclipses: 'eclipses',
  houses: 'houses',
  'lilith-apogee': 'lilith-apogee',
  'lunar-nodes': 'lunar-nodes',
  'moon-phases': 'moon-phases',
  'retrograde-motion': 'retrograde-motion',
};

export function KnowledgeDiagram({ diagram, language }: KnowledgeDiagramProps) {
  const Artwork = DIAGRAMS[diagram];
  const [title, description, caption] = copy[language][contentKey[diagram]];
  const rasterDiagram = RASTER_DIAGRAMS[diagram];
  return (
    <figure className={styles.diagram}>
      <div className={styles.diagramIntro}>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {rasterDiagram ? (
        <img
          className={styles.diagramArtwork}
          src={`/encyclopedia/concepts/${rasterDiagram}.webp`}
          alt={description}
          width="640"
          height="640"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <Artwork language={language} />
      )}
      <figcaption><strong>{caption}</strong><span>{copy[language].scale}</span></figcaption>
    </figure>
  );
}
