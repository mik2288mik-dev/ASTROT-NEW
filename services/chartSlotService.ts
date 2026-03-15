/**
 * Chart slot purchase - Lumia MVP
 */

import { db } from '../lib/db';

const CHART_SLOT_COST = 50;

const log = {
  info: (msg: string, data?: any) => console.log(`[ChartSlotService] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[ChartSlotService] ERROR: ${msg}`, err || ''),
};

export async function buyChartSlot(userId: string): Promise<{
  success: true;
  newBalance: number;
  chartSlots: number;
}> {
  if (!userId?.trim()) throw new Error('UserId is required');
  const result = await db.users.buyChartSlot(userId, CHART_SLOT_COST);
  log.info('buyChartSlot', { userId, chartSlots: result.chartSlots, newBalance: result.newBalance });
  return result;
}

export function getChartSlotCost(): number {
  return CHART_SLOT_COST;
}
