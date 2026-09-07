import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../../../lib/db';
import { handleAdminError } from '../../../lib/adminAuth';
import { requireDesignPreviewAdmin } from '../../../lib/neboDesign/adminAccess';
import { defaultDesignPreference, mergeDesignPatch, parseDesignPatch, sanitizeDesignPreference } from '../../../lib/neboDesign/contract';
export const config = { api: { bodyParser: { sizeLimit: '12kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Authorization, Cookie, x-telegram-init-data');
  if (req.method !== 'GET' && req.method !== 'PATCH') { res.setHeader('Allow', 'GET, PATCH'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
  try {
    const userId = await requireDesignPreviewAdmin(req);
    if (req.method === 'GET') {
      const result = await getPool().query('SELECT preferences, revision FROM user_design_preferences WHERE user_id = $1', [userId]);
      const row = result.rows[0];
      const preference = row ? sanitizeDesignPreference({ ...row.preferences, revision: row.revision }) : defaultDesignPreference();
      return res.status(200).json({ eligible: true, preference });
    }
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return res.status(415).json({ code: 'JSON_REQUIRED' });
    let patch;
    try { patch = parseDesignPatch(req.body); } catch { return res.status(400).json({ code: 'INVALID_DESIGN_PATCH' }); }
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO user_design_preferences(user_id, preferences) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING`, [userId, JSON.stringify(defaultDesignPreference())]);
      const result = await client.query('SELECT preferences, revision FROM user_design_preferences WHERE user_id = $1 FOR UPDATE', [userId]);
      const row = result.rows[0];
      const current = sanitizeDesignPreference({ ...row.preferences, revision: row.revision });
      if (current.revision !== patch.expectedRevision) { await client.query('ROLLBACK'); return res.status(409).json({ eligible: true, code: 'DESIGN_REVISION_CONFLICT', preference: current }); }
      const preference = mergeDesignPatch(current, patch);
      await client.query(`UPDATE user_design_preferences SET preferences = $2::jsonb, revision = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId, JSON.stringify(preference), preference.revision]);
      await client.query('COMMIT');
      return res.status(200).json({ eligible: true, preference });
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); }
  } catch (error) {
    if ((error as { code?: string })?.code === '42P01') return res.status(503).json({ code: 'DESIGN_MIGRATION_REQUIRED' });
    return handleAdminError(res, error);
  }
}
