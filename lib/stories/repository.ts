/**
 * Story episodes in the database: generation of the buffer ahead, reading,
 * free unlocks and moderation edits.
 */
import type { Pool } from 'pg';
import { getPool } from '../db';
import { createLunaStructuredResponse, OPENAI_LUNA_MODEL } from '../openaiResponses';
import { ensureStorySchema } from './schema';
import type { StorySeries } from './series';
import { findManagedSeries, loadStorySeries, readPlans } from './catalog';
import {
  buildEpisodePrompt,
  checkEpisodeConsistency,
  EPISODE_SCHEMA,
  parseWrittenEpisode,
  type PreviousEpisode,
  type WrittenEpisode,
} from './episodeWriter';
import { releasedEpisodeNumbers, type EpisodeRow } from './access';

/** Days of episodes kept ready, today included, so a failed day never leaves a gap. */
export const STORY_BUFFER_DAYS = 10;

export { ensureStorySchema };

export function moscowDayKey(date = new Date()): string {
  return new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

function addDays(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type StoredEpisode = EpisodeRow & {
  seriesId: string;
  title: string;
  body: string;
  summary: string;
  facts: string[];
  hook: string;
  issues: string[];
  reviewedByHuman: boolean;
  reviewedAt: string | null;
  updatedAt: string;
};

function toEpisode(row: Record<string, any>): StoredEpisode {
  const date = row.release_date instanceof Date ? row.release_date.toISOString().slice(0, 10) : String(row.release_date).slice(0, 10);
  return {
    seriesId: row.series_id,
    number: Number(row.number),
    releaseDate: date,
    title: row.title,
    body: row.body,
    summary: row.summary,
    facts: Array.isArray(row.facts) ? row.facts : [],
    hook: row.hook || '',
    status: row.status,
    issues: Array.isArray(row.issues) ? row.issues : [],
    reviewedByHuman: Boolean(row.reviewed_by_human),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    updatedAt: new Date(row.updated_at || Date.now()).toISOString(),
  };
}

export async function listEpisodes(seriesId: string, pool: Pool = getPool()): Promise<StoredEpisode[]> {
  await ensureStorySchema(pool);
  const result = await pool.query('SELECT * FROM story_episodes WHERE series_id = $1 ORDER BY number', [seriesId]);
  return result.rows.map(toEpisode);
}

type Writer = (series: StorySeries, number: number, previous: PreviousEpisode[], direction?: string | null) => Promise<WrittenEpisode | null>;

/** Writes the next episode with the project's cheap model. */
export const writeEpisodeWithAi: Writer = async (series, number, previous, direction) => {
  const prompt = buildEpisodePrompt(series, number, previous, direction);
  const result = await createLunaStructuredResponse({
    ...prompt,
    maxOutputTokens: 6_000,
    schemaName: 'story_episode',
    schema: EPISODE_SCHEMA,
    store: false,
    reasoningEffort: 'low',
  });
  return parseWrittenEpisode(result.content);
};

const running = new Map<string, Promise<number>>();

/**
 * Fills the buffer of one series up to STORY_BUFFER_DAYS ahead, one episode at
 * a time (each relies on the previous ones). Returns how many were written.
 */
export function ensureEpisodeBuffer(seriesId: string, options: { today?: string; maxNew?: number; writer?: Writer } = {}): Promise<number> {
  const existing = running.get(seriesId);
  if (existing) return existing;
  const task = (async () => {
    const series = await findManagedSeries(seriesId);
    if (!series) return 0; // unknown or paused in the admin
    const pool = getPool();
    const episodes = await listEpisodes(seriesId, pool);
    const plans = new Map((await readPlans(seriesId, pool)).map((plan) => [plan.number, plan.direction]));
    const today = options.today ?? moscowDayKey();
    const writer = options.writer ?? writeEpisodeWithAi;
    let written = 0;
    let last = episodes[episodes.length - 1];
    const previous: PreviousEpisode[] = episodes.map((episode) => ({ number: episode.number, title: episode.title, summary: episode.summary, facts: episode.facts }));
    while (written < (options.maxNew ?? STORY_BUFFER_DAYS)) {
      const releaseDate = last ? addDays(last.releaseDate < today ? addDays(today, -1) : last.releaseDate, 1) : today;
      if (releaseDate > addDays(today, STORY_BUFFER_DAYS - 1)) break;
      const number = (last?.number ?? 0) + 1;
      const episode = await writer(series, number, previous, plans.get(number) ?? null);
      if (!episode) break;
      const issues = checkEpisodeConsistency(series, episode, previous);
      const status = issues.length ? 'needs_review' : 'ready';
      await pool.query(
        `INSERT INTO story_episodes (series_id, number, release_date, title, body, summary, facts, hook, status, issues, model)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11) ON CONFLICT (series_id, number) DO NOTHING`,
        [seriesId, number, releaseDate, episode.title, episode.text, episode.summary, JSON.stringify(episode.facts), episode.hook, status, JSON.stringify(issues), OPENAI_LUNA_MODEL],
      );
      previous.push({ number, title: episode.title, summary: episode.summary, facts: episode.facts });
      last = { seriesId, number, releaseDate, status, title: episode.title, body: episode.text, summary: episode.summary, facts: episode.facts, hook: episode.hook, issues, reviewedByHuman: false, reviewedAt: null, updatedAt: new Date().toISOString() };
      written += 1;
    }
    return written;
  })().finally(() => running.delete(seriesId));
  running.set(seriesId, task);
  return task;
}

/** Story generation runs on the main server only, never on the OpenAI relay host. */
export function storyGenerationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.STORY_GENERATION_ENABLED === '0') return false;
  if (env.STORY_GENERATION_ENABLED === '1') return true;
  return env.OPENAI_RELAY_DIRECT !== '1' && Boolean(String(env.OPENAI_API_KEY || '').trim());
}

export async function ensureAllStoryBuffers(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const series of await loadStorySeries()) {
    try {
      result[series.id] = await ensureEpisodeBuffer(series.id);
    } catch (error) {
      console.warn('[stories] buffer failed', series.id, error instanceof Error ? error.message : error);
      result[series.id] = -1;
    }
  }
  return result;
}

export async function releasedNumbers(seriesId: string, today = moscowDayKey()): Promise<number[]> {
  return releasedEpisodeNumbers(await listEpisodes(seriesId), today);
}

export async function readUnlocks(userId: string, pool: Pool = getPool()): Promise<Array<{ seriesId: string; number: number; unlockedOn: string }>> {
  await ensureStorySchema(pool);
  const result = await pool.query('SELECT series_id, number, unlocked_on FROM story_unlocks WHERE user_id = $1', [userId]);
  return result.rows.map((row: Record<string, any>) => ({
    seriesId: row.series_id,
    number: Number(row.number),
    unlockedOn: row.unlocked_on instanceof Date ? row.unlocked_on.toISOString().slice(0, 10) : String(row.unlocked_on).slice(0, 10),
  }));
}

/** Records a free unlock; the unique key and the day check keep it to one per series per day. */
export async function addFreeUnlock(userId: string, seriesId: string, number: number, today: string, pool: Pool = getPool()): Promise<boolean> {
  await ensureStorySchema(pool);
  const result = await pool.query(
    `INSERT INTO story_unlocks (user_id, series_id, number, unlocked_on)
     SELECT $1, $2, $3, $4::date
     WHERE NOT EXISTS (SELECT 1 FROM story_unlocks WHERE user_id = $1 AND series_id = $2 AND unlocked_on = $4::date)
     ON CONFLICT DO NOTHING`,
    [userId, seriesId, number, today],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateEpisode(input: {
  seriesId: string;
  number: number;
  title?: string;
  body?: string;
  hook?: string;
  action: 'save' | 'approve' | 'hold' | 'release';
  reviewer: string;
}, pool: Pool = getPool()): Promise<StoredEpisode | null> {
  await ensureStorySchema(pool);
  const status = input.action === 'approve' || input.action === 'release' ? 'approved' : input.action === 'hold' ? 'hold' : null;
  const result = await pool.query(
    `UPDATE story_episodes SET
       title = COALESCE($3, title), body = COALESCE($4, body), hook = COALESCE($5, hook),
       status = COALESCE($6, status), reviewed_by_human = TRUE, reviewed_by = $7, reviewed_at = NOW(), updated_at = NOW()
     WHERE series_id = $1 AND number = $2 RETURNING *`,
    [input.seriesId, input.number, input.title ?? null, input.body ?? null, input.hook ?? null, status, input.reviewer],
  );
  return result.rows[0] ? toEpisode(result.rows[0]) : null;
}

/** Only the last, not yet released episode can be rewritten: later ones rely on it. */
export async function deleteLastUnreleasedEpisode(seriesId: string, number: number, today = moscowDayKey(), pool: Pool = getPool()): Promise<boolean> {
  await ensureStorySchema(pool);
  const result = await pool.query(
    `DELETE FROM story_episodes WHERE series_id = $1 AND number = $2 AND release_date > $3::date
       AND number = (SELECT MAX(number) FROM story_episodes WHERE series_id = $1)`,
    [seriesId, number, today],
  );
  return (result.rowCount ?? 0) > 0;
}
