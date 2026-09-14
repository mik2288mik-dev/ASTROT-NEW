import React from 'react';
import { LockKeyhole } from 'lucide-react';
import styles from './NatalSection.module.css';
import { NatalArtwork } from './NatalArtwork';

export function NatalPlusEntry({ title, children, onOpen }: { title: string; children: React.ReactNode; onOpen: () => void }) {
  return <section className={styles.plusEntry} aria-label="Доступ с NEBO+" data-natal-plus-entry>
    <NatalArtwork art="plus" className={styles.plusArtwork}/><span className={styles.plusLabel}><LockKeyhole size={16} aria-hidden="true"/>NEBO+</span>
    <h3>{title}</h3><p>{children}</p>
    <button type="button" onClick={onOpen}>Открыть NEBO+</button>
  </section>;
}
