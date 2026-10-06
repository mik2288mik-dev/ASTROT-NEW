import React, { useEffect, useState } from 'react';
import type { AdminStoryCharacter, AdminStorySeriesBible } from '../../services/admin2Service';

const inputCls = 'admin2-input';
const btnPrimary = 'admin2-button admin2-button--primary';
const btnGhost = 'admin2-button admin2-button--secondary';

const GENRES: Array<[AdminStorySeriesBible['genre'], string]> = [
  ['detective', 'Детектив'], ['romance', 'Романтика'], ['scifi', 'Фантастика'], ['comedy', 'Комедия'],
];
const GENDERS: Array<[AdminStoryCharacter['gender'], string]> = [
  ['female', 'женщина'], ['male', 'мужчина'], ['animal', 'животное'], ['machine', 'машина'],
];
const VOICES = ['coral', 'sage', 'nova', 'shimmer', 'ash', 'ballad', 'onyx', 'verse', 'alloy', 'echo', 'fable', 'marin', 'cedar'];

export const EMPTY_SERIES: AdminStorySeriesBible = {
  id: '',
  genre: 'detective',
  title: '',
  tagline: '',
  narrator: 'marin',
  world: '',
  characters: [{ name: '', aliases: [], role: '', gender: 'female' }],
  arcs: [{ name: '', beats: [''] }],
  rules: [],
  style: '',
};

const toLines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);

type Props = {
  initial: AdminStorySeriesBible;
  enabled: boolean;
  isNew: boolean;
  builtIn: boolean;
  edited: boolean;
  busy: boolean;
  canEdit: boolean;
  onSave: (series: AdminStorySeriesBible, enabled: boolean) => void;
  onReset?: () => void;
};

/** The series bible: everything the writer gets before each episode. */
export function StorySeriesEditor({ initial, enabled, isNew, builtIn, edited, busy, canEdit, onSave, onReset }: Props) {
  const [draft, setDraft] = useState<AdminStorySeriesBible>(initial);
  const [on, setOn] = useState(enabled);
  useEffect(() => { setDraft(initial); setOn(enabled); }, [initial, enabled]);

  const set = <K extends keyof AdminStorySeriesBible>(key: K, value: AdminStorySeriesBible[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setCharacter = (index: number, patch: Partial<AdminStoryCharacter>) =>
    set('characters', draft.characters.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const setArc = (index: number, patch: Partial<{ name: string; beats: string[] }>) =>
    set('arcs', draft.arcs.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const clean = (): AdminStorySeriesBible => ({
    ...draft,
    id: draft.id.trim().toLowerCase(),
    characters: draft.characters.filter((item) => item.name.trim()),
    arcs: draft.arcs.map((arc) => ({ name: arc.name.trim(), beats: arc.beats.map((beat) => beat.trim()).filter(Boolean) })).filter((arc) => arc.name && arc.beats.length),
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Код сериала (латиницей, для ссылок)
          <input className={inputCls} value={draft.id} disabled={!isNew || !canEdit} placeholder="night-train" onChange={(e) => set('id', e.target.value)} />
        </label>
        <label className="block text-sm">
          Жанр
          <select className={inputCls} value={draft.genre} disabled={!canEdit} onChange={(e) => set('genre', e.target.value as AdminStorySeriesBible['genre'])}>
            {GENRES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          Название
          <input className={inputCls} value={draft.title} disabled={!canEdit} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label className="block text-sm">
          Голос рассказчика (для озвучки)
          <select className={inputCls} value={draft.narrator} disabled={!canEdit} onChange={(e) => set('narrator', e.target.value)}>
            {VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Подзаголовок для читателей
        <input className={inputCls} value={draft.tagline} disabled={!canEdit} onChange={(e) => set('tagline', e.target.value)} />
      </label>
      <label className="block text-sm">
        Мир: место, время, атмосфера
        <textarea className={inputCls} rows={4} value={draft.world} disabled={!canEdit} onChange={(e) => set('world', e.target.value)} />
      </label>
      <label className="block text-sm">
        Стиль и тон (как писать: темп, юмор, длина диалогов, что подчёркивать)
        <textarea className={inputCls} rows={3} value={draft.style ?? ''} disabled={!canEdit} placeholder="Например: больше диалогов, лёгкий юмор, каждая серия начинается с утра героини" onChange={(e) => set('style', e.target.value)} />
      </label>

      <div>
        <p className="mb-1 text-sm font-semibold text-slate-700">Герои</p>
        <div className="space-y-2">
          {draft.characters.map((character, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-2">
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={inputCls} placeholder="Имя Фамилия" value={character.name} disabled={!canEdit} onChange={(e) => setCharacter(index, { name: e.target.value })} />
                <input className={inputCls} placeholder="Как ещё зовут: Аня, Анюта" value={character.aliases.join(', ')} disabled={!canEdit} onChange={(e) => setCharacter(index, { aliases: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
                <select className={inputCls} value={character.gender} disabled={!canEdit} onChange={(e) => setCharacter(index, { gender: e.target.value as AdminStoryCharacter['gender'] })}>
                  {GENDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <textarea className={`${inputCls} mt-2`} rows={2} placeholder="Возраст, кто он, характер" value={character.role} disabled={!canEdit} onChange={(e) => setCharacter(index, { role: e.target.value })} />
              {canEdit ? <button type="button" className="mt-1 text-xs text-red-600" onClick={() => set('characters', draft.characters.filter((_, i) => i !== index))}>Убрать героя</button> : null}
            </div>
          ))}
        </div>
        {canEdit ? <button type="button" className={`${btnGhost} mt-2`} onClick={() => set('characters', [...draft.characters, { name: '', aliases: [], role: '', gender: 'female' }])}>+ Герой</button> : null}
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-slate-700">Сюжетные линии (по одной строке на событие, серии идут по ним по очереди)</p>
        <div className="space-y-2">
          {draft.arcs.map((arc, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-2">
              <input className={inputCls} placeholder="Название линии" value={arc.name} disabled={!canEdit} onChange={(e) => setArc(index, { name: e.target.value })} />
              <textarea className={`${inputCls} mt-2`} rows={4} placeholder={'Событие 1\nСобытие 2'} value={arc.beats.join('\n')} disabled={!canEdit} onChange={(e) => setArc(index, { beats: e.target.value.split('\n') })} />
              {canEdit ? <button type="button" className="mt-1 text-xs text-red-600" onClick={() => set('arcs', draft.arcs.filter((_, i) => i !== index))}>Убрать линию</button> : null}
            </div>
          ))}
        </div>
        {canEdit ? <button type="button" className={`${btnGhost} mt-2`} onClick={() => set('arcs', [...draft.arcs, { name: '', beats: [''] }])}>+ Линия</button> : null}
      </div>

      <label className="block text-sm">
        Правила сериала (по одному на строку)
        <textarea className={inputCls} rows={4} value={draft.rules.join('\n')} disabled={!canEdit} onChange={(e) => set('rules', toLines(e.target.value))} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={on} disabled={!canEdit} onChange={(e) => setOn(e.target.checked)} />
        Сериал виден читателям и пишутся новые серии (снимите, пауза)
      </label>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => onSave(clean(), on)}>
            {isNew ? 'Создать сериал' : 'Сохранить сценарий'}
          </button>
          {builtIn && edited && onReset ? (
            <button type="button" className={btnGhost} disabled={busy} onClick={onReset}>Вернуть исходный текст</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
