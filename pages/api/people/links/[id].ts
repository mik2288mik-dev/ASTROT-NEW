import type { NextApiRequest, NextApiResponse } from 'next';
import { getLinkedPerson, unlink, updateMemberSettings } from '../../../../lib/people/service';
import { readLinkId, requireLinkableUser, sendPeopleError } from '../../../../lib/people/http';

function readManualChartId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^[1-9]\d{0,17}$/.test(value)) return value;
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireLinkableUser(req);
    const id = readLinkId(req.query.id);
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ person: await getLinkedPerson(auth.userId, id) });
    }
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const manualChartId = readManualChartId(body.manualChartId);
      await updateMemberSettings(auth.userId, id, {
        ...(typeof body.shareBirthday === 'boolean' ? { shareBirthday: body.shareBirthday } : {}),
        ...(manualChartId !== undefined ? { manualChartId } : {}),
      });
      return res.status(200).json({ person: await getLinkedPerson(auth.userId, id) });
    }
    if (req.method === 'DELETE') {
      await unlink(auth.userId, id);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return sendPeopleError(res, error);
  }
}
