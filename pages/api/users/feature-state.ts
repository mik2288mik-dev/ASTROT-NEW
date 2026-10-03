import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import {
  isUserFeature,
  isUserFeatureKey,
  readUserFeatureState,
  USER_FEATURE_VALUE_MAX_BYTES,
  writeUserFeatureState,
} from '../../../lib/userFeatureState';

export const config = { api: { bodyParser: { sizeLimit: '12kb' } } };

/**
 * GET ?feature=wishes → { items: { [key]: value } }
 * PUT { feature, key, value } → stores one record; value null deletes it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Authorization, Cookie, x-telegram-init-data');
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const user = await requireAppUser(req, { allowGuest: true });
    const userId = String(user.userId);
    if (req.method === 'GET') {
      const feature = typeof req.query.feature === 'string' ? req.query.feature : '';
      if (!isUserFeature(feature)) return res.status(400).json({ code: 'FEATURE_INVALID' });
      return res.status(200).json({ items: await readUserFeatureState(userId, feature) });
    }
    const { feature, key, value } = (req.body || {}) as { feature?: unknown; key?: unknown; value?: unknown };
    if (!isUserFeature(feature)) return res.status(400).json({ code: 'FEATURE_INVALID' });
    if (!isUserFeatureKey(key)) return res.status(400).json({ code: 'KEY_INVALID' });
    if (value === undefined) return res.status(400).json({ code: 'VALUE_REQUIRED' });
    if (value !== null && Buffer.byteLength(JSON.stringify(value), 'utf8') > USER_FEATURE_VALUE_MAX_BYTES) {
      return res.status(413).json({ code: 'VALUE_TOO_LARGE' });
    }
    await writeUserFeatureState(userId, feature, key, value);
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ code: status >= 500 ? 'FEATURE_STATE_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
