import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import {
  MODEL_SLOT_SETTING_KEYS,
  setModelForSlot,
  type ModelSlot,
} from '../../../../../lib/appSettings';
import { normalizeInterpretationModelId } from '../../../../../lib/openai-models';

/**
 * Смена единой модели генерации через совместимые слоты fast/main/deep:
 * пишет одно значение в app_settings
 * и сбрасывает кэш — новое значение подхватывается на лету, без редеплоя. Право — ai.edit.
 * model валидируется по курируемому списку (normalizeInterpretationModelId): случайный/битый id
 * сюда не пройдёт, чтобы не сломать живую генерацию у всех (для проверки нового id есть пинг).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    const ctx = await requireAdminPermission(req, 'ai.edit');

    const slot = String(req.body?.slot || '').trim() as ModelSlot;
    if (!(slot in MODEL_SLOT_SETTING_KEYS)) {
      throw new AdminAuthError(400, 'BAD_SLOT', 'slot must be one of fast, main, deep');
    }
    const model = normalizeInterpretationModelId(req.body?.model);
    if (!model) {
      throw new AdminAuthError(400, 'BAD_MODEL', 'model must be a known model id from the curated list');
    }

    await setModelForSlot(slot, model);
    await recordAdminAction({
      req,
      actor: ctx,
      action: 'settings_changed',
      entityType: 'app_setting',
      entityId: MODEL_SLOT_SETTING_KEYS[slot],
      after: { slot, model },
    });

    return res.status(200).json({ ok: true, slot, model });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
