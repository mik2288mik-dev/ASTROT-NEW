import React from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import styles from './PremiumHook.module.css';

type PremiumHookProps = {
  /** Personal headline: what this person specifically gets, not a generic upsell. */
  title: string;
  /** Short lines describing what opens, built from the person's own data. */
  items: readonly string[];
  cta?: string;
  note?: string;
  onOpen: () => void;
};

/**
 * The one invitation to NEBO Premium across the app. It shows what is inside for this
 * person (their placements, their numbers, their topics) and never cuts off
 * content that was already shown for free.
 */
export function PremiumHook({ title, items, cta = 'Открыть в NEBO Premium', note, onOpen }: PremiumHookProps) {
  return (
    <section className={styles.hook} aria-label="Доступ с NEBO Premium" data-premium-hook>
      <span className={styles.label}><LockKeyhole size={14} aria-hidden="true" />Premium</span>
      <h3 className={styles.title}>{title}</h3>
      {items.length ? (
        <ul className={styles.items}>
          {items.map((item) => (
            <li key={item}><Check size={15} strokeWidth={2.4} aria-hidden="true" />{item}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" className={styles.button} onClick={onOpen}>{cta}</button>
      {note ? <p className={styles.note}>{note}</p> : null}
    </section>
  );
}
