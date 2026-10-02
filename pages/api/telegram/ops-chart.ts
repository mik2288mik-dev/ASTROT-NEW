import type { NextApiRequest, NextApiResponse } from 'next';
import { renderNeboChartPng, verifyNeboChart } from '../../../lib/neboOpsChart';
import { collectNeboDailySeries } from '../../../lib/neboOpsStats';
import { forwardNeboOpsRequest } from '../../../lib/neboOpsWebhook';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (await forwardNeboOpsRequest(req, res)) return;
  const days = Number(req.query.days);
  const stamp = String(req.query.t || '');
  const signature = String(req.query.sig || '');
  if (![7, 14, 30].includes(days) || !/^\d{1,12}$/.test(stamp) || !verifyNeboChart(days, stamp, signature)) {
    return res.status(404).end();
  }
  try {
    const points = await collectNeboDailySeries(days);
    const png = await renderNeboChartPng(points, `NEBO · последние ${days} дней`);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(png);
  } catch {
    return res.status(503).end();
  }
}
