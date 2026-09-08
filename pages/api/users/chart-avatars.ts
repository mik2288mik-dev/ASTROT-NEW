import type { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import { getPool } from '../../../lib/db';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { AdminAuthError, getVerifiedTelegramUser, handleAdminError } from '../../../lib/adminAuth';
import { isAvatarSubjectKey, parseChartAvatarChoice } from '../../../lib/chartAvatar';
import { checkRateLimit } from '../../../lib/rateLimit';

export const config = { api: { bodyParser: { sizeLimit: '220kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'PATCH'].includes(req.method || '')) { res.setHeader('Allow', 'GET, PATCH'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
  try {
    const { userId } = await requireAppUser(req, { allowGuest: true });
    let telegramUrl: string | null = null;
    if (req.headers['x-telegram-init-data']) {
      const verified = getVerifiedTelegramUser(req);
      const url = verified?.rawUser?.photo_url;
      if (typeof url === 'string' && url.startsWith('https://') && url.length < 2048) telegramUrl = url;
    }
    if (req.method === 'GET') {
      const result = await getPool().query('SELECT subject_key, avatar FROM user_chart_avatars WHERE user_id=$1', [userId]);
      return res.status(200).json({ avatars: Object.fromEntries(result.rows.map(row => [row.subject_key, row.avatar])), telegramUrl });
    }
    if (!checkRateLimit(userId, { name: 'chart-avatar-write', windowMs: 60000, maxRequests: 30 }).allowed) return res.status(429).json({ code: 'RATE_LIMITED' });
    const subjectKey = req.body?.subjectKey;
    let avatar = parseChartAvatarChoice(req.body?.avatar);
    if (!isAvatarSubjectKey(subjectKey) || !avatar) return res.status(400).json({ code: 'INVALID_AVATAR' });
    if (subjectKey !== 'self') {
      const chart = await getPool().query('SELECT id FROM natal_charts WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [subjectKey.slice(6), userId]);
      if (!chart.rows.length) return res.status(404).json({ code: 'CHART_NOT_FOUND' });
    }
    if (avatar.kind === 'telegram' && (subjectKey !== 'self' || !telegramUrl)) return res.status(400).json({ code: 'TELEGRAM_PHOTO_UNAVAILABLE' });
    if (avatar.kind === 'photo') {
      try {
        const data = await sharp(Buffer.from(avatar.dataUrl.split(',')[1], 'base64'), { limitInputPixels: 16000000 }).rotate().resize(256, 256, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
        avatar = { kind: 'photo', dataUrl: `data:image/jpeg;base64,${data.toString('base64')}` };
      } catch { return res.status(400).json({ code: 'INVALID_PHOTO' }); }
    }
    await getPool().query(`INSERT INTO user_chart_avatars(user_id,subject_key,avatar) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(user_id,subject_key) DO UPDATE SET avatar=EXCLUDED.avatar,updated_at=NOW()`, [userId, subjectKey, JSON.stringify(avatar)]);
    return res.status(200).json({ avatar, telegramUrl });
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    return res.status(503).json({ code: 'AVATAR_UNAVAILABLE' });
  }
}
