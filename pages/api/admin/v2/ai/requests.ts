import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { getAdminContext, roleHasPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const ctx = await getAdminContext(req);
    if (!roleHasPermission(ctx.role, 'ai.view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'ai.view permission required' });
    }

    const {
      page = '1',
      pageSize = '30',
      scenario,
      status,
      model,
      userId,
      traceId,
    } = req.query;

    const pageNum = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(pageSize), 10) || 30));
    const offset = (pageNum - 1) * limit;

    const where: string[] = [];
    const vals: any[] = [];

    if (scenario && typeof scenario === 'string' && scenario !== 'all') {
      vals.push(scenario);
      where.push(`scenario = $${vals.length}`);
    }
    if (status && typeof status === 'string' && status !== 'all') {
      vals.push(status);
      where.push(`status = $${vals.length}`);
    }
    if (model && typeof model === 'string' && model !== 'all') {
      vals.push(model);
      where.push(`model = $${vals.length}`);
    }
    if (userId && typeof userId === 'string' && userId.trim()) {
      vals.push(userId.trim());
      where.push(`user_id = $${vals.length}`);
    }
    if (traceId && typeof traceId === 'string' && traceId.trim()) {
      vals.push(traceId.trim());
      where.push(`trace_id = $${vals.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const pool = getPool();

    const [countResult, listResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as total FROM app_ai_requests ${whereClause}`, vals),
      pool.query(`
        SELECT
          r.id, r.trace_id, r.user_id, r.scenario, r.model, r.provider,
          r.status, r.duration_ms, r.latency_breakdown_json,
          r.tokens_prompt, r.tokens_completion, r.cost_estimated_cents,
          r.input_safe_json, r.output_text, r.error_code, r.rejection_reason,
          r.created_at, u.name as user_name
        FROM app_ai_requests r
        LEFT JOIN users u ON u.id = r.user_id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}
      `, [...vals, limit, offset]),
    ]);

    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      requests: listResult.rows.map((row) => ({
        id: Number(row.id),
        traceId: row.trace_id,
        userId: row.user_id ? String(row.user_id) : null,
        userName: row.user_name || null,
        scenario: row.scenario,
        model: row.model,
        provider: row.provider,
        status: row.status,
        durationMs: Number(row.duration_ms),
        latencyBreakdown: row.latency_breakdown_json || null,
        tokensPrompt: row.tokens_prompt ? Number(row.tokens_prompt) : null,
        tokensCompletion: row.tokens_completion ? Number(row.tokens_completion) : null,
        costEstimatedCents: row.cost_estimated_cents ? Number(row.cost_estimated_cents) : null,
        inputSafe: row.input_safe_json || null,
        outputText: row.output_text || null,
        errorCode: row.error_code || null,
        rejectionReason: row.rejection_reason || null,
        createdAt: row.created_at,
      })),
      pagination: {
        page: pageNum,
        pageSize: limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
