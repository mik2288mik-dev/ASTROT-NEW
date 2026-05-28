import type { TodayAssistantHomeResult } from '../types';

export function shouldShowTodayAssistantFirst(result: TodayAssistantHomeResult | null | undefined) {
  if (!result || result.status !== 'ready') return false;

  if (result.dayMode === 'evening') {
    return result.checkIn.status === 'open';
  }

  return false;
}
