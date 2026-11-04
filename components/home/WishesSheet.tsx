import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import { DictationButton } from '../lumia-ui/DictationButton';
import { appendDictatedText } from '../../services/dictation';
import { tr, trf } from '../../lib/i18n';

export type WishItem = { id: string; text: string; done?: boolean };
export type WishRecord = { items: WishItem[]; savedAt: string };

export const WISH_LIMIT = 5;
export const WISH_MAX_LENGTH = 90;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type WishesSheetProps = {
  open: boolean;
  language: 'ru' | 'en';
  /** «7 октября». */
  dateLabel: string;
  initial: WishItem[];
  onSave: (items: WishItem[]) => void;
  onClose: () => void;
};

/** «Задумай, что хочешь за месяц»: a short list of plans saved for this new moon. */
export function WishesSheet({ open, language, dateLabel, initial, onSave, onClose }: WishesSheetProps) {
  const ru = language === 'ru';
  const [items, setItems] = useState<WishItem[]>([]);

  useEffect(() => {
    if (open) setItems(initial.length ? initial : [{ id: newId(), text: '' }]);
  }, [initial, open]);

  const filled = items.map((item) => ({ ...item, text: item.text.trim() })).filter((item) => item.text);

  return (
    <CosmicSheet
      open={open}
      title={ru ? 'Планы на месяц' : tr('Plans for the month')}
      subtitle={ru ? `Новолуние ${dateLabel}. Коротко, своими словами.` : trf('New moon, {0}. Short, in your own words.', dateLabel)}
      onClose={onClose}
      closeLabel={ru ? 'Закрыть' : tr('Close')}
      footer={(
        <button
          type="button"
          className="home-sheet-primary"
          disabled={!filled.length}
          onClick={() => { onSave(filled); onClose(); }}
        >
          {ru ? 'Сохранить' : tr('Save')}
        </button>
      )}
    >
      <ol className="wishes-list">
        {items.map((item, index) => (
          <li key={item.id} className="wishes-item">
            <span className="wishes-number" aria-hidden="true">{index + 1}</span>
            <input
              type="text"
              value={item.text}
              maxLength={WISH_MAX_LENGTH}
              placeholder={ru ? ['Например: выспаться хотя бы 4 ночи в неделю', 'Позвонить бабушке', 'Закрыть кредитку'][index % 3] : ['E.g. sleep well at least 4 nights a week', 'Call grandma', 'Pay off the card'][index % 3]}
              aria-label={ru ? `План ${index + 1}` : trf('Plan {0}', index + 1)}
              onChange={(event) => {
                const text = event.target.value;
                setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)));
              }}
            />
            <DictationButton
              language={language}
              onText={(text) => setItems((current) => current.map((entry) => (
                entry.id === item.id ? { ...entry, text: appendDictatedText(entry.text, text, WISH_MAX_LENGTH) } : entry
              )))}
            />
            {items.length > 1 ? (
              <button
                type="button"
                className="wishes-remove"
                aria-label={ru ? 'Убрать пункт' : tr('Remove')}
                onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {items.length < WISH_LIMIT ? (
        <button
          type="button"
          className="wishes-add"
          onClick={() => setItems((current) => [...current, { id: newId(), text: '' }])}
        >
          <Plus size={16} aria-hidden="true" />
          {ru ? 'Ещё пункт' : tr('Add a point')}
        </button>
      ) : null}
      <p className="home-sheet-note">
        {ru ? 'Видишь только ты. В конце месяца напомним отметить, что сбылось.' : tr('Only you can see this. At the end of the month we will remind you to mark what came true.')}
      </p>
    </CosmicSheet>
  );
}
