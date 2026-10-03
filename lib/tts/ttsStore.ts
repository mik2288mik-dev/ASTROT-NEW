/**
 * Audio cache: every text is synthesized once per voice and style, then served
 * from the database. Personal audio expires with its reading; shared audio
 * (stories, sleep tales) is kept.
 */
import type { Pool } from 'pg';
import { getPool } from '../db';
import { TTS_AUDIO_SCHEMA_SQL } from './ttsSchema';
import { estimateSpeechSeconds, synthesizeSpeech, ttsCacheId, type TtsStyle } from './openaiSpeech';

let schemaReady: Promise<void> | null = null;
export function ensureTtsSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(TTS_AUDIO_SCHEMA_SQL).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

export type StoredAudio = { id: string; mime: string; bytes: Buffer; byteSize: number };
export type AudioTicket = { id: string; durationSec: number; cached: boolean };

const inflight = new Map<string, Promise<AudioTicket>>();
let lastCleanupAt = 0;

export async function readStoredAudio(id: string): Promise<StoredAudio | null> {
  const pool = getPool();
  await ensureTtsSchema(pool);
  const result = await pool.query(
    'SELECT id, mime, bytes, byte_size FROM tts_audio WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW())',
    [id],
  );
  const row = result.rows[0];
  return row ? { id: row.id, mime: row.mime, bytes: row.bytes as Buffer, byteSize: Number(row.byte_size) } : null;
}

async function storedTicket(pool: Pool, id: string): Promise<AudioTicket | null> {
  const result = await pool.query(
    'SELECT duration_sec FROM tts_audio WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW())',
    [id],
  );
  return result.rows[0] ? { id, durationSec: Number(result.rows[0].duration_sec) || 0, cached: true } : null;
}

function cleanupExpired(pool: Pool): void {
  if (Date.now() - lastCleanupAt < 3_600_000) return;
  lastCleanupAt = Date.now();
  void pool.query('DELETE FROM tts_audio WHERE expires_at IS NOT NULL AND expires_at < NOW()').catch(() => undefined);
}

/**
 * Returns the audio id for this text, synthesizing it only when it is not
 * stored yet. Parallel requests for the same text share one synthesis.
 */
export function ensureAudio(input: { text: string; voice: string; style: TtsStyle; ttlDays: number | null }): Promise<AudioTicket> {
  const id = ttsCacheId(input);
  const running = inflight.get(id);
  if (running) return running;
  const task = (async () => {
    const pool = getPool();
    await ensureTtsSchema(pool);
    const existing = await storedTicket(pool, id);
    if (existing) return existing;
    const bytes = await synthesizeSpeech(input);
    if (!bytes.length) throw new Error('TTS_EMPTY_AUDIO');
    const durationSec = estimateSpeechSeconds(input.text, input.style);
    await pool.query(
      `INSERT INTO tts_audio (id, voice, mime, bytes, byte_size, duration_sec, expires_at)
       VALUES ($1, $2, 'audio/mpeg', $3, $4, $5, CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() + ($6::int * INTERVAL '1 day') END)
       ON CONFLICT (id) DO NOTHING`,
      [id, input.voice, bytes, bytes.length, durationSec, input.ttlDays],
    );
    cleanupExpired(pool);
    return { id, durationSec, cached: false };
  })().finally(() => { inflight.delete(id); });
  inflight.set(id, task);
  return task;
}
