import React, { useState } from 'react';
import { lumiaSelectionHaptic } from '../../lib/haptics';

type InfoNoteProps = {
  /** Короткая подпись рядом с «i» (например, «Что это?»). */
  title: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Маленькая сноска-объяснение: кнопка «i» + подпись, по тапу раскрывается мелкий
 * текст. Единый способ объяснять астро/таро-термины простым языком на всех экранах
 * (как «Что это значит?» в Матрице), чтобы пользователь понимал, что и откуда.
 */
export function InfoNote({ title, children, className }: InfoNoteProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`info-note${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="info-note-toggle"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); lumiaSelectionHaptic(); setOpen((v) => !v); }}
      >
        <span className="info-note-i" aria-hidden>i</span>
        {title}
      </button>
      {open ? <p className="info-note-text">{children}</p> : null}
    </div>
  );
}
