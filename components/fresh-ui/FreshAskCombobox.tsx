import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { lumiaSelectionHaptic } from '../../lib/haptics';

const SearchGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

type FreshAskComboboxProps = {
  questions: string[];
  onPick: (question: string) => void;
  disabled?: boolean;
  placeholder: string;
  emptyText: string;
  /** Премиум-замок: показываем метку и не блокируем выбор (гейт на стороне родителя) */
  locked?: boolean;
  lockLabel?: string;
};

/**
 * Строка-комбобокс: ввод + выпадающий выбор вопросов.
 * Открывается вверх (живёт в нижней панели чата). Анимация — framer-motion.
 */
export function FreshAskCombobox({
  questions,
  onPick,
  disabled,
  placeholder,
  emptyText,
  locked,
  lockLabel,
}: FreshAskComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((item) => item.toLowerCase().includes(q));
  }, [query, questions]);

  useEffect(() => () => { if (blurTimer.current) window.clearTimeout(blurTimer.current); }, []);

  const pick = (question: string) => {
    if (disabled) return;
    lumiaSelectionHaptic();
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
    onPick(question);
  };

  return (
    <div className="fresh-combo">
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fresh-combo-list scrollbar-hide"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {filtered.length ? (
              filtered.map((question, i) => (
                <motion.button
                  key={question}
                  type="button"
                  className="fresh-combo-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(question)}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.025, 0.2), duration: 0.16 }}
                >
                  <span className="fresh-combo-dot" />
                  <span className="fresh-combo-option-text">{question}</span>
                  {locked ? (
                    <svg className="fresh-combo-option-lock" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  ) : null}
                </motion.button>
              ))
            ) : (
              <div className="fresh-combo-empty">{emptyText}</div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className={`fresh-combo-bar ${open ? 'is-open' : ''}`}>
        <span className="fresh-combo-ico"><SearchGlyph /></span>
        <input
          ref={inputRef}
          className="fresh-combo-input"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150); }}
        />
        {locked ? (
          <span className="fresh-combo-lock">{lockLabel}</span>
        ) : (
          <motion.span
            className="fresh-combo-chev"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        )}
      </div>
    </div>
  );
}
