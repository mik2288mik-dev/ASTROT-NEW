import React, { useMemo } from 'react';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import { buildNatalProfile } from '../../lib/natalProfile';
import { planetArtStyle } from './planetArt';
import styles from './NatalHighlights.module.css';

const DIGNITY_MARK: Record<string, { label: string; className: string }> = {
  domicile: { label: 'дом', className: styles.domicile },
  exaltation: { label: 'пик', className: styles.exaltation },
  detriment: { label: 'вне', className: styles.weak },
  fall: { label: 'вне', className: styles.weak },
};

export function NatalProfileTab({ chart }: { chart: NatalChartDataV2 }) {
  const profile = useMemo(() => buildNatalProfile(chart), [chart]);
  if (!profile) {
    return <p className={styles.disclaimer}>Профиль появится, когда карта полностью рассчитается.</p>;
  }

  return (
    <div>
      {profile.ruler ? (
        <section
          className={`${styles.block} ${styles.hero} ${styles.evening} ${styles.withArt}`}
          style={planetArtStyle(profile.ruler.planet)}
          aria-labelledby="natal-profile-ruler"
        >
          <p className={styles.heroLabel}>Управитель твоей карты</p>
          <h2 id="natal-profile-ruler" className={styles.heroTitle}>{profile.ruler.planetLabel}</h2>
          <p className={styles.heroText}>{profile.ruler.body}</p>
          <span className={styles.source}>Классическая традиция · Птолемей, II век</span>
        </section>
      ) : null}

      <section className={styles.block} aria-labelledby="natal-profile-days">
        <h2 id="natal-profile-days" className={styles.heading}>
          {profile.weekdays.length > 1 ? 'Твои дни недели' : 'Твой день недели'}
        </h2>
        <div className={styles.days}>
          {profile.weekdays.map((item) => (
            <div
              key={item.source}
              className={`${styles.dayTile} ${item.source === 'sun' ? styles.day : styles.evening} ${styles.withArt}`}
              style={planetArtStyle(item.planet)}
            >
              <span className={styles.dayCaption}>{item.caption}</span>
              <span className={styles.dayName}>{item.day}</span>
              <span className={styles.dayOrigin}>{item.origin}</span>
            </div>
          ))}
        </div>
      </section>

      {profile.dignities.length ? (
        <section className={styles.block} aria-labelledby="natal-profile-dignities">
          <h2 id="natal-profile-dignities" className={styles.heading}>
            Сильные позиции
            {profile.strongCount ? <span className={styles.headingNote}>{profile.strongCount} из 7</span> : null}
          </h2>
          <div className={styles.dignities}>
            {profile.dignities.map((item) => (
              <div key={item.planet} className={styles.dignity}>
                <span className={`${styles.dignityMark} ${DIGNITY_MARK[item.kind].className}`} aria-hidden="true">
                  {DIGNITY_MARK[item.kind].label}
                </span>
                <div className={styles.momentBody}>
                  <h3 className={styles.momentHeadline}>{item.headline}</h3>
                  <p className={styles.momentText}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.disclaimer}>«Дом», планета в своём знаке, «пик», в знаке, где ей лучше всего. Так позиции планет оценивали ещё во II веке.</p>
        </section>
      ) : null}

      <section className={styles.block} aria-labelledby="natal-profile-classic">
        <h2 id="natal-profile-classic" className={styles.heading}>Классика и современность</h2>
        <div className={styles.card}>
          <p className={styles.kicker}>Твой знак</p>
          <h3 className={styles.momentHeadline}>{profile.classicVsModern.headline}</h3>
          <p className={styles.momentText}>{profile.classicVsModern.body}</p>
        </div>
        <div className={styles.card}>
          <p className={styles.kicker}>Миф</p>
          <h3 className={styles.momentHeadline}>«Камень твоего знака», поздняя выдумка</h3>
          <p className={styles.momentText}>
            В старых книгах у каждой планеты был список из нескольких камней, и списки пересекались.
            Один камень на каждый месяц ювелиры утвердили только в 1912 году. Так что покупать кольцо по команде приложения не придётся.
          </p>
        </div>

      </section>

      <section className={styles.block} aria-labelledby="natal-profile-set">
        <h2 id="natal-profile-set" className={styles.heading}>Твоя классическая связка</h2>
        <div className={styles.card}>
          <p className={styles.kicker}>{profile.history.sign} · управитель {profile.history.planetLabel}</p>
          <h3 className={styles.momentHeadline}>Что старые астрологи связывали с твоим знаком</h3>
          <dl className={styles.setList}>
            {[
              ['Металл', profile.history.metal],
              ['Камни', profile.history.stones],
              ['Цвета', profile.history.colors],
              ['Растения', profile.history.plants],
              ['Деревья', profile.history.trees],
              ['Число планеты', String(profile.history.number)],
            ].map(([label, value]) => (
              <div key={label} className={styles.setRow}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <span className={styles.source}>Агриппа, «Оккультная философия», XVI век</span>
          <p className={styles.disclaimer}>Знак получает всё это от своей планеты. Это красивая часть истории астрологии, а не обязательные правила.</p>
        </div>
      </section>
    </div>
  );
}
