import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, ChevronDown, X, House, Triangle, Circle, BookOpen } from 'lucide-react';
import type { NatalChartWheelSource } from '../../lib/natalChartWheelModel';
import { natalChartWheelHouseLabelLongitude } from '../../lib/natalChartWheelModel';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import { buildMapData, explainMapSelection, MAP_SIGNS, MAP_SIGN_NAMES, mapObject, MAP_ASPECTS, type MapSelection } from './mapExplanation';
import styles from './InteractiveNatalMap.module.css';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { PlanetIcon } from '../icons/PlanetIcon';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { NatalMapExplanationScreen } from './NatalMapExplanationScreen';
import { NatalDetails } from './NatalDetails';
import sectionStyles from './NatalSection.module.css';
import { NatalPlusEntry } from './NatalPlusEntry';
import type { PaywallContext } from '../../lib/paywallContext';

const SIGN_COLORS = ['#cf403b','#087d5e','#076aa6','#6542c5','#d25923','#567423','#a33a89','#275dc5','#d1681b','#168478','#6841c6','#1374bc'];
const PLANET_KEYS = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
const ASPECT_GROUPS = [
  { type: 'conjunction', title: 'Соединения' },
  { type: 'sextile', title: 'Секстили' },
  { type: 'trine', title: 'Тригоны' },
  { type: 'square', title: 'Квадраты' },
  { type: 'opposition', title: 'Оппозиции' },
] as const;
type ElementItem = MapSelection & { label: string };
const HELP = [
  { Icon: Circle, title: 'Планета — что именно', text: 'Показывает, о какой части человека идёт речь.' },
  { Icon: BookOpen, title: 'Знак — как проявляется', text: 'Показывает, каким образом это выражается.' },
  { Icon: House, title: 'Дом — где проявляется', text: 'Показывает, в какой части жизни это заметнее.' },
  { Icon: Triangle, title: 'Аспекты — как связано', text: 'Показывают, как разные части карты влияют друг на друга.' },
];

export function InteractiveNatalMap({ chart, name, birthLine, view = 'map', isPremium = false, onRequestPremium, premiumContinuation, onPremiumContinuationHandled }: {
  chart: NatalChartWheelSource; name: string; birthLine: string; view?: 'map' | 'details'; isPremium?: boolean;
  onRequestPremium?: (selection: MapSelection, view: 'map' | 'details') => void;
  premiumContinuation?: PaywallContext | null; onPremiumContinuationHandled?: (id: string) => void;
}) {
  const data = buildMapData(chart);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [detail, setDetail] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | SVGElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const backAction = useRef(() => {});
  const explanation = selection ? explainMapSelection(chart, selection) : null;
  const isOpen = Boolean(selection && explanation);
  const fullAccess = isPremium || (selection?.kind === 'point' && ['sun','moon','ascendant'].includes(selection.id));
  useEffect(() => {
    if (premiumContinuation?.returnAction !== 'open_natal_map_element' || premiumContinuation.returnView !== 'chart') return;
    const [fromView,kind,...idParts] = (premiumContinuation.returnEntityId || '').split(':');
    const id = idParts.join(':');
    if (fromView !== view) return;
    if (!['point','house','aspect','sign'].includes(kind) || !id) return;
    const restored = {kind:kind as MapSelection['kind'],id};
    if (!explainMapSelection(chart,restored)) return;
    setSelection(restored); setDetail(true);
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [chart, view, premiumContinuation, onPremiumContinuationHandled]);
  const quality = getPermanentNatalReliability(chart).quality;
  const rotation = (data.angles.find(p => p.key === 'ascendant')?.longitude ?? -270) + 270;
  const point = (longitude: number, radius: number) => {
    const a = (rotation - longitude - 90) * Math.PI / 180;
    return { x: 200 + Math.cos(a) * radius, y: 200 + Math.sin(a) * radius };
  };
  const selected = (kind: MapSelection['kind'], id: string) => selection?.kind === kind && selection.id === id;
  const markers: { x: number; y: number }[] = [];
  const houseMarkers = data.houses.map(h => point(natalChartWheelHouseLabelLongitude(h, data.houses), 142));
  data.bodies.forEach(p => {
    let candidate = point(p.longitude, 128);
    const offsets = [0, ...Array.from({length:45}, (_, i) => [(i + 1) * 4, -(i + 1) * 4]).flat()];
    outer: for (const offset of offsets) {
      for (const radius of [128, 105, 82]) {
        candidate = point(p.longitude + offset, radius);
        if (markers.every(m => Math.hypot(m.x - candidate.x, m.y - candidate.y) >= 29)
          && houseMarkers.every(m => Math.hypot(m.x - candidate.x, m.y - candidate.y) >= 27)) break outer;
      }
    }
    markers.push(candidate);
  });
  const objectIcon = (key: string, size: number) => <PlanetIcon planet={key === 'northNode' ? 'north-node' : key === 'southNode' ? 'south-node' : key === 'ascendant' ? 'asc' : key === 'descendant' ? 'desc' : key} size={size} strokeWidth={1.7}/>;
  const choose = (kind: MapSelection['kind'], id: string, target: EventTarget | null) => {
    opener.current = target as HTMLElement | SVGElement;
    setDetail(false); setSelection({ kind, id });
  };
  const close = () => { setSelection(null); setDetail(false); };
  backAction.current = () => { if (detail) setDetail(false); else close(); };
  useEffect(() => {
    if (!selection) return;
    const nativeBack = (event: Event) => {
      const payload = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (payload?.handled) return;
      if (payload) payload.handled = true;
      event.stopImmediatePropagation(); backAction.current();
    };
    window.addEventListener(NATIVE_BACK_EVENT, nativeBack, true);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, nativeBack, true);
  }, [selection]);
  useEffect(() => {
    const el = dialog.current;
    if (isOpen && el && !el.open) el.showModal();
    if (isOpen) {
      const previous = document.body.style.overflow;
      const host = (window as unknown as { Telegram?: { WebApp?: { isVersionAtLeast?: (v: string) => boolean; isVerticalSwipesEnabled?: boolean; disableVerticalSwipes?: () => void; enableVerticalSwipes?: () => void } } }).Telegram?.WebApp;
      const restoreSwipes = host?.isVerticalSwipesEnabled !== false;
      const canControlSwipes = host?.isVersionAtLeast?.('7.7') && !!host.disableVerticalSwipes;
      if (canControlSwipes) host?.disableVerticalSwipes?.();
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
        if (canControlSwipes && restoreSwipes) host?.enableVerticalSwipes?.();
        el?.close();
        if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      };
    }
  // Selection changes are local; no chart request or persistence runs here.
  }, [isOpen]);
  useEffect(() => {
    if (!dialog.current?.open) return;
    content.current?.scrollTo(0, 0);
    dialog.current.querySelector<HTMLButtonElement>('button')?.focus();
  }, [detail]);
  const interactive = (kind: MapSelection['kind'], id: string, label: string) => ({
    role: 'button', tabIndex: 0, 'aria-label': label, 'aria-pressed': selected(kind, id),
    onClick: (e: React.MouseEvent<SVGElement>) => {
      let targetId = id;
      if (kind === 'aspect' && e.detail > 0) {
        const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
        if (box?.width && box.height) {
          const x = (e.clientX - box.x) * 400 / box.width, y = (e.clientY - box.y) * 400 / box.height;
          let nearest = Infinity;
          for (const aspect of data.aspects) {
            const a = point(aspect.fromLongitude, 89), b = point(aspect.toLongitude, 89);
            const dx = b.x - a.x, dy = b.y - a.y;
            const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
            const distance = Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
            if (distance < nearest - .01) { nearest = distance; targetId = aspect.id; }
          }
        }
      }
      choose(kind, targetId, e.currentTarget);
    },
    onKeyDown: (e: React.KeyboardEvent<SVGElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(kind, id, e.currentTarget); } },
  });
  const pointItems = (points: typeof data.allPoints): ElementItem[] => points.map(p => ({ kind: 'point', id: p.key, label: mapObject(p.key)?.name || p.name }));
  const angleKeys = new Set(data.angles.map(p => p.key));
  const elementGroups = [
    { title: 'Планеты', items: pointItems(data.allPoints.filter(p => PLANET_KEYS.has(p.key))) },
    { title: 'Дома', items: data.houses.map(h => ({ kind: 'house', id: String(h.house), label: `${h.house} дом` } satisfies ElementItem)) },
    { title: 'Угловые точки', items: pointItems(data.angles) },
    { title: 'Другие точки', items: pointItems(data.allPoints.filter(p => !PLANET_KEYS.has(p.key) && !angleKeys.has(p.key))) },
  ];
  const elementList = (items: ElementItem[]) => <div className={styles.elementList}>{items.map(item => <button key={`${item.kind}:${item.id}`} type="button" onClick={e => choose(item.kind, item.id, e.currentTarget)}><span>{item.label}</span><ChevronRight size={16} aria-hidden="true"/></button>)}</div>;
  const groupSummary = (title: string, count: number) => <summary><span>{title}</span><span className={styles.elementCount} aria-label={`Элементов: ${count}`}>{count}</span><ChevronDown size={18} className={styles.groupArrow} aria-hidden="true"/></summary>;
  return <section className={view === 'details' ? sectionStyles.content : styles.map} aria-labelledby="interactive-map-name">
    <header className={styles.person}><h1 id="interactive-map-name">{name}</h1><p>{birthLine}</p></header>
    {view === 'details' ? <NatalDetails key={name + birthLine} chart={chart} onSelect={(item, target) => choose(item.kind, item.id, target)}/> : <>
    <svg viewBox="0 0 400 400" className={styles.wheel} aria-label="Твоя натальная карта. Выбери планету, знак, дом или аспект.">
      <circle cx="200" cy="200" r="184" fill="white"/>
      {MAP_SIGNS.map((sign, i) => {
        const a = point(i * 30, 184), b = point(i * 30 + 30, 184), c = point(i * 30 + 30, 155), d = point(i * 30, 155), g = point(i * 30 + 15, 170);
        return <g key={sign} className={styles.sign} style={{'--sign-fill':['#ffe0dc','#bceede','#ffebbf','#c9ddff','#ffe0dc','#bceede','#e0d3ff','#c9ddff','#ffe0dc','#bceede','#ffebbf','#c9ddff'][i]} as React.CSSProperties} {...interactive('sign', sign, `Знак: ${MAP_SIGN_NAMES[i]}`)}>
          <path d={`M ${a.x} ${a.y} A 184 184 0 0 0 ${b.x} ${b.y} L ${c.x} ${c.y} A 155 155 0 0 1 ${d.x} ${d.y} Z`} stroke="white" strokeWidth="1"/>
          <g transform={`translate(${g.x - 15} ${g.y - 15})`} style={{color:SIGN_COLORS[i]}}><ZodiacIcon sign={sign} size={30} strokeWidth={1.6}/></g>
        </g>;
      })}
      <circle cx="200" cy="200" r="155" className={styles.ring}/><circle cx="200" cy="200" r="89" className={styles.ring}/>
      {data.houses.map(h => {
        const a = point(h.longitude, 155), b = point(h.longitude, 89), g = point(natalChartWheelHouseLabelLongitude(h, data.houses), 142);
        return <g key={h.house} className={styles.house}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><g {...interactive('house', String(h.house), `${h.house} дом`)} transform={`translate(${g.x} ${g.y})`}><circle r="13"/><text y="4" textAnchor="middle">{h.house}</text></g>
        </g>;
      })}
      {data.aspects.map(a => {
        const from = point(a.fromLongitude, 89), to = point(a.toLongitude, 89);
        const label = `${mapObject(a.fromKey)?.name || a.fromKey} — ${mapObject(a.toKey)?.name || a.toKey}: ${MAP_ASPECTS[a.type].name}`;
        return <g key={a.id} className={`${styles.aspect} ${a.type === 'square' || a.type === 'opposition' ? styles.hard : styles.soft}`} {...interactive('aspect', a.id, label)}>
          <line className={styles.aspectHit} x1={from.x} y1={from.y} x2={to.x} y2={to.y}/><line className={styles.aspectLine} x1={from.x} y1={from.y} x2={to.x} y2={to.y}/>
        </g>;
      })}
      {data.bodies.map((p, i) => {
        const g = markers[i], anchor = point(p.longitude, 155); const meta = mapObject(p.key);
        return <g key={p.key} style={{ color: meta?.color }}>
          <line className={styles.leader} x1={anchor.x} y1={anchor.y} x2={g.x} y2={g.y}/><g className={styles.body} {...interactive('point', p.key, meta?.name || p.name)} transform={`translate(${g.x} ${g.y})`}><circle className={styles.bodyHalo} r="14"/>
          <g transform="translate(-16 -16)" style={{pointerEvents:'none'}}>{objectIcon(p.key, 32)}</g></g>
        </g>;
      })}
      {data.angles.map(p => { const g = point(p.longitude, 194); const meta = mapObject(p.key); return <g key={p.key} className={styles.angle} {...interactive('point', p.key, meta?.name || p.name)}><rect x={g.x - 15} y={g.y - 8} width="30" height="16" rx="5"/><text x={g.x} y={g.y + 4} textAnchor="middle">{meta?.glyph}</text></g>; })}
    </svg>
    {quality !== 'exact' ? <p className={styles.precision}>{quality === 'unknown' ? 'Время рождения не указано.' : 'Время рождения указано примерно.'} Показаны только надёжные положения. Меняющиеся точки и дома не используются в объяснениях.</p> : null}
    <details className={styles.help}><summary><BookOpen size={20} aria-hidden="true"/>Как читать карту<ChevronDown size={18} aria-hidden="true"/></summary><div className={styles.helpGrid}>{HELP.map(({Icon,title,text}) => <div key={title} className={styles.helpItem}><Icon aria-hidden="true"/><div><h3>{title}</h3><p>{text}</p></div></div>)}</div><p className={styles.hint}>Нажми на планету, номер дома или линию внутри круга, чтобы узнать больше.</p></details>
    <details className={styles.elements}>
      <summary>Все элементы твоей карты</summary>
      <div className={styles.elementGroups}>
        {elementGroups.filter(group => group.items.length > 0).map(group => <details key={group.title} className={styles.elementGroup}>
          {groupSummary(group.title, group.items.length)}
          {elementList(group.items)}
        </details>)}
        {data.aspects.length > 0 ? <details className={styles.elementGroup}>
          {groupSummary('Аспекты', data.aspects.length)}
          <div className={styles.aspectGroups}>{ASPECT_GROUPS.map(group => {
            const aspects = data.aspects.filter(a => a.type === group.type);
            if (!aspects.length) return null;
            return <details key={group.type} className={styles.elementGroup}>
              {groupSummary(group.title, aspects.length)}
              {elementList(aspects.map(a => ({ kind: 'aspect', id: a.id, label: `${mapObject(a.fromKey)?.name || a.fromKey} — ${mapObject(a.toKey)?.name || a.toKey}` })))}
            </details>;
          })}</div>
        </details> : null}
      </div>
    </details>
    </>}
    <dialog ref={dialog} className={`${styles.sheet} ${detail ? styles.detail : ''}`} aria-labelledby="map-explanation-title" onCancel={e => { e.preventDefault(); if (detail) setDetail(false); else close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      {explanation ? <div className={styles.sheetInner}>
        {detail ? <header className={styles.detailHeader}><button type="button" aria-label="Назад к краткому объяснению" onClick={() => setDetail(false)}><ArrowLeft/></button><h2 id="map-explanation-title">Почему такой вывод<span className={styles.detailObject}>{explanation.title}</span></h2><button type="button" aria-label="Закрыть объяснение" onClick={close}><X/></button></header> : <><div className={styles.handle} onPointerDown={e => { dragStart.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { if (dragStart.current !== null && e.clientY - dragStart.current > 55) close(); dragStart.current = null; }}><span/></div><header className={styles.sheetHeader}><span className={styles.symbol} style={{color: explanation.color}}>{selection?.kind === 'point' ? objectIcon(selection.id, 30) : selection?.kind === 'sign' ? <ZodiacIcon sign={selection.id} size={30} stroke={explanation.color}/> : selection?.kind === 'house' ? <House size={30}/> : <Triangle size={30}/>}</span><div className={styles.sheetHeading}><h2 id="map-explanation-title">{explanation.title}</h2><p>{explanation.yours}</p></div><button type="button" aria-label="Закрыть объяснение" onClick={close}><X/></button></header></>}
        <div ref={content} className={styles.sheetContent}>
          {detail ? fullAccess ? <NatalMapExplanationScreen explanation={explanation}/> : <div data-map-premium-entry><p className={styles.detailIntro}>{explanation.yours}</p><NatalPlusEntry title={`Почему такой вывод: ${explanation.title}`} onOpen={() => {if (selection) {const item=selection; close(); onRequestPremium?.(item,view);}}}>Из каких частей карты получилось это описание — в полном объяснении с NEBO+. Бесплатно можно посмотреть весь путь вывода для Солнца, Луны и Асцендента, если он рассчитан.</NatalPlusEntry></div> : <><p className={styles.selectionIntro}>{explanation.what}</p><button type="button" className={styles.why} onClick={() => setDetail(true)}><BookOpen size={20}/>Почему такой вывод<ChevronRight size={20}/></button></>}
        </div>
      </div> : null}
    </dialog>
  </section>;
}
