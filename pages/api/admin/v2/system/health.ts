import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { getAdminContext, roleHasPermission } from '../../../../lib/admin/rbac';
import { getPool } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const ctx = await getAdminContext(req);
    if (!roleHasPermission(ctx.role, 'settings.manage') && !roleHasPermission(ctx.role, 'audit.view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'settings.manage or audit.view permission required' });
    }

    const pool = getPool();

    // 1. DB ping & latency
    const dbPingStart = Date.now();
    let dbStatus = 'ok';
    let dbLatencyMs = 0;
    try {
      await pool.query('SELECT 1');
      dbLatencyMs = Date.now() - dbPingStart;
    } catch (e: any) {
      dbStatus = 'error';
      dbLatencyMs = Date.now() - dbPingStart;
    }

    // 2. Pool statistics
    const totalCount = pool.totalCount;
    const idleCount = pool.idleCount;
    const waitingCount = pool.waitingCount;

    // 3. Queue counts
    const [queueRes, outboxRes, recentErrorsRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
          COUNT(*) FILTER (WHERE status = 'failed')::int as failed
        FROM notification_queue
      `).catch(() => ({ rows: [{ pending: 0, failed: 0 }] })),

      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
          COUNT(*) FILTER (WHERE status = 'failed')::int as failed
        FROM nebo_ops_outbox
      `).catch(() => ({ rows: [{ pending: 0, failed: 0 }] })),

      pool.query(`
        SELECT COUNT(*)::int as count_1h
        FROM app_technical_errors
        WHERE last_seen_at >= NOW() - INTERVAL '1 hour'
      `).catch(() => ({ rows: [{ count_1h: 0 }] })),
    ]);

    const notifPending = queueRes.rows[0]?.pending || 0;
    const notifFailed = queueRes.rows[0]?.failed || 0;
    const opsPending = outboxRes.rows[0]?.pending || 0;
    const opsFailed = outboxRes.rows[0]?.failed || 0;
    const errorsLast1h = recentErrorsRes.rows[0]?.count_1h || 0;

    // 4. Provider configs
    const providers = {
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        model: 'gpt-5.6-luna',
      },
      deepseek: {
        configured: Boolean(process.env.DEEPSEEK_API_KEY),
        model: 'deepseek-chat',
      },
      telegramBot: {
        configured: Boolean(process.env.BOT_TOKEN),
      },
      telegramOps: {
        configured: Boolean(process.env.NEBO_OPS_BOT_TOKEN || process.env.NEBO_ANALYTICS_BOT_TOKEN),
        enabled: process.env.NEBO_OPS_TELEGRAM_ENABLED === '1',
      },
      rustorePay: {
        configured: Boolean(process.env.RUSTORE_APPLICATION_ID && process.env.RUSTORE_PRIVATE_KEY),
      },
    };

    // 5. System metrics
    const memory = process.memoryUsage();
    const system = {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      rssMb: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
      env: process.env.NODE_ENV || 'development',
    };

    return res.status(200).json({
      healthy: dbStatus === 'ok' && errorsLast1h < 50,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        pool: {
          total: totalCount,
          idle: idleCount,
          waiting: waitingCount,
        },
      },
      queues: {
        notifications: { pending: notifPending, failed: notifFailed },
        opsOutbox: { pending: opsPending, failed: opsFailed },
      },
      errorsLast1h,
      providers,
      system,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
