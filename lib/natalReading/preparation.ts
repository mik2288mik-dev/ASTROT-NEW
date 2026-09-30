import { getPool } from '../db';
import type { PoolClient } from 'pg';
import { resolveDatabaseUrl } from '../database-url';
import { isCanonicalNatalChartDataComplete } from '../natalChartCanonical';
import { resolveReadingContext, type ReadingContext } from './apiHelper';
import { generateNatalUnifiedReadingWithLock, natalUnifiedReadingInputHash } from './unifiedApi';
import type { NatalWriterProgress } from './unifiedGeneration';
import { NATAL_READING_JOBS_SCHEMA } from './jobSchema';

const WORKER_LOCK = 'natal-reading-preparation-v1';
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
    `INSERT INTO natal_reading_jobs(user_id,chart_id,input_hash,language,priority)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(chart_id,input_hash,language)
     DO UPDATE SET priority=GREATEST(natal_reading_jobs.priority,EXCLUDED.priority),
       status='pending',attempts=CASE WHEN natal_reading_jobs.status='obsolete' THEN 0 ELSE natal_reading_jobs.attempts END
     WHERE natal_reading_jobs.status IN ('pending','obsolete')`,
    [chart.user_id, chart.id, natalUnifiedReadingInputHash(ctx), language, priority],
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
    [ctx.chartId, natalUnifiedReadingInputHash(ctx), ctx.profile.language === 'en' ? 'en' : 'ru'],
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
      if (natalUnifiedReadingInputHash(ctx) !== job.input_hash) {
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
