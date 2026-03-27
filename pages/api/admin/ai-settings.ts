import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../lib/adminAuth';
import { db } from '../../../lib/db';
import { invalidateInterpretationModelCache } from '../../../lib/appSettings';
import {
  INTERPRETATION_MODEL_OPTIONS,
  INTERPRETATION_MODEL_SETTING_KEY,
  normalizeInterpretationModelId,
  getInterpretationModelFromEnv,
} from '../../../lib/openai-models';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await requireAdminAccess(req);

    if (req.method === 'GET') {
      let stored: string | null = null;
      try {
        const row = await db.app_settings.get(INTERPRETATION_MODEL_SETTING_KEY);
        stored = normalizeInterpretationModelId(row?.value);
      } catch {
        stored = null;
      }
      const effective = stored || getInterpretationModelFromEnv();
      return res.status(200).json({
        modelId: effective,
        storedModelId: stored,
        envFallback: getInterpretationModelFromEnv(),
        options: INTERPRETATION_MODEL_OPTIONS,
      });
    }

    if (req.method === 'POST') {
      const raw = typeof req.body?.modelId === 'string' ? req.body.modelId.trim() : '';
      const modelId = normalizeInterpretationModelId(raw);
      if (!modelId) {
        return res.status(400).json({
          error: 'INVALID_MODEL',
          message: 'Invalid or unsupported model id',
        });
      }
      await db.app_settings.set(INTERPRETATION_MODEL_SETTING_KEY, modelId);
      invalidateInterpretationModelCache();
      return res.status(200).json({ success: true, modelId });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
