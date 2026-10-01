import type { NextApiRequest, NextApiResponse } from 'next';
import type { PoolClient } from 'pg';
import { getPool } from '../../../lib/db';
import { isCanonicalNatalChartDataComplete } from '../../../lib/natalChartCanonical';
import { isNatalUnifiedReading, NATAL_COPY_REVISION } from '../../../lib/natalReading/unifiedReading';

// Read-only data for the existing localhost preview. Never available in a deployed build.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host;
  let localHost = false;
  try { localHost = !!host && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(`http://${host}`).hostname); } catch { /* Reject malformed hosts. */ }
  if (process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_UI_PREVIEW !== '1' || !localHost) {
    return res.status(404).end();
  }
  if (req.method !== 'GET') return res.status(405).end();
  if (req.headers.origin && req.headers.origin !== `http://${host}`) return res.status(403).end();
  res.setHeader('Cache-Control', 'no-store');
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query('BEGIN READ ONLY');
    const admins = await client.query('SELECT id, name, gender FROM users WHERE is_admin=true ORDER BY id');
    const owner = typeof req.query.owner === 'string'
      ? admins.rows.find(admin => String(admin.id) === req.query.owner)
      : admins.rows.length === 1 ? admins.rows[0] : null;
    if (!owner) return res.status(409).json({ error: 'Выбери владельца карт.' });
    const result = await client.query(`
      SELECT nc.id, nc.name, nc.birth_date, nc.birth_time, nc.birth_place,
             nc.is_primary, nc.subject_type, nc.chart_data, saved.content, saved.updated_at
      FROM natal_charts nc
      LEFT JOIN LATERAL (
        SELECT content, updated_at FROM content_interpretations
        WHERE chart_id=nc.id AND user_id=nc.user_id AND access_tier='premium'
          AND content_surface='natal' AND content_variant='full'
          AND cache_key LIKE 'natal.unified-reading.v3%'
        ORDER BY (content->>'copyRevision'=$2) DESC NULLS LAST, updated_at DESC, id DESC LIMIT 1
      ) saved ON true
      WHERE nc.user_id=$1 AND nc.archived_at IS NULL
      ORDER BY nc.is_primary DESC, nc.id`, [String(owner.id), NATAL_COPY_REVISION]);
    const people = result.rows.map(row => {
      if (!isCanonicalNatalChartDataComplete(row.chart_data)) throw new Error('Incomplete saved chart');
      return {
        id: `chart-${row.id}`, chartId: Number(row.id), isPrimary: row.is_primary,
        subjectType: row.subject_type === 'self' ? 'self' : 'saved_person',
        profile: { name: row.name || owner.name, birthDate: String(row.birth_date).slice(0, 10),
          birthTime: row.birth_time || '', birthPlace: row.birth_place,
          gender: row.subject_type === 'self' ? owner.gender || 'unspecified' : 'unspecified' },
        chart: row.chart_data,
        reading: isNatalUnifiedReading(row.content) ? row.content : null,
        savedAt: row.updated_at,
      };
    });
    return res.status(200).json({ source: 'configured-database', people });
  } catch {
    return res.status(500).json({ error: 'Не получилось загрузить сохранённые карты из базы.' });
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
  }
}
