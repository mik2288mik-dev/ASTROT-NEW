import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getAiContentHealth, pingAiGeneration } from '../../../../../lib/aiHealth';
import type { AiContentModelTier } from '../../../../../lib/contentMatrix';

/**
 * Здоровье генерации контента: есть ли OPENAI_API_KEY, какие модели по тирам, и (POST) живой пинг
 * генерации, доказывающий, что AI реально отвечает в проде. Отвечает на «проверь все тексты
 * генерации» — видно, персонализируется контент моделью или падает в курируемый фолбэк.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await requireAdminPermission(req, 'analytics.view');
      const health = await getAiContentHealth();
      return res.status(200).json({ ok: true, healthy: health.problems.length === 0, ...health });
    }

    if (req.method === 'POST') {
      await requireAdminPermission(req, 'analytics.view');
      const tierRaw = String(req.body?.tier || 'main');
      const tier: AiContentModelTier = tierRaw === 'fast' || tierRaw === 'deep' ? tierRaw : 'main';
      // Необязательный явный id модели: пинг проверяет доступность именно его (для проверки
      // ещё не подключённых моделей вроде gpt-5.4 до установки в env). Пустой → пинг по тиру.
      const explicitModel = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
      const result = await pingAiGeneration(tier, explicitModel || undefined);
      return res.status(200).json({ ok: true, result });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
