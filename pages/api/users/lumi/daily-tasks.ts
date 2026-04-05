import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';

const TASK_KEYS = new Set(['open_horoscope', 'open_chart']);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string;
  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    if (req.method === 'GET') {
      const status = await db.daily_task_completions.getStatus(userId.trim());
      return res.status(200).json(status);
    }

    if (req.method === 'POST') {
      const taskKey = String(req.body?.taskKey || '').trim();
      if (!TASK_KEYS.has(taskKey)) {
        return res.status(400).json({ error: 'taskKey is invalid' });
      }

      const result = await db.daily_task_completions.complete(
        userId.trim(),
        taskKey as 'open_horoscope' | 'open_chart'
      );
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error?.message === 'User not found') {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: error.message });
    }
    if (error?.code === 'INVALID_TASK_KEY') {
      return res.status(400).json({ error: 'INVALID_TASK_KEY', message: error.message });
    }
    console.error('[API/users/lumi/daily-tasks]', error?.message);
    return res.status(500).json({ error: 'DAILY_TASKS_FAILED', message: error?.message || 'Failed' });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.LUMI_ACTION);
