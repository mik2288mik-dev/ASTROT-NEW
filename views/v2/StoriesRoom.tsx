import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronRight, Gift, LoaderCircle, Lock } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { AssetSlot } from '../../components/lumia-ui/AssetSlot';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { STORY_GENRE_LABELS } from '../../lib/stories/series';
import { FREE_STORY_EPISODES, isFreeStorySeries } from '../../lib/stories/access';
import { loadEpisode, loadStories, type StoriesOverview, type StoryEpisode, type StorySeriesSummary } from '../../services/storiesService';
import { loadFeatureState, peekFeatureState, saveFeatureState } from '../../services/featureStateService';
import { noteNativeStoryRead } from '../../services/nativeNotifications';
import { VideoBackground } from '../../components/lumia-ui/VideoBackground';
import type { VideoBackgroundId } from '../../lib/videoBackgrounds';

export const STORY_COVERS: Record<string, string> = {
  'quiet-lane': '/assets/stories/quiet-lane.webp',
  'stair-neighbours': '/assets/stories/stair-neighbours.webp',
  'polyn-station': '/assets/stories/polyn-station.webp',
  'family-chat': '/assets/stories/family-chat.webp',
};

const STORY_VIDEOS: Record<string, VideoBackgroundId> = {
  'quiet-lane': 'story-quiet-lane',
  'stair-neighbours': 'story-stair-neighbours',
  'polyn-station': 'story-polyn-station',
  'family-chat': 'story-family-chat',
};

type Screen = { kind: 'list' } | { kind: 'series'; seriesId: string } | { kind: 'read'; seriesId: string; number: number };
type ReadMark = { number: number; at: string };

function readingMinutes(text: string): number {
  return Math.max(1, Math.round((text.match(/\S+/gu) ?? []).length / 180));
}

type StoriesRoomProps = { profile: UserProfile; onBack: () => void; onRequestPremium?: () => void };

/** «Рассказы»: four daily series — read in a magazine layout or listen. */
export function StoriesRoom({ profile, onBack, onRequestPremium }: StoriesRoomProps) {
  const ru = profile.language !== 'en';
  const userId = String(profile.id || 'guest');
  const [overview, setOverview] = useState<StoriesOverview | null>(null);
  const [error, setError] = useState(false);
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const [episode, setEpisode] = useState<StoryEpisode | null>(null);
  const [episodeState, setEpisodeState] = useState<'loading' | 'locked' | 'unlock' | 'error' | null>(null);
  const [marks, setMarks] = useState<Record<string, unknown>>(() => peekFeatureState(userId, 'stories'));

  const refresh = useCallback(() => {
    setError(false);
    void loadStories().then(setOverview).catch(() => setError(true));
  }, []);

  useEffect(() => {
    refresh();
    void loadFeatureState(userId, 'stories').then(setMarks);
  }, [refresh, userId]);

  useEffect(() => {
    document.querySelector('.stories-room')?.closest('.lumia-main-scroll')?.scrollTo({ top: 0 });
  }, [screen]);

  const lastRead = (seriesId: string) => (marks[`read:${seriesId}`] as ReadMark | undefined)?.number ?? 0;

  const open = useCallback(async (seriesId: string, number: number, unlock = false) => {
    lumiaSelectionHaptic();
    setScreen({ kind: 'read', seriesId, number });
    setEpisode(null);
    setEpisodeState('loading');
    try {
      const loaded = await loadEpisode(seriesId, number, unlock);
      setEpisode(loaded);
      setEpisodeState(null);
      const mark: ReadMark = { number: Math.max(number, (marks[`read:${seriesId}`] as ReadMark | undefined)?.number ?? 0), at: new Date().toISOString() };
      setMarks((current) => ({ ...current, [`read:${seriesId}`]: mark }));
      void saveFeatureState(userId, 'stories', `read:${seriesId}`, mark);
      noteNativeStoryRead(userId);
      if (unlock) refresh();
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      setEpisodeState(code === 'EPISODE_FREE_UNLOCK_AVAILABLE' ? 'unlock' : code === 'EPISODE_LOCKED' ? 'locked' : 'error');
    }
  }, [marks, refresh, userId]);

  const seriesOf = (id: string): StorySeriesSummary | null => overview?.series.find((item) => item.id === id) ?? null;

  if (screen.kind === 'read') {
    const series = seriesOf(screen.seriesId);
    return (
      <div className="fresh-page stories-room stories-room--read">
        <AppTopBar title={series?.title ?? (ru ? 'Рассказы' : 'Stories')} onBack={() => setScreen({ kind: 'series', seriesId: screen.seriesId })} />
        {episodeState === 'loading' ? <p className="stories-status" role="status"><LoaderCircle className="audio-mini-player-spinner" size={18} aria-hidden="true" />{ru ? 'Открываем серию…' : 'Opening the episode…'}</p> : null}
        {episodeState === 'error' ? (
          <div className="stories-status">
            <p>{ru ? 'Серия не загрузилась. Проверь соединение.' : 'The episode did not load. Check the connection.'}</p>
            <button type="button" className="stories-primary" onClick={() => { void open(screen.seriesId, screen.number); }}>{ru ? 'Повторить' : 'Retry'}</button>
          </div>
        ) : null}
        {episodeState === 'unlock' ? (
          <div className="stories-gate">
            <Gift size={22} aria-hidden="true" />
            <h2>{ru ? 'Серия дня, бесплатно' : 'Today’s free episode'}</h2>
            <p>{ru ? 'Одну серию этого сериала в день можно открыть бесплатно. С NEBO Premium, все серии сразу.' : 'One episode of this series a day opens for free. With NEBO Premium, every episode at once.'}</p>
            <button type="button" className="stories-primary" onClick={() => { void open(screen.seriesId, screen.number, true); }}>{ru ? 'Открыть бесплатно' : 'Open for free'}</button>
            {onRequestPremium ? <button type="button" className="stories-secondary" onClick={onRequestPremium}>{ru ? 'Все серии в NEBO Premium' : 'All episodes in NEBO Premium'}</button> : null}
          </div>
        ) : null}
        {episodeState === 'locked' ? (
          <div className="stories-gate">
            <Lock size={22} aria-hidden="true" />
            <h2>{!isFreeStorySeries(screen.seriesId)
              ? (ru ? 'Этот сериал в NEBO Premium' : 'This series is in NEBO Premium')
              : (ru ? 'Сегодняшняя бесплатная серия уже открыта' : 'Today’s free episode is already open')}</h2>
            <p>{!isFreeStorySeries(screen.seriesId)
              ? (ru ? 'Бесплатно открыт «Тихий переулок». С NEBO Premium все сериалы, все серии сразу, новый рассказ каждый месяц.' : 'The Quiet Lane is free. With NEBO Premium: every series, every episode at once, a new story each month.')
              : (ru ? 'Завтра откроется следующая. Или читай все серии сразу с NEBO Premium.' : 'The next one opens tomorrow. Or read them all with NEBO Premium.')}</p>
            {onRequestPremium ? <button type="button" className="stories-primary" onClick={onRequestPremium}>{ru ? 'Открыть все в NEBO Premium' : 'Open all in NEBO Premium'}</button> : null}
          </div>
        ) : null}
        {episode ? (
          <article className={`stories-reader is-${series?.genre ?? 'detective'}`} lang={ru ? 'ru' : 'en'}>
            <p className="stories-kicker">{ru ? `Серия ${episode.number}` : `Episode ${episode.number}`} · {readingMinutes(episode.text)} {ru ? 'мин чтения' : 'min read'}</p>
            <h1 className="stories-title">{episode.title}</h1>
            <div className="stories-body">
              {episode.text.split(/\n{2,}/u).map((paragraph, index, all) => (
                <p key={index} className={index === all.length - 1 ? 'is-hook' : index === 0 ? 'is-first' : undefined}>{paragraph}</p>
              ))}
            </div>
            <footer className="stories-next">
              {episode.next ? (
                <button type="button" className="stories-primary" onClick={() => { void open(episode.seriesId, episode.next!); }}>
                  {ru ? `Читать серию ${episode.next}` : `Read episode ${episode.next}`}
                </button>
              ) : (
                <p>{episode.nextReleaseTomorrow ? (ru ? 'Следующая серия выйдет завтра.' : 'The next episode comes out tomorrow.') : (ru ? 'Новая серия выходит каждый день.' : 'A new episode comes out every day.')}</p>
              )}
            </footer>
          </article>
        ) : null}
      </div>
    );
  }

  if (screen.kind === 'series') {
    const series = seriesOf(screen.seriesId);
    if (!series) return null;
    const read = lastRead(series.id);
    const continueNumber = series.episodes.find((item) => item.number === read + 1)?.number ?? null;
    return (
      <div className="fresh-page stories-room">
        <AppTopBar title={series.title} onBack={() => setScreen({ kind: 'list' })} />
        <section className={`stories-series-head${STORY_VIDEOS[series.id] ? ' video-hero' : ''}`}>
          {STORY_VIDEOS[series.id] ? <VideoBackground id={STORY_VIDEOS[series.id]} /> : null}
          <AssetSlot src={STORY_COVERS[series.id]} className="stories-cover" />
          <p className="stories-kicker">{STORY_GENRE_LABELS[series.genre][ru ? 'ru' : 'en']}</p>
          <h1 className="stories-title">{series.title}</h1>
          <p className="stories-tagline">{series.tagline}</p>
          {continueNumber ? (
            <button type="button" className="stories-primary" onClick={() => { void open(series.id, continueNumber); }}>
              {read ? (ru ? `Продолжить с серии ${continueNumber}` : `Continue with episode ${continueNumber}`) : (ru ? 'Начать с первой серии' : 'Start from episode 1')}
            </button>
          ) : null}
        </section>
        {series.episodes.length ? (
          <ol className="stories-episodes">
            {[...series.episodes].reverse().map((item) => (
              <li key={item.number}>
                <button type="button" onClick={() => { void open(series.id, item.number); }}>
                  <span className="stories-episode-number">{item.number}</span>
                  <span className="stories-episode-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {item.releaseDate === overview?.today ? (ru ? 'вышла сегодня' : 'out today') : new Date(`${item.releaseDate}T12:00:00Z`).toLocaleDateString(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                      {item.number <= read ? (ru ? ' · прочитано' : ' · read') : ''}
                      {item.number <= FREE_STORY_EPISODES && !overview?.premium ? (ru ? ' · бесплатно' : ' · free') : ''}
                    </small>
                  </span>
                  {item.access === 'open' ? <BookOpen size={17} aria-hidden="true" /> : item.access === 'free_unlock_available' ? <Gift size={17} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ol>
        ) : <p className="stories-status">{ru ? 'Первая серия уже готовится, загляни чуть позже.' : 'The first episode is being prepared, come back a bit later.'}</p>}
      </div>
    );
  }

  return (
    <div className="fresh-page stories-room">
      <AppTopBar title={ru ? 'Рассказы' : 'Stories'} onBack={onBack} />
      <section className="stories-intro video-hero">
        <VideoBackground id="stories-catalog" />
        <h1>{ru ? 'Сериалы на каждый день' : 'A series for every day'}</h1>
        <p>{ru
          ? `Тихий переулок открыт всем: ${FREE_STORY_EPISODES} серии сразу, дальше по серии в день. Остальные сериалы и все серии сразу с NEBO Premium. Каждый месяц добавляем новый рассказ.`
          : `The Quiet Lane is free for everyone: ${FREE_STORY_EPISODES} episodes at once, then one a day. The other series, every episode at once come with NEBO Premium. A new story is added every month.`}</p>
      </section>
      {error ? (
        <div className="stories-status">
          <p>{ru ? 'Не получилось загрузить сериалы.' : 'Could not load the series.'}</p>
          <button type="button" className="stories-primary" onClick={refresh}>{ru ? 'Повторить' : 'Retry'}</button>
        </div>
      ) : !overview ? (
        <p className="stories-status" role="status"><LoaderCircle className="audio-mini-player-spinner" size={18} aria-hidden="true" />{ru ? 'Загружаем…' : 'Loading…'}</p>
      ) : (
        <div className="stories-list">
          {overview.series.map((series) => {
            const latest = series.episodes[series.episodes.length - 1];
            const read = lastRead(series.id);
            const unread = series.episodes.filter((item) => item.number > read).length;
            return (
              <button key={series.id} type="button" className={`stories-card is-${series.genre}`} onClick={() => setScreen({ kind: 'series', seriesId: series.id })}>
                <AssetSlot src={STORY_COVERS[series.id]} className="stories-card-cover" />
                <span className="stories-card-copy">
                  <small>{STORY_GENRE_LABELS[series.genre][ru ? 'ru' : 'en']}</small>
                  <strong>{series.title}</strong>
                  <span>{series.tagline}</span>
                  <em>
                    {!overview.premium && !isFreeStorySeries(series.id)
                      ? (ru ? 'Сериал в NEBO Premium' : 'A NEBO Premium series')
                      : latest
                      ? (latest.releaseDate === overview.today ? (ru ? `Новая серия ${latest.number} вышла сегодня` : `New episode ${latest.number} today`) : (ru ? `${series.episodes.length} серий` : `${series.episodes.length} episodes`))
                      : (ru ? 'Скоро первая серия' : 'First episode soon')}
                    {read && unread ? (ru ? ` · непрочитано: ${unread}` : ` · unread: ${unread}`) : ''}
                  </em>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            );
          })}
          <div className="stories-soon">
            <strong>{ru ? 'Скоро новый рассказ' : 'A new story is coming'}</strong>
            <span>{ru ? 'Каждый месяц в NEBO появляется новая история. Следующая уже в работе.' : 'A new story arrives in NEBO every month. The next one is on its way.'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
