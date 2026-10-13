import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../lib/admin/rbac';
import { withAdminSource } from '../../../../lib/admin/dataSource';
import { getPool } from '../../../../lib/db';
import { collectVersions, moscowDaysBack } from '../../../../lib/productMetrics';

/** «Ошибки и версии»: who is on which app version and on which phones (last 30 days). */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'analytics.view');
    const now = new Date();
    const since = moscowDaysBack(now, 29).toISOString();
    const [versions, devices, aiFailures] = await Promise.all([
      collectVersions(now),
      getPool().query(
        `SELECT label, COUNT(*)::int AS count FROM (
           SELECT DISTINCT ON (o.user_id) o.user_id,
                  TRIM(CONCAT_WS(' ', NULLIF(o.payload_json->>'deviceManufacturer', ''), NULLIF(o.payload_json->>'deviceModel', ''),
                    CASE WHEN o.payload_json ? 'osVersion' THEN '· ' || COALESCE(o.payload_json->>'osName', '') || ' ' || (o.payload_json->>'osVersion') END)) AS label
           FROM nebo_ops_outbox o
           WHERE o.payload_json ? 'deviceModel' AND o.occurred_at >= $1::timestamptz
           ORDER BY o.user_id, o.occurred_at DESC
         ) latest GROUP BY label ORDER BY count DESC LIMIT 15`, [since],
      ),
      getPool().query(
        `SELECT scenario, error_code, COUNT(*)::int AS count, MAX(created_at) AS last_at
         FROM app_ai_requests WHERE status <> 'success' AND scenario <> 'content_diagnostic' AND created_at >= $1::timestamptz
         GROUP BY 1, 2 ORDER BY count DESC LIMIT 20`, [since],
      ).catch(() => ({ rows: [] as any[] })),
    ]);
    return res.status(200).json({
      versions,
      devices: devices.rows.map((row) => ({ label: String(row.label || 'Не известно'), count: Number(row.count) })),
      aiFailures: aiFailures.rows.map((row) => ({ scenario: String(row.scenario), errorCode: row.error_code || null,
        count: Number(row.count), lastAt: row.last_at })),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}

export default withAdminSource(handler);
