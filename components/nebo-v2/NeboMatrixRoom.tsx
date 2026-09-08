import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  embedded?: boolean;
};

type MatrixView = 'overview' | 'scheme' | 'reading';
type SelectedItem = ({ kind: 'position' } & MatrixPosition) | ({ kind: 'life' } & MatrixLifeArea);

const tones = ['violet','blue','pink','amber','green','violet','blue','pink'] as const;

export function NeboMatrixRoom({ profile, onBack, onOpenProfile, embedded = false }: Props) {
  const ru = profile.language !== 'en';
  const lang: 'ru' | 'en' = ru ? 'ru' : 'en';
  const [date, setDate] = useState(toDateInputValue(profile.birthDate || ''));
  const [computedDate, setComputedDate] = useState(toDateInputValue(profile.birthDate || ''));
  const [view, setView] = useState<MatrixView>('overview');
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const result = useMemo(() => computeMatrix(computedDate, lang), [computedDate, lang]);
  const primary = result?.positions.find(item => item.key === 'self') || result?.positions[0] || null;
  const primaryArcana = primary ? getArcana(primary.arcana) : null;
  const allItems: SelectedItem[] = result ? [
    ...result.positions.map(item => ({ ...item, kind: 'position' as const })),
    ...result.lifeAreas.map(item => ({ ...item, kind: 'life' as const })),
  ] : [];

  const selectItem = (item: SelectedItem) => {
    lumiaSelectionHaptic();
    setSelected(item);
  };
  const calculate = () => {
    if (!date) return;
    lumiaSelectionHaptic();
    setComputedDate(date);
    setView('overview');
    setSelected(null);
  };
  const share = () => {
    if (!primaryArcana) return;
    const keyword = ru ? primaryArcana.keyword : primaryArcana.keywordEn;
    const text = ru
      ? `Моя матрица в NEBO: главное число — ${primary?.arcana}, «${keyword}».`
      : `My NEBO matrix: core number ${primary?.arcana}, “${keyword}”.`;
    shareToTelegram(text);
  };

  if (!result) {
    return <div className="nebo-screen nebo-matrix-screen">
      {!embedded ? <Header name={profile.name || ''} title="Матрица судьбы" onBack={onBack} onProfile={onOpenProfile}/> : null}
      <div className="nebo-reader-scroll nebo-matrix-empty">
        <Art name="matrix-destiny" className="nebo-matrix-empty-art"/>
        <h1>{ru ? 'Матрица судьбы' : 'Destiny Matrix'}</h1>
        <p>{ru ? 'Нужна только дата рождения.' : 'Only a birth date is required.'}</p>
        <label className="nebo-field"><span>{ru ? 'Дата рождения' : 'Birth date'}</span><input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
        <button type="button" className="nebo-primary" disabled={!date} onClick={calculate}>{ru ? 'Построить матрицу' : 'Build matrix'}</button>
      </div>
    </div>;
  }

  if (view === 'reading') {
    return <div className="nebo-screen nebo-matrix-screen">
      {!embedded ? <Header name={profile.name || ''} title="Матрица судьбы" onBack={() => setView('overview')} onProfile={onOpenProfile}/> : null}
      <div className="nebo-reader-scroll nebo-matrix-reading">
        <div className="nebo-segmented"><button type="button" aria-pressed="true">{ru ? 'Разбор' : 'Reading'}</button><button type="button" onClick={() => setView('scheme')}>{ru ? 'Схема' : 'Scheme'}</button></div>
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
    const nodes = result.positions.slice(0,8);
    return <div className="nebo-screen nebo-matrix-screen">
      {!embedded ? <Header name={profile.name || ''} title="Матрица судьбы" onBack={() => setView('overview')} onProfile={onOpenProfile}/> : null}
      <div className="nebo-reader-scroll nebo-matrix-scheme-scroll">
        <p className="nebo-muted">{birthLine(profile)}</p>
        <div className="nebo-matrix-diagram" role="group" aria-label={ru ? 'Схема матрицы' : 'Matrix scheme'}>
          <svg viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="112"/><circle cx="150" cy="150" r="72"/><path d="M150 32v236M32 150h236M70 70l160 160M230 70 70 230"/></svg>
          {nodes.map((item,index) => <button key={item.key} type="button" className={`nebo-matrix-node nebo-matrix-node--${index}`} onClick={() => selectItem({ ...item, kind:'position' })}><span>{item.arcana}</span><small>{item.label}</small></button>)}
          <button type="button" className="nebo-matrix-center" onClick={() => primary && selectItem({ ...primary, kind:'position' })}>{result.center}</button>
        </div>
        <button type="button" className="nebo-action-row nebo-matrix-guide" onClick={() => setView('reading')}><Glyph name="book"/><span><strong>{ru ? 'Как читать схему?' : 'How to read it?'}</strong><small>{ru ? 'Открой полный разбор всех точек' : 'Open the full reading'}</small></span><Glyph name="next" size={18}/></button>
      </div>
      <MatrixSheet selected={selected} language={lang} onClose={() => setSelected(null)} onOpenReading={() => { setSelected(null); setView('reading'); }}/>
    </div>;
  }

  return <div className="nebo-screen nebo-matrix-screen">
    {!embedded ? <Header name={profile.name || ''} onProfile={onOpenProfile}/> : null}
    <div className="nebo-reader-scroll nebo-matrix-overview">
      <h1>{ru ? 'Матрица судьбы' : 'Destiny Matrix'}</h1><p className="nebo-muted">{birthLine(profile)}</p>
      <section className="nebo-matrix-hero nebo-tone-lilac"><div><strong>{ru ? 'Твоя матрица — это карта твоих сильных сторон' : 'Your matrix maps your strengths'}</strong><p>{primaryArcana ? (ru ? primaryArcana.essence : primaryArcana.essenceEn) : ''}</p></div><Art name="matrix-destiny"/></section>
      <div className="nebo-matrix-actions"><button type="button" className="nebo-matrix-action nebo-tone-blue" onClick={() => setView('scheme')}><span><strong>{ru ? 'Схема' : 'Scheme'}</strong><small>{ru ? 'Посмотреть числа' : 'See your numbers'}</small></span><Art name="matrix-destiny"/></button><button type="button" className="nebo-matrix-action nebo-tone-lilac" onClick={() => setView('reading')}><span><strong>{ru ? 'Читать разбор' : 'Read'}</strong><small>{ru ? 'Все значения по порядку' : 'All meanings'}</small></span><Art name="saved-cards"/></button></div>
      <div className="nebo-home-subhead"><strong>{ru ? 'Ключевые темы' : 'Key themes'}</strong></div>
      <div className="nebo-matrix-key-grid">{allItems.slice(0,4).map((item,index) => <button type="button" key={`${item.kind}-${item.key}`} onClick={() => selectItem(item)}><span className={`nebo-matrix-dot nebo-matrix-card--${tones[index]}`}>{item.arcana}</span><small>{item.label}</small></button>)}</div>
      <details className="nebo-matrix-date"><summary>{ru ? 'Другая дата рождения' : 'Another birth date'}</summary><div><input type="date" value={date} onChange={event => setDate(event.target.value)}/><button type="button" onClick={calculate}>{ru ? 'Пересчитать' : 'Recalculate'}</button></div></details>
    </div>
    <MatrixSheet selected={selected} language={lang} onClose={() => setSelected(null)} onOpenReading={() => { setSelected(null); setView('reading'); }}/>
  </div>;
}

function MatrixSheet({ selected, language, onClose, onOpenReading }: { selected: SelectedItem | null; language:'ru'|'en'; onClose:()=>void; onOpenReading:()=>void }) {
  const ru = language === 'ru';
  const arcana = selected ? getArcana(selected.arcana) : null;
  return <AnimatePresence>{selected && arcana ? <motion.div className="nebo-modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
    <motion.section className="nebo-bottom-sheet" role="dialog" aria-modal="true" aria-label={selected.label} initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:430,damping:42}} onClick={event => event.stopPropagation()}>
      <div className="nebo-sheet-handle"/><button type="button" className="nebo-sheet-close" onClick={onClose} aria-label={ru?'Закрыть':'Close'}><Glyph name="close"/></button>
      <div className="nebo-matrix-sheet-head"><span className="nebo-matrix-number nebo-matrix-number--blue">{selected.arcana}</span><span><strong>{selected.label}</strong><small>{selected.hint}</small></span></div>
      <p>{ru ? arcana.essence : arcana.essenceEn}</p>
      <button type="button" className="nebo-primary" onClick={onOpenReading}>{ru ? 'Открыть весь разбор' : 'Open full reading'} <Glyph name="next" size={18}/></button>
    </motion.section>
  </motion.div> : null}</AnimatePresence>;
}
