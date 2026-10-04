/**
 * Story series managed from Admin v2: the four built-in series are defaults,
 * every field can be overridden, new series can be added, any series can be
 * paused. Plans fix what happens in a given episode (chosen from AI variants
 * or written by hand) before the writer gets to it.
 */
import type { Pool } from 'pg';
import { getPool } from '../db';
import { createLunaStructuredResponse, type StrictJsonSchema } from '../openaiResponses';
import { TTS_VOICES, type TtsVoice } from '../tts/openaiSpeech';
import { STORY_SERIES, type StoryCharacter, type StorySeries } from './series';
import { ensureStorySchema } from './schema';
import type { PreviousEpisode } from './episodeWriter';

export type ManagedSeries = StorySeries & {
  /** Paused series are hidden from readers and get no new episodes. */
  enabled: boolean;
  /** Not one of the built-in four. */
  custom: boolean;
  /** Changed in the admin (built-in series only). */
  edited: boolean;
};

export type EpisodePlan = { number: number; direction: string; source: 'ai' | 'own'; createdAt: string };
export type EpisodeVariant = { title: string; synopsis: string };

const GENRES: StorySeries['genre'][] = ['detective', 'romance', 'scifi', 'comedy'];
const GENDERS: StoryCharacter['gender'][] = ['female', 'male', 'animal', 'machine'];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/;
const CACHE_MS = 60_000;

let cache: { at: number; list: ManagedSeries[] } | null = null;

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\r/g, '').trim().slice(0, max) : '');
const lines = (value: unknown, max: number, each: number) => (Array.isArray(value) ? value : [])
  .map((item) => text(item, each))
  .filter(Boolean)
  .slice(0, max);

/** Validates a series coming from the admin; returns null when required parts are missing. */
export function sanitizeSeries(raw: unknown): StorySeries | null {
  const value = (raw ?? {}) as Record<string, unknown>;
  const id = text(value.id, 41).toLowerCase();
  const genre = GENRES.includes(value.genre as StorySeries['genre']) ? value.genre as StorySeries['genre'] : null;
  const narrator = (TTS_VOICES as readonly string[]).includes(String(value.narrator)) ? value.narrator as TtsVoice : 'coral';
  const characters = (Array.isArray(value.characters) ? value.characters : [])
    .map((item) => {
      const character = (item ?? {}) as Record<string, unknown>;
      const name = text(character.name, 80);
      if (!name) return null;
      return {
        name,
        aliases: lines(character.aliases, 6, 40),
        role: text(character.role, 600),
        gender: GENDERS.includes(character.gender as StoryCharacter['gender']) ? character.gender as StoryCharacter['gender'] : 'female',
      } satisfies StoryCharacter;
    })
    .filter((item): item is StoryCharacter => item !== null)
    .slice(0, 12);
  const arcs = (Array.isArray(value.arcs) ? value.arcs : [])
    .map((item) => {
      const arc = (item ?? {}) as Record<string, unknown>;
      const name = text(arc.name, 80);
      const beats = lines(arc.beats, 30, 300);
      return name && beats.length ? { name, beats } : null;
    })
    .filter((item): item is { name: string; beats: string[] } => item !== null)
    .slice(0, 8);
  const series: StorySeries = {
    id,
    genre: genre ?? 'detective',
    title: text(value.title, 80),
    tagline: text(value.tagline, 240),
    narrator,
    world: text(value.world, 2_000),
    characters,
    arcs,
    rules: lines(value.rules, 15, 300),
    style: text(value.style, 1_200) || undefined,
  };
  if (!ID_PATTERN.test(series.id) || !genre || !series.title || !series.world || !series.characters.length || !series.arcs.length) return null;
  return series;
}

export function invalidateSeriesCache(): void {
  cache = null;
}

/** Built-in series with their admin overrides, plus series created in the admin. */
export async function loadStorySeries(options: { includeDisabled?: boolean; pool?: Pool } = {}): Promise<ManagedSeries[]> {
  const pool = options.pool ?? getPool();
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    await ensureStorySchema(pool);
    const rows = (await pool.query('SELECT series_id, data, enabled, sort_order FROM story_series_config ORDER BY sort_order, series_id')).rows;
    const byId = new Map<string, Record<string, any>>(rows.map((row) => [row.series_id, row]));
    const list: ManagedSeries[] = STORY_SERIES.map((base) => {
      const row = byId.get(base.id);
      const override = row ? sanitizeSeries({ ...base, ...row.data, id: base.id }) : null;
      return { ...(override ?? base), enabled: row ? row.enabled !== false : true, custom: false, edited: Boolean(override) };
    });
    for (const row of rows) {
      if (STORY_SERIES.some((base) => base.id === row.series_id)) continue;
      const series = sanitizeSeries({ ...row.data, id: row.series_id });
      if (series) list.push({ ...series, enabled: row.enabled !== false, custom: true, edited: true });
    }
    cache = { at: Date.now(), list };
  }
  return options.includeDisabled ? cache.list : cache.list.filter((series) => series.enabled);
}

export async function findManagedSeries(id: string, options: { includeDisabled?: boolean } = {}): Promise<ManagedSeries | null> {
  return (await loadStorySeries(options)).find((series) => series.id === id) ?? null;
}

export async function saveStorySeries(series: StorySeries, enabled: boolean, by: string, pool: Pool = getPool()): Promise<void> {
  await ensureStorySchema(pool);
  const { id, ...data } = series;
  await pool.query(
    `INSERT INTO story_series_config (series_id, data, enabled, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, NOW())
     ON CONFLICT (series_id) DO UPDATE SET data = EXCLUDED.data, enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [id, JSON.stringify(data), enabled, by],
  );
  invalidateSeriesCache();
}

/** Back to the built-in text (built-in series only). */
export async function resetStorySeries(id: string, pool: Pool = getPool()): Promise<void> {
  await ensureStorySchema(pool);
  await pool.query('DELETE FROM story_series_config WHERE series_id = $1', [id]);
  invalidateSeriesCache();
}

export async function readPlans(seriesId: string, pool: Pool = getPool()): Promise<EpisodePlan[]> {
  await ensureStorySchema(pool);
  const result = await pool.query('SELECT number, direction, source, created_at FROM story_episode_plans WHERE series_id = $1 ORDER BY number', [seriesId]);
  return result.rows.map((row) => ({
    number: Number(row.number),
    direction: row.direction,
    source: row.source === 'ai' ? 'ai' : 'own',
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function savePlan(input: { seriesId: string; number: number; direction: string; source: 'ai' | 'own'; by: string }, pool: Pool = getPool()): Promise<void> {
  await ensureStorySchema(pool);
  await pool.query(
    `INSERT INTO story_episode_plans (series_id, number, direction, source, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (series_id, number) DO UPDATE SET direction = EXCLUDED.direction, source = EXCLUDED.source, created_by = EXCLUDED.created_by, created_at = NOW()`,
    [input.seriesId, input.number, input.direction.slice(0, 2_000), input.source, input.by],
  );
}

export async function deletePlan(seriesId: string, number: number, pool: Pool = getPool()): Promise<void> {
  await ensureStorySchema(pool);
  await pool.query('DELETE FROM story_episode_plans WHERE series_id = $1 AND number = $2', [seriesId, number]);
}

const VARIANTS_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, synopsis: { type: 'string' } },
        required: ['title', 'synopsis'],
        additionalProperties: false,
      },
    },
  },
  required: ['variants'],
  additionalProperties: false,
};

/** Three different plots for one episode, from the bible and what already happened. */
export async function proposeEpisodeVariants(
  series: StorySeries,
  number: number,
  previous: readonly PreviousEpisode[],
  hint: string,
): Promise<EpisodeVariant[]> {
  const recent = previous.slice(-10);
  const result = await createLunaStructuredResponse({
    instructions: [
      'Ты сценарист ежедневного сериала для приложения NEBO. Предложи три РАЗНЫХ варианта сюжета для одной серии.',
      'Каждый вариант: короткое название (2–6 слов) и синопсис на 3–5 предложений — что происходит, чем серия заканчивается и какой крючок остаётся на завтра.',
      'Варианты должны продолжать уже случившееся, не противоречить фактам и героям и отличаться по настроению: один спокойный, один с поворотом, один неожиданный.',
      'Без эзотерики, жестокости, мата и реальных брендов. Ответ строго в JSON по схеме.',
    ].join('\n'),
    input: [
      `СЕРИАЛ: «${series.title}» (${series.genre}). ${series.tagline}.`,
      `МИР: ${series.world}`,
      'ГЕРОИ:',
      ...series.characters.map((character) => `- ${character.name}: ${character.role}`),
      'ЛИНИИ:',
      ...series.arcs.map((arc) => `- ${arc.name}: ${arc.beats.join('; ')}`),
      series.rules.length ? `ПРАВИЛА: ${series.rules.join('; ')}` : '',
      series.style ? `СТИЛЬ: ${series.style}` : '',
      `НУЖНА СЕРИЯ № ${number}.`,
      recent.length ? 'ЧТО УЖЕ БЫЛО:' : 'Это первая серия.',
      ...recent.map((episode) => `- Серия ${episode.number} «${episode.title}»: ${episode.summary}`),
      hint ? `ПОЖЕЛАНИЕ АВТОРА: ${hint}` : '',
    ].filter(Boolean).join('\n'),
    maxOutputTokens: 2_500,
    schemaName: 'story_variants',
    schema: VARIANTS_SCHEMA,
    store: false,
    reasoningEffort: 'low',
  });
  const parsed = JSON.parse(result.content) as { variants?: Array<{ title?: unknown; synopsis?: unknown }> };
  return (parsed.variants ?? [])
    .map((item) => ({ title: text(item.title, 80), synopsis: text(item.synopsis, 1_200) }))
    .filter((item) => item.title && item.synopsis)
    .slice(0, 3);
}
