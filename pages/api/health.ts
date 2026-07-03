import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveDatabaseUrl } from '../../lib/database-url';
import { getSwissEphemerisHealth } from '../../lib/swisseph-calculator';
import { getTodayPulseMetricsSnapshot } from '../../lib/todayPulse';
import { getProductionObservabilitySnapshot } from '../../lib/productionObservability';
import { ensureNotificationScheduler, getSchedulerStatus, isSchedulerAllowedByEnv } from '../../lib/notificationScheduler';

/**
 * Health check endpoint for Railway deployment monitoring
 * Returns status of app and database connectivity
 */
import { Pool } from 'pg';

const DATABASE_URL = resolveDatabaseUrl();

/**
 * Health check endpoint - checks database connectivity and migrations
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Страховка: гарантированно поднимаем in-process планировщик уведомлений. Railway дёргает этот
  // healthcheck каждые ~30с, поэтому даже если instrumentation.register() не выполнился в standalone,
  // первый же health-пинг запустит планировщик (идемпотентно). Не должно влиять на ответ health.
  try { ensureNotificationScheduler('health'); } catch { /* best-effort */ }

  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    swissEphemeris: getSwissEphemerisHealth(),
    calculationMetrics: {
      todayPulseSources: getTodayPulseMetricsSnapshot(),
    },
    observability: await getProductionObservabilitySnapshot(),
    // Операционный статус планировщика уведомлений (без PII) — чтобы «почему не приходят пуши»
    // было видно даже без админ-доступа. started=false при allowedByEnv=false ⇒ выключен окружением
    // (см. inProcessCronDisabled / реальный NODE_ENV).
    scheduler: {
      started: getSchedulerStatus().started,
      allowedByEnv: isSchedulerAllowedByEnv(),
      inProcessCronDisabled: process.env.DISABLE_INPROCESS_CRON === '1',
      nodeEnv: process.env.NODE_ENV || 'unset',
      lastDispatchAt: getSchedulerStatus().lastDispatchAt,
    },
    database: {
      connected: false,
      tablesExist: false,
    },
  };

  if (!health.observability.ok && health.status !== 'error') {
    health.status = 'warning';
    health.message = health.observability.alerts[0] || 'Production observability reported warnings';
  }

  if (!health.swissEphemeris.ok) {
    health.status = process.env.NODE_ENV === 'production' ? 'error' : 'warning';
    health.message = health.swissEphemeris.message || 'Swiss Ephemeris is unavailable';
  }

  // Check DATABASE_URL configuration
  if (!DATABASE_URL) {
    return res.status(200).json({
      ...health,
      status: health.status === 'error' ? 'error' : 'warning',
      message: health.message || 'DATABASE_URL is not configured',
    });
  }

  // Test database connection
  let pool: Pool | null = null;
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    await pool.query('SELECT 1');
    health.database.connected = true;

    // Check if migrations have been run (check for users table)
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      health.database.tablesExist = tableCheck.rows[0].exists;
      
      if (!health.database.tablesExist) {
        if (health.status !== 'error') {
          health.status = 'warning';
          health.message = 'Database connected but migrations have not been run. Tables do not exist.';
        }
      }
    } catch (tableError: any) {
      console.error('[Health] Table check failed:', tableError.message);
      health.database.tablesExist = false;
      if (health.status !== 'error') {
        health.status = 'warning';
        health.message = 'Could not verify tables exist';
      }
    }

    return res.status(health.status === 'error' ? 503 : 200).json(health);
  } catch (error: any) {
    console.error('[Health] Database connection failed:', error.message);
    return res.status(503).json({
      ...health,
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
    });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
