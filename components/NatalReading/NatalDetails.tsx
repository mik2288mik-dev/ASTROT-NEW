import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Circle, House, Compass, Triangle } from 'lucide-react';
import type { NatalChartWheelSource } from '../../lib/natalChartWheelModel';
import { PlanetIcon } from '../icons/PlanetIcon';
import { buildMapData, explainMapSelection, mapObject, MAP_HOUSES, MAP_ASPECTS, type MapSelection } from './mapExplanation';
import styles from './NatalSection.module.css';
import { NatalArtwork, type NatalArt } from './NatalArtwork';

type Row = MapSelection & { title: string; meaning: string; objectKey?: string };
const PLANETS = new Set(['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto']);

export function NatalDetails({ chart, onSelect }: { chart: NatalChartWheelSource; onSelect: (selection: MapSelection, target: HTMLElement) => void }) {
  const data = buildMapData(chart);
  const [expanded, setExpanded] = useState<string[]>([]);
  const points = (planet: boolean): Row[] => (planet ? data.allPoints.filter(p => PLANETS.has(p.key)) : [...data.angles, ...data.bodies.filter(p => !PLANETS.has(p.key))]).map(p => {
    const selection: MapSelection = { kind: 'point', id: p.key };
    const explanation = explainMapSelection(chart, selection);
    return { ...selection, title: explanation?.yours || p.name, meaning: mapObject(p.key)?.what || '', objectKey: p.key };
  });
  const groups = [
    { title: 'Планеты', Icon: Circle, rows: points(true), color: '#ed8700' },
    { title: 'Дома', Icon: House, rows: data.houses.map(h => ({ kind: 'house', id: String(h.house), title: `${h.house} дом — ${MAP_HOUSES[h.house]}`, meaning: explainMapSelection(chart, {kind:'house',id:String(h.house)})?.yours || '' } satisfies Row)), color: '#7b44df' },
    { title: 'Аспекты', Icon: Triangle, rows: [...data.aspects].sort((a,b) => Number(!(PLANETS.has(a.fromKey) && PLANETS.has(a.toKey))) - Number(!(PLANETS.has(b.fromKey) && PLANETS.has(b.toKey)))).map(a => ({ kind: 'aspect', id: a.id, title: `${MAP_ASPECTS[a.type].name}: ${mapObject(a.fromKey)?.name || a.fromKey} — ${mapObject(a.toKey)?.name || a.toKey}`, meaning: explainMapSelection(chart,{kind:'aspect',id:a.id})?.meaning || MAP_ASPECTS[a.type].what } satisfies Row)), color: '#3b70d6' },
    { title: 'Асцендент и точки', Icon: Compass, rows: points(false), color: '#008879' },
  ];
  return <div aria-label="Подробности твоей карты">{groups.map(({title, Icon, rows, color}) => {
    const open = expanded.includes(title);
    const shown = open ? rows : rows.slice(0,3);
    const art: NatalArt = title === 'Планеты' ? 'character' : title === 'Дома' ? 'home' : title === 'Аспекты' ? 'communication' : 'plus';
    return <section key={title} className={styles.detailsGroup} style={{'--section-accent':color} as React.CSSProperties}>
      <header className={styles.detailsHeading}><span className={styles.sectionMarker}><Icon size={22} aria-hidden="true"/></span><h2>{title}</h2><small>{rows.length}</small><NatalArtwork art={art}/></header>
      <div className={styles.detailsRows}>{shown.map(row => <button key={row.id} type="button" onClick={e => onSelect({kind:row.kind,id:row.id},e.currentTarget)}>
        {row.objectKey ? <PlanetIcon planet={row.objectKey === 'northNode' ? 'north-node' : row.objectKey === 'southNode' ? 'south-node' : row.objectKey === 'ascendant' ? 'asc' : row.objectKey === 'descendant' ? 'desc' : row.objectKey} size={24} stroke={mapObject(row.objectKey)?.color}/> : <Icon size={24} color={color} aria-hidden="true"/>}
        <span><strong>{row.title}</strong><small>{row.meaning}</small></span><ChevronRight size={17} aria-hidden="true"/>
      </button>)}</div>
      {!rows.length ? <p className={styles.detailsEmpty}>В сохранённой карте нет надёжных данных для этой группы.</p> : rows.length > 3 ? <button type="button" className={styles.detailsMore} aria-expanded={open} onClick={() => setExpanded(current => open ? current.filter(item => item !== title) : [...current,title])}>{open ? 'Свернуть' : `Все ${rows.length}`}<ChevronDown size={17} aria-hidden="true" style={{transform:open?'rotate(180deg)':undefined}}/></button> : null}
    </section>;
  })}</div>;
}
