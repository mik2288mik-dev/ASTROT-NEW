import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import {
  APP_ENTRY_ANNOUNCEMENT_FLAG,
  readAppEntryAnnouncement,
} from '../../../lib/appEntryAnnouncement';
import { getFlag } from '../../../lib/admin/featureFlags';

/** The app reads this only after authentication; it never exposes admin settings. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    await requireAppUser(req, { allowGuest: true });
    const value = await getFlag<unknown>(APP_ENTRY_ANNOUNCEMENT_FLAG, null);
    return res.status(200).json({ announcement: readAppEntryAnnouncement(value) });
  } catch {
    return res.status(401).json({ error: 'APP_AUTH_REQUIRED' });
  }
}

