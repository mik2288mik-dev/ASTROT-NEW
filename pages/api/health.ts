import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveDatabaseUrl } from '../../lib/database-url';
import { getSwissEphemerisHealth } from '../../lib/swisseph-calculator';
import { getDailyAstroSignalMetricsSnapshot } from '../../lib/dailyAstroSignal';
import { getProductionObservabilitySnapshot } from '../../lib/productionObservability';
import { ensureNotificationScheduler, getSchedulerStatus, isSchedulerAllowedByEnv } from '../../lib/notificationScheduler';

/**
 * Health check endpoint for Railway deployment monitoring
 * Returns status of app and database connectivity
 */
import { Pool } from 'pg';

const DATABASE_URL = resolveDatabaseUrl();

/**
 * Railway liveness endpoint.
 *
 * This must answer whether the HTTP server is alive. Dependency diagnostics stay
 * visible in the JSON payload, but optional or temporarily unavailable
 * subsystems must not make deployment liveness fail.
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

  const warnings: string[] = [];
  const markWarning = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };

  const health: any = {
    status: 'ok',
    liveness: {
      ok: true,
      message: 'HTTP server is responding',
    },
    timestamp: new Date().toISOString(),
    swissEphemeris: getSwissEphemerisHealth(),
    calculationMetrics: {
      dailyAstroSignalSources: getDailyAstroSignalMetricsSnapshot(),
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

  if (!health.observability.ok) {
    markWarning(health.observability.alerts[0] || 'Production observability reported warnings');
  }

  if (!health.swissEphemeris.ok) {
    markWarning(health.swissEphemeris.message || 'Swiss Ephemeris is unavailable');
  }

  // Check DATABASE_URL configuration
  if (!DATABASE_URL) {
    markWarning('DATABASE_URL is not configured');
    health.status = 'warning';
    health.message = warnings[0];
    health.warnings = warnings;
    return res.status(200).json({
      ...health,
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
        markWarning('Database connected but migrations have not been run. Tables do not exist.');
      }
    } catch (tableError: any) {
      console.error('[Health] Table check failed:', tableError.message);
      health.database.tablesExist = false;
      markWarning('Could not verify tables exist');
    }

    if (warnings.length) {
      health.status = 'warning';
      health.message = warnings[0];
      health.warnings = warnings;
    }

    return res.status(200).json(health);
  } catch (error: any) {
    console.error('[Health] Database connection failed:', error.message);
    markWarning('Database connection failed');
    health.status = 'warning';
    health.message = warnings[0];
    health.warnings = warnings;
    health.database.error = error.message;
    return res.status(200).json({
      ...health,
    });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
