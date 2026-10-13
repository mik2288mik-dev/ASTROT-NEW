import React, { useState } from 'react';
import { admin2, type AdminStoryPlan, type AdminStoryVariant } from '../../services/admin2Service';

const inputCls = 'admin2-input';
const btnPrimary = 'admin2-button admin2-button--primary';
const btnGhost = 'admin2-button admin2-button--secondary';

type Props = {
  seriesId: string;
  /** Numbers that already have written episodes. */
  lastNumber: number;
  plans: AdminStoryPlan[];
  canEdit: boolean;
  generationEnabled: boolean;
  onChanged: () => Promise<void> | void;
};

/**
 * What happens in upcoming episodes: ask the AI for three plots and pick one,
 * or write your own. The writer follows the plan when it reaches that number.
 */
export function StoryPlanner({ seriesId, lastNumber, plans, canEdit, generationEnabled, onChanged }: Props) {
  const [number, setNumber] = useState(lastNumber + 1);
  const [hint, setHint] = useState('');
  const [own, setOwn] = useState('');
  const [variants, setVariants] = useState<AdminStoryVariant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const propose = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await admin2.proposeStoryVariants(seriesId, number, hint.trim() || undefined);
      setVariants(result.variants);
      if (!result.variants.length) setError('Модель не вернула вариантов, попробуйте ещё раз');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const planned = plans.find((plan) => plan.number === number) ?? null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Задайте сюжет будущей серии, генератор напишет её по вашему плану, а не по линиям сценария. Уже написанную последнюю серию
        можно переписать по плану кнопкой «Написать заново» в списке серий.
      </p>
      <label className="block max-w-[220px] text-sm">
        Номер серии
        <input className={inputCls} type="number" min={1} value={number} onChange={(e) => { setNumber(Math.max(1, Number(e.target.value) || 1)); setVariants([]); }} />
      </label>
      {number <= lastNumber ? <p className="text-xs text-amber-700">Серия № {number} уже написана, план сработает, только если её переписать.</p> : null}

      {planned ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <b>План серии № {number}</b> ({planned.source === 'ai' ? 'вариант ИИ' : 'ваш вариант'}): {planned.direction}
          {canEdit ? <button type="button" className="ml-2 text-xs text-red-600" disabled={busy} onClick={() => run(() => admin2.deleteStoryPlan(seriesId, number), 'План удалён, серия пойдёт по линиям сценария')}>убрать план</button> : null}
        </div>
      ) : null}

      {canEdit ? (
        <>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-1 text-sm font-semibold text-slate-700">Варианты от ИИ</p>
            <input className={inputCls} placeholder="Пожелание (необязательно): например, «пусть Марк наконец признается»" value={hint} onChange={(e) => setHint(e.target.value)} />
            <button type="button" className={`${btnGhost} mt-2`} disabled={busy || !generationEnabled} onClick={propose}>
              {busy ? 'Думаю…' : 'Предложить 3 варианта'}
            </button>
            {!generationEnabled ? <p className="mt-1 text-xs text-amber-700">На этом сервере генерация выключена.</p> : null}
            <div className="mt-2 space-y-2">
              {variants.map((variant) => (
                <div key={variant.title} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <b>{variant.title}</b>
                  <p className="mt-1 text-slate-600">{variant.synopsis}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={btnPrimary} disabled={busy} onClick={() => run(() => admin2.saveStoryPlan(seriesId, number, `${variant.title}. ${variant.synopsis}`, 'ai'), `План серии № ${number} сохранён`)}>Выбрать</button>
                    <button type="button" className={btnGhost} onClick={() => setOwn(`${variant.title}. ${variant.synopsis}`)}>Взять и поправить</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-1 text-sm font-semibold text-slate-700">Свой вариант</p>
            <textarea className={inputCls} rows={5} placeholder="Что происходит в серии, кто участвует, чем заканчивается и какой крючок на завтра" value={own} onChange={(e) => setOwn(e.target.value)} />
            <button type="button" className={`${btnPrimary} mt-2`} disabled={busy || !own.trim()} onClick={() => run(() => admin2.saveStoryPlan(seriesId, number, own.trim(), 'own'), `План серии № ${number} сохранён`)}>
              Сохранить план
            </button>
          </div>
        </>
      ) : null}

      {plans.length ? (
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-700">Все планы</p>
          <ul className="space-y-1 text-sm text-slate-600">
            {plans.map((plan) => (
              <li key={plan.number}><b>№ {plan.number}</b> · {plan.direction.slice(0, 160)}{plan.direction.length > 160 ? '…' : ''}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
