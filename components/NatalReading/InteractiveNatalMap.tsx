import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, LockKeyhole, X, House, Triangle, Circle, BookOpen } from 'lucide-react';
import type { NatalChartWheelSource } from '../../lib/natalChartWheelModel';
import { natalChartWheelHouseLabelLongitude } from '../../lib/natalChartWheelModel';
import { buildMapData, explainMapSelection, MAP_HOUSES, MAP_SIGNS, MAP_SIGN_NAMES, mapObject, MAP_ASPECTS, type MapSelection } from './mapExplanation';
import styles from './InteractiveNatalMap.module.css';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { PlanetIcon } from '../icons/PlanetIcon';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { NatalDetails } from './NatalDetails';
import sectionStyles from './NatalSection.module.css';
import { NatalPlusEntry } from './NatalPlusEntry';
import type { PaywallContext } from '../../lib/paywallContext';

// Sky palette by element: fire = sunset, earth = dawn, air = day sky, water = evening.
const ELEMENT_INK = ['#d9603f', '#a87517', '#2d6fd6', '#4b4f9e'];
const ELEMENT_FILL = ['#ffe4d9', '#fbefd6', '#deebfd', '#e7e4f7'];
const SIGN_COLORS = Array.from({ length: 12 }, (_, index) => ELEMENT_INK[index % 4]);
const SIGN_FILLS = Array.from({ length: 12 }, (_, index) => ELEMENT_FILL[index % 4]);
const HELP = [
  { Icon: Circle, title: 'Планета, что именно', text: 'Показывает, о какой части человека идёт речь.' },
  { Icon: BookOpen, title: 'Знак, как проявляется', text: 'Показывает, каким образом это выражается.' },
  { Icon: House, title: 'Дом, где проявляется', text: 'Показывает, в какой части жизни это заметнее.' },
  { Icon: Triangle, title: 'Аспекты, как связано', text: 'Показывают, как разные части карты влияют друг на друга.' },
];

/** Layers of the wheel the reader can bring forward; the rest fades back. */
type WheelMode = 'all' | 'planets' | 'houses' | 'aspects' | 'now';
const WHEEL_MODES: ReadonlyArray<{ id: WheelMode; label: string }> = [
  { id: 'all', label: 'Всё' },
  { id: 'planets', label: 'Планеты' },
  { id: 'houses', label: 'Дома' },
  { id: 'aspects', label: 'Связи' },
  { id: 'now', label: 'Сейчас' },
];
/** Free readers get the full explanation of these; every other element shows its first line. */
const FREE_POINTS = new Set(['sun', 'moon', 'ascendant']);
const SIGN_IN_RU = ['Овне', 'Тельце', 'Близнецах', 'Раке', 'Льве', 'Деве', 'Весах', 'Скорпионе', 'Стрельце', 'Козероге', 'Водолее', 'Рыбах'];
const NOW_BODIES = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;
type NowBody = { key: (typeof NOW_BODIES)[number]; longitude: number };
let skyEngine: Promise<typeof import('astronomy-engine')> | null = null;

function firstSentence(text: string): string {
  const match = text.match(/^.+?[.!?](?=\s|$)/u);
  return (match ? match[0] : text).trim();
}

/** The natal house a longitude falls in, from the house cusps; null when cusps are missing. */
function houseOfLongitude(longitude: number, houses: ReadonlyArray<{ house: number; longitude: number }>): number | null {
  if (houses.length !== 12) return null;
  const sorted = [...houses].sort((a, b) => a.house - b.house);
  for (let index = 0; index < 12; index += 1) {
    const start = sorted[index].longitude;
    const end = sorted[(index + 1) % 12].longitude;
    const span = (end - start + 360) % 360;
    if ((longitude - start + 360) % 360 < span) return sorted[index].house;
  }
  return null;
}

export function InteractiveNatalMap({ chart, name, birthLine, view = 'map', isPremium = false, onRequestPremium, premiumContinuation, onPremiumContinuationHandled }: {
  chart: NatalChartWheelSource; name: string; birthLine: string; view?: 'map' | 'details'; isPremium?: boolean;
  onRequestPremium?: (selection: MapSelection, view: 'map' | 'details') => void;
  premiumContinuation?: PaywallContext | null; onPremiumContinuationHandled?: (id: string) => void;
}) {
  const data = buildMapData(chart);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | SVGElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const backAction = useRef(() => {});
  const explanation = selection ? explainMapSelection(chart, selection) : null;
  const isOpen = Boolean(selection && explanation);
  const freeSelection = Boolean(selection && (
    (selection.kind === 'point' && FREE_POINTS.has(selection.id))
    || (selection.kind === 'house' && selection.id === '1')
  ));
  // The element the wheel is centred on: it stays highlighted and is described under the wheel.
  const [focus, setFocus] = useState<MapSelection | null>(() => (data.bodies.some((p) => p.key === 'sun') ? { kind: 'point', id: 'sun' } : null));
  const [mode, setMode] = useState<WheelMode>('all');
  const [nowBodies, setNowBodies] = useState<NowBody[]>([]);
  useEffect(() => {
    if (mode !== 'now' || nowBodies.length) return undefined;
    let active = true;
    skyEngine ??= import('astronomy-engine');
    void skyEngine.then((astro) => {
      const date = new Date();
      const bodies = {
        sun: astro.Body.Sun, moon: astro.Body.Moon, mercury: astro.Body.Mercury, venus: astro.Body.Venus,
        mars: astro.Body.Mars, jupiter: astro.Body.Jupiter, saturn: astro.Body.Saturn,
      } as const;
      if (active) setNowBodies(NOW_BODIES.map((key) => ({ key, longitude: astro.Ecliptic(astro.GeoVector(bodies[key], date, true)).elon })));
    }).catch(() => { skyEngine = null; });
    return () => { active = false; };
  }, [mode, nowBodies.length]);
  // Today's planets on the sign band, nudged apart when two stand within a few degrees of each other.
  const nowPlaced = useMemo(() => {
    const placed: Array<{ body: NowBody; longitude: number }> = [];
    for (const body of [...nowBodies].sort((a, b) => a.longitude - b.longitude)) {
      const previous = placed[placed.length - 1];
      const gap = previous ? (body.longitude - previous.longitude + 360) % 360 : 360;
      placed.push({ body, longitude: previous && gap < 9 ? previous.longitude + 9 : body.longitude });
    }
    return placed;
  }, [nowBodies]);
  const focusExplanation = focus ? explainMapSelection(chart, focus) : null;
  const [showAllParts, setShowAllParts] = useState(false);
  useEffect(() => { setShowAllParts(false); }, [focus?.kind, focus?.id]);
  // Each part of the chart behind the explanation, without repeating the main point above it.
  const focusParts = useMemo(() => (focusExplanation?.reasons ?? [])
    .filter((reason) => reason.text && !focusExplanation?.meaning.includes(reason.text))
    .map((reason) => ({ title: reason.title, text: reason.text })), [focusExplanation]);
  const focusIsFree = Boolean(focus && ((focus.kind === 'point' && FREE_POINTS.has(focus.id)) || (focus.kind === 'house' && focus.id === '1')));
  // What lights up with the focus: a planet with its aspects and partners, an aspect with its two ends.
  const related = useMemo(() => {
    const points = new Set<string>();
    const aspects = new Set<string>();
    if (focus?.kind === 'point') {
      points.add(focus.id);
      for (const aspect of data.aspects) {
        if (aspect.fromKey === focus.id || aspect.toKey === focus.id) {
          aspects.add(aspect.id);
          points.add(aspect.fromKey);
          points.add(aspect.toKey);
        }
      }
    } else if (focus?.kind === 'aspect') {
      const aspect = data.aspects.find((item) => item.id === focus.id);
      if (aspect) { aspects.add(aspect.id); points.add(aspect.fromKey); points.add(aspect.toKey); }
    } else if (focus?.kind === 'sign') {
      const index = MAP_SIGNS.indexOf(focus.id as (typeof MAP_SIGNS)[number]);
      for (const body of data.bodies) if (Math.floor(body.longitude / 30) === index) points.add(body.key);
    } else if (focus?.kind === 'house') {
      for (const body of data.bodies) if (String(houseOfLongitude(body.longitude, data.houses)) === focus.id) points.add(body.key);
    }
    return { points, aspects, active: Boolean(focus) && (points.size > 0 || aspects.size > 0) };
  }, [data.aspects, data.bodies, data.houses, focus]);
  const focusLinks = focus?.kind === 'point'
    ? data.aspects.filter((aspect) => aspect.fromKey === focus.id || aspect.toKey === focus.id).map((aspect) => {
      const other = aspect.fromKey === focus.id ? aspect.toKey : aspect.fromKey;
      return { id: aspect.id, target: { kind: 'point' as const, id: other }, label: `${MAP_ASPECTS[aspect.type].name} · ${mapObject(other)?.name || other}` };
    })
    : focus?.kind === 'aspect'
      ? (() => {
        const aspect = data.aspects.find((item) => item.id === focus.id);
        return aspect ? [aspect.fromKey, aspect.toKey].map((key) => ({ id: key, target: { kind: 'point' as const, id: key }, label: mapObject(key)?.name || key })) : [];
      })()
      : [];
  const fullAccess = isPremium || freeSelection;
  useEffect(() => {
    if (premiumContinuation?.returnAction !== 'open_natal_map_element' || premiumContinuation.returnView !== 'chart') return;
    const [fromView,kind,...idParts] = (premiumContinuation.returnEntityId || '').split(':');
    const id = idParts.join(':');
    const normalizedFromView = fromView === 'details' ? 'map' : fromView;
    if (normalizedFromView !== view) return;
    if (!['point','house','aspect','sign'].includes(kind) || !id) return;
    const restored = {kind:kind as MapSelection['kind'],id};
    if (!explainMapSelection(chart,restored)) return;
    setClosing(false); setSelection(restored);
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [chart, view, premiumContinuation, onPremiumContinuationHandled]);
  const quality = chart.chartQuality?.birthTimeQuality ?? chart.birthTimeQuality ?? 'unknown';
  const rotation = (data.angles.find(p => p.key === 'ascendant')?.longitude ?? -270) + 270;
  const point = (longitude: number, radius: number) => {
    const a = (rotation - longitude - 90) * Math.PI / 180;
    return { x: 200 + Math.cos(a) * radius, y: 200 + Math.sin(a) * radius };
  };
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
    setClosing(false); setSelection({ kind, id });
  };
  const finishClose = () => { setSelection(null); setEntered(false); setClosing(false); setDragOffset(null); };
  const close = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishClose();
    else setClosing(true);
  };
  backAction.current = close;
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => { setSelection(null); setEntered(false); setClosing(false); setDragOffset(null); }, 180);
    return () => window.clearTimeout(timer);
  }, [closing]);
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
      let frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => setEntered(true));
      });
      const previous = document.body.style.overflow;
      const host = (window as unknown as { Telegram?: { WebApp?: { isVersionAtLeast?: (v: string) => boolean; isVerticalSwipesEnabled?: boolean; disableVerticalSwipes?: () => void; enableVerticalSwipes?: () => void } } }).Telegram?.WebApp;
      const restoreSwipes = host?.isVerticalSwipesEnabled !== false;
      const canControlSwipes = host?.isVersionAtLeast?.('7.7') && !!host.disableVerticalSwipes;
      if (canControlSwipes) host?.disableVerticalSwipes?.();
      document.body.style.overflow = 'hidden';
      return () => {
        window.cancelAnimationFrame(frame);
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
  }, [selection]);
  const interactive = (kind: MapSelection['kind'], id: string, label: string) => ({
    role: 'button', tabIndex: 0, 'aria-label': label, 'aria-pressed': focus?.kind === kind && focus.id === id,
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
      opener.current = e.currentTarget;
      setFocus({ kind, id: targetId });
    },
    onKeyDown: (e: React.KeyboardEvent<SVGElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opener.current = e.currentTarget; setFocus({ kind, id }); } },
  });
  return <section className={view === 'details' ? sectionStyles.content : styles.map} aria-labelledby="interactive-map-name">
    <header className={sectionStyles.personInline}><h1 id="interactive-map-name">{name}</h1><p title={birthLine}>{birthLine}</p></header>
    {view === 'details' ? <NatalDetails key={name + birthLine} chart={chart} isPremium={isPremium} onSelect={(item, target) => choose(item.kind, item.id, target)}/> : <>
    <div className={styles.modes} role="group" aria-label="Что показать на карте">
      {WHEEL_MODES.map((item) => (
        <button key={item.id} type="button" className={styles.modeChip} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>{item.label}</button>
      ))}
    </div>
    <svg viewBox="0 0 400 400" className={styles.wheel} data-mode={mode} data-focused={(mode !== 'now' && related.active) || undefined} aria-label="Твоя натальная карта. Выбери планету, знак, дом или аспект.">
      <circle cx="200" cy="200" r="184" fill="white"/>
      {MAP_SIGNS.map((sign, i) => {
        const a = point(i * 30, 184), b = point(i * 30 + 30, 184), c = point(i * 30 + 30, 155), d = point(i * 30, 155), g = point(i * 30 + 15, 170);
        return <g key={sign} className={`${styles.sign}${focus?.kind === 'sign' && focus.id === sign ? ` ${styles.isFocus}` : ''}`} style={{'--sign-fill':SIGN_FILLS[i]} as React.CSSProperties} {...interactive('sign', sign, `Знак: ${MAP_SIGN_NAMES[i]}`)}>
          <path d={`M ${a.x} ${a.y} A 184 184 0 0 0 ${b.x} ${b.y} L ${c.x} ${c.y} A 155 155 0 0 1 ${d.x} ${d.y} Z`} stroke="white" strokeWidth="1"/>
          <g transform={`translate(${g.x - 15} ${g.y - 15})`} style={{color:SIGN_COLORS[i]}}><ZodiacIcon sign={sign} size={30} strokeWidth={1.6}/></g>
        </g>;
      })}
      <circle cx="200" cy="200" r="155" className={styles.ring}/><circle cx="200" cy="200" r="89" className={styles.ring}/>
      {data.houses.map(h => {
        const a = point(h.longitude, 155), b = point(h.longitude, 89), g = point(natalChartWheelHouseLabelLongitude(h, data.houses), 142);
        return <g key={h.house} className={`${styles.house}${focus?.kind === 'house' && focus.id === String(h.house) ? ` ${styles.isFocus}` : ''}`}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><g {...interactive('house', String(h.house), `${h.house} дом`)} transform={`translate(${g.x} ${g.y})`}><circle r="13"/><text y="4" textAnchor="middle">{h.house}</text></g>
        </g>;
      })}
      {data.aspects.map(a => {
        const from = point(a.fromLongitude, 89), to = point(a.toLongitude, 89);
        const label = `${mapObject(a.fromKey)?.name || a.fromKey} - ${mapObject(a.toKey)?.name || a.toKey}: ${MAP_ASPECTS[a.type].name}`;
        return <g key={a.id} className={`${styles.aspect} ${a.type === 'square' || a.type === 'opposition' ? styles.hard : styles.soft}${related.aspects.has(a.id) ? ` ${styles.isRelated}` : ''}`} {...interactive('aspect', a.id, label)}>
          <line className={styles.aspectHit} x1={from.x} y1={from.y} x2={to.x} y2={to.y}/><line className={styles.aspectLine} x1={from.x} y1={from.y} x2={to.x} y2={to.y}/>
        </g>;
      })}
      {data.bodies.map((p, i) => {
        const g = markers[i], anchor = point(p.longitude, 155); const meta = mapObject(p.key);
        const state = focus?.kind === 'point' && focus.id === p.key ? styles.isFocus : related.points.has(p.key) ? styles.isRelated : '';
        return <g key={p.key} className={`${styles.bodyGroup}${state ? ` ${state}` : ''}`} style={{ color: meta?.color }}>
          <line className={styles.leader} x1={anchor.x} y1={anchor.y} x2={g.x} y2={g.y}/><g className={styles.body} {...interactive('point', p.key, meta?.name || p.name)} transform={`translate(${g.x} ${g.y})`}><circle className={styles.bodyHit} r="21"/><circle className={styles.bodyHalo} r="14"/>
          <g transform="translate(-16 -16)" style={{pointerEvents:'none'}}>{objectIcon(p.key, 32)}</g></g>
        </g>;
      })}
      {mode === 'now' ? nowPlaced.map(({ body, longitude }) => {
        const g = point(longitude, 170);
        return <g key={`now-${body.key}`} className={styles.nowBody} transform={`translate(${g.x} ${g.y})`} aria-hidden="true"><circle r="15"/><g transform="translate(-12 -12)">{objectIcon(body.key, 24)}</g></g>;
      }) : null}
      {data.angles.map(p => { const g = point(p.longitude, 194); const meta = mapObject(p.key); return <g key={p.key} className={styles.angle} {...interactive('point', p.key, meta?.name || p.name)}><rect x={g.x - 15} y={g.y - 8} width="30" height="16" rx="5"/><text x={g.x} y={g.y + 4} textAnchor="middle">{meta?.glyph}</text></g>; })}
    </svg>
    {mode === 'now' ? (
      <section className={styles.focusCard} aria-live="polite">
        <h2 className={styles.focusTitle}>Небо сейчас поверх твоей карты</h2>
        {nowBodies.length ? (
          <ul className={styles.nowList}>
            {nowBodies.map((body) => {
              const house = quality === 'exact' ? houseOfLongitude(body.longitude, data.houses) : null;
              return <li key={body.key}>
                <span style={{ color: mapObject(body.key)?.color }}>{objectIcon(body.key, 22)}</span>
                <span><b>{mapObject(body.key)?.name || body.key} в {SIGN_IN_RU[Math.floor(body.longitude / 30) % 12]}</b>{house ? <small>твой {house} дом: {MAP_HOUSES[house]}</small> : null}</span>
              </li>;
            })}
          </ul>
        ) : <p className={styles.focusText}>Считаю небо…</p>}
      </section>
    ) : focus && focusExplanation ? (
      <section className={styles.focusCard} aria-live="polite">
        <h2 className={styles.focusTitle}>{focusExplanation.title}</h2>
        {focusExplanation.yours ? <p className={styles.focusMeta}>{focusExplanation.yours}</p> : null}
        {/* The whole explanation in plain words right here: what the element is about, the main point,
            then each part of the chart that says it, named the way an astrologer would. */}
        {focusExplanation.what ? <p className={styles.focusRole}>{focusExplanation.what}</p> : null}
        {focusExplanation.meaning ? <p className={styles.focusText}>{isPremium || focusIsFree ? focusExplanation.meaning : firstSentence(focusExplanation.meaning)}</p> : null}
        {(isPremium || focusIsFree) && focusParts.length ? (
          <div className={styles.focusParts}>
            {(showAllParts ? focusParts : focusParts.slice(0, 3)).map((part, index) => (
              <p key={index}><b>{part.title}</b>{part.text}</p>
            ))}
            {focusParts.length > 3 && !showAllParts ? (
              <button type="button" className={styles.focusMore} onClick={() => setShowAllParts(true)}>Показать ещё {focusParts.length - 3}<ChevronDown size={16} aria-hidden="true"/></button>
            ) : null}
          </div>
        ) : null}
        {focusLinks.length ? (
          <div className={styles.focusLinks}>
            <span className={styles.focusLinksLabel}>Связи</span>
            {focusLinks.map((link) => (
              <button key={link.id} type="button" className={styles.modeChip} onClick={() => setFocus(link.target)}>{link.label}</button>
            ))}
          </div>
        ) : null}
        {isPremium || focusIsFree ? null : (
          <button type="button" className={styles.focusMore} onClick={() => onRequestPremium?.(focus, 'map')}>
            <LockKeyhole size={15} aria-hidden="true"/>Открыть полностью с Premium<ChevronRight size={16} aria-hidden="true"/>
          </button>
        )}
      </section>
    ) : null}
    {quality !== 'exact' ? <p className={styles.precision}>{quality === 'unknown' ? 'Время рождения не указано.' : 'Время рождения указано примерно.'} Показаны только надёжные положения. Меняющиеся точки и дома не используются в объяснениях.</p> : null}
    <details className={styles.help}><summary><BookOpen size={20} aria-hidden="true"/>Как читать карту<ChevronDown size={18} aria-hidden="true"/></summary><div className={styles.helpGrid}>{HELP.map(({Icon,title,text}) => <div key={title} className={styles.helpItem}><Icon aria-hidden="true"/><div><h3>{title}</h3><p>{text}</p></div></div>)}</div><p className={styles.hint}>Нажми на планету, номер дома или линию внутри круга, чтобы узнать больше.</p></details>
    <div className={sectionStyles.embeddedDetails}>
      <NatalDetails
        key={name + birthLine}
        chart={chart}
        isPremium={isPremium}
        onSelect={(item, target) => choose(item.kind, item.id, target)}
      />
    </div>
    </>}
    <dialog ref={dialog} className={styles.sheet} data-entered={entered} data-closing={closing} data-dragging={dragOffset !== null && !closing} style={{transform: dragOffset !== null && !closing ? `translateY(${dragOffset}px)` : undefined}} aria-labelledby="map-explanation-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => {
      if (e.target !== e.currentTarget) return;
      const bounds = e.currentTarget.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) close();
    }}>
      {explanation ? <div className={styles.sheetInner}>
        <div className={styles.handle} aria-hidden="true" onPointerDown={e => { dragStart.current = e.clientY; setDragOffset(0); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (dragStart.current !== null) setDragOffset(Math.max(0, e.clientY - dragStart.current)); }} onPointerUp={e => { if (dragStart.current !== null && e.clientY - dragStart.current > 55) close(); setDragOffset(null); dragStart.current = null; }} onPointerCancel={() => { setDragOffset(null); dragStart.current = null; }}><span/></div>
        <header className={styles.sheetHeader}><span className={styles.symbol} style={{color: explanation.color}}>{selection?.kind === 'point' ? objectIcon(selection.id, 30) : selection?.kind === 'sign' ? <ZodiacIcon sign={selection.id} size={30} stroke={explanation.color}/> : selection?.kind === 'house' ? <House size={30}/> : <Triangle size={30}/>}</span><div className={styles.sheetHeading}><h2 id="map-explanation-title">{explanation.title}</h2><p>{explanation.yours}</p></div><button type="button" aria-label="Закрыть объяснение" onClick={close}><X/></button></header>
        <div ref={content} className={styles.sheetContent}>
          {fullAccess ? (
            <><p className={styles.selectionIntro}>{explanation.meaning}</p>
              <section className={styles.basis} aria-labelledby="map-explanation-basis" data-map-explanation-screen>
                <h3 id="map-explanation-basis">На чём основано</h3>
                <p>{explanation.what}</p>
                {explanation.reasons.map((reason, index) => <section key={index} className={styles.basisReason}>
                  <h4>{reason.title}</h4>
                  {reason.facts ? <p className={styles.basisFacts}>{reason.facts}</p> : null}
                  {reason.text !== explanation.meaning ? <p>{reason.text}</p> : null}
                </section>)}
                {explanation.summary ? <p>{explanation.summary}</p> : null}
              </section>
            </>
          ) : (
            <div data-map-premium-entry>
              <NatalPlusEntry title={`Открыть: ${explanation.title}`} onOpen={() => {if (selection) {const item=selection; finishClose(); onRequestPremium?.(item,'map');}}}>
                Полное объяснение каждой планеты, дома и связи открывается с Premium. Бесплатно целиком открыты Солнце, Луна, Асцендент и 1 дом.
              </NatalPlusEntry>
            </div>
          )}
        </div>
      </div> : null}
    </dialog>
  </section>;
}
