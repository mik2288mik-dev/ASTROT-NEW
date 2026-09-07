/** Offline component verification fixture; not routed or shipped as an app screen. */
import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { LayeredSurface } from '../components/nebo-v2/LayeredSurface';
import { ActionRow, Art, Header, ProductCard, Glyph } from '../components/nebo-v2/Primitives';
import type { LayeredSurfaceController } from '../lib/neboDesign/layeredSurface';
import type { SurfaceState } from '../lib/neboDesign/contract';
const params=new URLSearchParams(location.search);
const theme=params.get('theme')==='dark'?'dark':'light';
const natal=params.get('screen')==='natal';
const position=params.get('position');
const initial:SurfaceState={position:position==='expanded'||position==='middle'?position:'collapsed',scrollTop:0};
const host=window as unknown as {neboFixture?:{controller:LayeredSurfaceController|null;changes:SurfaceState[];clicks:number;escapes:number}};
host.neboFixture={controller:null,changes:[],clicks:0,escapes:0};
function Preview(){
 const control=useRef<LayeredSurfaceController|null>(null);
 const click=()=>{host.neboFixture!.clicks++;};
 const back=<div className="nebo-personal"><h1>{natal?'Натальная карта':'Привет, Алина!'}</h1><p className="nebo-muted">14 мая 1999 · 09:20 · Москва</p>{natal?<><section className="nebo-natal-intro"><Art name="natal-chart"/><p>Это демонстрационный текст для проверки чтения. Здесь важно проверить размеры, переносы строк и возвращение к нужному разделу.</p></section><button className="nebo-primary" type="button" onClick={click}>Читать разбор</button><ActionRow title="Карта и расчёт" icon="chart" onClick={click}/><ActionRow title="Продолжить с места" subtitle="Раздел «Характер»" onClick={click}/></>:<><div className="nebo-periods">{['Сегодня','Неделя','Месяц'].map((s,i)=><button type="button" aria-pressed={i===0} key={s} onClick={click}>{s}</button>)}</div><section className="nebo-forecast nebo-tone-lime"><Art name="today"/><h2>Сегодня</h2><p>Пример для проверки интерфейса: короткий текст, понятный заголовок и продолжение чтения.</p><button type="button" className="nebo-soft-button" onClick={click}>Продолжить чтение</button></section><ActionRow title="Натальная карта" subtitle="Читать свой разбор" onClick={click}/><ActionRow title="Сохранённые карты" icon="people" onClick={click}/></>}</div>;
 const cards=natal?[['Общий разбор','natal-chart','peach'],['Характер','zodiac','lilac'],['Отношения','compatibility','pink'],['Общение','support','blue'],['Работа','saved-cards','blue'],['Деньги','matrix-destiny','lime']]:[['Натальная карта','natal-chart','peach'],['Совместимость','compatibility','lilac'],['Матрица судьбы','matrix-destiny','blue'],['Сохранённые карты','saved-cards','lime']];
 return <div className="nebo-v2 fixture-app" data-nebo-theme={theme}><div className="fixture-main"><div className="nebo-screen"><Header name="Алина" onProfile={click} onEscape={()=>{host.neboFixture!.escapes++;}}/><LayeredSurface controlRef={control} initial={initial} onChange={state=>{host.neboFixture!.controller=control.current;host.neboFixture!.changes.push(state);}} back={back}><div className="nebo-panel-heading"><h2>{natal?'Разделы разбора':'Твои разделы'}</h2></div><div className="nebo-product-grid">{cards.map(([title,art,tone])=><ProductCard key={title} title={title} art={art as React.ComponentProps<typeof Art>['name']} tone={tone} onClick={click}/>)}</div><h2 className="nebo-section-title">Продолжить</h2>{['Твой разбор','Сохранённые карты','Вопросы по карте','Недавний результат','Энциклопедия'].map(s=><ActionRow key={s} title={s} onClick={click}/>)}</LayeredSurface></div></div><nav className="nebo-tabs">{['Сегодня','Зодиак','Натальная карта','Сравнить','Меню'].map((s,i)=><button type="button" key={s} aria-current={i===(natal?2:0)?'page':undefined} onClick={click}><Glyph name={(['sun','moon','chart','people','menu'] as const)[i]}/><span>{s}</span></button>)}</nav></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
