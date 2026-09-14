import React from 'react';
import type { explainMapSelection } from './mapExplanation';
import styles from './InteractiveNatalMap.module.css';
import { Circle, House, Triangle, Heart } from 'lucide-react';
import { NatalArtwork, type NatalArt } from './NatalArtwork';

type MapExplanation = NonNullable<ReturnType<typeof explainMapSelection>>;

/** Explains one selected chart element; never opens the general natal reading. */
export function NatalMapExplanationScreen({ explanation }: { explanation: MapExplanation }) {
  const aspects = explanation.reasons.filter(reason => reason.tone === 'aspect');
  const firstAspect = explanation.reasons.findIndex(reason => reason.tone === 'aspect');
  const artFor = (title: string, tone: string): NatalArt => tone === 'house'
    ? /5 дом|твор/i.test(title) ? 'work' : /7 дом|отнош/i.test(title) ? 'love' : 'home'
    : /Овен|Лев|Стрелец/.test(title) ? 'character' : /Близнецы|Весы|Водолей/.test(title) ? 'communication' : /Рак|Скорпион|Рыбы/.test(title) ? 'emotions' : 'home';
  return <article data-map-explanation-screen aria-label={`Почему такой вывод: ${explanation.title}`}>
    <p className={styles.detailIntro}>{explanation.yours}</p>
    <section className={`${styles.reason} ${styles.objectIntro}`}><span className={styles.explanationGlyph} style={{color:explanation.color,fontSize:explanation.glyph.length > 2 ? 22 : undefined}} aria-hidden="true">{explanation.glyph}</span><div><h3>Что это</h3><p>{explanation.what}</p></div></section>
    {explanation.reasons.map((reason, index) => reason.tone === 'aspect' ? index === firstAspect ? <section key="aspects" className={`${styles.reason} ${styles.aspect}`}>
      <header className={styles.reasonHeading}><span className={styles.reasonMarker}><Triangle size={23} aria-hidden="true"/></span><div><h3>Аспекты</h3><small>Как связано</small></div></header>
      <div className={styles.aspectReasons}>{aspects.map((aspect,i) => <section key={i}><h4>{aspect.title}</h4><small>{aspect.subtitle}</small>{aspect.facts ? <p className={styles.facts}>{aspect.facts}</p> : null}<p>{aspect.text}</p></section>)}</div>
    </section> : null : <section key={index} className={`${styles.reason} ${styles[reason.tone]}`}>
      <header className={styles.reasonHeading}><span className={styles.reasonMarker}>{reason.tone === 'house' ? <House size={23} aria-hidden="true"/> : <Circle size={23} aria-hidden="true"/>}</span><div><h3>{reason.title}</h3><small>{reason.subtitle}</small></div>{index < 2 ? <NatalArtwork art={artFor(`${reason.title} ${reason.facts ?? ''}`,reason.tone)} className={styles.reasonArtwork}/> : null}</header>
      {reason.facts ? <p className={styles.facts}>{reason.facts}</p> : null}
      <p>{reason.text}</p>
    </section>)}
    <section className={`${styles.reason} ${styles.total}`}>
      <header className={styles.reasonHeading}><span className={styles.reasonMarker}><Heart size={23} aria-hidden="true"/></span><h3>Что всё это значит вместе</h3></header>
      <p>{explanation.summary}</p>
    </section>
  </article>;
}
