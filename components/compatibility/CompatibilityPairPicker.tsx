import React, { useMemo } from 'react';
import { Plus, UserRoundPlus } from 'lucide-react';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { getZodiacSign } from '../../constants';
import { buildCompatibilityLiveSample } from '../../lib/synastry/compatibilityLiveSample';

export type PairPerson = {
  name: string;
  /** Lowercase zodiac key, when known. */
  sign: string | null;
  meta: string;
  empty: boolean;
};

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function Avatar({ person, tone, label, onClick, ru }: { person: PairPerson; tone: 'blue' | 'red'; label: string; onClick: () => void; ru: boolean }) {
  return (
    <button type="button" className={`compat-pair-avatar is-${tone}${person.empty ? ' is-empty' : ''}`} onClick={onClick} aria-label={label}>
      <span className="compat-pair-avatar-circle" aria-hidden="true">
        {person.empty ? <UserRoundPlus size={30} strokeWidth={1.6} /> : <span className="compat-pair-avatar-initial">{initialOf(person.name) || '?'}</span>}
        {person.sign ? (
          <span className="compat-pair-avatar-sign">
            <ZodiacIcon sign={person.sign} size={16} strokeWidth={1.6} />
          </span>
        ) : null}
      </span>
      <span className="compat-pair-avatar-name">{person.empty ? (ru ? 'Выбрать' : 'Choose') : person.name}</span>
      <span className="compat-pair-avatar-meta">{person.sign ? getZodiacSign(ru ? 'ru' : 'en', person.sign) : person.meta}</span>
    </button>
  );
}

/** Two big avatars with zodiac badges and a «+» between them. */
export function CompatibilityPairAvatars({ first, second, ru, onPickFirst, onPickSecond }: {
  first: PairPerson;
  second: PairPerson;
  ru: boolean;
  onPickFirst: () => void;
  onPickSecond: () => void;
}) {
  return (
    <div className="compat-pair-picker" aria-label={ru ? 'Люди для сравнения' : 'People to compare'}>
      <Avatar person={first} tone="blue" ru={ru} onClick={onPickFirst} label={ru ? `Первый человек: ${first.empty ? 'не выбран' : first.name}` : `First person: ${first.empty ? 'not chosen' : first.name}`} />
      <span className="compat-pair-picker-plus" aria-hidden="true"><Plus size={22} strokeWidth={2.2} /></span>
      <Avatar person={second} tone="red" ru={ru} onClick={onPickSecond} label={ru ? `Второй человек: ${second.empty ? 'не выбран' : second.name}` : `Second person: ${second.empty ? 'not chosen' : second.name}`} />
    </div>
  );
}

export type SavedPersonChip = { id: number; name: string; sign: string | null; self: boolean; selected: boolean };

/** Saved people in one row: tap and the person takes their place in the pair. */
export function CompatibilitySavedPeople({ people, ru, onPick, onAddNew }: {
  people: readonly SavedPersonChip[];
  ru: boolean;
  onPick: (person: SavedPersonChip) => void;
  onAddNew: () => void;
}) {
  return (
    <section className="compat-saved-people" aria-label={ru ? 'Сохранённые люди' : 'Saved people'}>
      <ul>
        {people.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              className={`compat-saved-person${person.selected ? ' is-selected' : ''}`}
              aria-pressed={person.selected}
              onClick={() => onPick(person)}
            >
              <span className="compat-saved-person-circle" aria-hidden="true">
                {initialOf(person.name)}
                {person.sign ? <span className="compat-saved-person-sign"><ZodiacIcon sign={person.sign} size={11} strokeWidth={1.7} /></span> : null}
              </span>
              <span className="compat-saved-person-name">{person.self ? (ru ? 'Я' : 'Me') : person.name.split(/\s+/u)[0]}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="compat-saved-person is-new" onClick={onAddNew}>
            <span className="compat-saved-person-circle" aria-hidden="true"><Plus size={18} /></span>
            <span className="compat-saved-person-name">{ru ? 'Новый' : 'New'}</span>
          </button>
        </li>
      </ul>
    </section>
  );
}

/**
 * A real sample of the reading, built on this person's own Sun sign and the
 * sign they match best with. The full reading uses both birth dates.
 */
export function CompatibilityLiveSample({ yourSign, ru }: { yourSign: string; ru: boolean }) {
  const sample = useMemo(() => buildCompatibilityLiveSample(yourSign, ru), [ru, yourSign]);
  if (!sample) return null;

  return (
    <article className="compat-live-sample" aria-label={ru ? 'Образец разбора совместимости' : 'Compatibility reading sample'}>
      <header className="compat-live-sample-cover">
        <span className="compat-live-sample-kicker">{ru ? 'образец · по знакам' : 'sample · by signs'}</span>
        <strong>
          <span className="compat-live-sample-sign"><ZodiacIcon sign={sample.you} size={18} strokeWidth={1.6} /></span>
          {ru ? `Ты (${sample.youName}) и ${sample.partnerName}` : `You (${sample.youName}) and ${sample.partnerName}`}
          <span className="compat-live-sample-sign"><ZodiacIcon sign={sample.partner} size={18} strokeWidth={1.6} /></span>
        </strong>
      </header>
      {/* No percentage: the birth-date reading promises not to grade a relationship, so its sample doesn't either. */}
      <div className="compat-live-sample-scale">
        <small>{sample.verdict}</small>
      </div>
      <ol className="compat-live-sample-topics">
        {sample.topics.map((topic) => (
          <li key={topic.title}>
            <div>
              <h4>{topic.title}</h4>
              <p>{topic.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {sample.quote ? <blockquote className="compat-live-sample-quote">{sample.quote}</blockquote> : null}
      <p className="compat-live-sample-note">
        {ru
          ? 'Это пример по солнечным знакам. Ваш разбор строится по датам рождения обоих: Луна, Венера, Марс, и ответы именно про вашу пару.'
          : 'This sample uses Sun signs. Your reading uses both birth dates: the Moon, Venus, Mars, and answers about your pair.'}
      </p>
    </article>
  );
}
