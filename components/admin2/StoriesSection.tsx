import React, { useEffect, useMemo, useState } from 'react';
import { admin2, type AdminStoriesOverview, type AdminStoryEpisode, type AdminStorySeriesBible } from '../../services/admin2Service';
import { EMPTY_SERIES, StorySeriesEditor } from './StorySeriesEditor';
import { StoryPlanner } from './StoryPlanner';

const card = 'admin2-card';
const btnPrimary = 'admin2-button admin2-button--primary';
const btnGhost = 'admin2-button admin2-button--secondary';
const inputCls = 'admin2-input';

const STATUS: Record<AdminStoryEpisode['status'], string> = {
  ready: 'готова, выйдет сама',
  needs_review: 'ждёт проверки',
  approved: 'проверена',
  hold: 'остановлена',
};

function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

type View = 'episodes' | 'bible' | 'plan';

function bibleOf(series: AdminStoriesOverview['series'][number]): AdminStorySeriesBible {
  const { id, genre, title, tagline, narrator, world, characters, arcs, rules, style } = series;
  return { id, genre, title, tagline, narrator, world, characters, arcs, rules, style: style ?? '' };
}

/** «Рассказы»: the series scripts, plots of upcoming episodes, and moderation before release. */
export function StoriesSection({ canEdit, canPublish }: { canEdit: boolean; canPublish: boolean }) {
  const [overview, setOverview] = useState<AdminStoriesOverview | null>(null);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string; hook: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<View>('episodes');
  const [creating, setCreating] = useState(false);
  const [rewriteNote, setRewriteNote] = useState('');

  const load = () => admin2.stories()
    .then((data) => {
      setOverview(data);
      setSeriesId((current) => current ?? data.series[0]?.id ?? null);
    })
    .catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);

  const series = overview?.series.find((item) => item.id === seriesId) ?? null;
  const episode = series?.episodes.find((item) => item.number === selected) ?? null;
  useEffect(() => {
    setDraft(episode ? { title: episode.title, body: episode.body, hook: episode.hook } : null);
  }, [episode?.seriesId, episode?.number, episode?.updatedAt]);

  const lastNumber = useMemo(() => Math.max(0, ...(series?.episodes.map((item) => item.number) ?? [0])), [series]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setNotice(message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!overview) return <div className={card}>{error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-slate-400">Загрузка…</p>}</div>;

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="mb-1 text-base font-bold text-slate-800">Рассказы-сериалы</p>
        <p className="mb-3 text-sm text-slate-500">
          Каждый день выходит новая серия. Запас готовится на {overview.bufferDays} дней вперёд. Серии без замечаний выходят сами;
          с замечаниями проверки связности, ждут, пока вы их одобрите. Отредактированная серия помечается «проверено человеком».
        </p>
        {!overview.generationEnabled ? <p className="mb-3 text-sm text-amber-700">Генерация на этом сервере выключена (это хост relay или нет ключа OpenAI).</p> : null}
        <div className="flex flex-wrap gap-2">
          {overview.series.map((item) => {
            const waiting = item.episodes.filter((ep) => ep.status === 'needs_review').length;
            return (
              <button key={item.id} type="button" className={item.id === seriesId && !creating ? btnPrimary : btnGhost} onClick={() => { setSeriesId(item.id); setSelected(null); setCreating(false); }}>
                {item.title}{!item.enabled ? ' · пауза' : ''}{waiting ? ` · ждут: ${waiting}` : ''}
              </button>
            );
          })}
          {canEdit ? (
            <>
              <button type="button" className={creating ? btnPrimary : btnGhost} onClick={() => { setCreating(true); setSelected(null); }}>
                + Новый сериал
              </button>
              <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => admin2.generateStories(seriesId ?? undefined), 'Запас серий пополняется, обновите через пару минут')}>
                Пополнить запас
              </button>
            </>
          ) : null}
        </div>
        {notice ? <p className="mt-2 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      {creating ? (
        <div className={card}>
          <p className="mb-3 text-base font-bold text-slate-800">Новый сериал</p>
          <StorySeriesEditor
            initial={EMPTY_SERIES}
            enabled
            isNew
            builtIn={false}
            edited={false}
            busy={busy}
            canEdit={canEdit}
            onSave={(bible, on) => run(async () => {
              await admin2.saveStorySeries(bible, on);
              setCreating(false);
              setSeriesId(bible.id);
            }, 'Сериал создан, первые серии напишутся при «Пополнить запас» или ночью')}
          />
        </div>
      ) : null}

      {series && !creating ? (
        <div className={card}>
          <div className="mb-3 flex flex-wrap gap-2">
            {([['episodes', 'Серии'], ['bible', 'Сценарий'], ['plan', 'Сюжет следующих серий']] as const).map(([value, label]) => (
              <button key={value} type="button" className={view === value ? btnPrimary : btnGhost} onClick={() => setView(value)}>{label}</button>
            ))}
          </div>
          {view === 'bible' ? (
            <StorySeriesEditor
              initial={bibleOf(series)}
              enabled={series.enabled}
              isNew={false}
              builtIn={series.builtIn}
              edited={series.edited}
              busy={busy}
              canEdit={canEdit}
              onSave={(bible, on) => run(() => admin2.saveStorySeries(bible, on), 'Сценарий сохранён, новые серии пишутся по нему')}
              onReset={() => run(() => admin2.resetStorySeries(series.id), 'Вернули исходный сценарий')}
            />
          ) : null}
          {view === 'plan' ? (
            <StoryPlanner
              seriesId={series.id}
              lastNumber={lastNumber}
              plans={series.plans}
              canEdit={canEdit}
              generationEnabled={overview.generationEnabled}
              onChanged={load}
            />
          ) : null}
          {view === 'episodes' ? (
          <>
          <p className="mb-2 text-sm font-semibold text-slate-700">{series.title}: {series.episodes.length} серий, сегодня {overview.today}</p>
          {series.episodes.length === 0 ? <p className="text-sm text-slate-500">Серий ещё нет, нажмите «Пополнить запас».</p> : null}
          <div className="divide-y divide-slate-100">
            {series.episodes.map((item) => (
              <button
                key={item.number}
                type="button"
                className={`flex w-full items-center justify-between gap-3 py-2 text-left text-sm ${item.number === selected ? 'bg-slate-50' : ''}`}
                onClick={() => setSelected(item.number === selected ? null : item.number)}
              >
                <span>
                  <b>№ {item.number}</b> · {item.title}
                  <span className="ml-2 text-slate-400">{item.releaseDate}{item.released ? ' · вышла' : ''}</span>
                </span>
                <span className={item.status === 'needs_review' ? 'text-amber-700' : item.status === 'hold' ? 'text-red-600' : 'text-slate-500'}>
                  {STATUS[item.status]}{item.reviewedByHuman ? ' · проверено человеком' : ''}
                </span>
              </button>
            ))}
          </div>
          </>
          ) : null}
        </div>
      ) : null}

      {view === 'episodes' && !creating && episode && draft ? (
        <div className={card}>
          <p className="mb-2 text-base font-bold text-slate-800">Серия № {episode.number}, {STATUS[episode.status]}</p>
          {episode.issues.length ? (
            <ul className="mb-3 list-disc pl-5 text-sm text-amber-700">
              {episode.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          ) : null}
          <p className="mb-2 text-xs text-slate-500">Кратко: {episode.summary}</p>
          {episode.facts.length ? <p className="mb-3 text-xs text-slate-500">Факты дальше: {episode.facts.join(' · ')}</p> : null}
          <label className="mb-2 block text-sm">
            Название
            <input className={inputCls} value={draft.title} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="mb-2 block text-sm">
            Текст ({wordCount(draft.body)} слов)
            <textarea className={inputCls} rows={18} value={draft.body} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            Крючок в конце
            <textarea className={inputCls} rows={3} value={draft.hook} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => admin2.updateStoryEpisode({ seriesId: episode.seriesId, number: episode.number, ...draft, action: 'save' }), 'Сохранено')}>
                Сохранить правки
              </button>
            ) : null}
            {canPublish ? (
              <>
                <button type="button" className={btnPrimary} disabled={busy} onClick={() => run(() => admin2.updateStoryEpisode({ seriesId: episode.seriesId, number: episode.number, ...draft, action: 'approve' }), 'Серия проверена и выйдет в свой день')}>
                  Проверено, выпустить
                </button>
                <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => admin2.updateStoryEpisode({ seriesId: episode.seriesId, number: episode.number, action: 'hold' }), 'Серия остановлена, следующие тоже подождут')}>
                  Остановить
                </button>
              </>
            ) : null}
            {canEdit && episode.number === lastNumber && !episode.released ? (
              <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => admin2.rewriteStoryEpisode(episode.seriesId, episode.number, rewriteNote.trim() || undefined), 'Серия написана заново')}>
                Написать заново
              </button>
            ) : null}
          </div>
          {canEdit && episode.number === lastNumber && !episode.released ? (
            <label className="mt-3 block text-sm">
              Что изменить при переписывании (необязательно, станет планом этой серии)
              <textarea className={inputCls} rows={3} placeholder="Например: сделай финал неожиданнее, пусть Глеб появится раньше" value={rewriteNote} onChange={(e) => setRewriteNote(e.target.value)} />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
