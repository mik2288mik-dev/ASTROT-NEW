import React, { useEffect, useRef, useState } from 'react';
import { getZodiacSign } from '../../constants';
import { ZODIAC_KEYS, normalizeZodiacKey, type ZodiacKey } from '../../lib/zodiacKeys';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { getSignCompatibility } from '../../services/astrologyService';
import type { SignCompatibilityResult } from '../../lib/synastry/signCompatibility';
import { Art, Glyph, type ArtName } from './Primitives';
import styles from './NeboZodiac.module.css';

export function NeboZodiacExplore({ sign, language }: { sign: ZodiacKey; language: 'ru' | 'en' }) {
  const ru = language === 'ru';
  const [open, setOpen] = useState<'pair' | 'birthday' | null>(null);
  const [other, setOther] = useState<ZodiacKey>(ZODIAC_KEYS[0]);
  const [result, setResult] = useState<SignCompatibilityResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [birthday, setBirthday] = useState('');
  const request = useRef(0);
  useEffect(() => { request.current += 1; setResult(null); setPhase('idle'); }, [sign, other, language, open]);
  useEffect(() => () => { request.current += 1; }, []);
  const birthdaySign = birthday ? normalizeZodiacKey(sunSignFromDate(birthday) || '') : null;
  async function compare() {
    const id = ++request.current; setPhase('loading');
    try {
      const value = await getSignCompatibility(sign, other, language);
      if (id !== request.current) return;
      setResult(value); setPhase('ready');
    } catch { if (id === request.current) setPhase('error'); }
  }
  return <section className={styles.explore} aria-label={ru ? 'Ещё о знаках' : 'Explore signs'}>
    <div className={styles.exploreGrid}>
      <button type="button" className={styles.pairEntry} aria-expanded={open === 'pair'} aria-controls="zodiac-explore-content" onClick={() => setOpen(open === 'pair' ? null : 'pair')}><Art name="rings" size={65}/><strong>{ru ? 'Вы сойдётесь?' : 'A good match?'}</strong><small>{ru ? 'Совместимость знаков' : 'Sign compatibility'}</small></button>
      <button type="button" className={styles.birthdayEntry} aria-expanded={open === 'birthday'} aria-controls="zodiac-explore-content" onClick={() => setOpen(open === 'birthday' ? null : 'birthday')}><Art name="sun" size={65}/><strong>{ru ? 'А у тебя какой?' : 'What is your sign?'}</strong><small>{ru ? 'Узнай знак по дате' : 'Find a sign by birthday'}</small></button>
    </div>
    <div id="zodiac-explore-content">
      {open ? <section className={styles.explorePanel}>
        <div className={styles.panelHeading}><h3>{open === 'pair' ? (ru ? 'Как вы ладите?' : 'How do you get along?') : (ru ? 'Когда день рождения?' : 'When is the birthday?')}</h3><button type="button" className={styles.arrow} aria-label={ru ? 'Закрыть раздел' : 'Close section'} onClick={() => setOpen(null)}><Glyph name="close" size={18}/></button></div>
        {open === 'pair' ? <>
          <div className={styles.pairChoice}><span><Art name={sign.toLowerCase() as ArtName} size={45}/><b>{getZodiacSign(language, sign)}</b></span><span aria-hidden="true">+</span><span><Art name={other.toLowerCase() as ArtName} size={45}/><b>{getZodiacSign(language, other)}</b></span></div>
          <p className={styles.pairPickerLabel}>{ru ? 'Выбери второй знак' : 'Choose the second sign'}</p>
          <div className={`${styles.signStrip} ${styles.pairSignStrip}`} role="group" aria-label={ru ? 'Второй знак' : 'Second sign'}>{ZODIAC_KEYS.map(value => <button type="button" key={value} className={styles.signChip} aria-pressed={other === value} onClick={() => setOther(value)}><img className={styles.pickerArt} src={`/zodiac/sign_symbol_${value.toLowerCase()}.png`} width={42} height={42} alt=""/><small>{getZodiacSign(language, value)}</small></button>)}</div>
          <button type="button" className={styles.action} disabled={phase === 'loading' || phase === 'ready'} onClick={() => void compare()}>{phase === 'loading' ? (ru ? 'Открываем…' : 'Opening…') : phase === 'ready' ? (ru ? 'Сравнение открыто' : 'Comparison opened') : (ru ? 'Посмотреть совместимость' : 'See compatibility')}</button>
          <div aria-live="polite">{result ? <div className={styles.pairResult}>{[[ru ? 'Что притягивает' : 'Attraction', result.attraction], [ru ? 'Где сложнее' : 'Difficulties', result.difficulty], [ru ? 'Как договориться' : 'Communication', result.communication]].map(([title, text]) => <div key={title}><h4>{title}</h4><p>{text}</p></div>)}<small>{result.limitation}</small></div> : phase === 'error' ? <p role="alert">{ru ? 'Не получилось открыть. Попробуй ещё раз.' : 'Could not open it. Try again.'}</p> : null}</div>
        </> : <><label className={styles.birthdayLabel}>{ru ? 'Дата рождения' : 'Birthday'}<input type="date" value={birthday} onChange={event => setBirthday(event.target.value)}/></label><div className={styles.birthdayResult} aria-live="polite">{birthdaySign ? <><Art name={birthdaySign.toLowerCase() as ArtName} size={72}/><strong>{getZodiacSign(language, birthdaySign)}</strong><p>{ru ? 'Это знак по календарной дате. На границе двух знаков уточнить его можно по времени и месту рождения в натальной карте.' : 'This is a calendar estimate. Near a sign boundary, birth time and place are needed for an exact result.'}</p></> : null}</div></>}
      </section> : null}
    </div>
  </section>;
}
