import { getPool } from './db';

export type AiPersonalHoroscopeDialogueMemory = {
  question: string;
  answer: string;
  answeredAt: string | null;
};

function compact(value: unknown, maxLength: number): string {
  return String(value || '')
    .trim()
    .replace(/\s+/gu, ' ')
    .slice(0, maxLength);
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/**
 * The personal horoscope may continue a real in-app conversation, but it must
 * not invent personal facts. Only already answered user questions are passed
 * as compact private context. A missing table or offline database never blocks
 * the horoscope itself.
 */
export async function loadAiPersonalHoroscopeDialogueMemory(
  userId: string,
  limit = 6,
): Promise<AiPersonalHoroscopeDialogueMemory[]> {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId || !process.env.DATABASE_URL) return [];
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit) || 6));

  try {
    const result = await getPool().query(
      `SELECT question_text, answer_text, answered_at
       FROM personal_forecast_questions
       WHERE user_id = $1
         AND status = 'answered'
         AND answer_text IS NOT NULL
       ORDER BY answered_at DESC NULLS LAST, updated_at DESC
       LIMIT $2`,
      [safeUserId, safeLimit],
    );
    return result.rows.flatMap((row: any) => {
      const question = compact(row.question_text, 280);
      const answer = compact(row.answer_text, 520);
      if (!question || !answer) return [];
      return [{
        question,
        answer,
        answeredAt: iso(row.answered_at),
      }];
    });
  } catch (error) {
    console.warn(
      '[ai-personal-horoscope] dialogue memory unavailable; continuing without it:',
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}
