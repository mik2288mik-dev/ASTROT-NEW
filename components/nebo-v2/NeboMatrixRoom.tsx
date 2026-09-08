import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import type { UserProfile } from '../../types';
import { computeMatrix, type MatrixLifeArea, type MatrixPosition } from '../../lib/matrixOfDestiny';
import { getArcana } from '../../lib/matrixArcana';
import { toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { shareToTelegram } from '../../lib/botLink';
import { Art, birthLine, Glyph, Header } from './Primitives';

type Props = {
  profile: UserProfile;
  onBack: () => void;
  onOpenProfile?: () => void;
  onOpenCharts?: () => void;
  embedded?: boolean;
  uiPreview?: { initialView?: MatrixView };
};

type MatrixView = 'overview' | 'scheme' | 'reading';
type SelectedItem = ({ kind: 'position' } & MatrixPosition) | ({ kind: 'life' } & MatrixLifeArea);

const tones = ['violet','blue','pink','amber','green','violet','blue','pink'] as const;

export function validMatrixDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1000 && year <= new Date().getFullYear()
    && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function NeboMatrixRoom({ profile, onBack, onOpenProfile, onOpenCharts, embedded = false, uiPreview }: Props) {
  const preview = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1' ? uiPreview : undefined;
  const ru = profile.language !== 'en';
  const lang: 'ru' | 'en' = ru ? 'ru' : 'en';
  const [date, setDate] = useState(toDateInputValue(profile.birthDate || ''));
  const [computedDate, setComputedDate] = useState(toDateInputValue(profile.birthDate || ''));
  const [view, setView] = useState<MatrixView>(preview?.initialView || 'overview');
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dateError, setDateError] = useState(false);
  const result = useMemo(() => validMatrixDate(computedDate) ? computeMatrix(computedDate, lang) : null, [computedDate, lang]);
  const birthLabel = computedDate ? birthLine({ birthDate: computedDate }) : '';
  const primary = result?.positions.find(item => item.key === 'self') || result?.positions[0] || null;
  const primaryArcana = primary ? getArcana(primary.arcana) : null;
  const allItems: SelectedItem[] = result ? [
    ...result.positions.map(item => ({ ...item, kind: 'position' as const })),
    ...result.lifeAreas.map(item => ({ ...item, kind: 'life' as const })),
  ] : [];
  useEffect(() => {
    const next = toDateInputValue(profile.birthDate || '');
    setDate(next); setComputedDate(next); setView(preview?.initialView || 'overview'); setSelected(null); setDateError(false);
  }, [profile.id, profile.birthDate, preview?.initialView]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [view, computedDate]);
  useEffect(() => {
    const back = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail?.handled || selected || view === 'overview') return;
      if (detail) detail.handled = true;
      setView('overview');
    };
    window.addEventListener(NATIVE_BACK_EVENT, back);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, back);
  }, [selected, view]);
  const viewTabs = <nav className="nebo-segmented" aria-label={ru ? 'Матрица судьбы' : 'Destiny Matrix'}>{(['overview','scheme','reading'] as const).map((key, index) => <button type="button" key={key} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}>{(ru ? ['Обзор','Схема','Разбор'] : ['Overview','Diagram','Reading'])[index]}</button>)}</nav>;

  const selectItem = (item: SelectedItem) => {
    lumiaSelectionHaptic();
    setSelected(item);
  };
  const calculate = () => {
    if (!validMatrixDate(date)) { setDateError(true); return; }
    setDateError(false);
    lumiaSelectionHaptic();
    setComputedDate(date);
    setView('overview');
    setSelected(null);
  };
  const share = () => {
    if (!primaryArcana || preview) return;
    const keyword = ru ? primaryArcana.keyword : primaryArcana.keywordEn;
    const text = ru
      ? `Моя матрица в NEBO: главное число — ${primary?.arcana}, «${keyword}».`
      : `My NEBO matrix: core number ${primary?.arcana}, “${keyword}”.`;
    shareToTelegram(text);
  };

  if (!result) {
    return <div className="nebo-screen nebo-matrix-screen">
      {!embedded ? <Header name={profile.name || ''} title={ru ? 'Матрица судьбы' : 'Destiny Matrix'} onBack={onBack} onPeople={onOpenCharts} onProfile={onOpenProfile}/> : null}
      <div ref={scrollRef} className="nebo-reader-scroll nebo-matrix-empty">
        <Art name="matrix-destiny" className="nebo-matrix-empty-art"/>
        <h1>{ru ? 'Матрица судьбы' : 'Destiny Matrix'}</h1>
        <p>{ru ? 'Нужна только дата рождения.' : 'Only a birth date is required.'}</p>
        <label className="nebo-field"><span>{ru ? 'Дата рождения' : 'Birth date'}</span><input name="matrix-birth-date" type="date" aria-label={ru ? 'Дата рождения' : 'Birth date'} aria-invalid={dateError} value={date} onChange={event => setDate(event.target.value)}/></label>
        {dateError ? <p role="alert">{ru ? 'Проверь дату рождения.' : 'Check the birth date.'}</p> : null}
        <button type="button" className="nebo-primary" onClick={calculate}>{ru ? 'Построить матрицу' : 'Build matrix'}</button>
      </div>
    </div>;
  }

  if (view === 'reading') {
    return <div className="nebo-screen nebo-matrix-screen">
      {!embedded ? <Header name={profile.name || ''} title={ru ? 'Матрица судьбы' : 'Destiny Matrix'} onBack={() => setView('overview')} onPeople={onOpenCharts} onProfile={onOpenProfile}/> : null}
      <div ref={scrollRef} className="nebo-reader-scroll nebo-matrix-reading">
        {viewTabs}
        <p className="nebo-muted">{birthLabel}</p>
        {primary && primaryArcana ? <section className="nebo-matrix-reading-lead">
          <span className="nebo-matrix-number nebo-matrix-number--blue">{primary.arcana}</span>
          <div><h1>{ru ? primary.label : primary.label}</h1><p>{ru ? primaryArcana.keyword : primaryArcana.keywordEn}</p></div>
        </section> : null}
        <div className="nebo-matrix-reading-list">{allItems.map((item,index) => {
          const arcana = getArcana(item.arcana);
          return <button type="button" key={`${item.kind}-${item.key}`} className={`nebo-matrix-reading-card nebo-matrix-card--${tones[index%tones.length]}`} onClick={() => selectItem(item)}>
            <span className="nebo-matrix-number">{item.arcana}</span><span><strong>{item.label}</strong><small>{item.hint}</small><p>{ru ? arcana.essence : arcana.essenceEn}</p></span><Glyph name="next" size={18}/>
          </button>;
        })}</div>
        <button type="button" className="nebo-primary" onClick={share}>{ru ? 'Поделиться' : 'Share'}</button>
      </div>
      <MatrixSheet selected={selected} language={lang} onClose={() => setSelected(null)} onOpenReading={() => { setSelected(null); setView('reading'); }}/>
    </div>;
  }

  if (view === 'scheme') {
    const nodes = result.positions.filter(item => item.key !== 'self');
    return <div className="nebo-screen nebo-matrix-screen">
      {!embedded ? <Header name={profile.name || ''} title={ru ? 'Матрица судьбы' : 'Destiny Matrix'} onBack={() => setView('overview')} onPeople={onOpenCharts} onProfile={onOpenProfile}/> : null}
      <div ref={scrollRef} className="nebo-reader-scroll nebo-matrix-scheme-scroll">
        {viewTabs}
        <p className="nebo-muted">{birthLabel}</p>
        <div className="nebo-matrix-diagram" role="group" aria-label={ru ? 'Схема матрицы' : 'Matrix scheme'}>
          <svg viewBox="0 0 360 360" aria-hidden="true"><circle cx="180" cy="180" r="126"/>{nodes.map((item, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / nodes.length; return <line key={item.key} x1="180" y1="180" x2={180 + 126 * Math.cos(angle)} y2={180 + 126 * Math.sin(angle)}/>; })}</svg>
          {nodes.map((item,index) => {
            const angle = -Math.PI / 2 + index * Math.PI * 2 / nodes.length;
            return <button key={item.key} type="button" className={`nebo-matrix-node nebo-matrix-card--${tones[index]}`} style={{ '--node-x': `${50 + 35 * Math.cos(angle)}%`, '--node-y': `${50 + 35 * Math.sin(angle)}%` } as React.CSSProperties} aria-label={`${item.label}: ${item.arcana}`} onClick={() => selectItem({ ...item, kind:'position' })}><span>{item.arcana}</span><small>{item.label}</small></button>;
          })}
          <button type="button" className="nebo-matrix-center" aria-label={`${primary?.label}: ${result.center}`} onClick={() => primary && selectItem({ ...primary, kind:'position' })}>{result.center}</button>
        </div>
        <button type="button" className="nebo-action-row nebo-matrix-guide" onClick={() => setView('reading')}><Glyph name="book"/><span><strong>{ru ? 'Как читать схему?' : 'How to read it?'}</strong><small>{ru ? 'Открой полный разбор всех точек' : 'Open the full reading'}</small></span><Glyph name="next" size={18}/></button>
      </div>
      <MatrixSheet selected={selected} language={lang} onClose={() => setSelected(null)} onOpenReading={() => { setSelected(null); setView('reading'); }}/>
    </div>;
  }

  return <div className="nebo-screen nebo-matrix-screen">
    {!embedded ? <Header title={ru ? 'Матрица судьбы' : 'Destiny matrix'} name={profile.name || ''} onPeople={onOpenCharts} onProfile={onOpenProfile}/> : null}
    <div ref={scrollRef} className="nebo-reader-scroll nebo-matrix-overview">
      {viewTabs}
      <h1>{ru ? 'Матрица судьбы' : 'Destiny Matrix'}</h1><p className="nebo-muted">{birthLabel}</p>
      <section className="nebo-matrix-hero nebo-tone-lilac"><div><strong>{ru ? 'Твоя матрица — это карта твоих сильных сторон' : 'Your matrix maps your strengths'}</strong><p>{primaryArcana ? (ru ? primaryArcana.essence : primaryArcana.essenceEn) : ''}</p></div><Art name="matrix-destiny"/></section>
      <div className="nebo-matrix-actions"><button type="button" className="nebo-matrix-action nebo-tone-blue" onClick={() => setView('scheme')}><span><strong>{ru ? 'Схема' : 'Scheme'}</strong><small>{ru ? 'Посмотреть числа' : 'See your numbers'}</small></span><Art name="matrix-destiny"/></button><button type="button" className="nebo-matrix-action nebo-tone-lilac" onClick={() => setView('reading')}><span><strong>{ru ? 'Читать разбор' : 'Read'}</strong><small>{ru ? 'Все значения по порядку' : 'All meanings'}</small></span><Art name="saved-cards"/></button></div>
      <div className="nebo-home-subhead"><strong>{ru ? 'Ключевые темы' : 'Key themes'}</strong></div>
      <div className="nebo-matrix-key-grid">{allItems.filter(item => item.kind === 'life').map((item,index) => <button type="button" key={`${item.kind}-${item.key}`} onClick={() => selectItem(item)}><span className={`nebo-matrix-dot nebo-matrix-card--${tones[index]}`}>{item.arcana}</span><small>{item.label}</small></button>)}</div>
      <details className="nebo-matrix-date"><summary>{ru ? 'Другая дата рождения' : 'Another birth date'}</summary><div><input name="matrix-birth-date" type="date" aria-label={ru ? 'Дата рождения' : 'Birth date'} aria-invalid={dateError} value={date} onChange={event => setDate(event.target.value)}/><button type="button" onClick={calculate}>{ru ? 'Построить' : 'Calculate'}</button></div>{dateError ? <p role="alert">{ru ? 'Проверь дату рождения.' : 'Check the birth date.'}</p> : null}</details>
    </div>
    <MatrixSheet selected={selected} language={lang} onClose={() => setSelected(null)} onOpenReading={() => { setSelected(null); setView('reading'); }}/>
  </div>;
}

function MatrixSheet({ selected, language, onClose, onOpenReading }: { selected: SelectedItem | null; language:'ru'|'en'; onClose:()=>void; onOpenReading:()=>void }) {
  const ru = language === 'ru';
  const arcana = selected ? getArcana(selected.arcana) : null;
  return <CosmicSheet open={Boolean(selected && arcana)} title={selected?.label || ''} onClose={onClose} closeLabel={ru ? 'Закрыть' : 'Close'} className="nebo-matrix-sheet" contentClassName="nebo-matrix-sheet-content">
    {selected && arcana ? <><span className="nebo-matrix-sheet-number">{selected.arcana}</span><p>{ru ? arcana.essence : arcana.essenceEn}</p><button type="button" className="nebo-matrix-sheet-action" onClick={onOpenReading}>{ru ? 'Открыть весь разбор' : 'Open full reading'} <Glyph name="next" size={18}/></button></> : null}
  </CosmicSheet>;
}
