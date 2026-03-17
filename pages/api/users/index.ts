import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error: 'DEPRECATED_ROUTE',
    message: 'Use authenticated /api/admin/users endpoints for admin access.',
  });
}
