import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import type { WishItem } from './WishesSheet';

export type MonthReviewRecord = { note: string; came: number; planned: number; savedAt: string };

type WishGroup = { key: string; items: WishItem[] };

type MonthReviewSheetProps = {
  open: boolean;
  language: 'ru' | 'en';
  /** «октябрь». */
  monthLabel: string;
  wishGroups: WishGroup[];
  onSave: (groups: WishGroup[], note: string) => void;
  onClose: () => void;
};

/** «Итоги месяца»: mark what came true from the plans and keep one good thing. */
export function MonthReviewSheet({ open, language, monthLabel, wishGroups, onSave, onClose }: MonthReviewSheetProps) {
  const ru = language === 'ru';
  const [groups, setGroups] = useState<WishGroup[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setGroups(wishGroups);
    setNote('');
  }, [open, wishGroups]);

  const toggle = (groupKey: string, itemId: string) => {
    setGroups((current) => current.map((group) => (group.key !== groupKey ? group : {
      ...group,
      items: group.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    })));
  };

  const hasWishes = groups.some((group) => group.items.length);

  return (
    <CosmicSheet
      open={open}
      title={ru ? `Итоги: ${monthLabel}` : `${monthLabel} in review`}
      subtitle={ru ? 'Без оценок — просто посмотреть, что получилось.' : 'No grades — just a look at what worked out.'}
      onClose={onClose}
      closeLabel={ru ? 'Закрыть' : 'Close'}
      footer={(
        <button
          type="button"
          className="home-sheet-primary"
          disabled={!hasWishes && !note.trim()}
          onClick={() => { onSave(groups, note.trim()); onClose(); }}
        >
          {ru ? 'Сохранить итоги' : 'Save the review'}
        </button>
      )}
    >
      {hasWishes ? (
        <>
          <h3 className="home-sheet-heading">{ru ? 'Что сбылось' : 'What came true'}</h3>
          <ul className="review-list">
            {groups.flatMap((group) => group.items.map((item) => (
              <li key={`${group.key}:${item.id}`}>
                <button
                  type="button"
                  className={`review-item${item.done ? ' is-done' : ''}`}
                  aria-pressed={Boolean(item.done)}
                  onClick={() => toggle(group.key, item.id)}
                >
                  <span className="review-check" aria-hidden="true">{item.done ? <Check size={14} strokeWidth={3} /> : null}</span>
                  <span>{item.text}</span>
                </button>
              </li>
            )))}
          </ul>
        </>
      ) : (
        <p className="home-sheet-note">
          {ru
            ? 'В этом месяце планов не было. В следующее новолуние предложим записать три-пять пунктов.'
            : 'There were no plans this month. At the next new moon we will offer to write three to five points.'}
        </p>
      )}
      <label className="review-note">
        <span>{ru ? 'Одна хорошая вещь за месяц' : 'One good thing this month'}</span>
        <textarea
          value={note}
          maxLength={280}
          rows={3}
          placeholder={ru ? 'Например: наконец-то выбрались на море. Или: по утрам стало спокойнее.' : 'E.g. finally got to the sea. Or: mornings got calmer.'}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
    </CosmicSheet>
  );
}
