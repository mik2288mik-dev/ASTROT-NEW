import { getPool } from '../db';
import type { PoolClient } from 'pg';
import { resolveDatabaseUrl } from '../database-url';
import { isCanonicalNatalChartDataComplete } from '../natalChartCanonical';
import { resolveReadingContext, type ReadingContext } from './apiHelper';
import { generateNatalUnifiedReadingWithLock, natalUnifiedReadingInputHash } from './unifiedApi';
import { NATAL_MAX_BLOCK_REPAIRS, type NatalWriterProgress } from './unifiedGeneration';
import { NATAL_READING_JOBS_SCHEMA } from './jobSchema';
import { NATAL_COPY_REVISION, NATAL_PREVIOUS_COPY_REVISION } from './unifiedReading';

export function natalReadingPreparationInputHash(ctx: ReadingContext): string {
  return `${natalUnifiedReadingInputHash(ctx)}:${NATAL_COPY_REVISION}`;
}

const WORKER_LOCK = 'natal-reading-preparation-v1';
const REJECTED_DRAFT_RECOVERY = 'validated-draft-recovery-20260930';
let schema: Promise<void> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let processing = false;
let scanAfter = 0;

export async function ensureNatalReadingJobSchema(): Promise<void> {
  if (!schema) schema = getPool().query(NATAL_READING_JOBS_SCHEMA).then(() => undefined).catch((error) => {
    schema = undefined;
    throw error;
  });
  await schema;
}

/** Called only after a chart write, or by the autonomous reconciliation scan. */
export async function enqueueNatalReadingPreparation(chart: {
  id: number; user_id: string; chart_data: unknown;
}, language: 'ru' | 'en' = 'ru', priority = 10): Promise<void> {
  if (!isCanonicalNatalChartDataComplete(chart.chart_data)) return;
  await ensureNatalReadingJobSchema();
  const ctx = { chartData: chart.chart_data, profile: { id: String(chart.user_id), language } } as ReadingContext;
  await getPool().query(
    `INSERT INTO natal_reading_jobs(user_id,chart_id,input_hash,language,priority,progress)
     VALUES($1,$2,$3,$4,$5,COALESCE((
       SELECT progress-'reading' FROM natal_reading_jobs
       WHERE chart_id=$2 AND user_id=$1 AND input_hash=$6 AND language=$4
         AND jsonb_typeof(progress->'raw'->'story')='array'
       LIMIT 1
     ),'{}'::jsonb)) ON CONFLICT(chart_id,input_hash,language)
     DO UPDATE SET priority=GREATEST(natal_reading_jobs.priority,EXCLUDED.priority),
       status='pending',attempts=CASE WHEN natal_reading_jobs.status='obsolete' THEN 0 ELSE natal_reading_jobs.attempts END
     WHERE natal_reading_jobs.status IN ('pending','obsolete')`,
    [chart.user_id, chart.id, natalReadingPreparationInputHash(ctx), language, priority,
      `${natalUnifiedReadingInputHash(ctx)}:${NATAL_PREVIOUS_COPY_REVISION}`],
  );
  ensureNatalReadingPreparationWorker();
}

async function reconcileSavedCharts(): Promise<void> {
  // Missing readings from before this release are prepared independently of visits.
  const result = await getPool().query(
    `SELECT c.id,c.user_id,c.chart_data,u.language FROM natal_charts c
     JOIN users u ON u.id=c.user_id WHERE c.archived_at IS NULL AND c.id>$1
     ORDER BY c.id LIMIT 50`, [scanAfter],
  );
  for (const chart of result.rows) {
    await enqueueNatalReadingPreparation(chart, chart.language === 'en' ? 'en' : 'ru', 0);
    scanAfter = Number(chart.id);
  }
  if (result.rows.length < 50) scanAfter = 0;
}

export async function hasFailedNatalReadingPreparation(ctx: ReadingContext): Promise<boolean> {
  await ensureNatalReadingJobSchema();
  const result = await getPool().query(
    `SELECT status FROM natal_reading_jobs WHERE chart_id=$1 AND input_hash=$2 AND language=$3`,
    [ctx.chartId, natalReadingPreparationInputHash(ctx), ctx.profile.language === 'en' ? 'en' : 'ru'],
  );
  return result.rows[0]?.status === 'failed';
}

export async function processNatalReadingPreparations(): Promise<void> {
  if (processing) return;
  processing = true;
  let client: PoolClient | undefined;
  let acquired = false;
  try {
    await ensureNatalReadingJobSchema();
    client = await getPool().connect();
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired', [WORKER_LOCK]);
    acquired = lock.rows[0]?.acquired === true;
    if (!acquired) return;
    // One release-specific recovery for premature rejection or an unnecessary
    // continuation. Keep the draft and its budget; never reset a ready reading.
    await client.query(
      `UPDATE natal_reading_jobs SET status='pending',attempts=0,available_at=NOW(),updated_at=NOW(),
         progress=jsonb_set(progress,'{recoveryRevision}',to_jsonb($2::text))
       WHERE status='failed' AND input_hash LIKE $1
         AND jsonb_typeof(progress->'raw'->'story')='array'
         AND COALESCE((progress->>'repairs')::int,0)>0
         AND (COALESCE((progress->>'repairs')::int,0)<$3
              OR last_error LIKE '%paragraph adds no new observation%')
         AND COALESCE(progress->>'recoveryRevision','')<>$2`,
      [`%:${NATAL_COPY_REVISION}`, REJECTED_DRAFT_RECOVERY, NATAL_MAX_BLOCK_REPAIRS],
    );
    await reconcileSavedCharts();
    const pending = await client.query(
      `SELECT * FROM natal_reading_jobs WHERE status='pending' AND attempts<2
       AND available_at<=NOW() ORDER BY priority DESC,id LIMIT 1`,
    );
    const job = pending.rows[0];
    if (!job) return;
    try {
      const ctx = await resolveReadingContext(String(job.user_id), Number(job.chart_id));
      if (!ctx || !isCanonicalNatalChartDataComplete(ctx.chartData)) {
        await client.query("UPDATE natal_reading_jobs SET status='obsolete',updated_at=NOW() WHERE id=$1", [job.id]);
        return;
      }
      ctx.profile = { ...ctx.profile, language: job.language };
      if (natalReadingPreparationInputHash(ctx) !== job.input_hash) {
        await client.query("UPDATE natal_reading_jobs SET status='obsolete',updated_at=NOW() WHERE id=$1", [job.id]);
        return;
      }
      const generated = await generateNatalUnifiedReadingWithLock({
        userId: String(job.user_id), ctx, tier: 'premium',
        progress: job.progress as NatalWriterProgress | undefined,
        onProgress: async (progress) => {
          await client!.query('UPDATE natal_reading_jobs SET progress=$2,updated_at=NOW() WHERE id=$1',
            [job.id, JSON.stringify(progress)]);
        },
      });
      if (generated.status === 'ready') {
        await client.query("UPDATE natal_reading_jobs SET status='ready',last_error=NULL,updated_at=NOW() WHERE id=$1", [job.id]);
        console.info('[natal/preparation] ready', { chartId: job.chart_id, fromCache: generated.fromCache });
      }
    } catch (error) {
      const attempts = Number(job.attempts) + 1;
      const fatal = (error as { code?: string })?.code === 'NATAL_WRITER_REJECTED';
      await client.query(
        `UPDATE natal_reading_jobs SET attempts=$2,status=$3,last_error=$4,
         available_at=NOW()+INTERVAL '2 minutes',updated_at=NOW() WHERE id=$1`,
        [job.id, attempts, fatal || attempts >= 2 ? 'failed' : 'pending',
          error instanceof Error ? error.message : String(error)],
      );
      console.error('[natal/preparation] failed', { chartId: job.chart_id, attempts,
        error: error instanceof Error ? error.message : String(error) });
    }
  } finally {
    processing = false;
    if (client) {
      try { if (acquired) await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [WORKER_LOCK]); }
      finally { client.release(); }
    }
  }
}

export function ensureNatalReadingPreparationWorker(): void {
  if (timer || !resolveDatabaseUrl() || process.env.NODE_ENV !== 'production'
    || process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PUBLIC_MOBILE_BUILD === '1') return;
  const tick = () => { void processNatalReadingPreparations().catch((error) => {
    console.error('[natal/preparation] worker unavailable:', error instanceof Error ? error.message : error);
  }); };
  timer = setInterval(tick, 15_000);
  timer.unref?.();
  tick();
}
