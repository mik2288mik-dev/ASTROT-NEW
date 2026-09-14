import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Send, Heart, MessageCircle, Compass, Leaf } from 'lucide-react';
import type { NatalChartData } from '../../types';
import { explainMapSelection } from './mapExplanation';
import { NatalPlusEntry } from './NatalPlusEntry';
import styles from './NatalSection.module.css';
import { NatalArtwork } from './NatalArtwork';

const EXAMPLES = ['Какие отношения мне подходят?', 'Как я принимаю важные решения?', 'Почему мне бывает трудно объяснить свои мысли?', 'Что помогает мне чувствовать себя спокойно?'];
const EXAMPLE_ICONS = [Heart, Compass, MessageCircle, Leaf];

/** Local demonstration from existing chart facts; never calls the question API. */
export function NatalQuestionDemo({ chart, onRequestPremium }: { chart: NatalChartData; onRequestPremium: () => void }) {
  const [draft, setDraft] = useState('');
  const [showEntry, setShowEntry] = useState(false);
  const entry = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (showEntry) entry.current?.scrollIntoView({block:'nearest',behavior:'smooth'}); }, [showEntry]);
  const venus = explainMapSelection(chart,{kind:'point',id:'venus'});
  const moon = explainMapSelection(chart,{kind:'point',id:'moon'});
  const answer = [venus?.meaning, moon?.meaning].filter((text): text is string => Boolean(text));
  return <article className={styles.questionDemo} aria-labelledby="natal-demo-title">
    <header className={styles.questionHero}><NatalArtwork art="plus"/><small className={styles.plusLabel}>NEBO+</small><h2 id="natal-demo-title">Спроси о себе по своей карте</h2><p>Обычный вопрос — понятный ответ. Ниже пример того, как можно читать свою карту.</p></header>
    <section aria-labelledby="natal-demo-examples"><h3 id="natal-demo-examples">Примеры вопросов</h3><div className={styles.demoExamples}>{EXAMPLES.map((question,index) => {const Icon=EXAMPLE_ICONS[index]; return <button key={question} type="button" onClick={() => {setDraft(question); field.current?.focus();}}><Icon className={styles.exampleIcon} size={20} aria-hidden="true"/><span>{question}</span><ChevronRight size={16} aria-hidden="true"/></button>;})}</div></section>
    <section className={styles.demoAnswer} aria-labelledby="natal-demo-answer"><small>Демонстрационный ответ по этой карте</small><h3 id="natal-demo-answer">Какие отношения мне подходят?</h3>
      {answer.length ? answer.map((paragraph,index) => <p key={index}>{paragraph}</p>) : <p>В сохранённой карте нет надёжных положений для этого примера. Не будем заполнять пробелы выдуманным описанием.</p>}
      <small>Пример собран из сохранённых положений карты. Свободные вопросы и ответы ИИ доступны с NEBO+.</small>
    </section>
    <form onSubmit={event => {event.preventDefault(); setShowEntry(true);}}>
      <label htmlFor="natal-demo-question">Твой вопрос</label>
      <div className={styles.demoComposer}><textarea ref={field} id="natal-demo-question" rows={3} value={draft} maxLength={300} onChange={event => setDraft(event.target.value)} placeholder="Напиши свой вопрос…" aria-describedby="natal-demo-access"/><button type="submit" aria-label="Задать свой вопрос с NEBO+"><Send size={20} aria-hidden="true"/></button></div>
      <p id="natal-demo-access" className={styles.demoAccess}>Можно посмотреть пример бесплатно. Свои вопросы — с NEBO+.</p>
    </form>
    {showEntry ? <div ref={entry} role="status"><NatalPlusEntry title="Ответ на твой вопрос — с NEBO+" onOpen={onRequestPremium}>До 5 принятых вопросов в день по твоей основной карте. Ответы сохраняются в существующей истории.</NatalPlusEntry></div> : null}
  </article>;
}
