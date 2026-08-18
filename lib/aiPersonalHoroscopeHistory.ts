import { getPool } from './db';
import {
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  type AiPersonalHoroscopeHistoryItem,
  type AiPersonalHoroscopePeriod,
} from './aiPersonalHoroscope';

function readObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return readObject(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readHistoryItem(value: unknown): AiPersonalHoroscopeHistoryItem | null {
  const content = readObject(value);
  if (!content) return null;
  const period = content.period;
  if (period !== 'day' && period !== 'week' && period !== 'month') return null;
  const reading = readObject(content.reading);
  if (!reading) return null;
  const opening = typeof reading.opening === 'string' ? reading.opening.trim() : '';
  const forecast = typeof reading.forecast === 'string' ? reading.forecast.trim() : '';
  const advice = Array.isArray(reading.advice)
    ? reading.advice
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  if (!opening || !forecast || advice.length === 0) return null;

  const periodKey = typeof content.periodKey === 'string' ? content.periodKey.trim() : '';
  const currentDate = typeof content.currentDate === 'string'
    ? content.currentDate.trim()
    : typeof content.periodStart === 'string'
      ? content.periodStart.trim()
      : '';
  if (!periodKey || !currentDate) return null;

  return {
    period: period as AiPersonalHoroscopePeriod,
    periodKey,
    currentDate,
    opening,
    forecast,
    advice,
  };
}

export async function loadPreviousAiPersonalHoroscopes(
  userId: string,
  limit = 15,
): Promise<AiPersonalHoroscopeHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(15, Math.floor(limit)));
  try {
    const result = await getPool().query(
      `SELECT content
       FROM content_interpretations
       WHERE user_id = $1
         AND access_tier = 'premium'
         AND content_surface = 'forecast'
         AND content_variant IN ('daily', 'weekly', 'monthly')
         AND chart_id IS NULL
         AND prompt_version = $2
       ORDER BY updated_at DESC
       LIMIT $3`,
      [String(userId), AI_PERSONAL_HOROSCOPE_PROMPT_VERSION, safeLimit],
    );
    return result.rows
      .map((row: { content?: unknown }) => readHistoryItem(row.content))
      .filter((item): item is AiPersonalHoroscopeHistoryItem => !!item)
      .slice(0, safeLimit);
  } catch (error) {
    console.warn(
      '[ai-personal-horoscope] previous forecast history unavailable; continuing without it:',
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}
